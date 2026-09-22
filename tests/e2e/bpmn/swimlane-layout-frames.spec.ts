import AxeBuilder from "@axe-core/playwright";
import { BpmnModdle } from "bpmn-moddle";
import type { BPMNShape, Collaboration, Definitions, Lane } from "bpmn-moddle";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  armBpmnLauncherTool,
  createBpmnModelViaDialog,
  findBpmnLauncherTool,
  openBpmnComponentLauncher,
  readBpmnDraft,
  waitForBpmnDraftAcknowledgement,
} from "./authoring-helpers";
import {
  openBpmnInspectorPanel,
  openBpmnInspectorView,
} from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Swimlane Layout Frames ";
const createdModelIds: string[] = [];

type DiagramBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

async function elementIds(locator: Locator) {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute("data-element-id"))
      .filter((id): id is string => Boolean(id)),
  );
}

async function draft(page: Page, modelId: string) {
  return readBpmnDraft(page, modelId);
}

async function createSwimlaneModel(page: Page, suffix: string) {
  const created = await createBpmnModelViaDialog(page, {
    title: `${titlePrefix}${suffix} ${Date.now()}`,
    profileLabel: "Cộng tác theo vai trò · khuyên dùng",
  });
  createdModelIds.push(created.modelId);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

async function openLauncher(page: Page, query: string) {
  const panel = await openBpmnComponentLauncher(page);
  await panel
    .getByRole("searchbox", { name: "Tìm thành phần theo tên hoặc công dụng" })
    .fill(query);
  return panel;
}

async function createLauncherToolByKeyboard(
  page: Page,
  query: string,
  toolId: string,
) {
  const panel = await openLauncher(page, query);
  const tool = await findBpmnLauncherTool(page, {
    toolId,
    actionability: "usable",
    preparation: "none",
  });
  await tool.focus();
  await tool.press("Enter");
  await expect(panel).toHaveCount(0);
}

async function armLauncherTool(page: Page, query: string, toolId: string) {
  return armBpmnLauncherTool(page, {
    toolId,
    query,
    actionability: "usable",
    preparation: "none",
  });
}

async function clickDiagramPoint(
  page: Page,
  point: { readonly x: number; readonly y: number },
) {
  const clientPoint = await page.evaluate(({ x, y }) => {
    const viewport = document.querySelector<SVGGraphicsElement>(
      ".bpmn-modeler svg .viewport",
    );
    const matrix = viewport?.getScreenCTM();
    if (!matrix) return null;
    const client = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: client.x, y: client.y };
  }, point);
  expect(clientPoint).not.toBeNull();
  await page.mouse.click(clientPoint!.x, clientPoint!.y);
}

async function waitForSaveAck(
  page: Page,
  modelId: string,
  action: () => Promise<void>,
) {
  await waitForBpmnDraftAcknowledgement(page, modelId, action);
}

async function savedShapeBounds(
  xml: string,
  elementIds: readonly string[],
): Promise<Record<string, DiagramBounds>> {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const shapes = definitions.diagrams
    .flatMap((diagram) => diagram.plane?.planeElement ?? [])
    .filter((element): element is BPMNShape =>
      element.$type === "bpmndi:BPMNShape",
    );
  const result: Record<string, DiagramBounds> = {};
  for (const elementId of elementIds) {
    const bounds = shapes.find(
      (shape) => shape.bpmnElement?.id === elementId,
    )?.bounds;
    expect(bounds, `Missing DI bounds for ${elementId}`).toBeTruthy();
    result[elementId] = {
      x: bounds!.x,
      y: bounds!.y,
      width: bounds!.width,
      height: bounds!.height,
    };
  }
  return result;
}

function containsBounds(outer: DiagramBounds, inner: DiagramBounds) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function overlaps(left: DiagramBounds, right: DiagramBounds) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

async function ensureInspectorOpen(page: Page) {
  await openBpmnInspectorPanel(page);
  return page.locator(".bpmn-studio__inspector");
}

async function openInspectorDisclosure(inspector: Locator, label: string) {
  const disclosure = inspector
    .locator("details.bpmn-inspector-disclosure")
    .filter({ hasText: label });
  if ((await disclosure.getAttribute("open")) === null) {
    await disclosure.locator(":scope > summary").click();
  }
  return disclosure;
}

