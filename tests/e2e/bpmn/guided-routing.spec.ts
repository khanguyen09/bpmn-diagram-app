import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  activateBpmnLauncherTool,
  createBpmnModelViaDialog,
  findBpmnLauncherTool,
  readBpmnDraft,
  waitForBpmnDraftAcknowledgement,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Guided ";
const createdModelIds: string[] = [];

async function createCoreModel(page: Page, suffix: string) {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${suffix} ${Date.now()}`,
    profileLabel: /Nội bộ cơ bản/iu,
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

test.afterAll(async () => {
  await cleanupExactProcessModels(createdModelIds, titlePrefix);
});

async function boundingBox(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

function intersectionArea(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    Math.max(
      0,
      Math.min(left.x + left.width, right.x + right.width) -
        Math.max(left.x, right.x),
    ) *
    Math.max(
      0,
      Math.min(left.y + left.height, right.y + right.height) -
        Math.max(left.y, right.y),
    )
  );
}

test("guided Sequence Flow creates one exact edge and rejects End outgoing", async ({
  page,
}) => {
  const modelId = await createCoreModel(page, "sequence");
  await openBpmnInspectorView(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  const connections = page.locator(".bpmn-modeler .djs-connection");
  const before = await connections.count();
  await activateBpmnLauncherTool(page, {
    toolId: "sequence-flow",
    query: "luồng công việc",
  });
  await expect(page.getByText(/Bước 1\/2 · Chọn điểm bắt đầu/)).toBeVisible();
  await outline
    .getByRole("button")
    .filter({ hasText: "Kiểm tra cấu trúc" })
    .click();
  await expect(page.getByText(/Bước 2\/2 · Chọn điểm đến/)).toBeVisible();
  await waitForBpmnDraftAcknowledgement(page, modelId, () =>
    outline
      .getByRole("button")
      .filter({ hasText: "Hoàn tất review" })
      .click(),
  );
  await expect(connections).toHaveCount(before + 1);

  await waitForBpmnDraftAcknowledgement(page, modelId, () =>
    page.getByRole("button", { name: "Hoàn tác" }).click(),
  );
  await expect(connections).toHaveCount(before);
  await waitForBpmnDraftAcknowledgement(page, modelId, () =>
    page.getByRole("button", { name: "Làm lại" }).click(),
  );
  await expect(connections).toHaveCount(before + 1);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

  const draft = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  const persisted = (await draft.json()) as { canonicalXml: string };
  expect(persisted.canonicalXml).toMatch(
    /<bpmn:sequenceFlow[^>]+sourceRef="Task_Intake"[^>]+targetRef="End_Reviewed"/,
  );

  await openBpmnInspectorView(page, "structure");
  await activateBpmnLauncherTool(page, {
    toolId: "sequence-flow",
    query: "luồng công việc",
  });
  await outline
    .getByRole("button")
    .filter({ hasText: "Hoàn tất review" })
    .click();
  await outline
    .getByRole("button")
    .filter({ hasText: "Kiểm tra cấu trúc" })
    .click();
  await expect(
    page.getByText("Điểm kết thúc không thể có đường thực hiện đi ra.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(connections).toHaveCount(before + 1);
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Bước [12]\/2 ·/)).toHaveCount(0);
});

test("contextual plus is keyboard-operable and appends atomically without overlap", async ({
  page,
}) => {
  await createCoreModel(page, "append");
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: "Kiểm tra cấu trúc" })
    .click();

  const shapes = page.locator(".bpmn-modeler .djs-shape");
  const connections = page.locator(".bpmn-modeler .djs-connection");
  const shapeCount = await shapes.count();
  const connectionCount = await connections.count();
  const existingBoxes = await Promise.all(
    Array.from({ length: shapeCount }, (_, index) =>
      boundingBox(shapes.nth(index)),
    ),
  );
  const trigger = page.getByRole("button", {
    name: "Thêm phần tử kế tiếp",
  });
  const triggerBox = await boundingBox(trigger);
  expect(triggerBox.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox.height).toBeGreaterThanOrEqual(44);

  await trigger.focus();
  await page.keyboard.press("Enter");
  const appendMenu = page.getByRole("menu", {
    name: "Chọn phần tử kế tiếp",
  });
  await expect(appendMenu).toBeVisible();
  const taskAction = appendMenu.getByRole("menuitem", {
    name: /Công việc/u,
  });
  await taskAction.focus();
  await taskAction.press("Enter");

  await expect(shapes).toHaveCount(shapeCount + 1);
  await expect(connections).toHaveCount(connectionCount + 1);
  const created = page.locator(".bpmn-modeler .djs-shape.selected");
  const createdId = await created.getAttribute("data-element-id");
  expect(createdId).toBeTruthy();
  const createdBox = await boundingBox(created);
  expect(
    existingBoxes.every(
      (existing) => intersectionArea(existing, createdBox) === 0,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(shapes).toHaveCount(shapeCount);
  await expect(connections).toHaveCount(connectionCount);
  await page.getByRole("button", { name: "Làm lại" }).click();
  await expect(shapes).toHaveCount(shapeCount + 1);
  await expect(connections).toHaveCount(connectionCount + 1);
  await expect(
    page.locator(
      `.bpmn-modeler .djs-shape[data-element-id="${createdId}"]`,
    ),
  ).toHaveCount(1);
});

test("Structured Routing unlocks and persists Parallel Gateway without widening the old profile", async ({
  page,
}) => {
  const modelId = await createCoreModel(page, "parallel");
  const parallel = await findBpmnLauncherTool(page, {
    toolId: "parallel-gateway",
    query: "song song",
    actionability: "usable",
    preparation: "ordered-profile-ack",
  });
  await parallel.click();
  await expect
    .poll(async () => (await readBpmnDraft(page, modelId)).profileId)
    .toBe("teb-core-structured@1");
  await expect(
    page.locator('[data-bpmn-armed-tool="parallel-gateway"]'),
  ).toBeVisible();
  const canvas = await page.getByTestId("bpmn-modeler").boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.click(
    canvas!.x + canvas!.width * 0.62,
    canvas!.y + canvas!.height * 0.68,
  );
  await expect(
    page.locator(
      '.bpmn-modeler .djs-shape[data-element-id^="Gateway_"]',
    ),
  ).toHaveCount(3);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

  const persisted = await readBpmnDraft(page, modelId);
  expect(persisted.profileId).toBe("teb-core-structured@1");
  expect(persisted.canonicalXml).toContain("<bpmn:parallelGateway");
});
