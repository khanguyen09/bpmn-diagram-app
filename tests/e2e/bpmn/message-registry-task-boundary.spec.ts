import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createBpmnModelViaApi,
  findBpmnLauncherTool,
  readBpmnDraft,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Message Registry Boundary ";
const createdModelIds: string[] = [];
let durableBoundaryModelId: string | undefined;

const eventRoutingXml = readFileSync(
  resolve(process.cwd(), "tests/fixtures/event-routing.bpmn"),
  "utf8",
);

const boundaryModelXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_Boundary_Proof"
  targetNamespace="https://the-experience.blog/bpmn/boundary-proof">
  <bpmn:message id="Message_Shared_Editorial" name="Shared editorial response" />
  <bpmn:process id="Process_Boundary_Proof" name="Boundary event proof" isExecutable="false">
    <bpmn:startEvent id="Start_Boundary_Proof" name="Case opened">
      <bpmn:outgoing>Flow_Start_User</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="User_Human_Review" name="Human review">
      <bpmn:incoming>Flow_Start_User</bpmn:incoming>
      <bpmn:outgoing>Flow_User_Service</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:boundaryEvent id="Boundary_Message_Human" name="Escalation message"
      attachedToRef="User_Human_Review" cancelActivity="true">
      <bpmn:outgoing>Flow_Boundary_Message_End</bpmn:outgoing>
      <bpmn:messageEventDefinition id="Definition_Boundary_Message" messageRef="Message_Shared_Editorial" />
    </bpmn:boundaryEvent>
    <bpmn:serviceTask id="Service_Automated_Review" name="Automated review">
      <bpmn:incoming>Flow_User_Service</bpmn:incoming>
      <bpmn:outgoing>Flow_Service_Manual</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="Boundary_Timer_Service" name="Review timeout"
      attachedToRef="Service_Automated_Review" cancelActivity="false">
      <bpmn:outgoing>Flow_Boundary_Timer_End</bpmn:outgoing>
      <bpmn:timerEventDefinition id="Definition_Boundary_Timer">
        <bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT30M</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:boundaryEvent>
    <bpmn:manualTask id="Manual_Offline_Check" name="Offline check">
      <bpmn:incoming>Flow_Service_Manual</bpmn:incoming>
      <bpmn:outgoing>Flow_Manual_None_Throw</bpmn:outgoing>
    </bpmn:manualTask>
    <bpmn:intermediateThrowEvent id="Throw_None_Checkpoint" name="Review checkpoint">
      <bpmn:incoming>Flow_Manual_None_Throw</bpmn:incoming>
      <bpmn:outgoing>Flow_None_Message_Throw</bpmn:outgoing>
    </bpmn:intermediateThrowEvent>
    <bpmn:intermediateThrowEvent id="Throw_Message_Editorial" name="Notify editorial">
      <bpmn:incoming>Flow_None_Message_Throw</bpmn:incoming>
      <bpmn:outgoing>Flow_Message_Throw_End</bpmn:outgoing>
      <bpmn:messageEventDefinition id="Definition_Throw_Message" messageRef="Message_Shared_Editorial" />
    </bpmn:intermediateThrowEvent>
    <bpmn:endEvent id="End_Boundary_Proof" name="Case completed">
      <bpmn:incoming>Flow_Message_Throw_End</bpmn:incoming>
      <bpmn:incoming>Flow_Boundary_Message_End</bpmn:incoming>
      <bpmn:incoming>Flow_Boundary_Timer_End</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Start_User" sourceRef="Start_Boundary_Proof" targetRef="User_Human_Review" />
    <bpmn:sequenceFlow id="Flow_User_Service" sourceRef="User_Human_Review" targetRef="Service_Automated_Review" />
    <bpmn:sequenceFlow id="Flow_Service_Manual" sourceRef="Service_Automated_Review" targetRef="Manual_Offline_Check" />
    <bpmn:sequenceFlow id="Flow_Manual_None_Throw" sourceRef="Manual_Offline_Check" targetRef="Throw_None_Checkpoint" />
    <bpmn:sequenceFlow id="Flow_None_Message_Throw" sourceRef="Throw_None_Checkpoint" targetRef="Throw_Message_Editorial" />
    <bpmn:sequenceFlow id="Flow_Message_Throw_End" sourceRef="Throw_Message_Editorial" targetRef="End_Boundary_Proof" />
    <bpmn:sequenceFlow id="Flow_Boundary_Message_End" sourceRef="Boundary_Message_Human" targetRef="End_Boundary_Proof" />
    <bpmn:sequenceFlow id="Flow_Boundary_Timer_End" sourceRef="Boundary_Timer_Service" targetRef="End_Boundary_Proof" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Boundary_Proof">
    <bpmndi:BPMNPlane id="Plane_Boundary_Proof" bpmnElement="Process_Boundary_Proof">
      <bpmndi:BPMNShape id="Shape_Start_Boundary" bpmnElement="Start_Boundary_Proof"><dc:Bounds x="70" y="232" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_User_Human" bpmnElement="User_Human_Review"><dc:Bounds x="150" y="210" width="120" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Boundary_Message" bpmnElement="Boundary_Message_Human"><dc:Bounds x="234" y="272" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Service_Automated" bpmnElement="Service_Automated_Review"><dc:Bounds x="330" y="210" width="130" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Boundary_Timer" bpmnElement="Boundary_Timer_Service"><dc:Bounds x="424" y="272" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Manual_Offline" bpmnElement="Manual_Offline_Check"><dc:Bounds x="520" y="210" width="120" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Throw_None" bpmnElement="Throw_None_Checkpoint"><dc:Bounds x="700" y="232" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Throw_Message" bpmnElement="Throw_Message_Editorial"><dc:Bounds x="790" y="232" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_Boundary" bpmnElement="End_Boundary_Proof"><dc:Bounds x="900" y="232" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Start_User" bpmnElement="Flow_Start_User"><di:waypoint x="106" y="250" /><di:waypoint x="150" y="250" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_User_Service" bpmnElement="Flow_User_Service"><di:waypoint x="270" y="250" /><di:waypoint x="330" y="250" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Service_Manual" bpmnElement="Flow_Service_Manual"><di:waypoint x="460" y="250" /><di:waypoint x="520" y="250" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Manual_None" bpmnElement="Flow_Manual_None_Throw"><di:waypoint x="640" y="250" /><di:waypoint x="700" y="250" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_None_Message" bpmnElement="Flow_None_Message_Throw"><di:waypoint x="736" y="250" /><di:waypoint x="790" y="250" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Message_End" bpmnElement="Flow_Message_Throw_End"><di:waypoint x="826" y="250" /><di:waypoint x="900" y="250" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Boundary_Message_End" bpmnElement="Flow_Boundary_Message_End"><di:waypoint x="252" y="308" /><di:waypoint x="252" y="370" /><di:waypoint x="918" y="370" /><di:waypoint x="918" y="268" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Boundary_Timer_End" bpmnElement="Flow_Boundary_Timer_End"><di:waypoint x="442" y="308" /><di:waypoint x="442" y="340" /><di:waypoint x="880" y="340" /><di:waypoint x="880" y="250" /><di:waypoint x="900" y="250" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

