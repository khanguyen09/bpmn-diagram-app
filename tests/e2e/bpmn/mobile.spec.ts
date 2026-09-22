import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { collaborationStarterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/collaboration-starter-model";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { createBpmnModelViaApi } from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Mobile ";
const createdModelIds: string[] = [];

test.afterAll(async () => {
  await cleanupExactProcessModels(createdModelIds, titlePrefix);
});

test("mobile remains viewer-first without hidden authoring controls", async ({
  page,
}, testInfo) => {
  const created = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}core ${Date.now()}`,
    description: "Mobile viewer proof",
    purpose: "REFERENCE",
    profileId: "teb-core-starter@2",
    xml: starterBpmnXml,
    idempotencyKey: `e2e-mobile-core:${Date.now()}`,
  });
  createdModelIds.push(created.modelId);
  await page.goto(`/studio/diagram/${created.modelId}`);

  await expect(
    page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bpmn-desktop-mutation").first()).toBeHidden();
  const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
  await expect(outline).toBeVisible();
  await expect(outline.locator("ol button")).not.toHaveCount(0);
  await expect(outline).toContainText("Bản nháp sẵn sàng");
  await expect(outline).toContainText("Kiểm tra cấu trúc");

  const results = await new AxeBuilder({ page }).analyze();
  await testInfo.attach("axe-mobile-results", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test("mobile reads the Collaboration hierarchy without mutation controls or overflow", async ({
  page,
}) => {
  const created = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}collaboration ${Date.now()}`,
    description: "Mobile viewer-first proof",
    purpose: "REFERENCE",
    profileId: "teb-collaboration-starter@1",
    xml: collaborationStarterBpmnXml,
    idempotencyKey: `e2e-mobile-collaboration:${Date.now()}`,
  });
  createdModelIds.push(created.modelId);

  await page.goto(`/studio/diagram/${created.modelId}`);
  await expect(
    page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
  ).toBeVisible();
  const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
  await expect(outline.getByText("Editorial Team", { exact: true })).toBeVisible();
  await expect(outline.getByText("Author", { exact: true })).toBeVisible();
  await expect(outline.getByText("Audience", { exact: true })).toBeVisible();
  await expect(page.locator(".bpmn-desktop-mutation").first()).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
