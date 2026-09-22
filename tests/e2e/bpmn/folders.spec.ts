import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { createBpmnModelViaApi, readBpmnDraft } from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";
const prefix = "E2E SDD87 Folders ";
const modelIds: string[] = [];
const folderIds: string[] = [];
async function folders(page: Page) {
  const response = await page.request.get("/api/v1/studio/process-model-folders");
  expect(response.ok()).toBe(true);
  return (await response.json()).folders as Array<{ id: string; name: string; revision: number }>;
}
async function chooseFilter(page: Page, name: string | RegExp) {
  await page.getByLabel("Thư mục", { exact: true }).click();
  await page.getByRole("option", { name, exact: typeof name === "string" }).click();
}
test.afterEach(async ({ page }) => {
  if (!folderIds.length) return;
  const ownFolders = await folders(page);
  for (const folder of ownFolders.filter(folder => folderIds.includes(folder.id))) {
    const result = await page.request.delete(`/api/v1/studio/process-model-folders/${folder.id}`, { headers: { Origin: new URL(page.url()).origin }, data: { expectedRevision: folder.revision } });
    expect(result.ok()).toBe(true);
  }
  folderIds.length = 0;
});
test.afterAll(async () => cleanupExactProcessModels(modelIds, prefix));

test("creates a folder, moves selected diagrams, filters, renames and deletes only the folder", async ({ page }) => {
  const stamp = Date.now();
  const created = [];
  for (const label of ["A", "B"]) {
    const model = await createBpmnModelViaApi(page, { title: `${prefix}${stamp} ${label}`, description: "Folder lifecycle", purpose: "TO_BE", profileId: "teb-core-starter@1", xml: starterBpmnXml, idempotencyKey: `e2e-folders:${stamp}:${label}` });
    modelIds.push(model.modelId); created.push(model);
  }
  const before = await Promise.all(created.map(model => readBpmnDraft(page, model.modelId)));
  await page.goto("/studio/diagram");
  const folderName = `${prefix}${stamp}`;
  await page.getByRole("button", { name: "Tạo thư mục", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Tạo thư mục", exact: true });
  await createDialog.getByLabel("Tên thư mục", { exact: true }).fill(folderName);
  await createDialog.getByRole("button", { name: "Tạo thư mục", exact: true }).click();
  await expect(createDialog).toBeHidden();
  const folder = (await folders(page)).find(folder => folder.name === folderName)!;
  expect(folder).toBeTruthy(); folderIds.push(folder.id);
  for (const model of created) await page.getByRole("checkbox", { name: `Chọn quy trình ${model.title}`, exact: true }).check();
  await page.getByRole("button", { name: "Chuyển vào thư mục", exact: true }).click();
  const moveDialog = page.getByRole("dialog", { name: "Chuyển quy trình vào thư mục", exact: true });
  await moveDialog.getByLabel("Thư mục đích", { exact: true }).click();
  await page.getByRole("option", { name: folderName, exact: true }).click();
  await moveDialog.getByRole("button", { name: "Chuyển quy trình vào thư mục", exact: true }).click();
  await expect(moveDialog).toBeHidden();
  await chooseFilter(page, `${folderName} (2)`);
  await expect(page.locator(".bpmn-library__grid > li")).toHaveCount(2);
  await page.reload();
  // The library defaults to all on a new visit; folder membership is durable.
  await chooseFilter(page, `${folderName} (2)`);
  await expect(page.locator(".bpmn-library__grid > li")).toHaveCount(2);
  await page.getByRole("button", { name: "Đổi tên thư mục", exact: true }).click();
  const rename = page.getByRole("dialog", { name: "Đổi tên thư mục", exact: true });
  await rename.getByLabel("Tên thư mục", { exact: true }).fill(`${folderName} renamed`);
  await rename.getByRole("button", { name: "Đổi tên thư mục", exact: true }).click();
  await expect(rename).toBeHidden();
  await expect(page.getByLabel("Thư mục", { exact: true })).toContainText(`${folderName} renamed`);
  await page.getByRole("button", { name: "Xoá thư mục", exact: true }).click();
  const remove = page.getByRole("alertdialog", { name: "Xoá thư mục", exact: true });
  await expect(remove.getByText(/nội dung và lịch sử không bị xoá/)).toBeVisible();
  await remove.getByRole("button", { name: "Xoá thư mục", exact: true }).click();
  await expect(remove).toBeHidden();
  for (let index = 0; index < created.length; index += 1) {
    expect(await readBpmnDraft(page, created[index].modelId)).toEqual(before[index]);
    await expect(page.getByRole("link", { name: `Mở quy trình ${created[index].title}`, exact: true })).toBeVisible();
  }
  expect((await folders(page)).some(item => item.id === folder.id)).toBe(false);
});

test("folder rename retries keep the opened revision after a competing change", async ({ page }) => {
  await page.goto("/studio/diagram");
  const id = randomUUID(); const name = `${prefix}${Date.now()} stale`;
  const origin = new URL(page.url()).origin;
  expect((await page.request.post("/api/v1/studio/process-model-folders", { headers: { Origin: origin }, data: { id, name } })).ok()).toBe(true);
  folderIds.push(id);
  await page.reload(); await chooseFilter(page, `${name} (0)`);
  await page.getByRole("button", { name: "Đổi tên thư mục", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Đổi tên thư mục", exact: true });
  await dialog.getByLabel("Tên thư mục", { exact: true }).fill(`${name} local`);
  expect((await page.request.patch(`/api/v1/studio/process-model-folders/${id}`, { headers: { Origin: origin }, data: { name: `${name} remote`, expectedRevision: 0 } })).ok()).toBe(true);
  const attemptedRevisions: number[] = [];
  await page.route(`**/api/v1/studio/process-model-folders/${id}`, async route => {
    if (route.request().method() === "PATCH") attemptedRevisions.push(route.request().postDataJSON().expectedRevision);
    await route.continue();
  });
  await dialog.getByRole("button", { name: "Đổi tên thư mục", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Danh sách đã thay đổi");
  await expect(page.getByLabel("Thư mục", { exact: true })).toContainText(`${name} remote`);
  await dialog.getByRole("button", { name: "Đổi tên thư mục", exact: true }).click();
  await expect.poll(() => attemptedRevisions.length).toBe(2);
  expect(attemptedRevisions).toEqual([0, 0]);
  expect((await folders(page)).find(folder => folder.id === id)?.name).toBe(`${name} remote`);
  await dialog.getByRole("button", { name: "Huỷ", exact: true }).click();
});
