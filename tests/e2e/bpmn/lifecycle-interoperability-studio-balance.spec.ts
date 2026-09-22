import AxeBuilder from "@axe-core/playwright";
import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNShape,
  DataStoreReference,
  Definitions,
  Process,
  SubProcess,
} from "bpmn-moddle";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createBpmnModelViaDialog,
  downloadBpmnDiagram,
  findBpmnLauncherTool,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Collaboration Lifecycle Studio Balance ";
const finalProfileId = "teb-collaboration-complex-routing@1";
const duplicateStoreReferenceId = "DataStoreReference_E2E_Shared_Second";
const externalFixturePath = resolve(
  process.cwd(),
  "tests/fixtures/external/camunda-modeler-collaboration.bpmn",
);
const externalManifestPath = resolve(
  process.cwd(),
  "tests/fixtures/external/camunda-modeler-collaboration.provenance.json",
);
const createdModelIds: string[] = [];

type Draft = {
  readonly profileId: string;
  readonly canonicalXml: string;
  readonly revisionToken: string;
};

type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type ElementPlacement = {
  readonly containerId: string;
  readonly shapeId: string;
  readonly bounds: Bounds;
};

type StoreProjection = {
  readonly backingId: string;
  readonly referenceIds: readonly string[];
};

type IdentifiedBpmnShape = BPMNShape & {
  readonly id: string;
};

