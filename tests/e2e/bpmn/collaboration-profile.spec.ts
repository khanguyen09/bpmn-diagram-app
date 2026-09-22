import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  activateBpmnLauncherTool,
  bpmnLauncherTool,
  createBpmnModelViaDialog,
  dragBpmnLauncherTool,
  findBpmnLauncherTool,
  openBpmnComponentLauncher,
  readBpmnDraft,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Collaboration ";
const createdModelIds: string[] = [];

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

async function createCollaborationModel(page: Page, suffix = "starter") {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${suffix} ${Date.now()}`,
    profileLabel: /Cộng tác có vùng vai trò phẳng/iu,
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

async function openInspector(
  page: Page,
  view: "edit" | "structure",
) {
  await openBpmnInspectorView(page, view);
}

test.afterAll(async () => {
  await cleanupExactProcessModels(createdModelIds, titlePrefix);
});

test("authors Lane and Message Flow atomically and retains Collaboration on reload", async ({
  page,
}) => {
  const modelId = await createCollaborationModel(page);
  await expect(
    await findBpmnLauncherTool(page, {
      toolId: "white-box-pool",
      query: "bên tham gia có quy trình",
      preparation: "none",
    }),
  ).toBeEnabled();
  await expect(
    await findBpmnLauncherTool(page, {
      toolId: "black-box-pool",
      query: "bên tham gia bên ngoài",
      preparation: "none",
    }),
  ).toBeEnabled();
  await expect(
    await findBpmnLauncherTool(page, {
      toolId: "message-flow",
      query: "trao đổi thông điệp",
      preparation: "none",
    }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");

  await openInspector(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await outline
    .getByRole("button")
    .filter({ hasText: "Editorial Team" })
    .click();
  await openInspector(page, "edit");
  await page
    .getByText("Bên tham gia và vùng vai trò", { exact: true })
    .click();
  const lanes = page.locator(".bpmn-modeler .djs-shape[data-element-id^='Lane_']");
  const laneCount = await lanes.count();
  await page
    .getByRole("button", { name: "Thêm vai trò phía dưới" })
    .click();
  await expect(lanes).toHaveCount(laneCount + 1);
  expect(
    overlaps(
      await box(
        page.locator(
          ".bpmn-modeler .djs-shape[data-element-id='Participant_Editorial']",
        ),
      ),
      await box(
        page.locator(
          ".bpmn-modeler .djs-shape[data-element-id='Participant_Audience']",
        ),
      ),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(lanes).toHaveCount(laneCount);
  await page.getByRole("button", { name: "Làm lại" }).click();
  await expect(lanes).toHaveCount(laneCount + 1);

  await openInspector(page, "structure");
  await outline
    .getByRole("button")
    .filter({ hasText: "Refine story" })
    .click();
  await activateBpmnLauncherTool(page, {
    toolId: "message-flow",
    query: "trao đổi thông điệp",
  });
  await outline
    .getByRole("button", { name: /^Công việc Publish story/ })
    .click();
  await expect(page.getByText(/hai bên tham gia khác nhau/iu)).toBeVisible();
  await outline
    .getByRole("button", {
      name: /^Bên tham gia chỉ trao đổi Audience/,
    })
    .click();
  await expect(page.getByText(/Đã tạo .*thông điệp/iu)).toBeVisible();

  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.reload();
  expect((await readBpmnDraft(page, modelId)).profileId).toBe(
    "teb-collaboration-starter@1",
  );
  await expect(page.locator(".bpmn-modeler .djs-connection")).toHaveCount(5);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("keeps Core authoring controls isolated", async ({ page }) => {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}core isolation ${Date.now()}`,
    profileLabel: /Nội bộ cơ bản/iu,
  });
  createdModelIds.push(created.modelId);
  const launcher = await openBpmnComponentLauncher(page);
  await expect(bpmnLauncherTool(launcher, "message-flow")).toHaveCount(0);
  await expect(bpmnLauncherTool(launcher, "white-box-pool")).toHaveCount(0);
});

test("splits a v2 Lane into a recursive hierarchy with one Undo and durable reload", async ({
  page,
}) => {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}nested lane ${Date.now()}`,
    profileLabel: /Cộng tác có vùng vai trò hai cấp/iu,
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

  await openInspector(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await outline
    .getByRole("button")
    .filter({ hasText: "Author" })
    .click();
  await openInspector(page, "edit");
  await page
    .getByText("Phân vai trong quy trình", { exact: true })
    .click();
  const lanes = page.locator(
    ".bpmn-modeler .djs-shape[data-element-id^='Lane_']",
  );
  await expect(lanes).toHaveCount(2);
  await page.getByTestId("open-child-role-dialog").click();
  const roleDialog = page.getByTestId("swimlane-role-dialog");
  await roleDialog.getByTestId("role-count-2").click();
  await roleDialog.getByTestId("role-name-0").fill("Tác giả chính");
  await roleDialog.getByTestId("role-name-1").fill("Tác giả phụ");
  await roleDialog.getByTestId("create-child-roles").click();
  await expect(lanes).toHaveCount(4);
  await expect(page.getByText(/Cấp 2\/2 · thuộc Author/)).toBeVisible();

  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(lanes).toHaveCount(2);
  await page.getByRole("button", { name: "Làm lại" }).click();
  await expect(lanes).toHaveCount(4);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.reload();
  expect((await readBpmnDraft(page, created.modelId)).profileId).toBe(
    "teb-collaboration-starter@2",
  );
  await expect(lanes).toHaveCount(4);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("upgrades Collaboration v1 explicitly before enabling nested actions", async ({
  page,
}) => {
  const modelId = await createCollaborationModel(page, "nested upgrade");
  await openInspector(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await outline
    .getByRole("button")
    .filter({ hasText: "Editorial Team" })
    .click();
  await openInspector(page, "edit");
  await page
    .getByText("Bên tham gia và vùng vai trò", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mở khả năng thêm vai trò con" })
    .click();
  await expect
    .poll(async () => (await readBpmnDraft(page, modelId)).profileId)
    .toBe("teb-collaboration-starter@2");

  await openInspector(page, "structure");
  await outline.getByRole("button").filter({ hasText: "Author" }).click();
  await openInspector(page, "edit");
  await page
    .getByText("Phân vai trong quy trình", { exact: true })
    .click();
  await expect(
    page.getByTestId("open-child-role-dialog"),
  ).toBeEnabled();
});

test("drags one white-box Pool through the Collaboration palette", async ({
  page,
}) => {
  await createCollaborationModel(page);
  const participants = page.locator(
    ".bpmn-modeler .djs-shape[data-element-id^='Participant_']",
  );
  const before = await participants.count();
  await dragBpmnLauncherTool(page, {
    toolId: "white-box-pool",
    query: "bên tham gia có quy trình",
    xRatio: 0.72,
    yRatio: 0.82,
  });

  await expect(participants).toHaveCount(before + 1);
  await expect(
    page.locator(".bpmn-modeler .djs-shape.selected"),
  ).toHaveAttribute("data-element-id", /Participant_/);
});
