import AxeBuilder from "@axe-core/playwright";
import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNShape,
  Definitions,
  Lane,
  Process,
} from "bpmn-moddle";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { collaborationStarterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/collaboration-starter-model";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Swimlane Actor Roles ";
const createdModelIds: string[] = [];
let durableRoleModelId: string | undefined;

const latestCollaborationProfile = "teb-collaboration-boundary-events@1";
const roleNames = [
  "Writer",
  "Researcher",
  "Fact checker",
  "SEO editor",
  "Legal reviewer",
  "Translator",
  "Accessibility reviewer",
  "Publisher",
] as const;

type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type RoleSnapshot = {
  readonly parent: {
    readonly id: string;
    readonly name: string;
    readonly refs: readonly string[];
    readonly bounds: Bounds;
    readonly childLaneSetId?: string;
  };
  readonly roles: readonly {
    readonly id: string;
    readonly name: string;
    readonly refs: readonly string[];
    readonly bounds: Bounds;
  }[];
  readonly owningPool: Bounds;
  readonly lowerPool: Bounds;
};

async function createModel(
  page: Page,
  profileId: string,
  xml: string,
  suffix: string,
) {
  await page.goto("/studio/diagram");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/studio/process-models", {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `e2e-swimlane-roles:${suffix}:${Date.now()}`,
      Origin: origin,
    },
    data: {
      title: `${titlePrefix}${suffix} ${Date.now()}`,
      description: "Native BPMN Participant, Lane group and child-role proof",
      purpose: "TO_BE",
      profileId,
      xml,
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

async function versions(page: Page, modelId: string) {
  const response = await page.request.get(
    `/api/v1/studio/process-models/${modelId}/versions`,
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()) as {
    versions: Array<{
      id: string;
      versionNumber: number;
      profileId: string;
      xmlChecksum: string;
    }>;
  }).versions;
}

async function waitForCanonical(
  page: Page,
  modelId: string,
  predicate: (xml: string) => boolean,
) {
  await expect
    .poll(async () => {
      const current = await draft(page, modelId);
      return predicate(current.canonicalXml);
    })
    .toBe(true);
  return draft(page, modelId);
}

async function selectOutlineItem(page: Page, name: string) {
  await openBpmnInspectorView(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline")
    .getByRole("button")
    .filter({ hasText: name })
    .click();
  await openBpmnInspectorView(page, "edit");
}

function finiteBounds(shape: BPMNShape | undefined, id: string): Bounds {
  const bounds = shape?.bounds;
  expect(bounds, `${id} must have BPMNShape bounds`).toBeTruthy();
  const projected = {
    x: bounds!.x,
    y: bounds!.y,
    width: bounds!.width,
    height: bounds!.height,
  };
  for (const value of Object.values(projected)) {
    expect(Number.isFinite(value), `${id} DI must be finite`).toBe(true);
  }
  expect(projected.width, `${id} width`).toBeGreaterThan(0);
  expect(projected.height, `${id} height`).toBeGreaterThan(0);
  return projected;
}

async function roleSnapshot(xml: string): Promise<RoleSnapshot> {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const process = definitions.rootElements.find(
    (element) => element.$type === "bpmn:Process" &&
      element.id === "Process_Editorial",
  ) as Process | undefined;
  expect(process).toBeTruthy();
  const parent = process!.laneSets
    .flatMap((laneSet) => laneSet.lanes)
    .find((lane) => lane.id === "Lane_Author");
  expect(parent).toBeTruthy();

  const shapes = new Map(
    definitions.diagrams
      .flatMap((diagram) => diagram.plane?.planeElement ?? [])
      .filter((element): element is BPMNShape =>
        element.$type === "bpmndi:BPMNShape")
      .map((shape) => [shape.bpmnElement?.id, shape]),
  );
  const projectLane = (lane: Lane) => ({
    id: lane.id,
    name: lane.name ?? "",
    refs: (lane.flowNodeRef ?? []).map((node) => node.id),
    bounds: finiteBounds(shapes.get(lane.id), lane.id),
  });

  return {
    parent: {
      ...projectLane(parent!),
      ...(parent!.childLaneSet?.id
        ? { childLaneSetId: parent!.childLaneSet.id }
        : {}),
    },
    roles: (parent!.childLaneSet?.lanes ?? []).map(projectLane),
    owningPool: finiteBounds(
      shapes.get("Participant_Editorial"),
      "Participant_Editorial",
    ),
    lowerPool: finiteBounds(
      shapes.get("Participant_Audience"),
      "Participant_Audience",
    ),
  };
}

function overlaps(left: Bounds, right: Bounds) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function assertRoleGeometryAndOwnership(snapshot: RoleSnapshot) {
  const parent = snapshot.parent.bounds;
  const seenRefs = new Set<string>();
  for (const role of snapshot.roles) {
    expect(role.bounds.x).toBeGreaterThanOrEqual(parent.x);
    expect(role.bounds.y).toBeGreaterThanOrEqual(parent.y);
    expect(role.bounds.x + role.bounds.width)
      .toBeLessThanOrEqual(parent.x + parent.width);
    expect(role.bounds.y + role.bounds.height)
      .toBeLessThanOrEqual(parent.y + parent.height);
    for (const nodeId of role.refs) {
      expect(snapshot.parent.refs).toContain(nodeId);
      expect(seenRefs.has(nodeId), `${nodeId} has one effective child role`)
        .toBe(false);
      seenRefs.add(nodeId);
    }
  }
  for (let left = 0; left < snapshot.roles.length; left += 1) {
    for (let right = left + 1; right < snapshot.roles.length; right += 1) {
      expect(
        overlaps(
          snapshot.roles[left]!.bounds,
          snapshot.roles[right]!.bounds,
        ),
        `${snapshot.roles[left]!.id} and ${snapshot.roles[right]!.id} overlap`,
      ).toBe(false);
    }
  }
  expect([...seenRefs].sort()).toEqual([...snapshot.parent.refs].sort());
  expect(overlaps(snapshot.owningPool, snapshot.lowerPool)).toBe(false);
}

function roleSemantics(snapshot: RoleSnapshot) {
  return snapshot.roles.map(({ id, name, refs }) => ({ id, name, refs }));
}

async function createInitialRoles(page: Page, names: readonly [string, string]) {
  const trigger = page.getByTestId("open-child-role-dialog");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("swimlane-role-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("role-count-2").click();
  await dialog.getByTestId("role-name-0").fill(names[0]);
  await dialog.getByTestId("role-name-1").fill(names[1]);
  await dialog.getByTestId("create-child-roles").click();
  await expect(dialog).toBeHidden();
}

async function addRole(page: Page, name: string) {
  await selectOutlineItem(page, "Author");
  const trigger = page.getByTestId("open-child-role-dialog");
  if (!(await trigger.isVisible())) {
    await page
      .getByRole("tabpanel", { name: "Chỉnh sửa", exact: true })
      .getByText("Phân vai trong quy trình", { exact: true })
      .click();
  }
  await trigger.click();
  const dialog = page.getByTestId("swimlane-role-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("new-role-name").fill(name);
  await dialog.getByTestId("add-child-role").click();
  await expect(dialog).toBeHidden();
}

test.describe.serial("BPMN Swimlane Actor and child-role authoring", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("keeps frozen Core and Collaboration v1 free of child-role mutation", async ({
    page,
  }) => {
    await createModel(
      page,
      "teb-core-starter@1",
      starterBpmnXml,
      "Frozen Core",
    );
    await expect(page.getByTestId("open-child-role-dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Thêm vai trò con" }),
    ).toHaveCount(0);

    await createModel(
      page,
      "teb-collaboration-starter@1",
      collaborationStarterBpmnXml,
      "Frozen Collaboration v1",
    );
    await selectOutlineItem(page, "Author");
    const actorInspector = page
      .getByRole("tabpanel", { name: "Chỉnh sửa", exact: true })
      .getByText("Phân vai trong quy trình", { exact: true });
    await expect(actorInspector).toBeVisible();
    await actorInspector.click();
    await expect(page.getByTestId("open-child-role-dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Thêm vai trò con" }),
    ).toHaveCount(0);
  });

  test("authors two named roles then appends to eight with exact XML, DI and one-step history", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const modelId = await createModel(
      page,
      latestCollaborationProfile,
      collaborationStarterBpmnXml,
      "Latest Successor",
    );
    durableRoleModelId = modelId;

    expect((await draft(page, modelId)).profileId).toBe(latestCollaborationProfile);
    await selectOutlineItem(page, "Author");
    const latestActorInspector = page
      .getByRole("tabpanel", { name: "Chỉnh sửa", exact: true })
      .getByText("Phân vai trong quy trình", { exact: true });
    await expect(latestActorInspector).toBeVisible();
    await latestActorInspector.click();
    await expect(
      page
        .getByRole("tabpanel", { name: "Chỉnh sửa", exact: true })
        .getByText("Nhóm chức năng", { exact: true }),
    ).toBeVisible();

    const beforeCreateDraft = await draft(page, modelId);
    const beforeCreate = await roleSnapshot(beforeCreateDraft.canonicalXml);
    expect(beforeCreate.roles).toHaveLength(0);

    const createTrigger = page.getByTestId("open-child-role-dialog");
    await createTrigger.focus();
    await page.keyboard.press("Enter");
    const untouchedDialog = page.getByTestId("swimlane-role-dialog");
    await expect(untouchedDialog).toBeVisible();
    await expect(untouchedDialog.getByTestId("create-child-roles"))
      .toBeDisabled();
    expect(await draft(page, modelId)).toEqual(beforeCreateDraft);
    const cancel = untouchedDialog.getByRole("button", { name: "Huỷ" });
    await cancel.click();
    await expect(untouchedDialog).toBeHidden();
    await expect(createTrigger).toBeFocused();
    expect(await draft(page, modelId)).toEqual(beforeCreateDraft);

    await createInitialRoles(page, [roleNames[0], roleNames[1]]);
    const twoRoleDraft = await waitForCanonical(
      page,
      modelId,
      (xml) => roleNames.slice(0, 2).every((name) => xml.includes(`name="${name}"`)),
    );
    expect(twoRoleDraft.profileId).toBe(latestCollaborationProfile);
    expect(twoRoleDraft.canonicalXml).not.toMatch(/(?:bpmn:)?Actor\b/);
    const twoRoles = await roleSnapshot(twoRoleDraft.canonicalXml);
    expect(twoRoles.roles.map((role) => role.name)).toEqual(roleNames.slice(0, 2));
    expect(new Set(twoRoles.roles.map((role) => role.id)).size).toBe(2);
    expect(twoRoles.parent.childLaneSetId).toBeTruthy();
    assertRoleGeometryAndOwnership(twoRoles);

    await page.getByRole("button", { name: "Hoàn tác" }).click();
    const undoneCreateDraft = await waitForCanonical(
      page,
      modelId,
      (xml) => !xml.includes(`name="${roleNames[0]}"`),
    );
    expect(await roleSnapshot(undoneCreateDraft.canonicalXml))
      .toEqual(beforeCreate);
    await page.getByRole("button", { name: "Làm lại" }).click();
    const redoneCreateDraft = await waitForCanonical(
      page,
      modelId,
      (xml) => xml.includes(`name="${roleNames[1]}"`),
    );
    expect(await roleSnapshot(redoneCreateDraft.canonicalXml)).toEqual(twoRoles);

    await addRole(page, roleNames[2]);
    const threeRoleDraft = await waitForCanonical(
      page,
      modelId,
      (xml) => xml.includes(`name="${roleNames[2]}"`),
    );
    const threeRoles = await roleSnapshot(threeRoleDraft.canonicalXml);
    expect(threeRoles.roles.map((role) => role.name)).toEqual(roleNames.slice(0, 3));
    expect(roleSemantics(threeRoles).slice(0, 2)).toEqual(
      roleSemantics(twoRoles),
    );
    assertRoleGeometryAndOwnership(threeRoles);

    await page.getByRole("button", { name: "Hoàn tác" }).click();
    const undoneAddDraft = await waitForCanonical(
      page,
      modelId,
      (xml) => !xml.includes(`name="${roleNames[2]}"`),
    );
    expect(await roleSnapshot(undoneAddDraft.canonicalXml)).toEqual(twoRoles);
    await page.getByRole("button", { name: "Làm lại" }).click();
    const redoneAddDraft = await waitForCanonical(
      page,
      modelId,
      (xml) => xml.includes(`name="${roleNames[2]}"`),
    );
    expect(await roleSnapshot(redoneAddDraft.canonicalXml)).toEqual(threeRoles);

    let previous = threeRoles;
    for (const name of roleNames.slice(3)) {
      await addRole(page, name);
      const appendedDraft = await waitForCanonical(
        page,
        modelId,
        (xml) => xml.includes(`name="${name}"`),
      );
      const appended = await roleSnapshot(appendedDraft.canonicalXml);
      expect(appended.roles.map((role) => role.name))
        .toEqual(roleNames.slice(0, appended.roles.length));
      expect(roleSemantics(appended).slice(0, previous.roles.length))
        .toEqual(roleSemantics(previous));
      assertRoleGeometryAndOwnership(appended);
      previous = appended;
    }
    expect(previous.roles).toHaveLength(8);
    await selectOutlineItem(page, "Author");
    const capDraft = await draft(page, modelId);
    const cappedTrigger = page.getByTestId("open-child-role-dialog");
    await expect(cappedTrigger).toBeVisible();
    await expect(cappedTrigger).toBeDisabled();
    await expect(
      page.getByText(
        "Nhóm đã đạt giới hạn 8 vai trò con của ứng dụng.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await draft(page, modelId)).toEqual(capDraft);

    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Tải tệp" }).click();
    const downloadDialog = page.getByRole("dialog", {
      name: "Chọn định dạng tải xuống",
    });
    await expect(downloadDialog).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await downloadDialog.getByRole("button", { name: /Tệp quy trình/ }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedXml = readFileSync(downloadPath!, "utf8");
    const exported = await roleSnapshot(exportedXml);
    expect(exported).toEqual(previous);
    expect(exportedXml).not.toMatch(/(?:bpmn:)?Actor\b/);
    await testInfo.attach("swimlane-role-export.bpmn", {
      body: exportedXml,
      contentType: "application/xml",
    });

    await page.reload();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
    expect((await draft(page, modelId)).profileId).toBe(latestCollaborationProfile);
    const reloadedDraft = await draft(page, modelId);
    expect(await roleSnapshot(reloadedDraft.canonicalXml)).toEqual(previous);

    await openBpmnInspectorView(page, "versions");
    await page
      .getByLabel("Ghi chú cho bản mới")
      .fill("Swimlane roles immutable checkpoint");
    await page.getByRole("button", { name: "Xác nhận lưu mốc" }).click();
    await expect(page.getByText(/Đã lưu mốc 1/)).toBeVisible({
      timeout: 15_000,
    });
    const immutableVersions = await versions(page, modelId);
    expect(immutableVersions).toHaveLength(1);
    expect(immutableVersions[0]).toMatchObject({
      versionNumber: 1,
      profileId: latestCollaborationProfile,
      xmlChecksum: createHash("sha256")
        .update(reloadedDraft.canonicalXml)
        .digest("hex"),
    });

    await openBpmnInspectorView(page, "structure");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("swimlane-role-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);

    await page.emulateMedia({ forcedColors: "active" });
    const forcedAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("swimlane-role-forced-colors-axe.json", {
      body: JSON.stringify(forcedAccessibility, null, 2),
      contentType: "application/json",
    });
    expect(forcedAccessibility.violations).toEqual([]);
  });

  test("390px remains viewer-only with recursive Pool, group and role ownership", async ({
    page,
  }, testInfo) => {
    test.skip(!durableRoleModelId, "Desktop durable role model is required.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/diagram/${durableRoleModelId}`);
    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(page.getByTestId("open-child-role-dialog")).toHaveCount(0);
    await expect(page.getByTestId("swimlane-role-dialog")).toHaveCount(0);

    const outline = page.locator(".bpmn-mobile-outline-shell.bpmn-outline");
    await expect(outline).toBeVisible();
    await expect(outline.getByText("Editorial Team", { exact: true }))
      .toBeVisible();
    await expect(outline.getByText("Author", { exact: true })).toBeVisible();
    for (const name of roleNames) {
      await expect(outline.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(
      outline.getByText("Nhóm chức năng", { exact: true }),
    ).toHaveCount(2);
    await expect(outline.getByText("Vai trò con", { exact: true }))
      .toHaveCount(8);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("swimlane-role-mobile-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });
});