async function createEventRoutingModel(page: Page) {
  const created = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}${Date.now()}`,
    description: "Message registry, Task Types and Boundary Events proof",
    purpose: "TO_BE",
    profileId: "teb-core-event-routing@1",
    xml: eventRoutingXml,
    idempotencyKey: `e2e-message-boundary:${Date.now()}`,
  });
  createdModelIds.push(created.modelId);
  await page.goto(`/studio/diagram/${created.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

async function resumeBoundaryJourney(page: Page) {
  if (!durableBoundaryModelId) throw new Error("The preceding journey must persist its model first.");
  await page.goto(`/studio/diagram/${durableBoundaryModelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return durableBoundaryModelId;
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

async function selectOutlineItem(page: Page, name: string) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: name })
    .click();
  await openBpmnInspectorView(page, "edit");
}

async function keyboardCreateAndUndo(
  page: Page,
  toolId: string,
  query: string,
  preparation: "none" | "ordered-profile-ack" = "none",
) {
  const shapes = page.locator(".bpmn-modeler .djs-shape");
  const before = await shapes.count();
  const item = await findBpmnLauncherTool(page, {
    toolId,
    query,
    preparation,
  });
  await item.focus();
  await page.keyboard.press("Enter");
  await expect(shapes).toHaveCount(before + 1);
  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(shapes).toHaveCount(before);
}

test.describe.serial("BPMN Message Registry, Task and Boundary Events", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("Task-Type ACK gate and shared Message selection, rename and cleanup history", async ({
    page,
  }) => {
    const modelId = await createEventRoutingModel(page);
    durableBoundaryModelId = modelId;
    await keyboardCreateAndUndo(
      page,
      "user-task",
      "người thực hiện",
      "ordered-profile-ack",
    );
    await expect.poll(async () => (await draft(page, modelId)).profileId)
      .toBe("teb-core-task-types@1");
    for (const [toolId, query] of [
      ["user-task", "người thực hiện"],
      ["service-task", "tự động"],
      ["manual-task", "thủ công"],
    ] as const) {
      await keyboardCreateAndUndo(page, toolId, query);
    }

    await selectOutlineItem(page, "Cancellation");
    const messagePicker = page.getByRole("group", {
      name: "Thông điệp dùng chung",
    });
    await expect(messagePicker).toBeVisible();
    await messagePicker.getByLabel("Tìm thông điệp").fill("Approval");
    const approvedMessage = messagePicker.getByRole("radio", {
      name: /Approval received, đang dùng tại 1 nơi/,
    });
    await approvedMessage.focus();
    await page.keyboard.press("Space");
    await page
      .getByRole("button", { name: "Áp dụng thông điệp" })
      .click();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toMatch(
        /<bpmn:receiveTask[^>]+id="Receive_Cancel"[^>]+messageRef="Message_Approved"/,
      );

    await openBpmnInspectorView(page, "model");
    const registry = page.locator("details.bpmn-message-registry").first();
    if ((await registry.getAttribute("open")) === null) {
      await registry.locator(":scope > summary").click();
    }
    await expect(registry).toBeVisible();
    const search = registry.getByLabel("Tìm thông điệp");
    await search.fill("Approval");
    await registry.getByRole("button", {
      name: /Approval received.*2 nơi sử dụng/,
    }).click();
    await search.fill("");
    await registry.getByLabel("Tên thông điệp").fill(
      "Shared editorial response",
    );
    await registry
      .getByRole("button", { name: "Đổi tên thông điệp" })
      .click();
    await expect(
      page.getByText(/Đã đổi tên thông điệp dùng chung tại 2 nơi sử dụng\./),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(registry).toContainText("Approval received");
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(registry).toContainText("Shared editorial response");

    const beforeCleanup = await draft(page, modelId);
    const cleanupTrigger = registry.getByRole("button", {
      name: "Xoá thông điệp không dùng",
    });
    await cleanupTrigger.focus();
    await cleanupTrigger.click();
    const cleanupDialog = page.getByRole("alertdialog", {
      name: "Xoá thông điệp không còn sử dụng",
    });
    await expect(cleanupDialog).toContainText("Message_Cancelled");
    await cleanupDialog.getByRole("button", { name: "Huỷ" }).click();
    await expect(cleanupTrigger).toBeFocused();
    expect(await draft(page, modelId)).toEqual(beforeCleanup);

    await cleanupTrigger.click();
    await cleanupDialog
      .getByRole("button", { name: "Xoá thông điệp" })
      .click();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .not.toContain('id="Message_Cancelled"');
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain('id="Message_Cancelled"');
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .not.toContain('id="Message_Cancelled"');

    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  });

  test("Intermediate and Boundary ACK gates, attachment history and imported XML", async ({ page }) => {
    const modelId = await resumeBoundaryJourney(page);

    await keyboardCreateAndUndo(
      page,
      "none-throw-event",
      "mốc trung gian",
      "ordered-profile-ack",
    );
    await expect.poll(async () => (await draft(page, modelId)).profileId)
      .toBe("teb-core-intermediate-events@1");
    for (const [toolId, query] of [
      ["none-throw-event", "mốc trung gian"],
      ["message-throw-event", "gửi thông điệp"],
    ] as const) {
      await keyboardCreateAndUndo(page, toolId, query);
    }

    await selectOutlineItem(page, "Cancellation");
    await keyboardCreateAndUndo(
      page,
      "message-boundary-event",
      "khi nhận được thông điệp",
      "ordered-profile-ack",
    );
    await expect.poll(async () => (await draft(page, modelId)).profileId)
      .toBe("teb-core-boundary-events@1");

    await selectOutlineItem(page, "Cancellation");
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const beforeBoundaryAttach = await shapes.count();
    const attachGroup = page.getByRole("group", {
      name: "Gắn sự kiện biên",
    });
    await attachGroup.getByRole("button", { name: "Thông điệp" }).focus();
    await page.keyboard.press("Enter");
    await expect(shapes).toHaveCount(beforeBoundaryAttach + 1);
    await expect(
      page.getByRole("radio", { name: "Dừng công việc đang chạy" }),
    ).toBeChecked();
    await page.getByRole("radio", { name: "Không ngắt" }).check();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(
      page.getByRole("radio", { name: "Dừng công việc đang chạy" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(
      page.getByRole("radio", { name: "Không ngắt" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(shapes).toHaveCount(beforeBoundaryAttach);

    await selectOutlineItem(page, "Cancellation");
    const timerAttachGroup = page.getByRole("group", {
      name: "Gắn sự kiện biên",
    });
    await timerAttachGroup.getByRole("button", { name: "Hẹn giờ" }).focus();
    await page.keyboard.press("Enter");
    await expect(shapes).toHaveCount(beforeBoundaryAttach + 1);
    await expect(
      page.getByRole("radio", { name: "Dừng công việc đang chạy" }),
    ).toBeChecked();
    await expect(
      page.getByRole("group", { name: "Kiểu thời gian" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(shapes).toHaveCount(beforeBoundaryAttach);

    await importXml(page, boundaryModelXml, "task-boundary-events.bpmn");
    const imported = await draft(page, modelId);
    expect(imported.profileId).toBe("teb-core-boundary-events@1");
    expect(imported.canonicalXml).toContain(
      '<bpmn:message id="Message_Shared_Editorial" name="Shared editorial response" />',
    );
    expect(imported.canonicalXml).toMatch(
      /<bpmn:boundaryEvent[^>]+id="Boundary_Message_Human"[^>]+attachedToRef="User_Human_Review"/,
    );
    expect(imported.canonicalXml).toMatch(
      /<bpmn:boundaryEvent(?=[^>]+id="Boundary_Timer_Service")(?=[^>]+attachedToRef="Service_Automated_Review")(?=[^>]+cancelActivity="false")[^>]*>/,
    );
    expect(imported.canonicalXml).toContain(
      '<bpmn:intermediateThrowEvent id="Throw_None_Checkpoint"',
    );
    expect(imported.canonicalXml).toMatch(
      /<bpmn:intermediateThrowEvent[^>]+id="Throw_Message_Editorial"[\s\S]*?messageRef="Message_Shared_Editorial"/,
    );

    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  });

  test("Boundary host movement, cascade safety, behavior history and durable version", async ({ page }) => {
    const modelId = await resumeBoundaryJourney(page);

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    expect((await readBpmnDraft(page, modelId)).profileId).toBe(
      "teb-core-boundary-events@1",
    );
    await selectOutlineItem(page, "Escalation message");
    await expect(
      page.getByRole("radio", { name: "Dừng công việc đang chạy" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Đi tới công việc" }).click();
    await expect(
      page.locator(
        '.bpmn-modeler .djs-shape.selected[data-element-id="User_Human_Review"]',
      ),
    ).toHaveCount(1);

    const host = page.locator(
      '.bpmn-modeler .djs-shape[data-element-id="User_Human_Review"]',
    );
    const attached = page.locator(
      '.bpmn-modeler .djs-shape[data-element-id="Boundary_Message_Human"]',
    );
    const hostBeforeMove = await host.boundingBox();
    const boundaryBeforeMove = await attached.boundingBox();
    expect(hostBeforeMove).toBeTruthy();
    expect(boundaryBeforeMove).toBeTruthy();
    await page.mouse.move(
      hostBeforeMove!.x + hostBeforeMove!.width / 2,
      hostBeforeMove!.y + hostBeforeMove!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      hostBeforeMove!.x + hostBeforeMove!.width / 2 + 60,
      hostBeforeMove!.y + hostBeforeMove!.height / 2 + 40,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect.poll(async () => (await host.boundingBox())?.x)
      .toBeGreaterThan(hostBeforeMove!.x + 40);
    await expect.poll(async () => (await attached.boundingBox())?.x)
      .toBeGreaterThan(boundaryBeforeMove!.x + 40);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect.poll(async () => Math.round((await host.boundingBox())?.x ?? 0))
      .toBe(Math.round(hostBeforeMove!.x));
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect.poll(async () => (await attached.boundingBox())?.x)
      .toBeGreaterThan(boundaryBeforeMove!.x + 40);

    const beforeCascade = await draft(page, modelId);
    const deleteActivity = page.getByRole("button", {
      name: "Xoá phần tử",
    });
    await deleteActivity.focus();
    await deleteActivity.click();
    const cascadeDialog = page.getByRole("alertdialog", {
      name: "Xoá phần tử này?",
    });
    await cascadeDialog.getByRole("button", { name: "Huỷ" }).click();
    await expect(deleteActivity).toBeFocused();
    expect(await draft(page, modelId)).toEqual(beforeCascade);
    await deleteActivity.click();
    await cascadeDialog.getByRole("button", { name: "Xoá phần tử" }).click();
    await expect(host).toHaveCount(0);
    await expect(attached).toHaveCount(0);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(host).toHaveCount(1);
    await expect(attached).toHaveCount(1);
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain('id="Boundary_Message_Human"');

    await selectOutlineItem(page, "Escalation message");
    await page.getByRole("radio", { name: "Không ngắt" }).check();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(
      page.getByRole("radio", { name: "Dừng công việc đang chạy" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(
      page.getByRole("radio", { name: "Không ngắt" }),
    ).toBeChecked();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toMatch(
        /<bpmn:boundaryEvent[^>]+id="Boundary_Message_Human"[^>]+cancelActivity="false"/,
      );

    const durable = await draft(page, modelId);
    await openBpmnInspectorView(page, "versions");
    await page
      .getByLabel("Ghi chú cho bản mới")
      .fill("Boundary Events immutable checkpoint");
    await page.getByRole("button", { name: "Xác nhận lưu mốc" }).click();
    await expect(page.getByText(/Đã lưu mốc 1/)).toBeVisible({
      timeout: 15_000,
    });
    const immutableVersions = await versions(page, modelId);
    expect(immutableVersions).toHaveLength(1);
    expect(immutableVersions[0]).toMatchObject({
      versionNumber: 1,
      profileId: "teb-core-boundary-events@1",
      xmlChecksum: createHash("sha256")
        .update(durable.canonicalXml)
        .digest("hex"),
    });
  });

  test("reloads exact Task, Throw and Boundary shapes with accessible color modes", async ({ page }, testInfo) => {
    const modelId = await resumeBoundaryJourney(page);

    await page.reload();
    expect((await readBpmnDraft(page, modelId)).profileId).toBe(
      "teb-core-boundary-events@1",
    );
    for (const id of [
      "User_Human_Review",
      "Service_Automated_Review",
      "Manual_Offline_Check",
      "Throw_None_Checkpoint",
      "Throw_Message_Editorial",
      "Boundary_Message_Human",
      "Boundary_Timer_Service",
    ]) {
      await expect(
        page.locator(`.bpmn-modeler .djs-shape[data-element-id="${id}"]`),
      ).toHaveCount(1);
    }

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("message-registry-boundary-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);

    await page.emulateMedia({ forcedColors: "active" });
    const forcedAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("message-registry-boundary-forced-colors-axe.json", {
      body: JSON.stringify(forcedAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(forcedAccessibility.violations).toEqual([]);
  });

  test("@mobile stays viewer-first with exact Task, Throw and Boundary semantics", async ({
    page,
  }, testInfo) => {
    expect(durableBoundaryModelId).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/diagram/${durableBoundaryModelId}`);
    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Chọn thành phần" })).toBeHidden();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Xoá thông điệp không dùng" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Gắn sự kiện biên" }),
    ).toHaveCount(0);
    const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
    await expect(outline).toBeVisible();
    for (const text of [
      "Công việc của người",
      "Công việc tự động",
      "Công việc thủ công",
      "Đánh dấu mốc",
      "Gửi thông điệp",
      "Thông điệp tại biên · không ngắt công việc · Human review",
      "Hẹn giờ tại biên · không ngắt công việc · Automated review",
    ]) {
      await expect(outline).toContainText(text);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("message-registry-boundary-mobile-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });
});