async function createFinalModel(page: Page) {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${Date.now()}`,
    profileLabel: "Quy trình cộng tác nâng cao",
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  expect((await getDraft(page, created.modelId)).profileId).toBe(finalProfileId);
  return created.modelId;
}

async function getDraft(page: Page, modelId: string): Promise<Draft> {
  const response = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as Draft;
}

async function getVersions(page: Page, modelId: string) {
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
  predicate: (draft: Draft) => boolean | Promise<boolean>,
) {
  await expect.poll(async () => await predicate(await getDraft(page, modelId)))
    .toBe(true);
  return getDraft(page, modelId);
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
  const responseBody = await response.text();
  expect(
    response.ok(),
    `Draft autosave failed with ${response.status()}: ${responseBody}`,
  ).toBe(true);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
}

async function selectOutline(page: Page, text: string | RegExp) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: text })
    .click();
}

async function selectedOutlineName(page: Page) {
  await openBpmnInspectorView(page, "structure");
  const name = await page
    .locator(
      '.bpmn-studio__inspector .bpmn-outline button[aria-current="true"]',
    )
    .getAttribute("aria-label");
  expect(name).toBeTruthy();
  return name!;
}

async function selectOutlineByName(page: Page, name: string) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button", { name, exact: true })
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

function shapeMap(definitions: Definitions) {
  return new Map(
    definitions.diagrams
      .flatMap((diagram) => diagram.plane?.planeElement ?? [])
      .filter(
        (element): element is IdentifiedBpmnShape =>
          element.$type === "bpmndi:BPMNShape",
      )
      .map((shape) => [shape.bpmnElement?.id, shape]),
  );
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

async function elementPlacement(
  xml: string,
  elementId: string,
): Promise<ElementPlacement> {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const processes = definitions.rootElements.filter(
    (element): element is Process => element.$type === "bpmn:Process",
  );
  let containerId: string | undefined;
  for (const process of processes) {
    if (process.flowElements.some((element) => element.id === elementId)) {
      containerId = process.id;
      break;
    }
    const parent = process.flowElements
      .filter(
        (element): element is SubProcess =>
          element.$type === "bpmn:SubProcess",
      )
      .find((subProcess) =>
        subProcess.flowElements.some((element) => element.id === elementId),
      );
    if (parent) {
      containerId = parent.id;
      break;
    }
  }
  expect(containerId, `${elementId} requires one semantic container`).toBeTruthy();
  const shape = shapeMap(definitions).get(elementId);
  expect(shape?.id).toBeTruthy();
  return {
    containerId: containerId!,
    shapeId: shape!.id,
    bounds: finiteBounds(shape, elementId),
  };
}

async function subProcessClosure(xml: string, subProcessId: string) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const subProcess = definitions.rootElements
    .filter((element): element is Process => element.$type === "bpmn:Process")
    .flatMap((process) => process.flowElements)
    .find((element) => element.id === subProcessId) as SubProcess | undefined;
  expect(subProcess).toBeTruthy();
  return [
    subProcess!.id,
    ...subProcess!.flowElements.map((element) => element.id),
  ].sort();
}

async function storeProjection(
  xml: string,
  referenceId: string,
): Promise<StoreProjection> {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const references = definitions.rootElements
    .filter((element): element is Process => element.$type === "bpmn:Process")
    .flatMap((process) => {
      const flowElements = process.flowElements ?? [];
      return [
      ...flowElements,
      ...flowElements
        .filter(
          (element): element is SubProcess =>
            element.$type === "bpmn:SubProcess",
        )
        .flatMap((subProcess) => subProcess.flowElements ?? []),
      ];
    })
    .filter(
      (element): element is DataStoreReference =>
        element.$type === "bpmn:DataStoreReference",
    );
  const selected = references.find((reference) => reference.id === referenceId);
  expect(selected?.dataStoreRef?.id).toBeTruthy();
  return {
    backingId: selected!.dataStoreRef.id,
    referenceIds: references
      .filter(
        (reference) => reference.dataStoreRef?.id === selected!.dataStoreRef.id,
      )
      .map((reference) => reference.id)
      .sort(),
  };
}

async function duplicateDataStoreReference(
  xml: string,
  sourceReferenceId: string,
) {
  const moddle = new BpmnModdle();
  const parsed = await moddle.fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const process = definitions.rootElements
    .filter((element): element is Process => element.$type === "bpmn:Process")
    .find((candidate) =>
      candidate.flowElements.some(
        (element) => element.id === sourceReferenceId,
      ),
    );
  expect(process).toBeTruthy();
  const source = process!.flowElements.find(
    (element) => element.id === sourceReferenceId,
  ) as DataStoreReference | undefined;
  expect(source?.dataStoreRef).toBeTruthy();
  const sourceShape = shapeMap(definitions).get(sourceReferenceId);
  const sourceBounds = finiteBounds(sourceShape, sourceReferenceId);

  const duplicate = moddle.create("bpmn:DataStoreReference", {
    id: duplicateStoreReferenceId,
    name: `${source!.name} shared reference`,
    dataStoreRef: source!.dataStoreRef,
  }) as DataStoreReference;
  duplicate.$parent = process!;
  process!.flowElements.push(duplicate);

  const plane = definitions.diagrams[0]?.plane;
  expect(plane).toBeTruthy();
  const duplicateShape = moddle.create("bpmndi:BPMNShape", {
    id: `Shape_${duplicateStoreReferenceId}`,
    bpmnElement: duplicate,
  }) as BPMNShape;
  duplicateShape.$parent = plane!;
  duplicateShape.bounds = moddle.create("dc:Bounds", {
    x: sourceBounds.x + 150,
    y: sourceBounds.y,
    width: sourceBounds.width,
    height: sourceBounds.height,
  });
  duplicateShape.bounds.$parent = duplicateShape;
  plane!.planeElement.push(duplicateShape);

  return (await moddle.toXML(definitions, { format: true })).xml;
}

async function importXml(page: Page, xml: string, name: string) {
  const importAck = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith("/draft"),
  );
  await page.getByLabel("Chọn tệp sơ đồ").setInputFiles({
    name,
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  expect((await importAck).ok()).toBe(true);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
}

async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function expectTouchActionFits(page: Page, action: Locator) {
  const box = await action.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectDialogContainsIds(
  dialog: Locator,
  ids: readonly string[],
) {
  const details = dialog.locator("details");
  for (let index = 0; index < (await details.count()); index += 1) {
    const current = details.nth(index);
    if (!(await current.evaluate((element) => element.hasAttribute("open")))) {
      await current.locator(":scope > summary").click();
    }
  }
  for (const id of ids) {
    await expect(dialog.getByText(id, { exact: true }).first()).toBeVisible();
  }
}

async function deleteSelectedThroughImpact(
  page: Page,
  expectedIds: readonly string[],
) {
  await page.getByRole("button", { name: "Xoá phần tử" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Xoá phần tử này?",
  });
  await expectDialogContainsIds(dialog, expectedIds);
  await actionWithSaveAck(page, async () => {
    const confirm = dialog.getByRole("button", { name: "Xoá phần tử" });
    await confirm.focus();
    await page.keyboard.press("Enter");
  });
}

test.describe.serial("BPMN lifecycle and Studio balance", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("keeps lifecycle destructive actions exact, durable and responsive", async ({
    page,
  }, testInfo) => {
    test.setTimeout(210_000);
    page.setDefaultTimeout(10_000);
    const modelId = await createFinalModel(page);
    let patchCount = 0;
    page.on("request", (request) => {
      if (
        request.method() === "PATCH" &&
        new URL(request.url()).pathname.endsWith("/draft")
      ) {
        patchCount += 1;
      }
    });

    await selectOutline(page, "Refine story");
    const subProcessId = await createFromLibrary(
      page,
      "expanded-subprocess",
    );
    const subProcessOutlineName = await selectedOutlineName(page);
    await selectOutline(page, "Refine story");
    const standaloneTaskId = await createFromLibrary(page, "task");
    const standaloneTaskOutlineName = await selectedOutlineName(page);
    const beforeReparent = await waitForDraft(
      page,
      modelId,
      (current) =>
        current.canonicalXml.includes(`id="${subProcessId}"`) &&
        current.canonicalXml.includes(`id="${standaloneTaskId}"`),
    );
    const beforePlacement = await elementPlacement(
      beforeReparent.canonicalXml,
      standaloneTaskId,
    );

    await selectOutlineByName(page, standaloneTaskOutlineName);
    await openBpmnInspectorView(page, "edit");
    const reparentTrigger = page.getByRole("button", {
      name: "Di chuyển phần tử",
    });
    await reparentTrigger.focus();
    await page.keyboard.press("Enter");
    const reparentDialog = page.getByRole("dialog", {
      name: "Di chuyển phần tử",
    });
    await expect(reparentDialog).toBeVisible();
    await expectDialogContainsIds(reparentDialog, [standaloneTaskId]);
    await reparentDialog
      .getByRole("combobox", { name: "Vị trí mới" })
      .selectOption(subProcessId);
    const patchesBeforeCancel = patchCount;
    await page.keyboard.press("Escape");
    await expect(reparentDialog).toBeHidden();
    await expect(reparentTrigger).toBeFocused();
    expect(patchCount).toBe(patchesBeforeCancel);
    expect(await getDraft(page, modelId)).toEqual(beforeReparent);

    await reparentTrigger.focus();
    await page.keyboard.press("Enter");
    await reparentDialog
      .getByRole("combobox", { name: "Vị trí mới" })
      .selectOption(subProcessId);
    await actionWithSaveAck(page, async () => {
      const commit = reparentDialog.getByRole("button", {
        name: "Di chuyển phần tử",
      });
      await commit.focus();
      await page.keyboard.press("Enter");
    });
    const reparentedDraft = await waitForDraft(
      page,
      modelId,
      async (current) =>
        (await elementPlacement(current.canonicalXml, standaloneTaskId))
          .containerId === subProcessId,
    );
    const reparentedPlacement = await elementPlacement(
      reparentedDraft.canonicalXml,
      standaloneTaskId,
    );
    expect(reparentedPlacement.shapeId).toBe(beforePlacement.shapeId);

    await actionWithSaveAck(page, () =>
      page.getByRole("button", { name: "Hoàn tác", exact: true }).click(),
    );
    expect((await getDraft(page, modelId)).canonicalXml).toBe(
      beforeReparent.canonicalXml,
    );
    await actionWithSaveAck(page, () =>
      page.getByRole("button", { name: "Làm lại", exact: true }).click(),
    );
    expect((await getDraft(page, modelId)).canonicalXml).toBe(
      reparentedDraft.canonicalXml,
    );

    const closure = await subProcessClosure(
      reparentedDraft.canonicalXml,
      subProcessId,
    );
    await selectOutlineByName(page, subProcessOutlineName);
    await openBpmnInspectorView(page, "edit");
    const deleteTrigger = page.getByRole("button", {
      name: "Xoá phần tử",
    });
    await deleteTrigger.focus();
    await page.keyboard.press("Enter");
    const deleteDialog = page.getByRole("alertdialog", {
      name: "Xoá phần tử này?",
    });
    await expect(
      deleteDialog.locator(".bpmn-delete-subject"),
    ).toHaveText("Quy trình con");
    await expectDialogContainsIds(
      deleteDialog,
      closure.filter((id) => id !== subProcessId),
    );
    const patchesBeforeDeleteCancel = patchCount;
    await page.keyboard.press("Escape");
    await expect(deleteDialog).toBeHidden();
    await expect(deleteTrigger).toBeFocused();
    expect(patchCount).toBe(patchesBeforeDeleteCancel);
    const afterDeleteCancel = await getDraft(page, modelId);
    expect(afterDeleteCancel.canonicalXml).toBe(reparentedDraft.canonicalXml);

    await deleteTrigger.focus();
    await page.keyboard.press("Enter");
    await expectDialogContainsIds(
      deleteDialog,
      closure.filter((id) => id !== subProcessId),
    );
    await actionWithSaveAck(page, async () => {
      const cascade = deleteDialog.getByRole("button", {
        name: "Xoá phần tử",
      });
      await cascade.focus();
      await page.keyboard.press("Enter");
    });
    await waitForDraft(page, modelId, (current) =>
      closure.every((id) => !current.canonicalXml.includes(`id="${id}"`)),
    );
    await actionWithSaveAck(page, () =>
      page.getByRole("button", { name: "Hoàn tác", exact: true }).click(),
    );
    const restoredCascade = await getDraft(page, modelId);
    expect(
      await subProcessClosure(restoredCascade.canonicalXml, subProcessId),
    ).toEqual(closure);
    const restoredPlacement = await elementPlacement(
      restoredCascade.canonicalXml,
      standaloneTaskId,
    );
    expect(restoredPlacement.containerId).toBe(subProcessId);
    expect(restoredPlacement.shapeId).toBe(reparentedPlacement.shapeId);

    await selectOutlineByName(page, subProcessOutlineName);
    await openBpmnInspectorView(page, "edit");
    await deleteSelectedThroughImpact(
      page,
      closure.filter((id) => id !== subProcessId),
    );
    await waitForDraft(page, modelId, (current) =>
      closure.every((id) => !current.canonicalXml.includes(`id="${id}"`)),
    );

    await selectOutline(page, "Refine story");
    const firstStoreReferenceId = await createFromLibrary(
      page,
      "data-store",
    );
    const firstStoreOutlineName = await selectedOutlineName(page);
    const oneReferenceDraft = await waitForDraft(
      page,
      modelId,
      (current) =>
        current.canonicalXml.includes(`id="${firstStoreReferenceId}"`),
    );
    const sharedXml = await duplicateDataStoreReference(
      oneReferenceDraft.canonicalXml,
      firstStoreReferenceId,
    );
    await importXml(page, sharedXml, "shared-datastore-lifecycle.bpmn");
    const sharedDraft = await waitForDraft(
      page,
      modelId,
      (current) => current.canonicalXml.includes(duplicateStoreReferenceId),
    );
    const sharedStore = await storeProjection(
      sharedDraft.canonicalXml,
      firstStoreReferenceId,
    );
    expect(sharedStore.referenceIds).toEqual(
      [firstStoreReferenceId, duplicateStoreReferenceId].sort(),
    );

    await selectOutlineByName(page, firstStoreOutlineName);
    await openBpmnInspectorView(page, "edit");
    await deleteSelectedThroughImpact(
      page,
      [firstStoreReferenceId],
    );
    const oneSharedReferenceLeft = await waitForDraft(
      page,
      modelId,
      (current) =>
        !current.canonicalXml.includes(`id="${firstStoreReferenceId}"`) &&
        current.canonicalXml.includes(`id="${duplicateStoreReferenceId}"`) &&
        current.canonicalXml.includes(`id="${sharedStore.backingId}"`),
    );
    expect(
      await storeProjection(
        oneSharedReferenceLeft.canonicalXml,
        duplicateStoreReferenceId,
      ),
    ).toEqual({
      backingId: sharedStore.backingId,
      referenceIds: [duplicateStoreReferenceId],
    });

    await selectOutline(page, /shared reference/);
    await openBpmnInspectorView(page, "edit");
    await deleteSelectedThroughImpact(
      page,
      [duplicateStoreReferenceId],
    );
    const orphanDraft = await waitForDraft(
      page,
      modelId,
      (current) =>
        !current.canonicalXml.includes(`id="${duplicateStoreReferenceId}"`) &&
        current.canonicalXml.includes(`id="${sharedStore.backingId}"`),
    );

    await openBpmnInspectorView(page, "model");
    const dataStoreRegistry = page
      .locator("details.bpmn-datastore-registry")
      .first();
    if ((await dataStoreRegistry.getAttribute("open")) === null) {
      await dataStoreRegistry.locator(":scope > summary").click();
    }
    const cleanupTrigger = page.getByRole("button", {
      name: "Xoá kho dữ liệu không dùng",
    });
    await cleanupTrigger.focus();
    await page.keyboard.press("Enter");
    const cleanupDialog = page.getByRole("alertdialog", {
      name: "Xoá kho dữ liệu không dùng",
    });
    await expectDialogContainsIds(cleanupDialog, [sharedStore.backingId]);
    await actionWithSaveAck(page, async () => {
      const cleanup = cleanupDialog.getByRole("button", {
        name: "Xoá kho dữ liệu",
      });
      await cleanup.focus();
      await page.keyboard.press("Enter");
    });
    const cleanedDraft = await waitForDraft(
      page,
      modelId,
      (current) =>
        !current.canonicalXml.includes(`id="${sharedStore.backingId}"`),
    );
    expect(orphanDraft.profileId).toBe(finalProfileId);

    const externalBytes = readFileSync(externalFixturePath);
    const externalManifest = JSON.parse(
      readFileSync(externalManifestPath, "utf8"),
    ) as {
      readonly producerEvidence: {
        readonly tool: string;
        readonly version: string | null;
      };
      readonly integrity: { readonly value: string };
      readonly claimBoundary: { readonly statement: string };
    };
    expect(externalManifest.producerEvidence.tool).toBe("Camunda Modeler");
    expect(externalManifest.producerEvidence.version).toBe(
      "3.7.0-dev.20200128",
    );
    expect(externalManifest.claimBoundary.statement).toContain(
      "declared Collaboration IDs",
    );
    expect(createHash("sha256").update(externalBytes).digest("hex")).toBe(
      externalManifest.integrity.value,
    );
    await importXml(
      page,
      externalBytes.toString("utf8"),
      "camunda-modeler-collaboration.bpmn",
    );
    const externalDraft = await waitForDraft(
      page,
      modelId,
      (current) =>
        current.profileId === finalProfileId &&
        current.canonicalXml.includes('id="Collaboration_1hcwsxy"') &&
        current.canonicalXml.includes('id="Process_1tp2lk4"') &&
        current.canonicalXml.includes('id="StartEvent_1"'),
    );

    const download = await downloadBpmnDiagram(page, "bpmn");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedXml = readFileSync(downloadPath!, "utf8");
    const exported = await new BpmnModdle().fromXML(exportedXml);
    expect(
      (exported.rootElement as Definitions).rootElements.some(
        (element) => element.id === "Collaboration_1hcwsxy",
      ),
    ).toBe(true);
    await testInfo.attach("external-modeler-browser-round-trip.bpmn", {
      body: exportedXml,
      contentType: "application/xml",
    });
    expect(externalDraft.profileId).toBe(finalProfileId);
    await importXml(
      page,
      cleanedDraft.canonicalXml,
      "restore-lifecycle-after-external-proof.bpmn",
    );
    await waitForDraft(
      page,
      modelId,
      (current) => current.canonicalXml === cleanedDraft.canonicalXml,
    );

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    await expect(
      page
        .locator("footer.bpmn-studio__status")
        .getByText("Điều phối nâng cao", { exact: true }),
    ).toBeVisible();
    const reloadedDraft = await getDraft(page, modelId);
    expect(reloadedDraft.canonicalXml).toBe(cleanedDraft.canonicalXml);

    await openBpmnInspectorView(page, "versions");
    await page
      .getByLabel("Ghi chú cho bản mới")
      .fill("Lifecycle and Studio balance checkpoint");
    const versionAck = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/versions"),
    );
    await page.getByRole("button", { name: "Xác nhận lưu mốc" }).click();
    expect((await versionAck).ok()).toBe(true);
    await expect(page.getByText(/Đã lưu mốc 1/)).toBeVisible();
    const immutableVersions = await getVersions(page, modelId);
    expect(immutableVersions).toHaveLength(1);
    expect(immutableVersions[0]).toMatchObject({
      versionNumber: 1,
      profileId: finalProfileId,
      xmlChecksum: createHash("sha256")
        .update(reloadedDraft.canonicalXml)
        .digest("hex"),
    });

    await selectOutline(page, "Refine story");
    const successorTaskId = await createFromLibrary(page, "task");
    await waitForDraft(
      page,
      modelId,
      (current) => current.canonicalXml.includes(`id="${successorTaskId}"`),
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
    const restoredVersion = await waitForDraft(
      page,
      modelId,
      (current) =>
        !current.canonicalXml.includes(`id="${successorTaskId}"`) &&
        current.canonicalXml === reloadedDraft.canonicalXml,
    );
    expect(restoredVersion.profileId).toBe(finalProfileId);
    expect(await getVersions(page, modelId)).toEqual(immutableVersions);
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("bpmn-modeler")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Thành phần", exact: true }),
      ).toBeVisible();
      const exportAction = page.getByRole("button", { name: "Tải tệp" });
      await expect(exportAction).toBeVisible();
      await expectTouchActionFits(page, exportAction);
      await expectNoDocumentOverflow(page);
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByTestId("bpmn-modeler")).toBeVisible();
    const tabletExport = page.getByRole("button", { name: "Tải tệp" });
    await expect(tabletExport).toBeVisible();
    await expectTouchActionFits(page, tabletExport);
    await expect(
      page.getByRole("button", {
        name: /Di chuyển phần tử|Xoá phần tử|Xoá kho dữ liệu không dùng/,
      }),
    ).toHaveCount(0);
    await expectNoDocumentOverflow(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await openBpmnInspectorView(page, "structure");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("lifecycle-studio-balance-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);

    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    const forcedAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("lifecycle-studio-balance-forced-colors-axe.json", {
      body: JSON.stringify(forcedAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(forcedAccessibility.violations).toEqual([]);

    await page.emulateMedia({
      forcedColors: "none",
      reducedMotion: "no-preference",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Chọn thành phần" })).toBeHidden();
    await expect(page.locator(".bpmn-desktop-mutation:visible")).toHaveCount(0);
    await expect(
      page.locator(".bpmn-mobile-outline-shell.bpmn-outline"),
    ).toBeVisible();
    await expectNoDocumentOverflow(page);

    // Firefox transitions from forced system colors back to the theme. Audit
    // the settled normal state, not an intermediate background interpolation.
    await page.mouse.move(0, 0);
    await expect(page.getByRole("button", { name: "Tải tệp", exact: true }))
      .toHaveCSS("background-color", "rgb(104, 79, 232)");
    const mobileAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("lifecycle-studio-balance-mobile-axe.json", {
      body: JSON.stringify(mobileAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(mobileAccessibility.violations).toEqual([]);
  });
});
