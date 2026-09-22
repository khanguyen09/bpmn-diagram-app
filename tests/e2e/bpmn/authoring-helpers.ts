import { readFile } from "node:fs/promises";
import {
  expect,
  type Download,
  type Locator,
  type Page,
} from "@playwright/test";
import type { BpmnProfileId } from "../../../modules/process-modeling/domain/core-profile";

export type BpmnPurpose = "AS_IS" | "TO_BE" | "REFERENCE";
export type BpmnDownloadFormat = "bpmn" | "svg" | "png";
export type BpmnSwimlaneOrientation = "horizontal" | "vertical";

export type CreatedBpmnModel = {
  readonly modelId: string;
  readonly title: string;
};

export type BpmnDraftResponse = {
  readonly modelId?: string;
  readonly profileId: BpmnProfileId;
  readonly canonicalXml: string;
  readonly revisionToken: string;
  readonly revisionNumber?: number;
  readonly title?: string;
};

const purposeLabels: Readonly<Record<BpmnPurpose, string>> = {
  AS_IS: "Hiện trạng",
  TO_BE: "Tương lai",
  REFERENCE: "Tham chiếu",
};

function processModelIdFromResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as {
    readonly modelId?: unknown;
    readonly draft?: { readonly modelId?: unknown };
  };
  if (typeof candidate.modelId === "string" && candidate.modelId) {
    return candidate.modelId;
  }
  return typeof candidate.draft?.modelId === "string" && candidate.draft.modelId
    ? candidate.draft.modelId
    : null;
}

export function bpmnModelIdFromUrl(url: string): string | null {
  const match = new URL(url).pathname.match(/^\/studio\/diagram\/([^/]+)$/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function createBpmnModelViaApi(
  page: Page,
  input: {
    readonly title: string;
    readonly description: string;
    readonly purpose: BpmnPurpose;
    readonly profileId: BpmnProfileId;
    readonly xml: string;
    readonly idempotencyKey: string;
  },
): Promise<CreatedBpmnModel> {
  await page.goto("/studio/diagram");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/studio/process-models", {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
      Origin: origin,
    },
    data: {
      title: input.title,
      description: input.description,
      purpose: input.purpose,
      profileId: input.profileId,
      xml: input.xml,
    },
  });
  expect(response.ok()).toBe(true);
  const modelId = processModelIdFromResponse(await response.json());
  expect(modelId, "create ProcessModel response must expose its model ID").toBeTruthy();
  return { modelId: modelId!, title: input.title };
}

