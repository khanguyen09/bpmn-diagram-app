import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  bpmnLauncherTool,
  createBpmnModelViaDialog,
  openBpmnComponentLauncher,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Productivity ";
const createdModelIds: string[] = [];

test.afterAll(async () => {
  await cleanupExactProcessModels(createdModelIds, titlePrefix);
});

async function openModelMetadata(page: Page) {
  await openBpmnInspectorView(page, "model");
  const section = page
    .locator("details.bpmn-inspector-section")
    .filter({ hasText: "Mô tả và mục đích" })
    .first();
  if ((await section.getAttribute("open")) === null) {
    await section.locator("summary").click();
  }
}

async function assertNoSeriousAxeViolations(
  page: Page,
  testInfo: TestInfo,
) {
  const results = await new AxeBuilder({ page }).analyze();
  await testInfo.attach("axe-results", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

test("OWNER productivity, metadata and icon changes are durable", async ({
  page,
}, testInfo) => {
  const title = `${titlePrefix}${Date.now()}`;
  await page.goto("/studio/diagram");
  await assertNoSeriousAxeViolations(page, testInfo);

  const created = await createBpmnModelViaDialog(page, {
    title,
    profileLabel: /Nội bộ cơ bản/iu,
  });
  const { modelId } = created;
  createdModelIds.push(modelId);

  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await openModelMetadata(page);
  await page.getByLabel("Mô tả").fill("Mô tả productivity đã xác nhận.");
  await page.getByRole("button", { name: "Sơ đồ này dùng để" }).click();
  await page.getByRole("option", { name: "Thiết kế trạng thái mong muốn" }).click();

  await openBpmnInspectorView(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await expect(outline).toBeVisible();
  const before = await outline.getByRole("listitem").count();
  await outline.getByRole("button").filter({ hasText: "Kiểm tra cấu trúc" }).click();
  await openBpmnInspectorView(page, "edit");
  await page
    .getByRole("group", { name: "Thêm bước tiếp theo" })
    .getByRole("button", { name: "Công việc", exact: true })
    .click();
  await openBpmnInspectorView(page, "structure");
  await expect(outline.getByRole("listitem")).toHaveCount(before + 2);

  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await openBpmnInspectorView(page, "structure");
  await expect(outline.getByRole("listitem")).toHaveCount(before);
  await page.getByRole("button", { name: "Làm lại" }).click();
  await openBpmnInspectorView(page, "structure");
  await expect(outline.getByRole("listitem")).toHaveCount(before + 2);

  await outline.getByRole("button", { name: /^Công việc / }).last().click();
  await openBpmnInspectorView(page, "edit");
  await page.locator("summary").filter({ hasText: /^Biểu tượng minh hoạ$/u }).click();
  await page.getByRole("button", { name: "Chọn biểu tượng Phê duyệt" }).click();
  await expect(
    page.getByRole("button", { name: "Chọn biểu tượng Phê duyệt" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `/api/v1/studio/process-models/${modelId}/draft`,
        );
        const candidate = (await response.json()) as { profileId?: string };
        return candidate.profileId;
      },
      { timeout: 15_000 },
    )
    .toBe("teb-core-starter@2");
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await openModelMetadata(page);
  await expect(page.getByLabel("Mô tả")).toHaveValue(
    "Mô tả productivity đã xác nhận.",
  );
  await expect(page.getByRole("button", { name: "Sơ đồ này dùng để" })).toContainText("Thiết kế trạng thái mong muốn");
  await expect(page.locator(".teb-node-visual")).toHaveCount(1);

  const draft = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  expect(draft.ok()).toBe(true);
  const body = (await draft.json()) as {
    profileId: string;
    canonicalXml: string;
  };
  expect(body.profileId).toBe("teb-core-starter@2");
  expect(body.canonicalXml).toContain('teb:nodeVisual iconKey="approval"');

  await assertNoSeriousAxeViolations(page, testInfo);
});

test("shortcut mutations are guarded while metadata inputs have focus", async ({
  page,
}) => {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}shortcut ${Date.now()}`,
    profileLabel: /Nội bộ cơ bản/iu,
  });
  createdModelIds.push(created.modelId);

  await openBpmnInspectorView(page, "structure");
  const outline = page.locator(".bpmn-studio__inspector .bpmn-outline");
  await expect(outline).toBeVisible();
  const before = await outline.getByRole("listitem").count();
  await openModelMetadata(page);
  await page.getByLabel("Mô tả").focus();
  await page.keyboard.press("ControlOrMeta+D");
  await page.keyboard.press("Delete");
  await expect(page.getByLabel("Mô tả")).toBeFocused();
  await openBpmnInspectorView(page, "structure");
  await expect(outline.getByRole("listitem")).toHaveCount(before);
});

test("node search, panel collapse and inspector tabs do not mutate BPMN", async ({
  page,
}, testInfo) => {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}workspace UX ${Date.now()}`,
    profileLabel: /Nội bộ cơ bản/iu,
  });
  const { modelId } = created;
  createdModelIds.push(modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();

  const beforeResponse = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  const before = (await beforeResponse.json()) as { canonicalXml: string };

  const launcher = await openBpmnComponentLauncher(page);
  const search = launcher.getByRole("searchbox", {
    name: "Tìm thành phần theo tên hoặc công dụng",
  });
  await search.fill("quyet dinh");
  await expect(bpmnLauncherTool(launcher, "exclusive-gateway")).toBeVisible();
  await expect(bpmnLauncherTool(launcher, "task")).toHaveCount(0);
  await search.fill("");
  await page.keyboard.press("Escape");

  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: "Kiểm tra cấu trúc" })
    .click();
  const selectedId = await page
    .locator(".bpmn-modeler .djs-shape.selected")
    .getAttribute("data-element-id");

  await page
    .getByRole("button", { name: "Thu gọn bảng hỗ trợ" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mở bảng hỗ trợ" }),
  ).toBeVisible();
  await expect(
    page.locator(".bpmn-modeler .djs-shape.selected"),
  ).toHaveAttribute("data-element-id", selectedId ?? "");
  await page.getByRole("button", { name: "Mở bảng hỗ trợ" }).click();
  await expect(
    page.getByRole("button", { name: "Thu gọn bảng hỗ trợ" }),
  ).toBeFocused();

  const structureTab = page.getByRole("tab", {
    name: "Danh sách bước",
    exact: true,
  });
  await structureTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Bản lưu", exact: true }),
  ).toBeFocused();

  await page.getByRole("tab", { name: "Sơ đồ", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: /^Kiểm tra(?:, \d+ vấn đề)?$/ }),
  ).toBeFocused();

  const afterResponse = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  const after = (await afterResponse.json()) as { canonicalXml: string };
  expect(after.canonicalXml).toBe(before.canonicalXml);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await assertNoSeriousAxeViolations(page, testInfo);
});
