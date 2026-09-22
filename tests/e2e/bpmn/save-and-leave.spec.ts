import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { createBpmnModelViaApi, readBpmnDraft } from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const prefix = "E2E SDD58 Save ";
const ids: string[] = [];
test.afterAll(async () => cleanupExactProcessModels(ids, prefix));

test("failed saves stay in a centered dialog; retry saves before leaving", async ({ page }) => {
  const model = await createBpmnModelViaApi(page, {
    title: `${prefix}${Date.now()}`, description: "Save navigation proof", purpose: "REFERENCE",
    profileId: "teb-core-full-authoring@1", xml: starterBpmnXml,
    idempotencyKey: `sdd58-${Date.now()}`,
  });
  ids.push(model.modelId);
  await page.goto(`/studio/diagram/${model.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  const shape = page.locator('.djs-shape[data-element-id="Task_Intake"]');
  await shape.click();
  for (let step = 0; step < 4; step += 1) {
    await expect.poll(async () => {
      const rect = (await shape.locator(".djs-visual > rect").first().boundingBox())!;
      const plus = (await page.getByRole("button", { name: "Thêm phần tử kế tiếp", exact: true }).boundingBox())!;
      return Math.abs(rect.y + rect.height / 2 - plus.y - plus.height / 2);
    }).toBeLessThan(2);
    await page.getByRole("button", { name: "Thu nhỏ", exact: true }).click();
  }
  let fail = true;
  await page.route("**/api/**", async route => {
    if (fail && route.request().method() === "PATCH") {
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
    } else await route.continue();
  });
  const title = `${prefix}Updated ${Date.now()}`;
  await page.getByRole("textbox", { name: "Tên sơ đồ", exact: true }).fill(title);
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(page.getByText("Chưa thể lưu", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Quay lại thư viện quy trình" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Lưu thay đổi trước khi rời trang?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Ở lại", exact: true })).toBeFocused();
  for (const viewport of [{ width: 1280, height: 900 }, { width: 820, height: 700 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
    expect(await dialog.evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
  }
  expect((await new AxeBuilder({ page }).include(".bpmn-leave-dialog").analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Lưu và thoát", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(page.url()).toContain(model.modelId);
  fail = false;
  await dialog.getByRole("button", { name: "Lưu và thoát", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/diagram$/);
  expect((await readBpmnDraft(page, model.modelId)).title).toBe(title);
});