async function assertAuthoredOrientation(
  xml: string,
  participantId: string,
  expected: boolean,
  expectedTopLevelLaneCount = 2,
) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const definitions = parsed.rootElement as Definitions;
  const collaboration = definitions.rootElements.find(
    (element) => element.$type === "bpmn:Collaboration",
  ) as Collaboration | undefined;
  const participant = collaboration?.participants.find(
    (candidate) => candidate.id === participantId,
  );
  expect(participant?.processRef).toBeTruthy();
  const lanes = participant!.processRef!.laneSets.flatMap(
    (laneSet) => laneSet.lanes,
  );
  expect(lanes).toHaveLength(expectedTopLevelLaneCount);
  const allLanes = (roots: readonly Lane[]): Lane[] =>
    roots.flatMap((lane) => [
      lane,
      ...allLanes(lane.childLaneSet?.lanes ?? []),
    ]);

  const shapes = definitions.diagrams
    .flatMap((diagram) => diagram.plane?.planeElement ?? [])
    .filter((element): element is BPMNShape =>
      element.$type === "bpmndi:BPMNShape",
    );
  const participantShape = shapes.find(
    (shape) => shape.bpmnElement?.id === participantId,
  );
  expect(participantShape?.isHorizontal).toBe(expected);
  for (const lane of allLanes(lanes)) {
    const shape = shapes.find((candidate) => candidate.bpmnElement?.id === lane.id);
    expect(shape?.isHorizontal).toBe(expected);
    expect(shape?.bounds?.width).toBeGreaterThan(0);
    expect(shape?.bounds?.height).toBeGreaterThan(0);
  }
  for (const parent of lanes.filter((lane) => lane.childLaneSet)) {
    const parentBounds = shapes.find(
      (shape) => shape.bpmnElement?.id === parent.id,
    )!.bounds!;
    const children = parent.childLaneSet!.lanes.map(
      (lane) => shapes.find((shape) => shape.bpmnElement?.id === lane.id)!.bounds!,
    );
    expect(children).toHaveLength(2);
    for (const child of children) {
      expect(child.x).toBeGreaterThanOrEqual(parentBounds.x);
      expect(child.y).toBeGreaterThanOrEqual(parentBounds.y);
      expect(child.x + child.width).toBeLessThanOrEqual(
        parentBounds.x + parentBounds.width,
      );
      expect(child.y + child.height).toBeLessThanOrEqual(
        parentBounds.y + parentBounds.height,
      );
    }
    expect(children[0]!.x + children[0]!.width).toBeLessThanOrEqual(
      children[1]!.x,
    );
  }
}

