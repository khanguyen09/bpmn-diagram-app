import { expect, test, type Locator, type Page } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E SDD46 Focus Workspace ";
const createdModelIds: string[] = [];

type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

function overlaps(left: Bounds, right: Bounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

async function bounds(locator: Locator): Promise<Bounds> {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

async function createBoundaryModel(page: Page, suffix: string): Promise<string> {
  await page.goto("/studio/diagram");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/studio/process-models", {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `e2e-sdd46-focus:${suffix}:${Date.now()}`,
      Origin: origin,
    },
    data: {
      title: `${titlePrefix}${suffix} ${Date.now()}`,
      description: "SDD46 exact focus workspace and contained launcher proof",
      purpose: "TO_BE",
      profileId: "teb-core-boundary-events@1",
      xml: starterBpmnXml,
    },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    readonly modelId?: string;
    readonly draft?: { readonly modelId?: string };
  };
  const modelId = body.modelId ?? body.draft?.modelId;
  expect(modelId).toBeTruthy();
  createdModelIds.push(modelId!);
  await page.goto(`/studio/diagram/${modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return modelId!;
}

test.describe.serial("SDD46 BPMN focus workspace and contained component detail", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("isolates the exact editor route and keeps one explicit back path", async ({
    page,
  }) => {
    await createBoundaryModel(page, "shell");

    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("#main-content")).toHaveClass(/main-content--focus/);
    await expect(
      page.locator("#primary-navigation, .sidebar, .mobile-header"),
    ).toHaveCount(0);
    await expect(page.getByTestId("bpmn-modeler")).toBeVisible();

    const back = page.getByRole("link", { name: "Quay lại thư viện quy trình" });
    await expect(back).toHaveAttribute("href", "/studio/diagram");
    await back.click();
    await expect(page).toHaveURL(/\/studio\/diagram$/);
    await expect(page.locator("#primary-navigation")).toBeVisible();
  });

  test("uses an in-layout detail preview without tooltip collisions and returns focus", async ({
    page,
  }, testInfo) => {
    await createBoundaryModel(page, "launcher");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 720 },
    ] as const) {
      await page.setViewportSize(viewport);
      const trigger = page.getByRole("button", { name: "Thành phần" });
      await trigger.click();

      const panel = page.locator(".bpmn-component-launcher__panel");
      const search = panel.locator('input[type="search"]');
      const preview = panel.locator(".bpmn-component-launcher__preview");
      await expect(panel).toBeVisible();
      await expect(search).toBeFocused();
      await expect(preview).toHaveAttribute("aria-live", "polite");
      await expect(preview).toHaveAttribute("aria-atomic", "true");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(page.locator(".bpmn-component-tile__tooltip")).toHaveCount(0);

      await search.press("ArrowDown");
      const firstTile = panel.locator("[data-bpmn-tool-id]").first();
      await expect(firstTile).toBeFocused();
      await expect(preview).toBeVisible();
      const firstAccessibleName = await firstTile.getAttribute("aria-label");
      const previewTitle = normalizeWhitespace(
        await preview.locator("strong").first().innerText(),
      );
      expect(firstAccessibleName).toContain(previewTitle);
      await firstTile.hover();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(page.locator(".bpmn-component-tile__tooltip")).toHaveCount(0);
      const initialPreviewHeight = (await bounds(preview)).height;
      await panel
        .locator('[data-bpmn-tool-id="expanded-subprocess"]')
        .hover();
      expect((await bounds(preview)).height).toBe(initialPreviewHeight);

      await firstTile.press("ArrowRight");
      const focusedToolId = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset.bpmnToolId,
      );
      expect(focusedToolId).toBeTruthy();
      expect(focusedToolId).not.toBe(
        await firstTile.getAttribute("data-bpmn-tool-id"),
      );

      const panelBounds = await bounds(panel);
      const previewBounds = await bounds(preview);
      expect(panelBounds.x).toBeGreaterThanOrEqual(0);
      expect(panelBounds.y).toBeGreaterThanOrEqual(0);
      expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(
        viewport.width + 1,
      );
      expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      expect(previewBounds.x).toBeGreaterThanOrEqual(panelBounds.x - 1);
      expect(previewBounds.y).toBeGreaterThanOrEqual(panelBounds.y - 1);
      expect(previewBounds.x + previewBounds.width).toBeLessThanOrEqual(
        panelBounds.x + panelBounds.width + 1,
      );
      expect(previewBounds.y + previewBounds.height).toBeLessThanOrEqual(
        panelBounds.y + panelBounds.height + 1,
      );

      const tileBounds = await Promise.all(
        (await panel.locator("[data-bpmn-tool-id]").all()).map((tile) =>
          bounds(tile),
        ),
      );
      const interactiveBounds: Bounds[] = [
        await bounds(search),
        await bounds(
          panel.getByRole("button", { name: "Đóng thư viện thành phần" }),
        ),
        ...tileBounds,
      ];
      expect(interactiveBounds.some((target) => overlaps(previewBounds, target))).toBe(
        false,
      );

      await testInfo.attach(`launcher-${viewport.width}x${viewport.height}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }

    const trigger = page.getByRole("button", { name: "Thành phần" });
    await trigger.click();
    // Inputs receive pointer focus in every supported engine; button policy varies.
    const outsideControl = page.getByLabel("Tên sơ đồ");
    await outsideControl.click();
    await expect(page.locator(".bpmn-component-launcher__panel")).toHaveCount(0);
    await expect(outsideControl).toBeFocused();

    await trigger.click();
    await page.locator('[data-bpmn-tool-id="task"]').first().click();
    await expect(page.locator('[data-bpmn-armed-tool="task"]')).toBeVisible();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
  });
});

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