export async function createBpmnModelViaDialog(
  page: Page,
  input: {
    readonly title: string;
    readonly purpose?: BpmnPurpose;
    readonly profileLabel?: string | RegExp;
  },
): Promise<CreatedBpmnModel> {
  await page.goto("/studio/diagram");
  await page.getByRole("button", { name: "Tạo quy trình", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Tạo quy trình mới" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Tên quy trình").fill(input.title);

  if (input.purpose) {
    await dialog.getByLabel("Mục đích sử dụng").click();
    await dialog
      .getByRole("option", { name: purposeLabels[input.purpose], exact: true })
      .click();
  }
  if (input.profileLabel) {
    await dialog.getByLabel("Kiểu sơ đồ").click();
    await dialog.getByRole("option", { name: input.profileLabel }).click();
  }

  const creationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/studio/process-models",
  );
  await dialog
    .getByRole("button", { name: "Tạo và mở quy trình", exact: true })
    .click();
  expect((await creationResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/\/studio\/diagram\/[^/]+$/u);
  const modelId = bpmnModelIdFromUrl(page.url());
  expect(modelId, "created ProcessModel route must contain its model ID").toBeTruthy();
  // Navigation can finish before the model import and inspector state settle.
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  return { modelId: modelId!, title: input.title };
}

export async function readBpmnDraft(
  page: Page,
  modelId: string,
): Promise<BpmnDraftResponse> {
  const response = await page.request.get(
    `/api/v1/studio/process-models/${encodeURIComponent(modelId)}/draft`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as BpmnDraftResponse;
}

export async function waitForBpmnDraftAcknowledgement(
  page: Page,
  modelId: string,
  action: () => Promise<void>,
) {
  const acknowledgement = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname ===
        `/api/v1/studio/process-models/${modelId}/draft`,
    { timeout: 20_000 },
  );
  await action();
  const response = await acknowledgement;
  expect(response.ok()).toBe(true);
  return response;
}

export async function openBpmnComponentLauncher(page: Page): Promise<Locator> {
  const trigger = page.getByRole("button", { name: "Thành phần", exact: true });
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  const launcher = page.getByRole("dialog", { name: "Chọn thành phần" });
  await expect(launcher).toBeVisible();
  return launcher;
}

export function bpmnLauncherTool(
  launcher: Locator,
  toolId: string,
): Locator {
  return launcher.locator(`[data-bpmn-tool-id="${toolId}"]`).first();
}

export async function findBpmnLauncherTool(
  page: Page,
  input: {
    readonly toolId: string;
    readonly query?: string;
    readonly actionability?: "usable" | "context-incompatible";
    readonly preparation?:
      | "none"
      | "ordered-profile-ack"
      | "in-place-swimlane-conversion";
  },
): Promise<Locator> {
  const launcher = await openBpmnComponentLauncher(page);
  await launcher
      .getByRole("searchbox", {
        name: "Tìm thành phần theo tên hoặc công dụng",
      })
      .fill(input.query ?? "");
  const tool = bpmnLauncherTool(launcher, input.toolId);
  await expect(tool).toBeVisible();
  if (input.actionability) {
    await expect(tool).toHaveAttribute(
      "data-bpmn-tool-actionability",
      input.actionability,
    );
  }
  if (input.preparation) {
    await expect(tool).toHaveAttribute(
      "data-bpmn-tool-preparation",
      input.preparation,
    );
  }
  return tool;
}

export async function armBpmnLauncherTool(
  page: Page,
  input: Parameters<typeof findBpmnLauncherTool>[1],
): Promise<Locator> {
  const tool = await findBpmnLauncherTool(page, input);
  await tool.click();
  const placement = page.locator(`[data-bpmn-armed-tool="${input.toolId}"]`);
  await expect(placement).toBeVisible();
  return placement;
}

export async function placeBpmnLauncherTool(
  page: Page,
  input: Parameters<typeof findBpmnLauncherTool>[1] & {
    readonly xRatio?: number;
    readonly yRatio?: number;
  },
): Promise<void> {
  await armBpmnLauncherTool(page, input);
  const canvas = page.getByTestId("bpmn-modeler");
  const bounds = await canvas.boundingBox();
  expect(bounds, "BPMN canvas must have measurable bounds").not.toBeNull();
  await page.mouse.click(
    bounds!.x + bounds!.width * (input.xRatio ?? 0.58),
    bounds!.y + bounds!.height * (input.yRatio ?? 0.54),
  );
  await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
}

export async function dragBpmnLauncherTool(
  page: Page,
  input: Parameters<typeof findBpmnLauncherTool>[1] & {
    readonly xRatio?: number;
    readonly yRatio?: number;
  },
): Promise<void> {
  const tool = await findBpmnLauncherTool(page, input);
  const canvas = page.getByTestId("bpmn-modeler");
  const source = await tool.boundingBox();
  const target = await canvas.boundingBox();
  expect(source, "launcher tool must have measurable bounds").not.toBeNull();
  expect(target, "BPMN canvas must have measurable bounds").not.toBeNull();
  await page.mouse.move(
    source!.x + source!.width / 2,
    source!.y + source!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target!.x + target!.width * (input.xRatio ?? 0.62),
    target!.y + target!.height * (input.yRatio ?? 0.58),
    { steps: 12 },
  );
  await page.mouse.up();
}

export async function activateBpmnLauncherTool(
  page: Page,
  input: Parameters<typeof findBpmnLauncherTool>[1],
): Promise<void> {
  const tool = await findBpmnLauncherTool(page, input);
  await tool.click();
}

export async function openBpmnLauncherView(
  page: Page,
  view: "all" | "recent" | "favorites",
): Promise<Locator> {
  const launcher = await openBpmnComponentLauncher(page);
  const label = {
    all: "Tất cả",
    recent: "Gần đây",
    favorites: "Yêu thích",
  }[view];
  const viewButton = launcher
    .getByRole("group", { name: "Cách xem thành phần" })
    .getByRole("button", { name: label, exact: true });
  await viewButton.click();
  await expect(viewButton).toHaveAttribute("aria-pressed", "true");
  return launcher;
}

export async function toggleBpmnLauncherFavorite(
  page: Page,
  toolId: string,
): Promise<void> {
  const launcher = await openBpmnComponentLauncher(page);
  const tool = bpmnLauncherTool(launcher, toolId);
  await tool.focus();
  const preview = launcher.getByLabel("Mô tả thành phần đang xem");
  const favorite = preview.getByRole("button", { name: /mục yêu thích:/iu });
  await expect(favorite).toBeVisible();
  await favorite.click();
}

export async function openBpmnDownloadDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Tải tệp", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Chọn định dạng tải xuống" });
  await expect(dialog).toBeVisible();
  await assertPrimaryBpmnCopyIsPlain(page);
  return dialog;
}

