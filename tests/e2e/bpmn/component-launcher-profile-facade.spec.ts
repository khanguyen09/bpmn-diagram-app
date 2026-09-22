import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import {
  assertNoDanglingAriaControls,
  assertPrimaryBpmnCopyIsPlain,
  bpmnLauncherTool,
  openBpmnComponentLauncher,
  openBpmnLauncherView,
  toggleBpmnLauncherFavorite,
} from "./authoring-helpers";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E SDD47 Component Launcher ";
const boundaryProfileId = "teb-core-boundary-events@1";
const fullProfileId = "teb-core-full-authoring@1";
const activityProfileId = "teb-core-activity-containers@1";
const createdModelIds: string[] = [];
const expectedCoreToolIds = [
  "association",
  "call-activity",
  "complex-gateway",
  "data-association",
  "data-object",
  "data-store",
  "end-event",
  "event-based-gateway",
  "exclusive-gateway",
  "expanded-subprocess",
  "group",
  "horizontal-swimlane-frame",
  "inclusive-gateway",
  "manual-task",
  "message-boundary-event",
  "message-catch-event",
  "message-throw-event",
  "none-throw-event",
  "parallel-gateway",
  "receive-task",
  "sequence-flow",
  "service-task",
  "start-event",
  "task",
  "text-annotation",
  "timer-boundary-event",
  "timer-catch-event",
  "user-task",
  "vertical-swimlane-frame",
] as const;

async function createBoundaryModel(page: Page, suffix: string) {
  await page.goto("/studio/diagram");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/studio/process-models", {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `e2e-sdd47:${suffix}:${Date.now()}`,
      Origin: origin,
    },
    data: {
      title: `${titlePrefix}${suffix} ${Date.now()}`,
      description: "SDD47 automatic preparation and ordered profile ACK proof",
      purpose: "TO_BE",
      profileId: boundaryProfileId,
      xml: starterBpmnXml,
    },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    modelId?: string;
    draft?: { modelId?: string };
  };
  const modelId = body.modelId ?? body.draft?.modelId;
  expect(modelId).toBeTruthy();
  createdModelIds.push(modelId!);
  await page.goto(`/studio/diagram/${modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return modelId!;
}

async function clickFreeCanvasPoint(page: Page) {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector(".djs-container")!.getBoundingClientRect();
    const occupied = [...document.querySelectorAll(".djs-element")].map((element) =>
      element.getBoundingClientRect(),
    );
    for (let y = canvas.top + 150; y < canvas.bottom - 100; y += 80) {
      for (let x = canvas.left + 150; x < canvas.right - 150; x += 100) {
        if (
          !occupied.some(
            (bounds) =>
              x > bounds.left - 70 &&
              x < bounds.right + 70 &&
              y > bounds.top - 60 &&
              y < bounds.bottom + 60,
          )
        ) {
          return { x, y };
        }
      }
    }
    return {
      x: canvas.left + canvas.width * 0.55,
      y: canvas.top + canvas.height * 0.55,
    };
  });
  await page.mouse.click(point.x, point.y);
}

async function waitForSaveAck(
  page: Page,
  modelId: string,
  action: () => Promise<void>,
) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PATCH" &&
      new URL(candidate.url()).pathname ===
        `/api/v1/studio/process-models/${modelId}/draft`,
    { timeout: 15_000 },
  );
  await action();
  expect((await response).ok()).toBe(true);
}

async function draft(page: Page, modelId: string) {
  const response = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/draft`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    profileId: string;
    canonicalXml: string;
    revisionToken: string;
  };
}

function xmlIdFingerprint(xml: string): string {
  return [...xml.matchAll(/\bid="([^"]+)"/g)]
    .map((match) => match[1])
    .sort()
    .join("|");
}

function seriousOrCriticalViolations(
  result: Awaited<ReturnType<AxeBuilder["analyze"]>>,
) {
  return result.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
}

