import AxeBuilder from "@axe-core/playwright";
import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNPlane,
  BPMNEdge,
  BPMNShape,
  Collaboration,
  Definitions,
  Lane,
  Process,
} from "bpmn-moddle";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import {
  arrangeSelectedBpmnElements,
  assertNoDanglingAriaControls,
  assertNoDocumentHorizontalOverflow,
  assertPrimaryBpmnCopyIsPlain,
  assertReadableBpmnHelperText,
  convertCurrentModelToSwimlane,
  createBpmnModelViaApi,
  downloadBpmnDiagram,
  expectValidBpmnSvgDownload,
  expectValidPngDownload,
  openBpmnComponentLauncher,
  openBpmnDownloadDialog,
  readBpmnDraft,
  selectBpmnCanvasElements,
  waitForBpmnDraftAcknowledgement,
  type BpmnSwimlaneOrientation,
} from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E SDD56 Completion ";
const createdModelIds: string[] = [];

async function createCoreModel(
  page: Page,
  suffix: string,
  xml = starterBpmnXml,
) {
  const created = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}${suffix} ${Date.now()}`,
    description: "Deterministic SDD56 browser completion proof",
    purpose: "REFERENCE",
    profileId: "teb-core-starter@2",
    xml,
    idempotencyKey: `e2e-sdd56:${suffix}:${Date.now()}`,
  });
  createdModelIds.push(created.modelId);
  await page.goto(`/studio/diagram/${created.modelId}`);
  await expect(page.getByTestId("bpmn-modeler")).toBeVisible();
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

async function shapeBox(page: Page, elementId: string) {
  const bounds = await page
    .locator(`.bpmn-modeler .djs-shape[data-element-id="${elementId}"] > .djs-visual`)
    .boundingBox();
  expect(bounds, `missing rendered bounds for ${elementId}`).not.toBeNull();
  return bounds!;
}

async function diagramGeometry(xml: string) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  return (definitions.diagrams[0].plane.planeElement ?? []).map((element) => {
    if (element.$type === "bpmndi:BPMNShape") {
      const shape = element as BPMNShape & { id: string };
      const { x, y, width, height } = shape.bounds;
      expect(shape.bpmnElement).toBeDefined();
      return { id: shape.id, elementId: shape.bpmnElement!.id, x, y, width, height };
    }
    const edge = element as BPMNEdge & { id: string };
    expect(edge.bpmnElement).toBeDefined();
    return {
      id: edge.id,
      elementId: edge.bpmnElement!.id,
      waypoints: edge.waypoint.map(({ x, y }) => ({ x, y })),
    };
  });
}

async function assertConvertedSwimlane(
  xml: string,
  orientation: BpmnSwimlaneOrientation,
) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const collaboration = definitions.rootElements.find(
    (element): element is Collaboration =>
      element.$type === "bpmn:Collaboration",
  );
  const process = definitions.rootElements.find(
    (element): element is Process => element.$type === "bpmn:Process",
  );
  expect(collaboration?.participants).toHaveLength(1);
  expect(process?.laneSets).toHaveLength(1);
  const lanes = (process?.laneSets[0]?.lanes ?? []) as Lane[];
  expect(lanes.map((lane) => lane.name)).toEqual(
    orientation === "horizontal"
      ? ["Vai trò trên", "Vai trò dưới"]
      : ["Vai trò trái", "Vai trò phải"],
  );
  const plane = definitions.diagrams[0]?.plane as BPMNPlane;
  const participantId = collaboration!.participants[0]!.id;
  const frameShapes = (plane.planeElement ?? []).filter(
    (element): element is BPMNShape =>
      element.$type === "bpmndi:BPMNShape" &&
      [participantId, ...lanes.map((lane) => lane.id)].includes(
        (element as BPMNShape).bpmnElement?.id ?? "",
      ),
  );
  expect(frameShapes).toHaveLength(3);
  expect(frameShapes.map((shape) => shape.isHorizontal)).toEqual([
    orientation === "horizontal",
    orientation === "horizontal",
    orientation === "horizontal",
  ]);
  for (const preservedId of [
    "Start_Submitted",
    "Task_Intake",
    "Gateway_Ready",
    "Task_Publish",
    "Task_Revise",
    "End_Reviewed",
  ]) {
    expect(parsed.elementsById[preservedId]).toBeDefined();
  }
}

test.describe("SDD56 BPMN completion journeys", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("downloads validated BPMN SVG and PNG without mutating the draft", async ({
    page,
  }) => {
    const modelId = await createCoreModel(page, "downloads");
    const before = await readBpmnDraft(page, modelId);
    const undo = page.getByRole("button", { name: "Hoàn tác", exact: true });
    const redo = page.getByRole("button", { name: "Làm lại", exact: true });
    const historyBefore = {
      undoDisabled: await undo.isDisabled(),
      redoDisabled: await redo.isDisabled(),
    };
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

    const bpmnDownload = await downloadBpmnDiagram(page, "bpmn");
    expect(bpmnDownload.suggestedFilename()).toMatch(/\.bpmn$/u);
    const bpmnPath = await bpmnDownload.path();
    expect(bpmnPath).toBeTruthy();
    const downloadedXml = await readFile(bpmnPath!, "utf8");
    expect(downloadedXml).toContain('id="Task_Publish"');
    await expectValidBpmnSvgDownload(
      await downloadBpmnDiagram(page, "svg"),
      {
        taskWidth: 130,
        taskHeight: 80,
        visibleText: "Chuẩn bị xuất bản",
      },
    );
    await expectValidPngDownload(await downloadBpmnDiagram(page, "png"));

    const after = await readBpmnDraft(page, modelId);
    expect(after.revisionToken).toBe(before.revisionToken);
    expect(after.canonicalXml).toBe(before.canonicalXml);
    expect(await undo.isDisabled()).toBe(historyBefore.undoDisabled);
    expect(await redo.isDisabled()).toBe(historyBefore.redoDisabled);
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  });

  test("sanitizes hostile SVG at runtime and emits no PNG download after raster failure", async ({
    page,
  }) => {
    await createCoreModel(page, "hostile-download");
    await page.evaluate(() => {
      const original = DOMParser.prototype.parseFromString;
      const runtime = window as typeof window & {
        __restoreBpmnDomParser?: () => void;
      };
      runtime.__restoreBpmnDomParser = () => {
        DOMParser.prototype.parseFromString = original;
      };
      DOMParser.prototype.parseFromString = function parseHostileSvg(
        source: string,
        mimeType: DOMParserSupportedType,
      ) {
        if (mimeType !== "image/svg+xml") {
          return original.call(this, source, mimeType);
        }
        return original.call(
          this,
          `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="160" height="100" viewBox="0 0 160 100" onload="alert(1)">
            <defs><marker id="safe-arrow"><path d="M0 0 L8 4 L0 8 Z" fill="#292933" /></marker></defs>
            <script>alert(1)</script>
            <foreignObject><body xmlns="http://www.w3.org/1999/xhtml">unsafe</body></foreignObject>
            <image href="https://outside.invalid/track.svg" width="1" height="1" />
            <a xlink:href="javascript:alert(1)"><text>unsafe link</text></a>
            <rect width="130" height="80" stroke="#292933" fill="#ffffff" marker-end="url(#safe-arrow)" onclick="alert(1)" style="filter:url(https://outside.invalid/filter.svg#x)" />
            <text>Sanitized task</text>
          </svg>`,
          mimeType,
        );
      };
    });
    const svg = await expectValidBpmnSvgDownload(
      await downloadBpmnDiagram(page, "svg"),
      { taskWidth: 130, taskHeight: 80, visibleText: "Sanitized task" },
    );
    expect(svg).not.toMatch(
      /<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:|https:\/\/outside\.invalid|unsafe link/iu,
    );
    await page.evaluate(() => {
      const runtime = window as typeof window & {
        __restoreBpmnDomParser?: () => void;
      };
      runtime.__restoreBpmnDomParser?.();
      delete runtime.__restoreBpmnDomParser;
    });

    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toBlob = function forcePngFailure(callback) {
        callback(null);
      };
    });
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    const dialog = await openBpmnDownloadDialog(page);
    await dialog
      .getByRole("group", { name: "Định dạng tệp" })
      .getByRole("button")
      .filter({ hasText: ".png" })
      .click();
    await expect(
      page.getByText("Chưa thể tạo tệp an toàn.", { exact: false }),
    ).toBeVisible();
    expect(downloads).toEqual([]);
  });

  test("arranges with native commands and restores the geometry with one Undo", async ({
    page,
  }) => {
    const modelId = await createCoreModel(page, "arrange");
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    const originalXml = (await readBpmnDraft(page, modelId)).canonicalXml;
    const intake = page.locator('.bpmn-modeler .djs-shape[data-element-id="Task_Intake"]');
    const publish = page.locator('.bpmn-modeler .djs-shape[data-element-id="Task_Publish"]');
    const originalIntakeTransform = await intake.getAttribute("transform");
    const originalPublishTransform = await publish.getAttribute("transform");
    expect(originalIntakeTransform).toBeTruthy();
    expect(originalPublishTransform).toBeTruthy();
    await selectBpmnCanvasElements(page, ["Task_Intake", "Task_Publish"]);
    await assertPrimaryBpmnCopyIsPlain(page);
    await waitForBpmnDraftAcknowledgement(page, modelId, () =>
      arrangeSelectedBpmnElements(page, "Căn trên"),
    );
    const alignedIntake = await shapeBox(page, "Task_Intake");
    const alignedPublish = await shapeBox(page, "Task_Publish");
    expect(Math.abs(alignedIntake.y - alignedPublish.y)).toBeLessThanOrEqual(1);
    const alignedXml = (await readBpmnDraft(page, modelId)).canonicalXml;
    const alignedModel = await new BpmnModdle().fromXML(alignedXml);
    const savedIntake = alignedModel.elementsById.Shape_Intake as unknown as BPMNShape;
    const savedPublish = alignedModel.elementsById.Shape_Publish as unknown as BPMNShape;
    expect(savedIntake.bounds.y).toBe(savedPublish.bounds.y);
    expect(alignedXml).not.toBe(originalXml);

    await waitForBpmnDraftAcknowledgement(page, modelId, () =>
      page.getByRole("button", { name: "Hoàn tác", exact: true }).click(),
    );
    // Undo restores model geometry, not the browser's independently scrollable viewport.
    await expect(intake).toHaveAttribute("transform", originalIntakeTransform!);
    await expect(publish).toHaveAttribute("transform", originalPublishTransform!);
    // Native serialization materializes initially omitted default label bounds.
    // Every shape bound and connector waypoint must nevertheless restore exactly.
    expect(await diagramGeometry((await readBpmnDraft(page, modelId)).canonicalXml))
      .toEqual(await diagramGeometry(originalXml));
    await expect(
      page.getByRole("button", { name: "Hoàn tác", exact: true }),
    ).toBeDisabled();
  });

  for (const orientation of ["horizontal", "vertical"] as const) {
    test(`converts the same Core model to a ${orientation} Collaboration swimlane`, async ({
      page,
    }) => {
      const modelId = await createCoreModel(page, `convert-${orientation}`);
      const before = await readBpmnDraft(page, modelId);
      await convertCurrentModelToSwimlane(page, orientation);
      const after = await readBpmnDraft(page, modelId);
      expect(after.profileId).toBe("teb-collaboration-swimlane-layouts@1");
      expect(after.revisionToken).not.toBe(before.revisionToken);
      await assertConvertedSwimlane(after.canonicalXml, orientation);
      await page.reload();
      expect((await readBpmnDraft(page, modelId)).canonicalXml).toBe(
        after.canonicalXml,
      );
    });
  }

  test("keeps ARIA responsive plain-copy and 200%-equivalent reflow gates explicit", async ({
    page,
  }, testInfo) => {
    await createCoreModel(page, "responsive-a11y");
    await page.setViewportSize({ width: 1024, height: 768 });
    await openBpmnComponentLauncher(page);
    await assertNoDanglingAriaControls(page);
    await assertNoDocumentHorizontalOverflow(page);
    await assertPrimaryBpmnCopyIsPlain(page);
    await assertReadableBpmnHelperText(page);
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    await testInfo.attach("axe-bpmn-completion", {
      body: JSON.stringify(axe, null, 2),
      contentType: "application/json",
    });
    expect(
      axe.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);

    await page
      .getByRole("button", { name: "Đóng thư viện thành phần" })
      .click();
    await page
      .locator('.bpmn-modeler .djs-shape[data-element-id="Task_Intake"]')
      .click();
    await assertPrimaryBpmnCopyIsPlain(page);
    await page.getByRole("button", { name: "Xoá phần tử", exact: true }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Xoá phần tử này?" }),
    ).toBeVisible();
    await assertPrimaryBpmnCopyIsPlain(page);
    await page
      .getByRole("alertdialog", { name: "Xoá phần tử này?" })
      .getByRole("button", { name: "Huỷ" })
      .click();
    await page.setViewportSize({ width: 768, height: 720 });
    await assertNoDanglingAriaControls(page);
    await assertNoDocumentHorizontalOverflow(page);
    await page.setViewportSize({ width: 720, height: 450 });
    await expect(page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true })).toBeVisible();
    await assertNoDocumentHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.locator(".bpmn-mobile-outline-shell.bpmn-outline"),
    ).toBeVisible();
    await expect(page.locator(".bpmn-desktop-mutation").first()).toBeHidden();
    await assertNoDanglingAriaControls(page);
    await assertNoDocumentHorizontalOverflow(page);
  });
});
