import { expect, type Page } from "@playwright/test";

export type BpmnInspectorView =
  | "edit"
  | "model"
  | "structure"
  | "versions"
  | "check";

const diagramViewLabels = {
  model: "Thông tin chung",
  structure: "Danh sách bước",
  versions: "Bản lưu",
} as const;

export async function openBpmnInspectorPanel(page: Page) {
  // Import finalizes inspector visibility; don't toggle against its loading state.
  await expect(page.locator(".bpmn-canvas-loading")).toBeHidden();
  const openButton = page.getByRole("button", {
    name: "Mở bảng hỗ trợ",
    exact: true,
  });
  if (await openButton.isVisible()) {
    await openButton.click();
    await expect(
      page.getByRole("button", { name: "Thu gọn bảng hỗ trợ", exact: true }),
    ).toBeFocused();
  }
}

export async function openBpmnInspectorView(
  page: Page,
  view: BpmnInspectorView,
) {
  await openBpmnInspectorPanel(page);

  if (view === "edit") {
    await page
      .getByRole("tab", { name: "Chỉnh sửa", exact: true })
      .click();
    return;
  }

  if (view === "check") {
    await page
      .getByRole("tab", {
        name: /^Kiểm tra(?:, \d+ vấn đề)?$/,
      })
      .click();
    return;
  }

  await page.getByRole("tab", { name: "Sơ đồ", exact: true }).click();
  await page
    .getByRole("tab", { name: diagramViewLabels[view], exact: true })
    .click();
}
