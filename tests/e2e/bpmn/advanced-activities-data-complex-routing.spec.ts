import AxeBuilder from "@axe-core/playwright";
import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNEdge,
  BPMNShape,
  CallActivity,
  ComplexGateway,
  DataObjectReference,
  DataStoreReference,
  Definitions,
  FlowElement,
  Process,
  SubProcess,
} from "bpmn-moddle";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  createBpmnModelViaDialog,
  downloadBpmnDiagram,
  findBpmnLauncherTool,
  openBpmnComponentLauncher,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Advanced Full Authoring ";
const finalProfileId = "teb-collaboration-complex-routing@1";
const activationCondition =
  "Hai nguồn biên tập đã hoàn tất kiểm tra cấu trúc";
const changedActivationCondition =
  "Điều kiện successor không được sửa version bất biến";
const createdModelIds: string[] = [];
let durableModelId: string | undefined;
let durableSnapshot: AdvancedSnapshot | undefined;

type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type AuthoredIds = {
  readonly subProcessId: string;
  readonly callActivityId: string;
  readonly dataObjectReferenceId: string;
  readonly dataStoreReferenceId: string;
  readonly complexGatewayId: string;
};

type AdvancedSnapshot = {
  readonly subProcess: {
    readonly id: string;
    readonly triggeredByEvent: boolean;
    readonly bounds: Bounds;
    readonly children: ReadonlyArray<{
      readonly id: string;
      readonly type: string;
      readonly bounds?: Bounds;
    }>;
  };
  readonly callActivity: {
    readonly id: string;
    readonly calledElement: string;
    readonly callableName: string;
  };
  readonly data: {
    readonly objectReferenceId: string;
    readonly objectBackingId: string;
    readonly storeReferenceId: string;
    readonly storeBackingId: string;
    readonly inputAssociation: {
      readonly id: string;
      readonly sourceId: string;
      readonly targetId: string;
    };
    readonly outputAssociation: {
      readonly id: string;
      readonly sourceId: string;
      readonly targetId: string;
    };
  };
  readonly complexJoin: {
    readonly id: string;
    readonly direction: string;
    readonly activationCondition: string;
    readonly incomingIds: readonly string[];
    readonly outgoingIds: readonly string[];
  };
};

type DataAssociationLike = {
  readonly id: string;
  readonly sourceRef?:
    | { readonly id: string }
    | readonly { readonly id: string }[];
  readonly targetRef?: {
    readonly id: string;
    readonly $type?: string;
    readonly name?: string;
  };
};