test.describe.serial("BPMN horizontal and vertical swimlane frames", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("authors both native frames atomically and keeps orientation durable", async ({
    page,
  }) => {
    test.slow();
    const modelId = await createSwimlaneModel(page, "frames");

    const participants = page.locator(
      ".bpmn-modeler .djs-shape[data-element-id^='Participant_']",
    );
    const lanes = page.locator(
      ".bpmn-modeler .djs-shape[data-element-id^='Lane_']",
    );
    const initialParticipantIds = await elementIds(participants);
    const initialLaneCount = await lanes.count();

    await createLauncherToolByKeyboard(
      page,
      "swimlane ngang",
      "horizontal-swimlane-frame",
    );
    await expect(participants).toHaveCount(initialParticipantIds.length + 1);
    await expect(lanes).toHaveCount(initialLaneCount + 2);
    const horizontalParticipantId = (await elementIds(participants)).find(
      (id) => !initialParticipantIds.includes(id),
    )!;
    const horizontalAggregateIds = [
      horizontalParticipantId,
      ...(await elementIds(lanes)).slice(initialLaneCount),
    ];
    const inspector = await ensureInspectorOpen(page);
    await openInspectorDisclosure(inspector, "Bên tham gia và vùng vai trò");
    await expect(
      inspector.getByText(
        "Ngang · vai trò xếp trên và dưới",
        { exact: true },
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(participants).toHaveCount(initialParticipantIds.length);
    await expect(lanes).toHaveCount(initialLaneCount);
    await page.getByRole("button", { name: "Làm lại", exact: true }).click();
    await expect(participants).toHaveCount(initialParticipantIds.length + 1);
    await expect(lanes).toHaveCount(initialLaneCount + 2);
    for (const id of horizontalAggregateIds) {
      await expect(
        page.locator(`.bpmn-modeler .djs-shape[data-element-id='${id}']`),
      ).toBeVisible();
    }

    await createLauncherToolByKeyboard(
      page,
      "swimlane doc",
      "vertical-swimlane-frame",
    );
    await expect(participants).toHaveCount(initialParticipantIds.length + 2);
    await expect(lanes).toHaveCount(initialLaneCount + 4);
    const verticalParticipantId = (await elementIds(participants)).find(
      (id) =>
        !initialParticipantIds.includes(id) && id !== horizontalParticipantId,
    )!;
    await ensureInspectorOpen(page);
    await openInspectorDisclosure(inspector, "Bên tham gia và vùng vai trò");
    await expect(
      inspector.getByText(
        "Dọc · vai trò xếp trái và phải",
        { exact: true },
      ),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Thêm vai trò bên phải" })
      .click();
    await expect(lanes).toHaveCount(initialLaneCount + 5);
    await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(lanes).toHaveCount(initialLaneCount + 4);
    await page.getByRole("button", { name: "Làm lại", exact: true }).click();
    await expect(lanes).toHaveCount(initialLaneCount + 5);

    await ensureInspectorOpen(page);
    await openBpmnInspectorView(page, "structure");
      await page
      .locator(".bpmn-studio__inspector .bpmn-outline")
      .getByRole("button")
      .filter({ hasText: "Vai trò trái" })
      .click();
    await openBpmnInspectorView(page, "edit");
    const roleTrigger = page.getByTestId("open-child-role-dialog");
    if (!(await roleTrigger.isVisible())) {
      await openInspectorDisclosure(inspector, "Phân vai trong quy trình");
    }
    await roleTrigger.click();
    const roleDialog = page.getByTestId("swimlane-role-dialog");
    await roleDialog.getByTestId("role-count-2").click();
    await roleDialog.getByTestId("role-name-0").fill("Vai trò trái A");
    await roleDialog.getByTestId("role-name-1").fill("Vai trò trái B");
    const lanesBeforeVerticalSplit = await elementIds(lanes);
    await roleDialog.getByTestId("create-child-roles").click();
    await expect(lanes).toHaveCount(initialLaneCount + 7);
    const verticalChildLaneIds = (await elementIds(lanes)).filter(
      (id) => !lanesBeforeVerticalSplit.includes(id),
    );
    expect(verticalChildLaneIds).toHaveLength(2);
    await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect(lanes).toHaveCount(initialLaneCount + 5);
    await page.getByRole("button", { name: "Làm lại", exact: true }).click();
    await expect(lanes).toHaveCount(initialLaneCount + 7);
    for (const id of verticalChildLaneIds) {
      await expect(
        page.locator(`.bpmn-modeler .djs-shape[data-element-id='${id}']`),
      ).toBeVisible();
    }

    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(async () => {
        const current = await draft(page, modelId);
        return verticalChildLaneIds.every((id) =>
          current.canonicalXml.includes(`id="${id}"`),
        );
      })
      .toBe(true);
    const saved = await draft(page, modelId);
    expect(saved.profileId).toBe("teb-collaboration-swimlane-layouts@1");
    await assertAuthoredOrientation(
      saved.canonicalXml,
      horizontalParticipantId,
      true,
    );
    await assertAuthoredOrientation(
      saved.canonicalXml,
      verticalParticipantId,
      false,
      3,
    );

    await page.reload();
    expect((await readBpmnDraft(page, modelId)).profileId).toBe(
      "teb-collaboration-swimlane-layouts@1",
    );
    await expect(
      page.locator(
        `.bpmn-modeler .djs-shape[data-element-id='${verticalParticipantId}']`,
      ),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    for (const width of [1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("bpmn-modeler")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
  });

  test("resolves the owning Pool, grows its Lane, reflows lower Pools and rejects invalid points", async ({
    page,
  }) => {
    test.slow();
    const modelId = await createSwimlaneModel(page, "point-owner");
    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const initialShapeCount = await shapes.count();
    const undo = page.getByRole("button", { name: "Hoàn tác", exact: true });
    await expect(undo).toBeDisabled();

    const trackedIds = [
      "Participant_Editorial",
      "Lane_Author",
      "Lane_Editor",
      "Participant_Audience",
    ] as const;
    const baseline = await draft(page, modelId);
    const baselineBounds = await savedShapeBounds(
      baseline.canonicalXml,
      trackedIds,
    );
    const editorial = baselineBounds.Participant_Editorial!;
    const audience = baselineBounds.Participant_Audience!;

    await page.getByRole("button", { name: "Thành phần" }).click();
    const keyboardTask = page.locator('[data-bpmn-tool-id="task"]').first();
    await keyboardTask.focus();
    await keyboardTask.press("Enter");
    await expect(
      page.getByText("Chọn một bên tham gia có quy trình", { exact: false }),
    ).toBeVisible();
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect(undo).toBeDisabled();
    expect(await draft(page, modelId)).toMatchObject({
      revisionToken: baseline.revisionToken,
      canonicalXml: baseline.canonicalXml,
    });

    await page
      .locator(
        ".bpmn-modeler .djs-shape[data-element-id='Participant_Audience']",
      )
      .click();
    await page.getByRole("button", { name: "Thành phần" }).click();
    await page.locator('[data-bpmn-tool-id="task"]').first().press("Enter");
    await expect(
      page.getByText("Chọn một bên tham gia có quy trình", { exact: false }),
    ).toBeVisible();
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect(undo).toBeDisabled();
    expect(await draft(page, modelId)).toMatchObject({
      revisionToken: baseline.revisionToken,
      canonicalXml: baseline.canonicalXml,
    });

    const assertRejectedPoint = async (
      point: { readonly x: number; readonly y: number },
      notice: string,
    ) => {
      const placement = await armLauncherTool(page, "task", "task");
      await clickDiagramPoint(page, point);
      await expect(page.getByText(notice, { exact: false })).toBeVisible();
      await expect(shapes).toHaveCount(initialShapeCount);
      await expect(undo).toBeDisabled();
      const unchanged = await draft(page, modelId);
      expect(unchanged.revisionToken).toBe(baseline.revisionToken);
      expect(unchanged.canonicalXml).toBe(baseline.canonicalXml);
      await placement.getByRole("button", { name: /Hủy/ }).click();
      await expect(placement).toHaveCount(0);
    };

    await assertRejectedPoint(
      {
        x: editorial.x + editorial.width / 2,
        y: (editorial.y + editorial.height + audience.y) / 2,
      },
      "Đặt thành phần bên trong một bên tham gia có quy trình.",
    );
    await assertRejectedPoint(
      {
        x: audience.x + audience.width / 2,
        y: audience.y + audience.height / 2,
      },
      "Bên tham gia chỉ trao đổi thông điệp không thể chứa thành phần.",
    );

    await armLauncherTool(page, "task", "task");
    await waitForSaveAck(page, modelId, () =>
      clickDiagramPoint(page, {
        x: editorial.x + editorial.width * 0.88,
        y: editorial.y + editorial.height - 5,
      }),
    );
    await expect(shapes).toHaveCount(initialShapeCount + 1);
    const createdTaskId = await page
      .locator(".bpmn-modeler .djs-shape.selected")
      .getAttribute("data-element-id");
    expect(createdTaskId).toBeTruthy();
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .toContain(`id="${createdTaskId}"`);

    const grown = await draft(page, modelId);
    const grownBounds = await savedShapeBounds(grown.canonicalXml, [
      ...trackedIds,
      createdTaskId!,
    ]);
    const grownEditorial = grownBounds.Participant_Editorial!;
    const grownAudience = grownBounds.Participant_Audience!;
    const createdTask = grownBounds[createdTaskId!]!;
    const grownLanes = [grownBounds.Lane_Author!, grownBounds.Lane_Editor!];

    expect(grownEditorial.height).toBeGreaterThan(editorial.height);
    expect(containsBounds(grownEditorial, createdTask)).toBe(true);
    expect(grownLanes.some((lane) => containsBounds(lane, createdTask))).toBe(
      true,
    );
    expect(
      grownLanes.some(
        (lane, index) =>
          lane.height >
          [baselineBounds.Lane_Author!, baselineBounds.Lane_Editor!][index]!
            .height,
      ),
    ).toBe(true);
    expect(grownAudience.y).toBeGreaterThan(audience.y);
    expect(
      grownAudience.y - (grownEditorial.y + grownEditorial.height),
    ).toBeGreaterThanOrEqual(80);
    expect(overlaps(grownEditorial, grownAudience)).toBe(false);

    await waitForSaveAck(page, modelId, () => undo.click());
    await expect(shapes).toHaveCount(initialShapeCount);
    await expect
      .poll(async () => (await draft(page, modelId)).canonicalXml)
      .not.toContain(`id="${createdTaskId}"`);
    const restored = await draft(page, modelId);
    expect(
      await savedShapeBounds(restored.canonicalXml, trackedIds),
    ).toEqual(baselineBounds);
    await expect(undo).toBeDisabled();
  });
});
