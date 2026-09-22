import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { inspectBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/inspect-bpmn-xml";
import { createBpmnModelViaApi, readBpmnDraft } from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E SDD86 Subprocess timer ";
const modelIds: string[] = [];
const predecessor = "teb-core-complex-routing@1";
const successor = "teb-core-subprocess-timers@1";
const xml = readFileSync(resolve(process.cwd(), "tests/fixtures/external/bpmn-js-expanded-subprocess.bpmn"), "utf8")
  .replace('id="SubProcess_1"', 'id="SubProcess_1" name="Mua vé trong thời hạn"');

test.afterAll(async () => cleanupExactProcessModels(modelIds, titlePrefix));

test("shared subprocess timer waits for successor ACK and survives saved draft reload", async ({ page }) => {
  const model = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}${Date.now()}`,
    description: "Shared deadline attachment and acknowledged successor regression",
    purpose: "TO_BE", profileId: predecessor, xml,
    idempotencyKey: `e2e-sdd86-timer:${Date.now()}`,
  });
  modelIds.push(model.modelId);
  await page.goto(`/studio/diagram/${model.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await page.locator('.djs-element[data-element-id="SubProcess_1"] .djs-hit-all').click({ position: { x: 8, y: 8 } });
  await openBpmnInspectorView(page, "edit");
  const attach = page.getByRole("button", { name: "Hẹn giờ chung cho quy trình con", exact: true });
  await expect(attach).toBeVisible();
  const shapeCount = await page.locator(".bpmn-modeler .djs-shape").count();
  expect((await readBpmnDraft(page, model.modelId)).profileId).toBe(predecessor);

  let releaseAcknowledgement!: () => void;
  let markAcknowledgementPending!: () => void;
  const acknowledgementGate = new Promise<void>(resolve => { releaseAcknowledgement = resolve; });
  const acknowledgementPending = new Promise<void>(resolve => { markAcknowledgementPending = resolve; });
  const path = `**/api/v1/studio/process-models/${model.modelId}/draft`;
  await page.route(path, async route => {
    if (route.request().method() !== "PATCH" || route.request().postDataJSON()?.profileId !== successor || route.request().postDataJSON()?.xml?.includes("boundaryEvent")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBe(true);
    // Only stall the upgrade response; subsequent autosave must proceed normally.
    if (!route.request().postDataJSON()?.xml?.includes("boundaryEvent")) {
      markAcknowledgementPending();
      await acknowledgementGate;
    }
    await route.fulfill({ response });
  });
  try {
    await attach.click();
    await acknowledgementPending;
    await expect(page.locator(".bpmn-modeler .djs-shape")).toHaveCount(shapeCount);
  } finally {
    releaseAcknowledgement();
  }
  await expect(page.locator(".bpmn-modeler .djs-shape")).toHaveCount(shapeCount + 1);
  await page.getByRole("radio", { name: "Khoảng chờ", exact: true }).check();
  await page.getByRole("textbox", { name: /^Khoảng thời gian/ }).fill("PT10M");
  await page.getByRole("button", { name: "Áp dụng thời gian", exact: true }).click();
  await expect.poll(async () => (await readBpmnDraft(page, model.modelId)).canonicalXml.includes("boundaryEvent")).toBe(true);
  await page.unroute(path);
  const saved = await readBpmnDraft(page, model.modelId);
  expect(saved.profileId).toBe(successor);
  const inspected = await inspectBpmnXml(saved.canonicalXml, successor);
  expect(inspected.safeToPersist).toBe(true);
  const deadline = inspected.snapshot?.elements.find(element => element.type === "bpmn:BoundaryEvent");
  expect(deadline).toMatchObject({ attachedToId: "SubProcess_1", parentContainerId: "Process_1", eventDefinition: { kind: "TIMER" } });
  // A newly attached event is deliberately incomplete until the author connects its exception path.
  expect(inspected.issues).toContainEqual(expect.objectContaining({ ruleId: "BPMN-BOUNDARY-003", disposition: "recoverable" }));
  expect((await inspectBpmnXml(saved.canonicalXml, predecessor)).safeToPersist).toBe(false);
  expect((await inspectBpmnXml(inspected.canonicalXml!, successor)).snapshot).toEqual(inspected.snapshot);
  await page.reload();
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  await expect(page.locator(`.djs-element[data-element-id="${deadline!.id}"]`)).toBeVisible();
  expect((await readBpmnDraft(page, model.modelId)).canonicalXml).toBe(saved.canonicalXml);
});
