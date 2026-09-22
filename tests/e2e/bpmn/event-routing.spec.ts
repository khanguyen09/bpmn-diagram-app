import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import {
  createBpmnModelViaApi,
  findBpmnLauncherTool,
  readBpmnDraft,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Event Routing ";
const createdModelIds: string[] = [];
let durableEventRoutingModelId: string | undefined;

const catchingEventsXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_Event_Routing"
  targetNamespace="https://the-experience.blog/bpmn/event-routing">
  <bpmn:message id="Message_Editorial_Approval" name="Editorial approval" />
  <bpmn:process id="Process_Event_Routing" name="Event routing review" isExecutable="false">
    <bpmn:startEvent id="Start_Event_Routing" name="Review opened">
      <bpmn:outgoing>Flow_Start_Message</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:intermediateCatchEvent id="Catch_Message_Approval" name="Approval message">
      <bpmn:incoming>Flow_Start_Message</bpmn:incoming>
      <bpmn:outgoing>Flow_Message_Gateway</bpmn:outgoing>
      <bpmn:messageEventDefinition id="Definition_Message_Approval" messageRef="Message_Editorial_Approval" />
    </bpmn:intermediateCatchEvent>
    <bpmn:exclusiveGateway id="Gateway_Wait" name="Wait for response" default="Flow_Gateway_Receive">
      <bpmn:incoming>Flow_Message_Gateway</bpmn:incoming>
      <bpmn:outgoing>Flow_Gateway_Timer</bpmn:outgoing>
      <bpmn:outgoing>Flow_Gateway_Receive</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:intermediateCatchEvent id="Catch_Timer_Deadline" name="Review deadline">
      <bpmn:incoming>Flow_Gateway_Timer</bpmn:incoming>
      <bpmn:outgoing>Flow_Timer_End</bpmn:outgoing>
      <bpmn:timerEventDefinition id="Definition_Timer_Deadline">
        <bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT24H</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:intermediateCatchEvent>
    <bpmn:receiveTask id="Receive_Editorial_Response" name="Receive editorial response"
      instantiate="false" messageRef="Message_Editorial_Approval">
      <bpmn:incoming>Flow_Gateway_Receive</bpmn:incoming>
      <bpmn:outgoing>Flow_Receive_End</bpmn:outgoing>
    </bpmn:receiveTask>
    <bpmn:endEvent id="End_Event_Routing" name="Review completed">
      <bpmn:incoming>Flow_Timer_End</bpmn:incoming>
      <bpmn:incoming>Flow_Receive_End</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Start_Message" sourceRef="Start_Event_Routing" targetRef="Catch_Message_Approval" />
    <bpmn:sequenceFlow id="Flow_Message_Gateway" sourceRef="Catch_Message_Approval" targetRef="Gateway_Wait" />
    <bpmn:sequenceFlow id="Flow_Gateway_Timer" name="Deadline reached" sourceRef="Gateway_Wait" targetRef="Catch_Timer_Deadline">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">deadline reached</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Gateway_Receive" name="Response received" sourceRef="Gateway_Wait" targetRef="Receive_Editorial_Response" />
    <bpmn:sequenceFlow id="Flow_Timer_End" sourceRef="Catch_Timer_Deadline" targetRef="End_Event_Routing" />
    <bpmn:sequenceFlow id="Flow_Receive_End" sourceRef="Receive_Editorial_Response" targetRef="End_Event_Routing" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Event_Routing">
    <bpmndi:BPMNPlane id="Plane_Event_Routing" bpmnElement="Process_Event_Routing">
      <bpmndi:BPMNShape id="Shape_Start_Event_Routing" bpmnElement="Start_Event_Routing"><dc:Bounds x="90" y="212" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Catch_Message" bpmnElement="Catch_Message_Approval"><dc:Bounds x="180" y="212" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Gateway_Wait" bpmnElement="Gateway_Wait" isMarkerVisible="true"><dc:Bounds x="280" y="205" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Catch_Timer" bpmnElement="Catch_Timer_Deadline"><dc:Bounds x="410" y="132" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Receive_Response" bpmnElement="Receive_Editorial_Response"><dc:Bounds x="390" y="280" width="140" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_Event_Routing" bpmnElement="End_Event_Routing"><dc:Bounds x="620" y="212" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Start_Message" bpmnElement="Flow_Start_Message"><di:waypoint x="126" y="230" /><di:waypoint x="180" y="230" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Message_Gateway" bpmnElement="Flow_Message_Gateway"><di:waypoint x="216" y="230" /><di:waypoint x="280" y="230" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Gateway_Timer" bpmnElement="Flow_Gateway_Timer"><di:waypoint x="305" y="205" /><di:waypoint x="305" y="150" /><di:waypoint x="410" y="150" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Gateway_Receive" bpmnElement="Flow_Gateway_Receive"><di:waypoint x="305" y="255" /><di:waypoint x="305" y="320" /><di:waypoint x="390" y="320" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Timer_End" bpmnElement="Flow_Timer_End"><di:waypoint x="446" y="150" /><di:waypoint x="638" y="150" /><di:waypoint x="638" y="212" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Receive_End" bpmnElement="Flow_Receive_End"><di:waypoint x="530" y="320" /><di:waypoint x="638" y="320" /><di:waypoint x="638" y="248" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const eventRoutingXml = catchingEventsXml
  .replace(
    '<bpmn:exclusiveGateway id="Gateway_Wait" name="Wait for response" default="Flow_Gateway_Receive">',
    '<bpmn:eventBasedGateway id="Gateway_Wait" name="Wait for response" instantiate="false" eventGatewayType="Exclusive">',
  )
  .replace("</bpmn:exclusiveGateway>", "</bpmn:eventBasedGateway>")
  .replace(
    /<bpmn:sequenceFlow id="Flow_Gateway_Timer" name="Deadline reached" sourceRef="Gateway_Wait" targetRef="Catch_Timer_Deadline">\s*<bpmn:conditionExpression[^>]*>deadline reached<\/bpmn:conditionExpression>\s*<\/bpmn:sequenceFlow>/,
    '<bpmn:sequenceFlow id="Flow_Gateway_Timer" name="Deadline reached" sourceRef="Gateway_Wait" targetRef="Catch_Timer_Deadline" />',
  );

async function createConditionalModel(page: Page) {
  const created = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}${Date.now()}`,
    description: "Event Routing and semantic color browser proof",
    purpose: "TO_BE",
    profileId: "teb-core-conditional@1",
    xml: starterBpmnXml,
    idempotencyKey: `e2e-event-routing:${Date.now()}`,
  });
  createdModelIds.push(created.modelId);
  await page.goto(`/studio/diagram/${created.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

async function importXml(page: Page, xml: string, name: string) {
  const acknowledgement = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith("/draft"),
  );
  await page.getByLabel("Chọn tệp sơ đồ").setInputFiles({
    name,
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  expect((await acknowledgement).ok()).toBe(true);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

async function draft(page: Page, modelId: string) {
  const response = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    profileId: string;
    canonicalXml: string;
    revisionToken: string;
  };
}

async function versions(page: Page, modelId: string) {
  const response = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/versions`,
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()) as {
    versions: Array<{
      id: string;
      versionNumber: number;
      profileId: string;
      xmlChecksum: string;
    }>;
  }).versions;
}

async function selectOutlineItem(page: Page, name: string) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: name })
    .click();
  await openBpmnInspectorView(page, "edit");
}

async function openColorModes(page: Page) {
  await openBpmnInspectorView(page, "model");
  const summary = page
    .locator("details.bpmn-inspector-section > summary")
    .filter({ hasText: /^Cách hiển thị$/u })
    .first();
  const section = summary.locator("..");
  if ((await section.getAttribute("open")) === null) {
    await summary.click();
  }
  return section.getByRole("group", {
    name: "Cách hiển thị sơ đồ",
    exact: true,
  });
}

test.describe.serial("BPMN Event Routing and semantic colors", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("sequential ACK gates, event topology, immutable version and colors round-trip", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const modelId = await createConditionalModel(page);
    durableEventRoutingModelId = modelId;
    for (const [toolId, query] of [
      ["message-catch-event", "chờ thông điệp"],
      ["timer-catch-event", "chờ thời điểm"],
      ["receive-task", "nhận thông điệp"],
      ["event-based-gateway", "sự kiện đầu tiên"],
    ] as const) {
      await expect(
        await findBpmnLauncherTool(page, {
          toolId,
          query,
          preparation: "ordered-profile-ack",
        }),
      ).toBeEnabled();
    }
    await page.keyboard.press("Escape");

    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const beforeFirstCatchingEvent = await shapes.count();
    const firstCatchingEvent = await findBpmnLauncherTool(page, {
      toolId: "message-catch-event",
      query: "chờ thông điệp",
      preparation: "ordered-profile-ack",
    });
    await firstCatchingEvent.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await draft(page, modelId)).profileId)
      .toBe("teb-core-catching-events@1");
    await expect(shapes).toHaveCount(beforeFirstCatchingEvent + 1);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(shapes).toHaveCount(beforeFirstCatchingEvent);

    for (const [toolId, query] of [
      ["message-catch-event", "chờ thông điệp"],
      ["timer-catch-event", "chờ thời điểm"],
      ["receive-task", "nhận thông điệp"],
    ] as const) {
      const before = await shapes.count();
      const primitive = await findBpmnLauncherTool(page, {
        toolId,
        query,
        preparation: "none",
      });
      await primitive.focus();
      await page.keyboard.press("Enter");
      await expect(shapes).toHaveCount(before + 1);
      await page.getByRole("button", { name: "Hoàn tác" }).click();
      await expect(shapes).toHaveCount(before);
    }

    await importXml(page, catchingEventsXml, "catching-events.bpmn");
    const importedCatchingDraft = await draft(page, modelId);
    expect(importedCatchingDraft.profileId).toBe(
      "teb-core-catching-events@1",
    );
    expect(importedCatchingDraft.canonicalXml).toContain(
      '<bpmn:message id="Message_Editorial_Approval" name="Editorial approval" />',
    );
    expect(importedCatchingDraft.canonicalXml).toContain(
      'messageRef="Message_Editorial_Approval"',
    );
    expect(importedCatchingDraft.canonicalXml).toMatch(
      /<bpmn:timerEventDefinition id="Definition_Timer_Deadline">[\s\S]*?<bpmn:timeDuration[^>]*>PT24H<\/bpmn:timeDuration>/,
    );

    await selectOutlineItem(page, "Approval message");
    await expect(
      page
        .locator("#bpmn-message-property-title")
        .getByText("Chờ thông điệp", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "Thông điệp dùng chung" })
        .getByRole("radio", {
          name: /Editorial approval, đang dùng tại 2 nơi/,
        }),
    ).toBeChecked();

    await selectOutlineItem(page, "Receive editorial response");
    await expect(
      page.getByText("Công việc nhận thông điệp", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "Thông điệp dùng chung" })
        .getByRole("radio", {
          name: /Editorial approval, đang dùng tại 2 nơi/,
        }),
    ).toBeChecked();

    await selectOutlineItem(page, "Review deadline");
    const timerEditor = page.locator(".bpmn-event-property-editor");
    await expect(
      timerEditor.getByText("Chờ thời gian", { exact: true }),
    ).toBeVisible();
    await expect(
      timerEditor.getByRole("radio", { name: "Khoảng chờ" }),
    ).toBeChecked();
    const timerValue = timerEditor.getByLabel("Khoảng thời gian");
    await expect(timerValue).toHaveValue("PT24H");
    await timerValue.fill("PT48H");
    await timerValue.press("Escape");
    await expect(timerValue).toHaveValue("PT24H");
    await timerValue.fill("PT48H");
    await timerEditor
      .getByRole("button", { name: "Áp dụng thời gian" })
      .click();
    await expect(
      page.getByText("Đã áp dụng thời gian chờ. Có thể hoàn tác một lần.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(timerValue).toHaveValue("PT24H");
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(timerValue).toHaveValue("PT48H");
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain(">PT48H</bpmn:timeDuration>");
    const catchingDraft = await draft(page, modelId);

    await openBpmnInspectorView(page, "versions");
    await page
      .getByLabel("Ghi chú cho bản mới")
      .fill("Catching Events immutable checkpoint");
    await page.getByRole("button", { name: "Xác nhận lưu mốc" }).click();
    await expect(page.getByText(/Đã lưu mốc 1/)).toBeVisible({
      timeout: 15_000,
    });
    const catchingVersions = await versions(page, modelId);
    expect(catchingVersions).toHaveLength(1);
    expect(catchingVersions[0]).toMatchObject({
      versionNumber: 1,
      profileId: "teb-core-catching-events@1",
      xmlChecksum: createHash("sha256")
        .update(catchingDraft.canonicalXml)
        .digest("hex"),
    });

    const eventGateway = await findBpmnLauncherTool(page, {
      toolId: "event-based-gateway",
      query: "sự kiện đầu tiên",
      preparation: "ordered-profile-ack",
    });
    const beforeGateway = await shapes.count();
    await eventGateway.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await draft(page, modelId)).profileId)
      .toBe("teb-core-event-routing@1");
    await expect(shapes).toHaveCount(beforeGateway + 1);
    const createdGateway = page.locator(".bpmn-modeler .djs-shape.selected");
    const createdGatewayId = await createdGateway.getAttribute(
      "data-element-id",
    );
    expect(createdGatewayId).toBeTruthy();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(shapes).toHaveCount(beforeGateway);
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(shapes).toHaveCount(beforeGateway + 1);

    await selectOutlineItem(page, "Chờ sự kiện đầu tiên");
    const connections = page.locator(".bpmn-modeler .djs-connection");
    const beforeAtomicBranchShapes = await shapes.count();
    const beforeAtomicBranchConnections = await connections.count();
    await page
      .getByRole("group", { name: "Thêm bước tiếp theo" })
      .getByRole("button", { name: "Chờ thời điểm", exact: true })
      .click();
    await expect(shapes).toHaveCount(beforeAtomicBranchShapes + 1);
    await expect(connections).toHaveCount(beforeAtomicBranchConnections + 1);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(shapes).toHaveCount(beforeAtomicBranchShapes);
    await expect(connections).toHaveCount(beforeAtomicBranchConnections);
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(shapes).toHaveCount(beforeAtomicBranchShapes + 1);
    await expect(connections).toHaveCount(beforeAtomicBranchConnections + 1);

    await importXml(page, eventRoutingXml, "event-routing.bpmn");
    const routed = await draft(page, modelId);
    expect(routed.profileId).toBe("teb-core-event-routing@1");
    expect(routed.canonicalXml).toMatch(
      /<bpmn:eventBasedGateway[^>]+id="Gateway_Wait"/,
    );
    expect(routed.canonicalXml).not.toMatch(
      /<bpmn:eventBasedGateway[^>]+(?:instantiate="true"|eventGatewayType="Parallel")/,
    );
    expect(routed.canonicalXml).toContain(
      'sourceRef="Gateway_Wait" targetRef="Catch_Timer_Deadline"',
    );
    expect(routed.canonicalXml).toContain(
      'sourceRef="Gateway_Wait" targetRef="Receive_Editorial_Response"',
    );
    expect(routed.canonicalXml).not.toContain("deadline reached</bpmn:conditionExpression>");

    await page.reload();
    expect((await readBpmnDraft(page, modelId)).profileId).toBe(
      "teb-core-event-routing@1",
    );
    for (const id of [
      "Catch_Message_Approval",
      "Catch_Timer_Deadline",
      "Receive_Editorial_Response",
      "Gateway_Wait",
    ]) {
      await expect(
        page.locator(`.bpmn-modeler .djs-shape[data-element-id="${id}"]`),
      ).toHaveCount(1);
    }

    const beforeColorDraft = await draft(page, modelId);
    const beforeColorVersions = await versions(page, modelId);
    const mutationRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() !== "GET" &&
        request.url().includes(`/process-models/${modelId}`)
      ) {
        mutationRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    const colorModes = await openColorModes(page);
    await colorModes.getByRole("radio", { name: /^Màu theo nhóm/ }).check();
    await expect(
      page.locator(".bpmn-studio__canvas-region"),
    ).toHaveAttribute("data-bpmn-color-mode", "SEMANTIC");
    const colorLegend = page.locator(".bpmn-semantic-legend");
    await expect(colorLegend).toContainText(
      "Sự kiện",
    );
    await colorModes.getByRole("radio", { name: /^Tương phản cao/ }).check();
    await expect(
      page.locator(".bpmn-studio__canvas-region"),
    ).toHaveAttribute("data-bpmn-color-mode", "HIGH_CONTRAST");
    await expect(colorLegend).toContainText(
      "Điểm quyết định",
    );
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hoàn tác" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Làm lại" })).toBeDisabled();

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("event-routing-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);

    await page.emulateMedia({ forcedColors: "active" });
    await expect(colorLegend).toBeVisible();
    const forcedAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("event-routing-forced-colors-axe.json", {
      body: JSON.stringify(forcedAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(forcedAccessibility.violations).toEqual([]);
    await page.emulateMedia({ forcedColors: "none" });

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    const reloadedColorModes = await openColorModes(page);
    await expect(
      reloadedColorModes.getByRole("radio", { name: /^Tương phản cao/ }),
    ).toBeChecked();
    const afterColorDraft = await draft(page, modelId);
    const afterColorVersions = await versions(page, modelId);
    expect(afterColorDraft).toEqual(beforeColorDraft);
    expect(afterColorVersions).toEqual(beforeColorVersions);
    expect(mutationRequests).toEqual([]);
  });

  test("imported message picker stays complete when secondary inspection stalls", async ({ page }) => {
    const created = await createBpmnModelViaApi(page, {
      title: `${titlePrefix}Projection ${Date.now()}`,
      description: "Validated import projection remains available without secondary worker",
      purpose: "TO_BE",
      profileId: "teb-core-catching-events@1",
      xml: starterBpmnXml,
      idempotencyKey: `e2e-import-projection:${Date.now()}`,
    });
    createdModelIds.push(created.modelId);
    await page.goto(`/studio/diagram/${created.modelId}`);
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      const original = Worker.prototype.postMessage;
      let matchingInspections = 0;
      Worker.prototype.postMessage = function (message: unknown) {
        const xml = (message as { xml?: unknown })?.xml;
        if (typeof xml === "string" && xml.includes('id="Message_Editorial_Approval"')) {
          matchingInspections += 1;
          // The first import inspection succeeds; subsequent refresh workers never reply.
          if (matchingInspections > 1) {
            document.documentElement.dataset.secondaryInspectionStalled = "true";
            return;
          }
        }
        original.call(this, message);
      };
    });
    await importXml(page, catchingEventsXml, "catching-events.bpmn");
    // Import does not guarantee a command-stack refresh. Request one through the UI.
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-secondary-inspection-stalled", "true");
    await expect(page.getByText("Không thể cập nhật danh sách bước. Vùng vẽ hiện tại vẫn được giữ.", { exact: true })).toBeVisible();
    for (const name of ["Approval message", "Receive editorial response"]) {
      await selectOutlineItem(page, name);
      await expect(page.getByRole("group", { name: "Thông điệp dùng chung" }).getByRole("radio", {
        name: /Editorial approval, đang dùng tại 2 nơi/,
      })).toBeChecked();
    }
    expect((await draft(page, created.modelId)).canonicalXml).toContain('messageRef="Message_Editorial_Approval"');
  });

  test("@mobile stays viewer-first and names event kinds in the outline", async ({
    page,
  }, testInfo) => {
    expect(durableEventRoutingModelId).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/diagram/${durableEventRoutingModelId}`);

    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Chọn thành phần" })).toBeHidden();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(page.locator(".bpmn-event-property-editor")).toHaveCount(0);
    const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
    await expect(outline).toBeVisible();
    await expect(outline).toContainText("Chờ thông điệp");
    await expect(outline).toContainText("Chờ một khoảng thời gian");
    await expect(outline).toContainText("Nhận thông điệp");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("event-routing-mobile-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });
});
