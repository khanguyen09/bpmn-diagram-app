import { performance } from "node:perf_hooks";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createBpmnModelViaApi,
  downloadBpmnDiagram,
  findBpmnLauncherTool,
} from "../../e2e/bpmn/authoring-helpers";
import { cleanupExactProcessModels } from "../../e2e/bpmn/process-model-cleanup";
import {
  bpmnPerformanceFixtures,
  type BpmnPerformanceFixture,
} from "./performance-fixtures";

const titlePrefix = "E2E BPMN Performance ";
const createdModelIds: string[] = [];
const strictBudgets = process.env.BPMN_PERFORMANCE_STRICT === "1";

type PerformanceResult = {
  readonly fixture: BpmnPerformanceFixture["size"];
  readonly fixtureSha256: string;
  readonly nodeCount: number;
  readonly connectorCount: number;
  readonly canvasReadyMs: number;
  readonly zoomFrameP95Ms: number;
  readonly zoomAverageFps: number;
  readonly validationMs: number;
  readonly xmlDownloadMs: number;
  readonly commandCommitP95Ms?: number;
  readonly undoP95Ms?: number;
  readonly strictBudgets: boolean;
};

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index]!;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function measureClickToNextPaint(control: Locator): Promise<number> {
  return control.evaluate(async (element) => {
    // Start on a frame boundary; an arbitrary start can falsely report >400 fps.
    const startedAt = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    (element as HTMLButtonElement).click();
    const paintedAt = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    return paintedAt - startedAt;
  });
}

async function measureZoom(page: Page): Promise<readonly number[]> {
  const samples: number[] = [];
  const zoomIn = page.getByRole("button", { name: "Phóng to", exact: true });
  const zoomOut = page.getByRole("button", { name: "Thu nhỏ", exact: true });
  for (let index = 0; index < 20; index += 1) {
    samples.push(
      await measureClickToNextPaint(index % 2 === 0 ? zoomIn : zoomOut),
    );
  }
  return samples;
}

async function measureMediumCommands(
  page: Page,
): Promise<{
  readonly commandSamples: readonly number[];
  readonly undoSamples: readonly number[];
}> {
  const commandSamples: number[] = [];
  const undoSamples: number[] = [];
  const shapes = page.locator(".bpmn-modeler .djs-shape");
  const baselineCount = await shapes.count();

  for (let index = 0; index < 20; index += 1) {
    const task = await findBpmnLauncherTool(page, {
      toolId: "task",
      query: "công việc",
      actionability: "usable",
      preparation: "none",
    });
    await task.focus();
    const commandStartedAt = performance.now();
    await task.press("Enter");
    await expect(shapes).toHaveCount(baselineCount + 1);
    commandSamples.push(performance.now() - commandStartedAt);

    const undoStartedAt = performance.now();
    await page.getByRole("button", { name: /^Hoàn tác/u }).click();
    await expect(shapes).toHaveCount(baselineCount);
    undoSamples.push(performance.now() - undoStartedAt);
  }
  return { commandSamples, undoSamples };
}

test.describe.serial(
  "records the Small Medium and Large workspace measurements",
  () => {
    test.afterAll(async () => {
      await cleanupExactProcessModels(createdModelIds, titlePrefix);
    });

    for (const fixture of bpmnPerformanceFixtures) {
      test(`records the ${fixture.size} BPMN workspace measurements`, async ({
        page,
      }, testInfo) => {
        const title = `${titlePrefix}${fixture.size} ${Date.now()}`;
        const created = await createBpmnModelViaApi(page, {
          title,
          description: `${fixture.size} deterministic BPMN performance fixture`,
          purpose: "REFERENCE",
          profileId: fixture.profileId,
          xml: fixture.xml,
          idempotencyKey: `e2e-bpmn-performance:${fixture.size}:${Date.now()}`,
        });
        createdModelIds.push(created.modelId);

        const canvasStartedAt = performance.now();
        await page.goto(`/studio/diagram/${created.modelId}`);
        await expect(page.getByTestId("bpmn-modeler")).toBeVisible();
        await expect(
          page.locator('.bpmn-modeler .djs-shape[data-element-id^="Perf_"]:not([data-element-id$="_label"])'),
        ).toHaveCount(fixture.nodeCount, { timeout: 120_000 });
        await expect(
          page.locator(".bpmn-modeler .djs-connection"),
        ).toHaveCount(fixture.connectorCount, { timeout: 120_000 });
        const canvasReadyMs = performance.now() - canvasStartedAt;

        const zoomSamples = await measureZoom(page);
        const validationStartedAt = performance.now();
        await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
        await expect(
          page.locator('[data-bpmn-validation-inspector="true"]'),
        ).toBeVisible();
        const validationMs = performance.now() - validationStartedAt;

        const downloadStartedAt = performance.now();
        const download = await downloadBpmnDiagram(page, "bpmn");
        expect(download.suggestedFilename()).toMatch(/\.bpmn$/u);
        const xmlDownloadMs = performance.now() - downloadStartedAt;

        const commandMeasurements =
          fixture.size === "Medium"
            ? await measureMediumCommands(page)
            : undefined;
        const result: PerformanceResult = {
          fixture: fixture.size,
          fixtureSha256: fixture.sha256,
          nodeCount: fixture.nodeCount,
          connectorCount: fixture.connectorCount,
          canvasReadyMs,
          zoomFrameP95Ms: percentile(zoomSamples, 95),
          zoomAverageFps: 1_000 / average(zoomSamples),
          validationMs,
          xmlDownloadMs,
          commandCommitP95Ms: commandMeasurements
            ? percentile(commandMeasurements.commandSamples, 95)
            : undefined,
          undoP95Ms: commandMeasurements
            ? percentile(commandMeasurements.undoSamples, 95)
            : undefined,
          strictBudgets,
        };

        await testInfo.attach(`bpmn-performance-${fixture.size.toLowerCase()}`, {
          body: JSON.stringify(result, null, 2),
          contentType: "application/json",
        });

        if (strictBudgets && fixture.size === "Medium") {
          expect(result.zoomFrameP95Ms).toBeLessThanOrEqual(32);
          expect(result.zoomAverageFps).toBeGreaterThanOrEqual(45);
          expect(result.commandCommitP95Ms!).toBeLessThanOrEqual(100);
          expect(result.undoP95Ms!).toBeLessThanOrEqual(150);
          expect(result.validationMs).toBeLessThanOrEqual(2_000);
        }
      });
    }
  },
);
