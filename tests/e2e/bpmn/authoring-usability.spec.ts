import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { BpmnModdle, type BPMNShape, type Definitions } from "bpmn-moddle";
import { expect, test, type Page } from "@playwright/test";
import { coreFullAuthoringBpmnProfile } from "../../../modules/process-modeling/domain/core-profile";
import {
  createBpmnModelViaApi,
  createBpmnModelViaDialog,
  readBpmnDraft,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const prefix = "E2E SDD86 Authoring ";
const createdIds: string[] = [];
const taskIds = ["Task_Copy", "Task_Legal"] as const;
const nativeXml = readFileSync("tests/fixtures/structured-parallel-routing.bpmn", "utf8")
  .replace('id="Definitions_Structured_Parallel"', 'xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="Definitions_Structured_Parallel"')
  .replace('id="Shape_Task_Copy"', 'bioc:fill="#E8F2FF" bioc:stroke="#2863C7" id="Shape_Task_Copy"')
  .replace('id="Shape_Task_Legal"', 'bioc:fill="#FDEBEC" bioc:stroke="#B23845" id="Shape_Task_Legal"');

test.describe.configure({ timeout: 90_000 });
test.afterAll(async () => cleanupExactProcessModels(createdIds, prefix));

async function createNativeModel(page: Page) {
  const model = await createBpmnModelViaApi(page, {
    title: `${prefix}${randomUUID()}`,
    description: "Bulk color and annotation usability evidence",
    purpose: "REFERENCE",
    profileId: coreFullAuthoringBpmnProfile.id,
    xml: nativeXml,
    idempotencyKey: `authoring-${randomUUID()}`,
  });
  createdIds.push(model.modelId);
  await page.goto(`/studio/diagram/${model.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await expect(page.locator(".bpmn-canvas-loading")).toBeHidden();
  return model.modelId;
}

async function colors(xml: string) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const shapes = definitions.diagrams.flatMap((diagram) => diagram.plane?.planeElement ?? []);
  return taskIds.map((id) => {
    const shape = shapes.find((item) => item.$type === "bpmndi:BPMNShape" && item.bpmnElement?.id === id) as BPMNShape & { get(key: string): unknown };
    expect(shape).toBeTruthy();
    return { fill: shape.get("bioc:fill"), stroke: shape.get("bioc:stroke") };
  });
}

function taskShape(page: Page, id: string) {
  return page.locator(`.bpmn-modeler .djs-shape[data-element-id="${id}"]`);
}

async function selectTask(page: Page, id: string) {
  await page.getByRole("button", { name: "Hiển thị vừa khung", exact: true }).click();
  await taskShape(page, id).locator(".djs-hit").click();
  await expect(taskShape(page, id)).toHaveClass(/selected/u);
}

test("preserves imported colors, recolors a selection with one undo, and fits the selection without editing XML", async ({ page }) => {
  const modelId = await createNativeModel(page);
  const before = await readBpmnDraft(page, modelId);
  const originalColors = await colors(before.canonicalXml);
  expect(originalColors).toEqual([
    { fill: "#E8F2FF", stroke: "#2863C7" },
    { fill: "#FDEBEC", stroke: "#B23845" },
  ]);
  await selectTask(page, taskIds[0]);
  await openBpmnInspectorView(page, "edit");
  await expect(page.getByRole("radio", { name: "Xanh dương", exact: true })).toHaveAttribute("aria-checked", "true");
  await taskShape(page, taskIds[1]).locator(".djs-hit").click({ modifiers: ["Shift"] });
  for (const id of taskIds) await expect(taskShape(page, id)).toHaveClass(/selected/u);
  await page.getByRole("radio", { name: "Xanh lá", exact: true }).click();
  await expect.poll(async () => colors((await readBpmnDraft(page, modelId)).canonicalXml)).toEqual([
    { fill: "#E8F7EF", stroke: "#247A52" },
    { fill: "#E8F7EF", stroke: "#247A52" },
  ]);
  await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
  await expect.poll(async () => colors((await readBpmnDraft(page, modelId)).canonicalXml)).toEqual(originalColors);
  await page.getByRole("button", { name: "Làm lại", exact: true }).click();
  await expect.poll(async () => colors((await readBpmnDraft(page, modelId)).canonicalXml)).toEqual([
    { fill: "#E8F7EF", stroke: "#247A52" },
    { fill: "#E8F7EF", stroke: "#247A52" },
  ]);

  await selectTask(page, taskIds[0]);
  const savedBeforeFit = await readBpmnDraft(page, modelId);
  const viewport = page.locator(".bpmn-modeler svg .viewport").first();
  const transformBefore = await viewport.getAttribute("transform");
  const sizeBefore = await taskShape(page, taskIds[0]).boundingBox();
  expect(sizeBefore).toBeTruthy();
  await page.getByRole("button", { name: "Phóng vừa phần đã chọn", exact: true }).click();
  await expect(viewport).not.toHaveAttribute("transform", transformBefore!);
  await expect.poll(async () => (await taskShape(page, taskIds[0]).boundingBox())?.width ?? 0).toBeGreaterThan(sizeBefore!.width);
  const savedAfterFit = await readBpmnDraft(page, modelId);
  expect(savedAfterFit.canonicalXml).toBe(savedBeforeFit.canonicalXml);
  expect(savedAfterFit.revisionToken).toBe(savedBeforeFit.revisionToken);
});

test("appends a semantic annotation template to authored text and saves only on Apply", async ({ page }) => {
  const modelId = await createNativeModel(page);
  await selectTask(page, taskIds[0]);
  await page.getByRole("button", { name: "Thành phần", exact: true }).click();
  const tool = page.locator('[data-bpmn-tool-id="text-annotation"]').first();
  await expect(tool).toHaveAttribute("data-bpmn-tool-actionability", "usable");
  await tool.focus();
  await tool.press("Enter");
  const editorRegion = page.getByRole("region", { name: "Nội dung chú thích", exact: true });
  const editor = editorRegion.getByRole("textbox", { name: "Nội dung", exact: true });
  await expect(editor).toBeVisible();
  const annotationNotice = page.getByText("Đã tạo chú thích. Nhập nội dung để hoàn tất.", { exact: true });
  await expect(annotationNotice).toHaveCount(1);
  await expect(annotationNotice).toBeVisible();
  const authored = "Giữ nguyên nhận xét đã viết.";
  await editor.fill(authored);
  await editorRegion.getByRole("button", { name: "Điểm tốt", exact: true }).click();
  const appended = await editor.inputValue();
  expect(appended).toMatch(/^Giữ nguyên nhận xét đã viết\.\n\nĐIỂM TỐT\n/u);
  expect((await readBpmnDraft(page, modelId)).canonicalXml).not.toContain(authored);
  await editorRegion.getByRole("button", { name: "Áp dụng chú thích", exact: true }).click();
  await expect.poll(async () => (await readBpmnDraft(page, modelId)).canonicalXml).toContain(authored);
  const persisted = await readBpmnDraft(page, modelId);
  expect(persisted.canonicalXml).toContain("ĐIỂM TỐT");
  await page.reload();
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  expect((await readBpmnDraft(page, modelId)).canonicalXml).toBe(persisted.canonicalXml);
});

test("normalizes known presentation colors and opens a different profile as a separate diagram", async ({ page }) => {
  const original = await createBpmnModelViaDialog(page, {
    title: `${prefix}Source ${randomUUID()}`,
    profileLabel: "Cộng tác theo vai trò · khuyên dùng",
  });
  createdIds.push(original.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  const before = await readBpmnDraft(page, original.modelId);
  const externalColors = nativeXml
    .replace('xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"', 'xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" xmlns:color="http://www.omg.org/spec/BPMN/non-normative/color/1.0"')
    .replace('bioc:fill="#E8F2FF" bioc:stroke="#2863C7"', 'color:background-color="#E8F2FF" color:border-color="#2863C7"');
  await page.getByLabel("Chọn tệp sơ đồ", { exact: true }).setInputFiles({
    name: `${prefix}Imported ${randomUUID()}.bpmn`,
    mimeType: "application/xml",
    buffer: Buffer.from(externalColors),
  });
  const dialog = page.getByRole("dialog", { name: "Mở tệp với khả năng BPMN phù hợp", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Mở thành sơ đồ mới", exact: true }).click();
  const link = dialog.getByRole("link", { name: "Mở sơ đồ vừa nhập trong tab mới", exact: true });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/studio\/diagram\//u);
  const importedId = decodeURIComponent(href!.split("/").at(-1)!);
  createdIds.push(importedId);
  expect(importedId).not.toBe(original.modelId);
  const untouched = await readBpmnDraft(page, original.modelId);
  expect(untouched.revisionToken).toBe(before.revisionToken);
  expect(untouched.canonicalXml).toBe(before.canonicalXml);
  const imported = await readBpmnDraft(page, importedId);
  expect(imported.profileId).not.toBe(before.profileId);
  expect(await colors(imported.canonicalXml)).toEqual(await colors(nativeXml));
  expect(imported.canonicalXml).not.toContain("non-normative/color");
  const opened = page.waitForEvent("popup");
  await link.click();
  const importedPage = await opened;
  await expect(importedPage.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await expect(taskShape(importedPage, "Task_Copy")).toBeVisible();
  await importedPage.close();
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByText("Đã lưu tệp nhập thành sơ đồ riêng; bản đang mở được giữ nguyên.", { exact: true })).toHaveCount(0);
});
