import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createBpmnModelViaDialog,
  dragBpmnLauncherTool,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Interaction ";
const createdModelIds: string[] = [];

async function createModel(page: Page, suffix: string) {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${suffix} ${Date.now()}`,
    profileLabel: /Nội bộ cơ bản/iu,
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
}

test.afterAll(async () => {
  await cleanupExactProcessModels(createdModelIds, titlePrefix);
});

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

function intersectionArea(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );
  return width * height;
}

test("palette drag creates exactly one Task at the released canvas area", async ({
  page,
}, testInfo) => {
  await createModel(page, "drag");

  const shapes = page.locator(".bpmn-modeler .djs-shape");
  const before = await shapes.count();
  const canvas = page.getByTestId("bpmn-modeler");
  const targetCanvas = await box(canvas);
  const target = {
    x: targetCanvas.x + targetCanvas.width * 0.72,
    y: targetCanvas.y + targetCanvas.height * 0.25,
  };

  await testInfo.attach("drag-coordinates", {
    body: JSON.stringify({ targetCanvas, target }, null, 2),
    contentType: "application/json",
  });
  await dragBpmnLauncherTool(page, {
    toolId: "task",
    query: "công việc",
    xRatio: 0.72,
    yRatio: 0.25,
  });

  await expect(shapes).toHaveCount(before + 1);
  const created = page.locator(".bpmn-modeler .djs-shape.selected");
  await expect(created).toHaveCount(1);
  const createdBox = await box(created);
  expect(createdBox.x + createdBox.width / 2).toBeCloseTo(target.x, -1);
  expect(createdBox.y + createdBox.height / 2).toBeCloseTo(target.y, -1);
});

test("Add next finds a free local position and remains one-step atomic", async ({
  page,
}) => {
  await createModel(page, "placement");

  await openBpmnInspectorView(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await outline
    .getByRole("button")
    .filter({ hasText: "Kiểm tra cấu trúc" })
    .click();
  await openBpmnInspectorView(page, "edit");

  const priorShapes = page.locator(".bpmn-modeler .djs-shape");
  const priorCount = await priorShapes.count();
  const priorBoxes = await Promise.all(
    Array.from({ length: priorCount }, (_, index) =>
      box(priorShapes.nth(index)),
    ),
  );

  await page
    .locator(".bpmn-add-next")
    .getByRole("button", { name: "Chọn một hướng", exact: true })
    .click();
  await expect(priorShapes).toHaveCount(priorCount + 1);
  const created = page.locator(".bpmn-modeler .djs-shape.selected");
  const createdBox = await box(created);
  expect(
    priorBoxes.every((existing) => intersectionArea(existing, createdBox) === 0),
  ).toBe(true);

  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(priorShapes).toHaveCount(priorCount);
  await page.getByRole("button", { name: "Làm lại" }).click();
  await expect(priorShapes).toHaveCount(priorCount + 1);
});

test("node visuals render one real Lucide SVG across refresh and reload", async ({
  page,
}) => {
  await createModel(page, "icon");

  await openBpmnInspectorView(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await outline
    .getByRole("button")
    .filter({ hasText: "Kiểm tra cấu trúc" })
    .click();
  await openBpmnInspectorView(page, "edit");
  await page
    .locator("summary")
    .filter({ hasText: /^Biểu tượng minh hoạ$/u })
    .click();
  await page
    .getByRole("button", { name: "Chọn biểu tượng Phê duyệt" })
    .click();

  const overlay = page.locator(".teb-node-visual");
  await expect(overlay).toHaveCount(1);
  await expect(overlay.locator("svg")).toHaveCount(1);
  await expect(overlay).toHaveAttribute("data-icon-key", "approval");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(overlay).toHaveText("");

  await page.getByRole("button", { name: "Phóng to" }).click();
  await page.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect(overlay).toHaveCount(1);
  await expect(overlay.locator("svg")).toHaveCount(1);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator(".teb-node-visual")).toHaveCount(1);
  await expect(page.locator(".teb-node-visual svg")).toHaveCount(1);
});
