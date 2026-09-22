import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { createBpmnModelViaApi, assertNoDocumentHorizontalOverflow } from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const prefix = "E2E SDD59 Library ";
const ids: string[] = [];
test.afterEach(async () => { await cleanupExactProcessModels(ids, prefix); ids.length = 0; });

test("library pages show provenance and archive only after confirmation", async ({ page }) => {
  test.setTimeout(90_000);
  for (let i = 0; i < 10; i += 1) {
    const model = await createBpmnModelViaApi(page, {
      title: `${prefix}${i}`, description: "Disposable library proof", purpose: "REFERENCE",
      profileId: "teb-core-full-authoring@1", xml: starterBpmnXml,
      idempotencyKey: `sdd59-${i}-${Date.now()}`,
    });
    ids.push(model.modelId);
  }
  await page.goto("/studio/diagram");
  const cards = page.locator(".bpmn-library__grid > li");
  await expect(cards).toHaveCount(9);
  await expect(page.getByText("Trang 1 / 2 · 10 quy trình", { exact: true })).toBeVisible();
  await expect(cards.first().getByText("Người tạo", { exact: true })).toBeVisible();
  await expect(cards.first().getByText("Ngày tạo", { exact: true })).toBeVisible();
  await expect(cards.first().locator(".bpmn-library__creator")).not.toHaveText("Chưa có thông tin");
  expect(await cards.first().locator("time").count()).toBe(2);
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(cards).toHaveCount(1);
  const title = (await cards.first().getByRole("heading").textContent())!;
  const openHref = await cards.first().getByRole("link").getAttribute("href");
  await cards.first().hover();
  await cards.first().getByRole("button", { name: `Xoá quy trình ${title}`, exact: true }).click();
  const modal = page.getByRole("alertdialog", { name: "Xoá quy trình khỏi thư viện?" });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button", { name: "Huỷ", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(cards).toHaveCount(1);
  await cards.first().hover();
  await cards.first().getByRole("button", { name: `Xoá quy trình ${title}`, exact: true }).click();
  for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    const box = (await modal.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThan(2);
    expect(await modal.evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
  }
  expect((await new AxeBuilder({ page }).include(".bpmn-library-delete-dialog").analyze()).violations).toEqual([]);
  await page.route("**/api/v1/studio/process-models/*", async route => {
    if (route.request().method() === "DELETE") await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    else await route.continue();
  });
  await modal.getByRole("button", { name: "Xoá khỏi thư viện", exact: true }).click();
  await expect(modal.getByRole("alert")).toBeVisible();
  await expect(cards).toHaveCount(1);
  await page.unroute("**/api/v1/studio/process-models/*");
  await modal.getByRole("button", { name: "Xoá khỏi thư viện", exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText("Trang 1 / 1 · 9 quy trình", { exact: true })).toBeVisible();
  await expect(cards).toHaveCount(9);
  await expect(page.locator(`a[href="${openHref}"]`)).toHaveCount(0);
  await assertNoDocumentHorizontalOverflow(page);
  expect((await new AxeBuilder({ page }).include(".bpmn-library").analyze()).violations).toEqual([]);
  const archivedId = openHref!.split("/").pop();
  expect((await page.request.get(`/api/v1/studio/process-models/${archivedId}/draft`)).status()).toBe(404);
});