test.describe.serial("SDD47 BPMN component launcher and profile facade", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("discovers all Core tools and keeps common click/keyboard placement one-Undo", async ({
    page,
  }) => {
    const modelId = await createBoundaryModel(page, "common");
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const initialShapeCount = await shapes.count();
    const initialXmlFingerprint = xmlIdFingerprint(
      (await draft(page, modelId)).canonicalXml,
    );

    await expect(
      page.getByRole("button", { name: "Mở bảng hỗ trợ" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Thành phần" }).click();
    const uniqueToolIds = await page
      .locator("[data-bpmn-tool-id]")
      .evaluateAll(
        (tiles) => [
          ...new Set(
            tiles.flatMap((tile) => {
              const id = tile.getAttribute("data-bpmn-tool-id");
              return id ? [id] : [];
            }),
          ),
        ].sort(),
      );
    expect(uniqueToolIds).toEqual([...expectedCoreToolIds].sort());
    const preparedDataObject = page
      .locator('[data-bpmn-tool-id="data-object"]')
      .first();
    await expect(preparedDataObject).toHaveAttribute(
      "data-bpmn-tool-actionability",
      "usable",
    );
    await expect(preparedDataObject).toHaveAttribute(
      "data-bpmn-tool-preparation",
      "ordered-profile-ack",
    );
    await expect(preparedDataObject).not.toHaveAttribute(
      "aria-label",
      /mở khóa|cần nâng cấp/i,
    );
    await expect(
      preparedDataObject.locator(".bpmn-component-tile__state"),
    ).toHaveCount(0);
    expect(
      seriousOrCriticalViolations(await new AxeBuilder({ page }).analyze()),
    ).toEqual([]);

    await page.locator('[data-bpmn-tool-id="task"]').first().click();
    await expect(page.locator('[data-bpmn-armed-tool="task"]')).toBeVisible();
    await waitForSaveAck(page, modelId, () => clickFreeCanvasPoint(page));
    await expect(shapes).toHaveCount(initialShapeCount + 1);
    const clickedTaskId = await page
      .locator(".bpmn-modeler .djs-shape.selected")
      .getAttribute("data-element-id");
    expect(clickedTaskId).toBeTruthy();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain(`id="${clickedTaskId}"`);
    await expect(
      page.getByRole("button", { name: "Thu gọn bảng hỗ trợ" }),
    ).toBeVisible();
    await waitForSaveAck(page, modelId, () =>
      page.getByRole("button", { name: /^Hoàn tác/ }).click(),
    );
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect
      .poll(async () => xmlIdFingerprint((await draft(page, modelId)).canonicalXml))
      .toBe(initialXmlFingerprint);
    await expect(page.getByRole("button", { name: /^Hoàn tác/ })).toBeDisabled();

    await page.getByRole("button", { name: "Thành phần" }).click();
    const keyboardTask = page.locator('[data-bpmn-tool-id="task"]').first();
    await keyboardTask.focus();
    await waitForSaveAck(page, modelId, () => keyboardTask.press("Enter"));
    await expect(shapes).toHaveCount(initialShapeCount + 1);
    await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
    const keyboardTaskId = await page
      .locator(".bpmn-modeler .djs-shape.selected")
      .getAttribute("data-element-id");
    expect(keyboardTaskId).toBeTruthy();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain(`id="${keyboardTaskId}"`);
    await waitForSaveAck(page, modelId, () =>
      page.getByRole("button", { name: /^Hoàn tác/ }).click(),
    );
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect
      .poll(async () => xmlIdFingerprint((await draft(page, modelId)).canonicalXml))
      .toBe(initialXmlFingerprint);
    await expect(page.getByRole("button", { name: /^Hoàn tác/ })).toBeDisabled();
  });

  test("persists Recent and Favorites while Cmd/Ctrl+K respects guarded editing", async ({
    page,
  }) => {
    const modelId = await createBoundaryModel(page, "preferences-shortcut");
    const initialFingerprint = xmlIdFingerprint(
      (await draft(page, modelId)).canonicalXml,
    );
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const initialShapeCount = await shapes.count();

    await page.keyboard.press("ControlOrMeta+K");
    const launcher = await openBpmnComponentLauncher(page);
    await expect(
      launcher.getByRole("searchbox", {
        name: "Tìm thành phần theo tên hoặc công dụng",
      }),
    ).toBeFocused();
    await toggleBpmnLauncherFavorite(page, "task");
    await bpmnLauncherTool(launcher, "task").click();
    await waitForSaveAck(page, modelId, () => clickFreeCanvasPoint(page));
    await expect(shapes).toHaveCount(initialShapeCount + 1);
    await waitForSaveAck(page, modelId, () =>
      page.getByRole("button", { name: /^Hoàn tác/u }).click(),
    );
    await expect(shapes).toHaveCount(initialShapeCount);

    const recent = await openBpmnLauncherView(page, "recent");
    await expect(bpmnLauncherTool(recent, "task")).toBeVisible();
    const favorites = await openBpmnLauncherView(page, "favorites");
    await expect(bpmnLauncherTool(favorites, "task")).toBeVisible();
    await favorites
      .getByRole("button", { name: "Đóng thư viện thành phần" })
      .click();
    await assertNoDanglingAriaControls(page);

    await page.getByLabel("Tên sơ đồ").focus();
    await page.keyboard.press("ControlOrMeta+K");
    await expect(
      page.getByRole("dialog", { name: "Chọn thành phần" }),
    ).toHaveCount(0);

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    const persistedFavorites = await openBpmnLauncherView(page, "favorites");
    await expect(bpmnLauncherTool(persistedFavorites, "task")).toBeVisible();
    const persistedRecent = await openBpmnLauncherView(page, "recent");
    await expect(bpmnLauncherTool(persistedRecent, "task")).toBeVisible();
    expect(
      xmlIdFingerprint((await draft(page, modelId)).canonicalXml),
    ).toBe(initialFingerprint);
  });

  test("keeps focus on the outside control that dismisses the launcher", async ({
    page,
  }) => {
    await createBoundaryModel(page, "outside-dismiss-focus");
    await openBpmnComponentLauncher(page);
    const title = page.getByLabel("Tên sơ đồ");
    await title.click();
    await expect(
      page.getByRole("dialog", { name: "Chọn thành phần" }),
    ).toBeHidden();
    await expect(title).toBeFocused();
  });

  test("keeps the launcher contained across editor viewports and mobile viewer mode", async ({
    page,
  }) => {
    await createBoundaryModel(page, "viewport");
    await page.getByRole("button", { name: "Thành phần" }).click();
    const panel = page.locator(".bpmn-component-launcher__panel");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }

    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    expect(
      seriousOrCriticalViolations(await new AxeBuilder({ page }).analyze()),
    ).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Thành phần" })).toBeHidden();
    await expect(page.locator(".bpmn-studio__mobile-boundary")).toBeVisible();
  });

  test("groups repeated findings, filters them and navigates without consuming an armed connector or history entry", async ({
    page,
  }) => {
    const modelId = await createBoundaryModel(page, "inspection");
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const edges = page.locator(".bpmn-modeler .djs-connection");
    const initialShapeCount = await shapes.count();
    const initialEdgeCount = await edges.count();
    const disconnectedTaskIds: string[] = [];

    for (let index = 0; index < 2; index += 1) {
      await page.getByRole("button", { name: "Thành phần" }).click();
      await page.locator('[data-bpmn-tool-id="task"]').first().click();
      await waitForSaveAck(page, modelId, () => clickFreeCanvasPoint(page));
      const taskId = await page
        .locator(".bpmn-modeler .djs-shape.selected")
        .getAttribute("data-element-id");
      expect(taskId).toBeTruthy();
      disconnectedTaskIds.push(taskId!);
    }

    await expect(shapes).toHaveCount(initialShapeCount + 2);
    await expect(edges).toHaveCount(initialEdgeCount);
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();

    const inspector = page.locator('[data-bpmn-validation-inspector="true"]');
    await expect(inspector).toBeVisible();
    const repeatedGroup = inspector
      .locator('[data-bpmn-issue-group="warning"]')
      .filter({ hasText: "BPMN-CONNECT-002" });
    await expect(repeatedGroup).toHaveCount(1);
    await expect(
      repeatedGroup.locator("[data-bpmn-issue-occurrence='true']"),
    ).toHaveCount(2);
    await expect(
      repeatedGroup.locator(
        ".bpmn-validation-inspector__group-count > [aria-hidden='true']",
      ),
    ).toHaveText("2");
    await expect(
      repeatedGroup.locator(".bpmn-validation-inspector__group-count .sr-only"),
    ).toHaveText("2 vị trí");

    await inspector.locator('[data-bpmn-issue-filter="error"]').click();
    await expect(inspector.locator("[data-bpmn-issue-group]")).toHaveCount(0);
    await expect(inspector.getByText("Không có vấn đề ở mức độ này.")).toBeVisible();
    await inspector.locator('[data-bpmn-issue-filter="warning"]').click();
    await expect(repeatedGroup).toBeVisible();

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.getByRole("tab", { name: /^Kiểm tra/ }).click();
      await expect(inspector).toBeVisible();
      const bounds = await inspector.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      const horizontalOverflow = await inspector.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("tab", { name: /^Kiểm tra/ }).click();
    const xmlBeforeNavigation = (await draft(page, modelId)).canonicalXml;
    await page.getByRole("button", { name: "Thành phần" }).click();
    await page.locator('[data-bpmn-tool-id="sequence-flow"]').first().click();
    await expect(page.locator(".bpmn-studio__canvas-region")).toHaveClass(
      /is-connecting/,
    );

    const navigationAction = repeatedGroup
      .locator('[data-bpmn-element-navigation="available"]')
      .first();
    await navigationAction.focus();
    await navigationAction.press("Enter");
    await expect(navigationAction).toBeFocused();
    await expect(page.locator(".bpmn-studio__canvas-region")).not.toHaveClass(
      /is-connecting/,
    );
    await expect(
      page.locator(
        `.bpmn-modeler .djs-shape.selected[data-element-id="${disconnectedTaskIds[0]}"]`,
      ),
    ).toBeVisible();
    await expect(edges).toHaveCount(initialEdgeCount);
    expect((await draft(page, modelId)).canonicalXml).toBe(xmlBeforeNavigation);

    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    expect(
      seriousOrCriticalViolations(await new AxeBuilder({ page }).analyze()),
    ).toEqual([]);

    await waitForSaveAck(page, modelId, () =>
      page.getByRole("button", { name: /^Hoàn tác/ }).click(),
    );
    await expect(shapes).toHaveCount(initialShapeCount + 1);
    await expect(edges).toHaveCount(initialEdgeCount);
  });

  test("automatically prepares Boundary to Full to Activity once and creates only after final ACK", async ({
    page,
  }) => {
    const modelId = await createBoundaryModel(page, "gated");
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const initialShapeCount = await shapes.count();
    const initialDraft = await draft(page, modelId);
    const initialRevisionToken = initialDraft.revisionToken;
    const initialXmlFingerprint = xmlIdFingerprint(initialDraft.canonicalXml);
    const requestedProfiles: Array<{
      profileId: string;
      ifMatch: string | undefined;
      idempotencyKey: string | undefined;
    }> = [];
    let heldActivityRoute: Route | undefined;
    let releaseActivitySeen: (() => void) | undefined;
    const activitySeen = new Promise<void>((resolve) => {
      releaseActivitySeen = resolve;
    });
    await page.route("**/api/v1/studio/process-models/*/draft", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      const profileId = (route.request().postDataJSON() as { profileId?: string })
        .profileId;
      if (profileId) {
        const headers = route.request().headers();
        requestedProfiles.push({
          profileId,
          ifMatch: headers["if-match"],
          idempotencyKey: headers["idempotency-key"],
        });
      }
      if (profileId === activityProfileId && !heldActivityRoute) {
        heldActivityRoute = route;
        releaseActivitySeen?.();
        return;
      }
      return route.continue();
    });

    await page
      .locator('.bpmn-modeler .djs-shape[data-element-id="Task_Intake"]')
      .click();
    await page.getByRole("button", { name: "Thành phần" }).click();
    const preparedSubProcess = page
      .locator('[data-bpmn-tool-id="expanded-subprocess"]')
      .first();
    await expect(preparedSubProcess).toHaveAttribute(
      "data-bpmn-tool-actionability",
      "usable",
    );
    await expect(preparedSubProcess).toHaveAttribute(
      "data-bpmn-tool-preparation",
      "ordered-profile-ack",
    );
    await expect(preparedSubProcess).not.toHaveAttribute(
      "aria-label",
      /mở khóa|cần nâng cấp/i,
    );
    await preparedSubProcess.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await activitySeen;

    await expect(
      page.getByRole("dialog", { name: /Đang chuẩn bị/iu }),
    ).toBeVisible();
    await assertPrimaryBpmnCopyIsPlain(page);

    await expect(
      page.getByRole("button", { name: /nâng cấp & thêm|mở khóa/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/^Mở khóa\b/i)).toHaveCount(0);
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("Delete");
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect(page.getByRole("button", { name: /^Hoàn tác/ })).toBeDisabled();
    expect(requestedProfiles.map((request) => request.profileId)).toEqual([
      fullProfileId,
      activityProfileId,
    ]);
    expect(requestedProfiles[0]?.ifMatch).toBe(`"${initialRevisionToken}"`);
    expect(requestedProfiles[1]?.ifMatch).not.toBe(requestedProfiles[0]?.ifMatch);
    expect(requestedProfiles[0]?.idempotencyKey).toBeTruthy();
    expect(requestedProfiles[1]?.idempotencyKey).toBeTruthy();
    expect(requestedProfiles[1]?.idempotencyKey).not.toBe(
      requestedProfiles[0]?.idempotencyKey,
    );
    expect(
      xmlIdFingerprint((await draft(page, modelId)).canonicalXml),
    ).toBe(initialXmlFingerprint);
    expect(
      seriousOrCriticalViolations(await new AxeBuilder({ page }).analyze()),
    ).toEqual([]);

    await heldActivityRoute!.continue();
    await expect(
      page.locator('[data-bpmn-armed-tool="expanded-subprocess"]'),
    ).toBeVisible();
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect.poll(async () => (await draft(page, modelId)).profileId).toBe(
      activityProfileId,
    );
    const preCreateXmlFingerprint = xmlIdFingerprint(
      (await draft(page, modelId)).canonicalXml,
    );

    await waitForSaveAck(page, modelId, () => clickFreeCanvasPoint(page));
    await expect(shapes).toHaveCount(initialShapeCount + 4);
    const createdId = await page
      .locator(".bpmn-modeler .djs-shape.selected")
      .getAttribute("data-element-id");
    expect(createdId).toBeTruthy();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain(`id="${createdId}"`);

    await waitForSaveAck(page, modelId, () =>
      page.getByRole("button", { name: /^Hoàn tác/ }).click(),
    );
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .not.toContain(`id="${createdId}"`);
    await expect
      .poll(async () => xmlIdFingerprint((await draft(page, modelId)).canonicalXml))
      .toBe(preCreateXmlFingerprint);
    await expect(page.getByRole("button", { name: /^Hoàn tác/ })).toBeDisabled();
    await expect.poll(async () => (await draft(page, modelId)).profileId).toBe(
      activityProfileId,
    );
  });

  test("retains in-flight edit A, flushes newer edit B and still does not create before the final ACK", async ({
    page,
  }) => {
    const modelId = await createBoundaryModel(page, "dirty");
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const initialShapeCount = await shapes.count();
    const initialDraft = await draft(page, modelId);
    const initialXmlFingerprint = xmlIdFingerprint(initialDraft.canonicalXml);
    const dirtyTitleA = `${titlePrefix}retained command A ${Date.now()}`;
    const dirtyTitleB = `${titlePrefix}newer edit B ${Date.now()}`;
    const requests: Array<{
      profileId: string;
      title: string;
      ifMatch: string | undefined;
    }> = [];
    let heldBoundaryRoute: Route | undefined;
    let releaseBoundarySeen: (() => void) | undefined;
    const boundarySeen = new Promise<void>((resolve) => {
      releaseBoundarySeen = resolve;
    });
    let heldActivityRoute: Route | undefined;
    let releaseActivitySeen: (() => void) | undefined;
    const activitySeen = new Promise<void>((resolve) => {
      releaseActivitySeen = resolve;
    });

    await page.route("**/api/v1/studio/process-models/*/draft", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      const body = route.request().postDataJSON() as {
        profileId?: string;
        title?: string;
      };
      if (body.profileId) {
        requests.push({
          profileId: body.profileId,
          title: body.title ?? "",
          ifMatch: route.request().headers()["if-match"],
        });
      }
      if (body.profileId === boundaryProfileId && !heldBoundaryRoute) {
        heldBoundaryRoute = route;
        releaseBoundarySeen?.();
        return;
      }
      if (body.profileId === activityProfileId && !heldActivityRoute) {
        heldActivityRoute = route;
        releaseActivitySeen?.();
        return;
      }
      return route.continue();
    });

    await page.getByLabel("Tên sơ đồ").fill(dirtyTitleA);
    await boundarySeen;
    await page.getByLabel("Tên sơ đồ").fill(dirtyTitleB);
    await page.getByRole("button", { name: "Thành phần" }).click();
    await page
      .locator('[data-bpmn-tool-id="expanded-subprocess"]')
      .first()
      .click();
    await heldBoundaryRoute!.continue();
    await activitySeen;

    expect(requests.map((request) => request.profileId)).toEqual([
      boundaryProfileId,
      boundaryProfileId,
      fullProfileId,
      activityProfileId,
    ]);
    expect(requests[0]).toMatchObject({
      profileId: boundaryProfileId,
      title: dirtyTitleA,
      ifMatch: `"${initialDraft.revisionToken}"`,
    });
    expect(requests[1]).toMatchObject({
      profileId: boundaryProfileId,
      title: dirtyTitleB,
    });
    expect(requests[1]?.ifMatch).not.toBe(requests[0]?.ifMatch);
    expect(requests[2]?.ifMatch).not.toBe(requests[1]?.ifMatch);
    expect(requests[3]?.ifMatch).not.toBe(requests[2]?.ifMatch);
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
    expect(
      xmlIdFingerprint((await draft(page, modelId)).canonicalXml),
    ).toBe(initialXmlFingerprint);

    await heldActivityRoute!.continue();
    await expect(
      page.locator('[data-bpmn-armed-tool="expanded-subprocess"]'),
    ).toBeVisible();
    await expect.poll(async () => (await draft(page, modelId)).profileId).toBe(
      activityProfileId,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
    await expect(shapes).toHaveCount(initialShapeCount);
  });

  for (const fault of [
    {
      name: "revision conflict",
      status: 409,
      body: {
        error: { code: "REVISION_CONFLICT" },
        currentRevisionToken: "server-revision-newer",
      },
      recovery: /revision.*thay đổi|tải lại/i,
    },
    {
      name: "server rejection",
      status: 422,
      body: { error: { code: "PROFILE_REJECTED" } },
      recovery: /từ chối/i,
    },
  ] as const) {
    test(`keeps XML and history untouched when automatic preparation meets ${fault.name}`, async ({
      page,
    }) => {
      const modelId = await createBoundaryModel(page, `fault-${fault.status}`);
      const shapes = page.locator(".bpmn-modeler .djs-shape");
      const initialShapeCount = await shapes.count();
      const initialDraft = await draft(page, modelId);
      const initialXmlFingerprint = xmlIdFingerprint(initialDraft.canonicalXml);
      const requestedProfiles: string[] = [];

      await page.route("**/api/v1/studio/process-models/*/draft", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        const profileId = (route.request().postDataJSON() as { profileId?: string })
          .profileId;
        if (profileId) requestedProfiles.push(profileId);
        if (profileId === fullProfileId) {
          await route.fulfill({
            status: fault.status,
            contentType: "application/json",
            body: JSON.stringify(fault.body),
          });
          return;
        }
        return route.continue();
      });

      await page.getByRole("button", { name: "Thành phần" }).click();
      await page
        .locator('[data-bpmn-tool-id="expanded-subprocess"]')
        .first()
        .click();

      await expect(page.getByText(fault.recovery).first()).toBeVisible();
      expect(requestedProfiles).toEqual([fullProfileId]);
      await expect(shapes).toHaveCount(initialShapeCount);
      await expect(page.locator("[data-bpmn-armed-tool]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Hoàn tác/ })).toBeDisabled();
      await expect(
        page.getByRole("button", { name: /nâng cấp & thêm|mở khóa/i }),
      ).toHaveCount(0);
      await expect(page.getByText(/^Mở khóa\b/i)).toHaveCount(0);
      const durableAfterFault = await draft(page, modelId);
      expect(durableAfterFault.profileId).toBe(boundaryProfileId);
      expect(xmlIdFingerprint(durableAfterFault.canonicalXml)).toBe(
        initialXmlFingerprint,
      );
    });
  }
});