export async function downloadBpmnDiagram(
  page: Page,
  format: BpmnDownloadFormat,
): Promise<Download> {
  const dialog = await openBpmnDownloadDialog(page);
  const downloadEvent = page.waitForEvent("download");
  await dialog
    .getByRole("group", { name: "Định dạng tệp" })
    .getByRole("button")
    .filter({ hasText: `.${format}` })
    .click();
  return downloadEvent;
}

export async function expectValidBpmnSvgDownload(
  download: Download,
  expected: {
    readonly taskWidth: number;
    readonly taskHeight: number;
    readonly visibleText: string;
  },
): Promise<string> {
  expect(download.suggestedFilename()).toMatch(/\.svg$/u);
  const path = await download.path();
  expect(path, "SVG download must expose a local artifact path").toBeTruthy();
  const svg = await readFile(path!, "utf8");
  expect(svg).toMatch(/^\s*<svg\b/iu);
  expect(svg).toMatch(
    new RegExp(
      `<rect\\b(?=[^>]*\\bwidth=(?:"|')${expected.taskWidth}(?:"|'))(?=[^>]*\\bheight=(?:"|')${expected.taskHeight}(?:"|'))(?=[^>]*\\bstroke=(?:"|'))(?=[^>]*\\bfill=(?:"|'))[^>]*>`,
      "iu",
    ),
  );
  expect(svg).toContain(expected.visibleText);
  expect(svg).toMatch(/\bmarker-end=(?:"|')url\((?:&quot;|')?#[-\w:.]+(?:&quot;|')?\)(?:"|')/iu);
  expect(svg).not.toMatch(
    /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)=(?:"|')\s*(?:https?:|\/\/|data:|javascript:)|url\(\s*(?:https?:|\/\/|data:|javascript:)/iu,
  );
  return svg;
}

export async function expectValidPngDownload(download: Download): Promise<void> {
  expect(download.suggestedFilename()).toMatch(/\.png$/u);
  const path = await download.path();
  expect(path, "PNG download must expose a local artifact path").toBeTruthy();
  const png = await readFile(path!);
  expect(png.byteLength).toBeGreaterThan(32);
  expect([...png.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
  expect(png.readUInt32BE(16)).toBeGreaterThan(0);
  expect(png.readUInt32BE(20)).toBeGreaterThan(0);
}

export async function convertCurrentModelToSwimlane(
  page: Page,
  orientation: BpmnSwimlaneOrientation,
): Promise<void> {
  const modelIdBefore = bpmnModelIdFromUrl(page.url());
  expect(modelIdBefore).toBeTruthy();
  await activateBpmnLauncherTool(page, {
    toolId: `${orientation}-swimlane-frame`,
    query: "vai trò",
    actionability: "usable",
    preparation: "in-place-swimlane-conversion",
  });
  const dialog = page.getByRole("dialog", {
    name:
      orientation === "horizontal"
        ? /hai vai trò theo hàng/iu
        : /hai vai trò theo cột/iu,
  });
  await expect(dialog).toBeVisible();
  await assertPrimaryBpmnCopyIsPlain(page);
  const acknowledgement = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/v1/studio/process-models/${modelIdBefore}/collaboration-conversion`,
  );
  await dialog
    .getByRole("button", { name: "Chuẩn bị và tiếp tục", exact: true })
    .click();
  expect((await acknowledgement).ok()).toBe(true);
  await expect(dialog).toBeHidden();
  expect(bpmnModelIdFromUrl(page.url())).toBe(modelIdBefore);
}

export async function selectBpmnCanvasElements(
  page: Page,
  elementIds: readonly string[],
): Promise<void> {
  for (const [index, elementId] of elementIds.entries()) {
    await page
      .locator(`.bpmn-modeler .djs-element[data-element-id="${elementId}"]`)
      .click({ modifiers: index === 0 ? [] : ["Shift"] });
  }
}

export async function arrangeSelectedBpmnElements(
  page: Page,
  actionName: string | RegExp,
): Promise<void> {
  const trigger = page.locator(".bpmn-arrange-menu > summary");
  await expect(trigger).toHaveAttribute("aria-disabled", "false");
  await trigger.click();
  await page
    .getByRole("group", { name: "Căn và giãn đều thành phần" })
    .getByRole("button", { name: actionName })
    .click();
}

export async function assertPrimaryBpmnCopyIsPlain(page: Page): Promise<void> {
  const visibleCopy = await page.evaluate(() => {
    const scopes = document.querySelectorAll<HTMLElement>(
      ".bpmn-studio__topbar, .bpmn-studio__status, .bpmn-canvas-toolbar, .bpmn-component-launcher__panel, .bpmn-studio__inspector, dialog[open]",
    );
    return [...scopes]
      .flatMap((scope) => [scope, ...scope.querySelectorAll<HTMLElement>("*")])
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0 &&
          !element.closest(
            ".bpmn-inspector-technical-details, details:not([open]), [aria-hidden='true']",
          )
        );
      })
      .flatMap((element) =>
        [...element.childNodes]
          .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim() ?? "")
          .filter(Boolean),
      )
      .join("\n");
  });
  expect(visibleCopy).not.toMatch(
    /teb-(?:core|collaboration)-[\w-]+@\d+|\b(?:ACK|CAS|FlowNode|Process|Pool|Lane|XML|Model ID|Revision|Versions?|restore-version|successor-draft|commit|history|candidate|worker|facade|payload|canonical|root registry|descendants?|idempotency)\b/iu,
  );
}

export async function assertReadableBpmnHelperText(
  page: Page,
  minimumPixels = 12,
): Promise<void> {
  const failures = await page.evaluate((minimum) => {
    const selector = [
      ".bpmn-component-launcher__panel p",
      ".bpmn-component-launcher__panel small",
      ".bpmn-component-launcher__panel em",
      ".bpmn-component-launcher__panel label",
      ".bpmn-studio__inspector p",
      ".bpmn-studio__inspector small",
      ".bpmn-studio__inspector label",
      ".bpmn-studio__inspector summary",
      ".bpmn-studio__inspector [role='status']",
    ].join(",");
    return [...document.querySelectorAll<HTMLElement>(selector)].flatMap(
      (element) => {
        if (
          element.closest(
            ".bpmn-inspector-technical-details, details:not([open]), .bpmn-modeler, .djs-label",
          ) ||
          !element.textContent?.trim() ||
          element.getClientRects().length === 0
        ) {
          return [];
        }
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return [];
        const size = Number.parseFloat(style.fontSize);
        return Number.isFinite(size) && size < minimum
          ? [
              {
                selector: element.className || element.tagName,
                text: element.textContent.trim().slice(0, 120),
                fontSize: size,
              },
            ]
          : [];
      },
    );
  }, minimumPixels);
  expect(failures).toEqual([]);
}

export async function assertNoDanglingAriaControls(page: Page): Promise<void> {
  const missingTargets = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[aria-controls]")].flatMap(
      (element) => {
        const controls = element.getAttribute("aria-controls")?.trim();
        if (!controls) return [];
        return controls
          .split(/\s+/u)
          .filter((id) => !document.getElementById(id))
          .map((id) => ({
            controller:
              element.getAttribute("aria-label") ||
              element.textContent?.trim() ||
              element.tagName,
            missingId: id,
          }));
      },
    ),
  );
  expect(missingTargets).toEqual([]);
}

export async function assertNoDocumentHorizontalOverflow(
  page: Page,
  tolerance = 1,
): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(tolerance);
}
