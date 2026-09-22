import AxeBuilder from "@axe-core/playwright";
import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNShape,
  Definitions,
  Group,
  Process,
  TextAnnotation,
} from "bpmn-moddle";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { collaborationSwimlaneLayoutsBpmnProfile } from "../../../modules/process-modeling/domain/collaboration-profile";
import {
  createBpmnModelViaDialog,
  expectValidBpmnSvgDownload,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Full Authoring Artifacts ";
const fullProfileId = collaborationSwimlaneLayoutsBpmnProfile.id;
const annotationText = "Evidence required before editorial approval.";
const groupTitle = "Editorial evidence";
const createdModelIds: string[] = [];
let durableModelId: string | undefined;

type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type ColorShape = BPMNShape & {
  readonly get: (property: string) => unknown;
};

type ArtifactSnapshot = {
  readonly annotation: {
    readonly id: string;
    readonly text: string;
    readonly textFormat: string;
    readonly bounds: Bounds;
    readonly fill?: string;
    readonly stroke?: string;
  };
  readonly group: {
    readonly id: string;
    readonly categoryValueId: string;
    readonly title: string;
    readonly bounds: Bounds;
    readonly stroke?: string;
  };
  readonly flowNodeIds: readonly string[];
};

async function createFullCollaborationModel(page: Page) {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${Date.now()}`,
    profileLabel: "Cộng tác theo vai trò · khuyên dùng",
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  expect((await draft(page, created.modelId)).profileId).toBe(fullProfileId);
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

function boundsOf(shape: BPMNShape | undefined, elementId: string): Bounds {
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

async function artifactSnapshot(xml: string): Promise<ArtifactSnapshot> {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const process = definitions.rootElements.find(
    (element) =>
      element.$type === "bpmn:Process" &&
      element.id === "Process_Editorial",
  ) as Process | undefined;
  expect(process).toBeTruthy();
  const artifacts = definitions.rootElements.flatMap((element) =>
    "artifacts" in element && Array.isArray(element.artifacts)
      ? element.artifacts
      : [],
  );
  const annotation = artifacts.find(
    (artifact) =>
      artifact.$type === "bpmn:TextAnnotation" &&
      (artifact as TextAnnotation).text === annotationText,
  ) as TextAnnotation | undefined;
  const group = artifacts.find(
    (artifact) =>
      artifact.$type === "bpmn:Group" &&
      (artifact as Group).categoryValueRef?.value === groupTitle,
  ) as Group | undefined;
  expect(annotation).toBeTruthy();
  expect(group).toBeTruthy();

  const shapes = new Map(
    definitions.diagrams
      .flatMap((diagram) => diagram.plane?.planeElement ?? [])
      .filter((element): element is BPMNShape =>
        element.$type === "bpmndi:BPMNShape")
      .map((shape) => [shape.bpmnElement?.id, shape]),
  );
  const annotationShape = shapes.get(annotation!.id) as ColorShape | undefined;
  const groupShape = shapes.get(group!.id) as ColorShape | undefined;
  const annotationFill = annotationShape?.get("bioc:fill") as
    | string
    | undefined;
  const annotationStroke = annotationShape?.get("bioc:stroke") as
    | string
    | undefined;
  const groupStroke = groupShape?.get("bioc:stroke") as string | undefined;

  return {
    annotation: {
      id: annotation!.id,
      text: annotation!.text,
      textFormat: annotation!.textFormat,
      bounds: boundsOf(annotationShape, annotation!.id),
      ...(annotationFill ? { fill: annotationFill } : {}),
      ...(annotationStroke ? { stroke: annotationStroke } : {}),
    },
    group: {
      id: group!.id,
      categoryValueId: group!.categoryValueRef.id,
      title: group!.categoryValueRef.value,
      bounds: boundsOf(groupShape, group!.id),
      ...(groupStroke ? { stroke: groupStroke } : {}),
    },
    flowNodeIds: process!.flowElements
      .filter((element) => element.$type !== "bpmn:SequenceFlow")
      .map((element) => element.id),
  };
}

async function createFromLauncher(page: Page, toolId: string) {
  const shapes = page.locator(".bpmn-modeler .djs-shape");
  const before = await shapes.count();
  await page
    .getByRole("button", { name: "Thành phần", exact: true })
    .click();
  const item = page.locator(`[data-bpmn-tool-id="${toolId}"]`).first();
  await expect(item).toHaveAttribute("data-bpmn-tool-actionability", "usable");
  await item.focus();
  await item.press("Enter");
  await expect.poll(() => shapes.count()).toBeGreaterThan(before);
  const selectedId = await page
    .locator(".bpmn-modeler .djs-shape.selected")
    .getAttribute("data-element-id");
  expect(selectedId).toBeTruthy();
  return selectedId!;
}

async function selectOutlineItem(page: Page, name: string) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: name })
    .click();
}

test.describe.serial("BPMN Full Authoring artifacts and persisted colors", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("creates Collaboration Full directly and durably authors annotation, titled Group and DI color", async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    const modelId = await createFullCollaborationModel(page);
    durableModelId = modelId;

    await page
      .getByRole("button", { name: "Thành phần", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Chọn thành phần" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-bpmn-tool-id="association"]').first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Đóng thư viện thành phần" }).click();

    await selectOutlineItem(page, "Refine story");
    const annotationId = await createFromLauncher(page, "text-annotation");
    const annotationEditor = page
      .getByRole("region", { name: "Nội dung chú thích" })
      .getByRole("textbox", { name: "Nội dung" });
    await expect(annotationEditor).toBeFocused();
    await annotationEditor.fill(annotationText);
    await annotationEditor.press("ControlOrMeta+Enter");
    const annotationDraft = await waitForDraft(
      page,
      modelId,
      (xml) => xml.includes(annotationText),
    );
    expect(annotationDraft.profileId).toBe(fullProfileId);
    expect(annotationDraft.canonicalXml).toContain(`id="${annotationId}"`);

    const unappliedAnnotationDraft =
      "Bản nháp chú thích chưa áp dụng\nVẫn giữ nguyên khi xem lại lịch sử";
    await annotationEditor.fill(unappliedAnnotationDraft);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await waitForDraft(
      page,
      modelId,
      (xml) => !xml.includes(annotationText),
    );
    await expect(annotationEditor).toHaveValue(unappliedAnnotationDraft);
    await page.getByRole("button", { name: "Làm lại" }).click();
    await waitForDraft(page, modelId, (xml) => xml.includes(annotationText));
    await expect(annotationEditor).toHaveValue(unappliedAnnotationDraft);
    await annotationEditor.focus();
    await annotationEditor.press("Escape");
    await expect(annotationEditor).toHaveValue(annotationText);

    await selectOutlineItem(page, "Refine story");
    const groupId = await createFromLauncher(page, "group");
    const titleEditor = page
      .getByRole("region", { name: "Tiêu đề nhóm" })
      .getByRole("textbox", { name: "Tiêu đề" });
    await expect(titleEditor).toBeFocused();
    await titleEditor.fill(groupTitle);
    await titleEditor.press("ControlOrMeta+Enter");
    const externalGroupTitle = page.locator(
      `.bpmn-modeler .djs-element[data-element-id="${groupId}_label"]`,
    );
    const titledDraft = await waitForDraft(
      page,
      modelId,
      (xml) => xml.includes(groupTitle),
    );
    expect(titledDraft.canonicalXml).toContain(`id="${groupId}"`);
    // SVG may wrap within a word, not only at spaces. Verify every rendered
    // character without inventing word separators at tspan boundaries; the
    // persisted canonical XML above independently verifies the exact title.
    const expectRenderedGroupTitle = async (title: string) => {
      await expect.poll(async () =>
        (await externalGroupTitle.locator("tspan").allTextContents()).join("").replace(/\s/g, ""),
      ).toBe(title.replace(/\s/g, ""));
    };
    await expectRenderedGroupTitle(groupTitle);

    const unappliedGroupTitle = "Tiêu đề nhóm đang soạn chưa áp dụng";
    await titleEditor.fill(unappliedGroupTitle);
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await waitForDraft(page, modelId, (xml) => !xml.includes(groupTitle));
    await expectRenderedGroupTitle("Nhóm mới");
    await expect(titleEditor).toHaveValue(unappliedGroupTitle);
    await page.getByRole("button", { name: "Làm lại" }).click();
    await waitForDraft(page, modelId, (xml) => xml.includes(groupTitle));
    await expectRenderedGroupTitle(groupTitle);
    await expect(titleEditor).toHaveValue(unappliedGroupTitle);
    await titleEditor.focus();
    await titleEditor.press("Escape");
    await expect(titleEditor).toHaveValue(groupTitle);

    // Deselect the group first: native resize handles can cover a wrapped title.
    await selectOutlineItem(page, "Refine story");
    await openBpmnInspectorView(page, "structure");
    await externalGroupTitle.click();
    await expect(
      page.locator(
        `.bpmn-modeler .djs-shape.selected[data-element-id="${groupId}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Tiêu đề nhóm" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Tiêu đề" }),
    ).toHaveValue(groupTitle);

    const colorRegion = page.getByRole("group", { name: "Màu thành phần" });
    await expect(colorRegion).toBeVisible();
    const authoredSwatch = colorRegion.getByRole("radio", {
      name: "Tím",
    });
    await expect(authoredSwatch).toHaveAccessibleName("Tím");
    await authoredSwatch.focus();
    await page.keyboard.press("Space");
    const coloredDraft = await waitForDraft(
      page,
      modelId,
      (xml) =>
        xml.includes(`bpmnElement="${groupId}"`) &&
        /bioc:stroke="#[0-9A-F]{6}"/.test(xml),
    );
    const colored = await artifactSnapshot(coloredDraft.canonicalXml);
    expect(colored.annotation.id).toBe(annotationId);
    expect(colored.annotation.textFormat).toBe("text/plain");
    expect(colored.group.id).toBe(groupId);
    expect(colored.group.categoryValueId).toBeTruthy();
    expect(colored.group.stroke).toMatch(/^#[0-9A-F]{6}$/);
    expect(colored.flowNodeIds).toEqual(
      expect.arrayContaining([
        "Start_Draft",
        "Task_Write",
        "Task_Publish",
        "End_Published",
      ]),
    );

    await page.getByRole("button", { name: "Hoàn tác" }).click();
    const uncoloredDraft = await waitForDraft(
      page,
      modelId,
      (xml) => !/bioc:stroke="#[0-9A-F]{6}"/.test(xml),
    );
    expect((await artifactSnapshot(uncoloredDraft.canonicalXml)).group.stroke)
      .toBeUndefined();
    await page.getByRole("button", { name: "Làm lại" }).click();
    const recoloredDraft = await waitForDraft(
      page,
      modelId,
      (xml) => /bioc:stroke="#[0-9A-F]{6}"/.test(xml),
    );
    expect(await artifactSnapshot(recoloredDraft.canonicalXml)).toEqual(colored);

    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Tải tệp" }).click();
    const downloadDialog = page.getByRole("dialog", {
      name: "Chọn định dạng tải xuống",
    });
    await expect(downloadDialog).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await downloadDialog.getByRole("button", { name: /Tệp quy trình/ }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedXml = readFileSync(downloadPath!, "utf8");
    expect(await artifactSnapshot(exportedXml)).toEqual(colored);
    await testInfo.attach("full-authoring-artifacts-export.bpmn", {
      body: exportedXml,
      contentType: "application/xml",
    });

    await page.locator(".bpmn-modeler").evaluate((modeler) => {
      const namespace = "http://www.w3.org/2000/svg";
      const layers = modeler.querySelectorAll(
        'svg g.viewport > g[class^="layer-root-"]',
      );
      if (layers.length !== 1) {
        throw new Error(`Expected one active SVG layer, found ${layers.length}`);
      }
      const layer = layers[0]!;
      const script = document.createElementNS(namespace, "script");
      script.textContent = "window.__unsafeSvgRan = true";
      const foreignObject = document.createElementNS(
        namespace,
        "foreignObject",
      );
      foreignObject.setAttribute("width", "40");
      foreignObject.setAttribute("height", "40");
      const unsafePath = document.createElementNS(namespace, "path");
      unsafePath.setAttribute("d", "M 0 0 L 10 10");
      unsafePath.setAttribute(
        "style",
        "stroke:#ef4444;fill:url(https://example.com/tracker.svg#paint);animation:spin 1s infinite",
      );
      unsafePath.setAttribute("onclick", "window.__unsafeSvgRan = true");
      const unsafeUse = document.createElementNS(namespace, "use");
      unsafeUse.setAttribute("href", "data:image/svg+xml;base64,PHN2Zy8+");
      layer.append(script, foreignObject, unsafePath, unsafeUse);
    });

    await page.getByRole("button", { name: "Tải tệp" }).click();
    await expect(downloadDialog).toBeVisible();
    const svgDownloadPromise = page.waitForEvent("download");
    await downloadDialog.getByRole("button", { name: /Ảnh vector/ }).click();
    const svgDownload = await svgDownloadPromise;
    const exportedSvg = await expectValidBpmnSvgDownload(svgDownload, {
      taskWidth: 120,
      taskHeight: 80,
      visibleText: "Refine story",
    });
    expect(exportedSvg).not.toContain(" style=");
    expect(exportedSvg).not.toMatch(/<(?:script|foreignObject)\b/iu);
    expect(exportedSvg).not.toContain("onclick=");
    expect(exportedSvg).not.toMatch(
      /(?:javascript:|data:|url\((?:"|')?\s*(?:\/\/|https?:))/iu,
    );
    await testInfo.attach("full-authoring-artifacts-export.svg", {
      body: exportedSvg,
      contentType: "image/svg+xml",
    });

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    await expect(
      page.locator("footer").getByText("Bố cục vai trò", { exact: true }),
    ).toBeVisible();
    const reloadedDraft = await draft(page, modelId);
    expect(await artifactSnapshot(reloadedDraft.canonicalXml)).toEqual(colored);

    await openBpmnInspectorView(page, "versions");
    await page
      .getByLabel("Ghi chú cho bản mới")
      .fill("Full Authoring artifact and color checkpoint");
    await page.getByRole("button", { name: "Xác nhận lưu mốc" }).click();
    await expect(page.getByText(/Đã lưu mốc 1/)).toBeVisible({
      timeout: 15_000,
    });
    const immutableVersions = await versions(page, modelId);
    expect(immutableVersions).toHaveLength(1);
    expect(immutableVersions[0]).toMatchObject({
      versionNumber: 1,
      profileId: fullProfileId,
      xmlChecksum: createHash("sha256")
        .update(reloadedDraft.canonicalXml)
        .digest("hex"),
    });

    await openBpmnInspectorView(page, "structure");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("full-authoring-artifacts-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);

    await page.emulateMedia({ forcedColors: "active" });
    const forcedAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("full-authoring-forced-colors-axe.json", {
      body: JSON.stringify(forcedAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(forcedAccessibility.violations).toEqual([]);
  });

  test("390px remains viewer-first with artifact text while persisted color stays intact", async ({
    page,
  }, testInfo) => {
    test.skip(!durableModelId, "Desktop durable Full Authoring model required.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/diagram/${durableModelId}`);
    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Thành phần", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("group", { name: "Màu thành phần" }),
    ).toHaveCount(0);

    const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
    await expect(outline).toBeVisible();
    await expect(outline.getByText(annotationText, { exact: true }))
      .toBeVisible();
    await expect(outline.getByText(groupTitle, { exact: true })).toBeVisible();
    await expect(outline.getByText("Nhóm trực quan", { exact: true }))
      .toBeVisible();
    await expect(outline).not.toContainText(/#[0-9A-F]{6}/);
    const mobileDraft = await draft(page, durableModelId!);
    expect(
      (await artifactSnapshot(mobileDraft.canonicalXml)).group.stroke,
    ).toMatch(/^#[0-9A-F]{6}$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("full-authoring-mobile-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });
});
