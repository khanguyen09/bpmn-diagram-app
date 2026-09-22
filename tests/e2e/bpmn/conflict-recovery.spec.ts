import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { createBpmnModelViaApi, readBpmnDraft, waitForBpmnDraftAcknowledgement } from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const prefix = "E2E SDD86 Recovery ";
const ids: string[] = [];
test.afterAll(async () => cleanupExactProcessModels(ids, prefix));

async function conflictingTabs(page: Page) {
  const model = await createBpmnModelViaApi(page, {
    title: `${prefix}${Date.now()}`, description: "Concurrent recovery evidence", purpose: "REFERENCE",
    profileId: "teb-core-full-authoring@1", xml: starterBpmnXml, idempotencyKey: `recovery-${crypto.randomUUID()}`,
  });
  ids.push(model.modelId);
  await page.goto(`/studio/diagram/${model.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  const other = await page.context().newPage();
  await other.goto(`/studio/diagram/${model.modelId}`);
  await expect(other.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  const remoteTitle = `${prefix}Server ${Date.now()}`;
  await waitForBpmnDraftAcknowledgement(other, model.modelId, async () => {
    await other.getByLabel("Tên sơ đồ", { exact: true }).fill(remoteTitle);
    await other.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  });
  const remote = await readBpmnDraft(other, model.modelId);
  const localTitle = `${prefix}Local ${Date.now()}`;
  await page.getByLabel("Tên sơ đồ", { exact: true }).fill(localTitle);
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(page.getByRole("button", { name: "Giữ cả hai bản", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Giữ cả hai bản", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Giữ cả hai bản chỉnh sửa" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(remoteTitle, { exact: true })).toBeVisible();
  await expect(dialog.getByText(localTitle, { exact: true })).toBeVisible();
  return { model, other, remote, remoteTitle, localTitle, dialog };
}

async function downloadText(page: Page, buttonName: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("dialog", { name: "Giữ cả hai bản chỉnh sửa" }).getByRole("button", { name: buttonName, exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/\.bpmn$/u);
  return readFile((await download.path())!, "utf8");
}

test("two tabs preserve a separate copy and both downloads before opening the unchanged server draft", async ({ page }) => {
  const { model, other, remote, remoteTitle, localTitle, dialog } = await conflictingTabs(page);
  await expect(dialog.getByRole("button", { name: "Ở lại", exact: true })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Mở bản máy chủ", exact: true })).toBeDisabled();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Lưu thành sơ đồ riêng", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Giữ cả hai bản", exact: true }).click();
  expect(await downloadText(page, "Tải bản máy chủ")).toBe(remote.canonicalXml);
  expect(await downloadText(page, "Tải bản đang sửa")).toContain("Task_Intake");
  await dialog.getByRole("button", { name: "Lưu thành sơ đồ riêng", exact: true }).click();
  const link = dialog.getByRole("link", { name: "Mở sơ đồ khôi phục trong tab mới" });
  await expect(link).toBeVisible();
  const copyId = (await link.getAttribute("href"))!.split("/").at(-1)!;
  ids.push(copyId);
  expect(copyId).not.toBe(model.modelId);
  expect((await readBpmnDraft(page, copyId)).title).toBe(`${localTitle} — bản khôi phục`);
  await dialog.getByRole("button", { name: "Mở bản máy chủ", exact: true }).click();
  await expect(page.getByLabel("Tên sơ đồ", { exact: true })).toHaveValue(remoteTitle);
  expect(await readBpmnDraft(page, model.modelId)).toEqual(remote);
  await other.close();
});

test("uncertain copy creation retries the same request and cannot release newer local edits", async ({ page }) => {
  const { model, other, remote, localTitle, dialog } = await conflictingTabs(page);
  const requests: { key: string | undefined; body: string | null }[] = [];
  let first = true;
  await page.route("**/api/v1/studio/process-models", async route => {
    if (route.request().method() !== "POST") return route.continue();
    requests.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData() });
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const copyId = body.modelId ?? body.draft?.modelId;
    expect(copyId).toBeTruthy();
    ids.push(copyId);
    if (first) { first = false; await route.abort("failed"); }
    else await route.fulfill({ response });
  });
  await dialog.getByRole("button", { name: "Lưu thành sơ đồ riêng", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Chưa xác nhận được bản sao");
  await expect(dialog.getByRole("button", { name: "Mở bản máy chủ", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Ở lại", exact: true }).click();
  await page.getByLabel("Tên sơ đồ", { exact: true }).fill(`${localTitle} newer`);
  await page.getByRole("button", { name: "Giữ cả hai bản", exact: true }).click();
  await expect(dialog.getByText(`${localTitle} newer`, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Lưu thành sơ đồ riêng", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Có chỉnh sửa mới hơn");
  expect(requests).toHaveLength(2);
  expect(requests[0].key).toBeTruthy();
  expect(requests[1]).toEqual(requests[0]);
  await expect(dialog.getByRole("button", { name: "Mở bản máy chủ", exact: true })).toBeDisabled();
  expect(await readBpmnDraft(page, model.modelId)).toEqual(remote);
  await dialog.getByRole("button", { name: "Lưu thành sơ đồ riêng", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Đã lưu bản đang sửa thành sơ đồ riêng");
  expect(requests[2].key).not.toBe(requests[0].key);
  await expect(dialog.getByRole("button", { name: "Mở bản máy chủ", exact: true })).toBeEnabled();
  await other.close();
});

test("explicit save consumes the scheduled autosave without an extra revision and later edits still autosave", async ({ page }) => {
  const model = await createBpmnModelViaApi(page, {
    title: `${prefix}Debounce ${Date.now()}`, description: "Manual save debounce evidence", purpose: "REFERENCE",
    profileId: "teb-core-full-authoring@1", xml: starterBpmnXml, idempotencyKey: `recovery-debounce-${crypto.randomUUID()}`,
  });
  ids.push(model.modelId);
  await page.goto(`/studio/diagram/${model.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  const patches: string[] = [];
  page.on("request", request => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/v1/studio/process-models/${model.modelId}/draft`) patches.push(request.postData() ?? "");
  });
  await waitForBpmnDraftAcknowledgement(page, model.modelId, async () => {
    await page.getByLabel("Tên sơ đồ", { exact: true }).fill(`${model.title} saved`);
    await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  });
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  const acknowledged = await readBpmnDraft(page, model.modelId);
  // This negative assertion must span the 2-second autosave debounce window.
  await page.waitForTimeout(2_500);
  expect(patches).toHaveLength(1);
  expect(await readBpmnDraft(page, model.modelId)).toEqual(acknowledged);
  await waitForBpmnDraftAcknowledgement(page, model.modelId, async () => {
    await page.getByLabel("Tên sơ đồ", { exact: true }).fill(`${model.title} newer`);
  });
  expect(patches).toHaveLength(2);
  expect((await readBpmnDraft(page, model.modelId)).title).toBe(`${model.title} newer`);
});