async function createFinalCollaborationModel(page: Page) {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${Date.now()}`,
    profileLabel: "Quy trình cộng tác nâng cao",
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  expect((await draft(page, created.modelId)).profileId).toBe(finalProfileId);
  return created.modelId;
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

async function waitForDraft(
  page: Page,
  modelId: string,
  predicate: (xml: string) => boolean,
) {
  await expect
    .poll(async () => predicate((await draft(page, modelId)).canonicalXml))
    .toBe(true);
  return draft(page, modelId);
}

async function actionWithSaveAck(
  page: Page,
  action: () => Promise<void>,
) {
  const saveAck = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith("/draft"),
    { timeout: 15_000 },
  );
  await action();
  const response = await saveAck;
  if (!response.ok()) {
    throw new Error(
      `Autosave rejected (${response.status()}): ${await response.text()}`,
    );
  }
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
}

function finiteBounds(shape: BPMNShape | undefined, elementId: string): Bounds {
  expect(shape?.bounds, `${elementId} requires BPMNShape bounds`).toBeTruthy();
  const bounds = {
    x: shape!.bounds!.x,
    y: shape!.bounds!.y,
    width: shape!.bounds!.width,
    height: shape!.bounds!.height,
  };
  for (const value of Object.values(bounds)) {
    expect(Number.isFinite(value), `${elementId} DI must be finite`).toBe(true);
  }
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.height).toBeGreaterThan(0);
  return bounds;
}

function associationSourceId(association: DataAssociationLike) {
  const source = Array.isArray(association.sourceRef)
    ? association.sourceRef[0]
    : association.sourceRef;
  expect(source).toBeTruthy();
  return source.id;
}

function isInside(child: Bounds, parent: Bounds) {
  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width &&
    child.y + child.height <= parent.y + parent.height
  );
}

async function advancedSnapshot(
  xml: string,
  ids: AuthoredIds,
): Promise<AdvancedSnapshot> {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const rootProcesses = definitions.rootElements.filter(
    (element): element is Process => element.$type === "bpmn:Process",
  );
  const ownerProcess = rootProcesses.find((process) =>
    process.flowElements.some((element) => element.id === ids.subProcessId),
  );
  expect(ownerProcess).toBeTruthy();

  const subProcess = ownerProcess!.flowElements.find(
    (element) => element.id === ids.subProcessId,
  ) as SubProcess | undefined;
  const callActivity = ownerProcess!.flowElements.find(
    (element) => element.id === ids.callActivityId,
  ) as CallActivity | undefined;
  const dataObjectReference = ownerProcess!.flowElements.find(
    (element) => element.id === ids.dataObjectReferenceId,
  ) as DataObjectReference | undefined;
  const dataStoreReference = ownerProcess!.flowElements.find(
    (element) => element.id === ids.dataStoreReferenceId,
  ) as DataStoreReference | undefined;
  const complexGateway = ownerProcess!.flowElements.find(
    (element) => element.id === ids.complexGatewayId,
  ) as ComplexGateway | undefined;
  expect(subProcess?.$type).toBe("bpmn:SubProcess");
  expect(callActivity?.$type).toBe("bpmn:CallActivity");
  expect(dataObjectReference?.$type).toBe("bpmn:DataObjectReference");
  expect(dataStoreReference?.$type).toBe("bpmn:DataStoreReference");
  expect(complexGateway?.$type).toBe("bpmn:ComplexGateway");

  const shapes = new Map(
    definitions.diagrams
      .flatMap((diagram) => diagram.plane?.planeElement ?? [])
      .filter(
        (element): element is BPMNShape =>
          element.$type === "bpmndi:BPMNShape",
      )
      .map((shape) => [shape.bpmnElement?.id, shape]),
  );
  const edges = new Map(
    definitions.diagrams
      .flatMap((diagram) => diagram.plane?.planeElement ?? [])
      .filter(
        (element): element is BPMNEdge =>
          element.$type === "bpmndi:BPMNEdge",
      )
      .map((edge) => [edge.bpmnElement?.id, edge]),
  );

  const subProcessBounds = finiteBounds(
    shapes.get(subProcess!.id),
    subProcess!.id,
  );
  const children = subProcess!.flowElements.map((element: FlowElement) => {
    const shape = shapes.get(element.id);
    const bounds = shape ? finiteBounds(shape, element.id) : undefined;
    if (bounds) {
      expect(
        isInside(bounds, subProcessBounds),
        `${element.id} must remain within ${subProcess!.id}`,
      ).toBe(true);
    }
    return {
      id: element.id,
      type: element.$type,
      ...(bounds ? { bounds } : {}),
    };
  });
  expect(children.filter((child) => child.type === "bpmn:StartEvent"))
    .toHaveLength(1);
  expect(children.filter((child) => child.type === "bpmn:Task")).toHaveLength(
    1,
  );
  expect(children.filter((child) => child.type === "bpmn:EndEvent"))
    .toHaveLength(1);
  expect(
    children.filter((child) => child.type === "bpmn:SequenceFlow"),
  ).toHaveLength(2);

  const callableProcess = rootProcesses.find(
    (process) => process.id === callActivity!.calledElement,
  );
  expect(callableProcess).toBeTruthy();
  expect(callableProcess).not.toBe(ownerProcess);
  expect(callableProcess!.isExecutable).toBe(false);

  const inputAssociation = callActivity!.dataInputAssociations[0] as
    | DataAssociationLike
    | undefined;
  const outputAssociation = callActivity!.dataOutputAssociations[0] as
    | DataAssociationLike
    | undefined;
  expect(inputAssociation).toBeTruthy();
  expect(outputAssociation).toBeTruthy();
  expect(inputAssociation!.targetRef).toMatchObject({
    $type: "bpmn:Property",
    name: "__targetRef_placeholder",
  });
  expect(outputAssociation!.sourceRef ?? []).toEqual([]);
  expect(outputAssociation!.targetRef?.id).toBe(dataObjectReference!.id);
  for (const association of [inputAssociation!, outputAssociation!]) {
    const edge = edges.get(association.id);
    expect(edge, `${association.id} requires BPMNEdge`).toBeTruthy();
    expect(edge!.waypoint.length).toBeGreaterThanOrEqual(2);
    for (const waypoint of edge!.waypoint) {
      expect(Number.isFinite(waypoint.x)).toBe(true);
      expect(Number.isFinite(waypoint.y)).toBe(true);
    }
  }

  expect(complexGateway!.gatewayDirection).toBe("Converging");
  expect(complexGateway!.incoming).toHaveLength(2);
  expect(complexGateway!.outgoing).toHaveLength(1);
  expect(complexGateway!.default).toBeFalsy();

  return {
    subProcess: {
      id: subProcess!.id,
      triggeredByEvent: subProcess!.triggeredByEvent,
      bounds: subProcessBounds,
      children,
    },
    callActivity: {
      id: callActivity!.id,
      calledElement: callActivity!.calledElement,
      callableName: callableProcess!.name,
    },
    data: {
      objectReferenceId: dataObjectReference!.id,
      objectBackingId: dataObjectReference!.dataObjectRef.id,
      storeReferenceId: dataStoreReference!.id,
      storeBackingId: dataStoreReference!.dataStoreRef.id,
      inputAssociation: {
        id: inputAssociation!.id,
        sourceId: associationSourceId(inputAssociation!),
        targetId: callActivity!.id,
      },
      outputAssociation: {
        id: outputAssociation!.id,
        sourceId: callActivity!.id,
        targetId: outputAssociation!.targetRef!.id,
      },
    },
    complexJoin: {
      id: complexGateway!.id,
      direction: complexGateway!.gatewayDirection,
      activationCondition: complexGateway!.activationCondition.body,
      incomingIds: complexGateway!.incoming.map((flow) => flow.id).sort(),
      outgoingIds: complexGateway!.outgoing.map((flow) => flow.id).sort(),
    },
  };
}

async function subProcessChildIds(xml: string, subProcessId: string) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const subProcess = definitions.rootElements
    .filter((element): element is Process => element.$type === "bpmn:Process")
    .flatMap((process) => process.flowElements)
    .find((element) => element.id === subProcessId) as SubProcess | undefined;
  expect(subProcess).toBeTruthy();
  return subProcess!.flowElements.map((element) => element.id);
}

async function selectOutlineItem(page: Page, text: string | RegExp) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: text })
    .click();
}

async function createFromLibrary(page: Page, toolId: string) {
  const shapes = page.locator(".bpmn-modeler .djs-shape");
  const before = await shapes.count();
  const item = await findBpmnLauncherTool(page, { toolId });
  await item.focus();
  await actionWithSaveAck(page, () => page.keyboard.press("Enter"));
  await expect.poll(() => shapes.count()).toBeGreaterThan(before);
  const selectedId = await page
    .locator(".bpmn-modeler .djs-shape.selected")
    .getAttribute("data-element-id");
  expect(selectedId).toBeTruthy();
  return selectedId!;
}

async function createSequenceFlow(
  page: Page,
  source: string | RegExp,
  target: string | RegExp,
) {
  await selectOutlineItem(page, source);
  const sequence = await findBpmnLauncherTool(page, {
    toolId: "sequence-flow",
    query: "luồng công việc",
  });
  await sequence.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".bpmn-connect-hud").getByText(/Bước 2\/2/)).toBeVisible();
  await actionWithSaveAck(page, () => selectOutlineItem(page, target));
}

async function createDataAssociation(
  page: Page,
  source: string | RegExp,
  target: string | RegExp,
) {
  await selectOutlineItem(page, source);
  const association = await findBpmnLauncherTool(page, {
    toolId: "data-association",
    query: "liên kết dữ liệu",
  });
  await association.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".bpmn-connect-hud").getByText(/Bước 2\/2/)).toBeVisible();
  await actionWithSaveAck(page, () => selectOutlineItem(page, target));
}

test.describe.serial("BPMN Advanced Full Authoring production journey", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("authors and restores advanced hierarchy, references, data dependencies and Complex join", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const modelId = await createFinalCollaborationModel(page);
    durableModelId = modelId;
    const launcher = await openBpmnComponentLauncher(page);
    await expect(launcher.getByText("Hoạt động", { exact: true }))
      .toBeVisible();
    await expect(launcher.getByText("Dữ liệu & chú thích", { exact: true })).toBeVisible();
    await expect(launcher.getByText("Điểm quyết định", { exact: true }))
      .toBeVisible();

    await selectOutlineItem(page, "Refine story");
    const subProcessId = await createFromLibrary(
      page,
      "expanded-subprocess",
    );
    const starterDraft = await waitForDraft(
      page,
      modelId,
      (xml) => xml.includes(`id="${subProcessId}"`),
    );
    const starterChildIds = await subProcessChildIds(
      starterDraft.canonicalXml,
      subProcessId,
    );
    expect(new Set(starterChildIds).size).toBe(5);

    await actionWithSaveAck(page, () =>
      page.getByRole("button", { name: "Hoàn tác", exact: true }).click(),
    );
    await waitForDraft(
      page,
      modelId,
      (xml) => !xml.includes(`id="${subProcessId}"`),
    );
    await actionWithSaveAck(page, () =>
      page.getByRole("button", { name: "Làm lại", exact: true }).click(),
    );
    await waitForDraft(
      page,
      modelId,
      (xml) =>
        xml.includes(`id="${subProcessId}"`) &&
        starterChildIds.every((id) => xml.includes(id)),
    );

    await selectOutlineItem(page, "Refine story");
    const callActivityId = await createFromLibrary(
      page,
      "call-activity",
    );
    await openBpmnInspectorView(page, "edit");
    const callEditor = page
      .locator("section.bpmn-artifact-editor")
      .filter({ hasText: "Dùng lại quy trình" });
    const callableProcess = callEditor.getByRole("button", {
      name: "Quy trình được dùng",
    });
    await expect(callableProcess).toContainText("Quy trình dùng chung");
    const callActivityDraft = await waitForDraft(
      page,
      modelId,
      (xml) => xml.includes(`id="${callActivityId}"`),
    );
    const parsedCallActivity = await new BpmnModdle().fromXML(
      callActivityDraft.canonicalXml,
    );
    const calledElement = (
      parsedCallActivity.elementsById[callActivityId] as
        | { readonly calledElement?: string }
        | undefined
    )?.calledElement;
    expect(calledElement).toBeTruthy();
    await callableProcess.click();
    await callEditor
      .getByRole("option", { name: "Quy trình dùng chung", exact: true })
      .click();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    const beforeNoOpApply = await draft(page, modelId);
    const applyCalledProcess = callEditor.getByRole("button", {
      name: "Áp dụng quy trình",
    });
    await applyCalledProcess.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Đã liên kết bước này với quy trình được chọn.", {
        exact: true,
      }),
    ).toBeVisible();
    const afterNoOpApply = await draft(page, modelId);
    expect(afterNoOpApply).toEqual(beforeNoOpApply);
    const parsedNoOpCallActivity = await new BpmnModdle().fromXML(
      afterNoOpApply.canonicalXml,
    );
    expect(
      (
        parsedNoOpCallActivity.elementsById[callActivityId] as
          | { readonly calledElement?: string }
          | undefined
      )?.calledElement,
    ).toBe(calledElement);
    await createSequenceFlow(page, "Draft ready", "Quy trình con");
    await createSequenceFlow(page, "Quy trình con", "Story published");
    await createSequenceFlow(page, "Draft ready", /Dùng lại quy trình/);
    await createSequenceFlow(page, /Dùng lại quy trình/, "Story published");

    await selectOutlineItem(page, "Refine story");
    const dataObjectReferenceId = await createFromLibrary(
      page,
      "data-object",
    );
    await selectOutlineItem(page, "Refine story");
    const dataStoreReferenceId = await createFromLibrary(
      page,
      "data-store",
    );
    await createDataAssociation(
      page,
      /Kho dữ liệu/,
      /Dùng lại quy trình/,
    );
    await createDataAssociation(
      page,
      /Dùng lại quy trình/,
      /Tài liệu dữ liệu/,
    );

    await selectOutlineItem(page, "Refine story");
    const complexGatewayId = await createFromLibrary(
      page,
      "complex-gateway",
    );
    await openBpmnInspectorView(page, "edit");
    const complexEditor = page
      .locator("section.bpmn-artifact-editor")
      .filter({ hasText: "Hợp nhánh theo điều kiện" });
    await expect(
      complexEditor.getByText(
        /Ứng dụng chỉ lưu mô tả này, không tự chạy/,
      ),
    ).toBeVisible();
    const activationEditor = complexEditor.getByRole("textbox", {
      name: "Điều kiện hợp nhánh",
    });
    await activationEditor.fill(activationCondition);
    await actionWithSaveAck(page, () =>
      activationEditor.press("ControlOrMeta+Enter"),
    );

    await createSequenceFlow(page, "Refine story", /Đồng bộ theo điều kiện/);
    await createSequenceFlow(page, "Publish story", /Đồng bộ theo điều kiện/);
    await createSequenceFlow(page, /Đồng bộ theo điều kiện/, "Story published");

    const authoredIds: AuthoredIds = {
      subProcessId,
      callActivityId,
      dataObjectReferenceId,
      dataStoreReferenceId,
      complexGatewayId,
    };
    const authoredDraft = await waitForDraft(
      page,
      modelId,
      (xml) =>
        xml.includes(activationCondition) &&
        xml.includes(`id="${dataObjectReferenceId}"`) &&
        xml.includes(`id="${dataStoreReferenceId}"`),
    );
    expect(authoredDraft.profileId).toBe(finalProfileId);
    const authored = await advancedSnapshot(
      authoredDraft.canonicalXml,
      authoredIds,
    );
    durableSnapshot = authored;
    expect(authored.subProcess.triggeredByEvent).toBe(false);
    expect(authored.callActivity.calledElement).toBe(calledElement);
    expect(authored.data.inputAssociation.sourceId).toBe(
      dataStoreReferenceId,
    );
    expect(authored.data.outputAssociation.targetId).toBe(
      dataObjectReferenceId,
    );
    expect(authored.complexJoin.activationCondition).toBe(activationCondition);

    const download = await downloadBpmnDiagram(page, "bpmn");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedXml = readFileSync(downloadPath!, "utf8");
    expect(await advancedSnapshot(exportedXml, authoredIds)).toEqual(authored);
    await testInfo.attach("advanced-full-authoring-export.bpmn", {
      body: exportedXml,
      contentType: "application/xml",
    });

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    const reloadedDraft = await draft(page, modelId);
    expect(await advancedSnapshot(reloadedDraft.canonicalXml, authoredIds))
      .toEqual(authored);

    await openBpmnInspectorView(page, "versions");
    await page
      .getByLabel("Ghi chú cho bản mới")
      .fill("Advanced Full Authoring immutable checkpoint");
    const versionAck = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/versions"),
    );
    await page.getByRole("button", { name: "Xác nhận lưu mốc" }).click();
    expect((await versionAck).ok()).toBe(true);
    await expect(page.getByText(/Đã lưu mốc 1/)).toBeVisible();
    const immutableVersions = await versions(page, modelId);
    expect(immutableVersions).toHaveLength(1);
    expect(immutableVersions[0]).toMatchObject({
      versionNumber: 1,
      profileId: finalProfileId,
      xmlChecksum: createHash("sha256")
        .update(reloadedDraft.canonicalXml)
        .digest("hex"),
    });

    await selectOutlineItem(page, /Đồng bộ theo điều kiện/);
    await openBpmnInspectorView(page, "edit");
    await activationEditor.fill(changedActivationCondition);
    await actionWithSaveAck(page, () =>
      activationEditor.press("ControlOrMeta+Enter"),
    );
    await waitForDraft(
      page,
      modelId,
      (xml) => xml.includes(changedActivationCondition),
    );

    await openBpmnInspectorView(page, "versions");
    page.once("dialog", (dialog) => dialog.accept());
    const restoreAck = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/versions\/[^/]+\/restore$/.test(new URL(response.url()).pathname),
    );
    const restoredNavigation = page.waitForNavigation({
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Khôi phục" }).click();
    expect((await restoreAck).ok()).toBe(true);
    await restoredNavigation;
    const restoredDraft = await waitForDraft(
      page,
      modelId,
      (xml) =>
        xml.includes(activationCondition) &&
        !xml.includes(changedActivationCondition),
    );
    expect(await advancedSnapshot(restoredDraft.canonicalXml, authoredIds))
      .toEqual(authored);
    expect(await versions(page, modelId)).toEqual(immutableVersions);

    await openBpmnInspectorView(page, "structure");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("advanced-full-authoring-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);

    await page.emulateMedia({ forcedColors: "active" });
    const forcedAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("advanced-full-authoring-forced-colors-axe.json", {
      body: JSON.stringify(forcedAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(forcedAccessibility.violations).toEqual([]);
  });

  test("390px remains viewer-first with advanced hierarchy and references", async ({
    page,
  }, testInfo) => {
    test.skip(
      !durableModelId || !durableSnapshot,
      "Desktop durable advanced model required.",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/diagram/${durableModelId}`);
    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Chọn thành phần" })).toBeHidden();
    await expect(page.locator(".bpmn-desktop-mutation:visible")).toHaveCount(0);

    const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
    await expect(outline).toBeVisible();
    await expect(
      outline.getByRole("button", {
        name: /Quy trình con Quy trình con, cấp/,
      }),
    ).toBeVisible();
    const reusedProcess = outline.getByRole("button", {
      name: /Dùng lại quy trình Dùng lại quy trình, cấp/,
    });
    await expect(reusedProcess).toBeVisible();
    await expect(
      reusedProcess.getByText("Đã liên kết với quy trình dùng chung", {
        exact: true,
      }),
    ).toBeVisible();
    const inputData = outline.getByRole("button", {
      name: /Dữ liệu đi vào công việc/,
    });
    const outputData = outline.getByRole("button", {
      name: /Dữ liệu đi ra từ công việc/,
    });
    await expect(inputData).toBeVisible();
    await expect(outputData).toBeVisible();
    await expect(
      inputData.getByText("Đã nối dữ liệu với công việc", { exact: true }),
    ).toBeVisible();
    await expect(
      outputData.getByText("Đã nối dữ liệu với công việc", { exact: true }),
    ).toBeVisible();
    const conditionalJoin = outline.getByRole("button", {
      name: /Hợp nhánh theo điều kiện Đồng bộ theo điều kiện, cấp/,
    });
    await expect(conditionalJoin).toBeVisible();
    await expect(
      conditionalJoin.getByText(`Điều kiện: ${activationCondition}`, {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("advanced-full-authoring-mobile-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });
});
