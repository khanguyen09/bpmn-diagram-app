import {
  isCoreBpmnProfileId,
  supportsSubprocessTimers,
  type BpmnProfileId,
  type CoreBpmnEdge,
  type CoreBpmnElement,
  type CoreBpmnShape,
  type CoreBpmnSnapshot,
} from "./core-profile";
import {
  collaborationSwimlaneLayoutsBpmnProfile,
  collaborationSubprocessTimersBpmnProfile,
  type CollaborationBpmnSnapshot,
} from "./collaboration-profile";

export function collaborationConversionTarget(sourceProfileId: BpmnProfileId) {
  return supportsSubprocessTimers(sourceProfileId)
    ? collaborationSubprocessTimersBpmnProfile.id
    : collaborationSwimlaneLayoutsBpmnProfile.id;
}

export type BpmnSwimlaneOrientation = "horizontal" | "vertical";

export const bpmnFamilyConversionRuleIds = {
  profile: "BPMN-CONVERT-001",
  sourcePlane: "BPMN-CONVERT-002",
  aggregate: "BPMN-CONVERT-003",
  semantics: "BPMN-CONVERT-004",
  diagram: "BPMN-CONVERT-005",
  orientation: "BPMN-CONVERT-006",
  metadata: "BPMN-CONVERT-007",
} as const;

export type BpmnFamilyConversionRuleId =
  (typeof bpmnFamilyConversionRuleIds)[keyof typeof bpmnFamilyConversionRuleIds];

export interface InspectCoreToSwimlaneConversionInput {
  readonly sourceProfileId: BpmnProfileId;
  readonly targetProfileId: BpmnProfileId;
  readonly orientation: BpmnSwimlaneOrientation;
  readonly sourceSnapshot?: CoreBpmnSnapshot;
  readonly candidateSnapshot?: CollaborationBpmnSnapshot;
}

export type CoreToSwimlaneConversionInspection =
  | {
      readonly accepted: true;
      readonly ruleIds: readonly [];
      readonly primaryProcessId: string;
      readonly collaborationId: string;
      readonly participantId: string;
      readonly laneIds: readonly [string, string];
    }
  | {
      readonly accepted: false;
      readonly ruleIds: readonly BpmnFamilyConversionRuleId[];
    };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function uniqueById<T extends { readonly id: string }>(
  values: readonly T[],
): ReadonlyMap<string, T> | null {
  const entries = new Map<string, T>();
  for (const value of values) {
    if (!value.id || entries.has(value.id)) return null;
    entries.set(value.id, value);
  }
  return entries;
}

function uniqueDiagramItems<T extends { readonly diId?: string }>(
  values: readonly T[],
): ReadonlyMap<string, T> | null {
  const entries = new Map<string, T>();
  for (const value of values) {
    if (!value.diId || entries.has(value.diId)) return null;
    entries.set(value.diId, value);
  }
  return entries;
}

/**
 * The latest Collaboration projection is richer than early Core projections.
 * These are the only contextual fields it may add to an existing element.
 */
function normalizeCandidateElement(
  source: CoreBpmnElement,
  candidate: CoreBpmnElement,
  primaryProcessId: string,
): CoreBpmnElement {
  const normalized = { ...candidate } as Record<string, unknown>;
  delete normalized.participantId;
  delete normalized.displayLabel;

  if (
    source.processId === undefined &&
    candidate.processId === primaryProcessId
  ) {
    delete normalized.processId;
  }
  if (
    source.parentContainerId === undefined &&
    candidate.parentContainerId === primaryProcessId
  ) {
    delete normalized.parentContainerId;
  }
  if (
    source.parentId === undefined &&
    candidate.parentId === primaryProcessId
  ) {
    delete normalized.parentId;
  }
  if (
    source.type === "bpmn:Process" &&
    source.isExecutable === undefined &&
    candidate.isExecutable === false
  ) {
    delete normalized.isExecutable;
  }

  return normalized as unknown as CoreBpmnElement;
}

function normalizeSourceElement(source: CoreBpmnElement): CoreBpmnElement {
  const normalized = { ...source } as Record<string, unknown>;
  delete normalized.displayLabel;
  return normalized as unknown as CoreBpmnElement;
}

function exactExistingSemantics(
  sourceElements: readonly CoreBpmnElement[],
  candidateElements: readonly CoreBpmnElement[],
  primaryProcessId: string,
): boolean {
  const sourceById = uniqueById(sourceElements);
  const candidateById = uniqueById(candidateElements);
  if (!sourceById || !candidateById) return false;

  for (const [id, source] of sourceById) {
    const candidate = candidateById.get(id);
    if (!candidate) return false;
    if (
      stableJson(normalizeSourceElement(source)) !==
      stableJson(normalizeCandidateElement(source, candidate, primaryProcessId))
    ) {
      return false;
    }
  }
  return true;
}

function exactExistingDiagram<T extends CoreBpmnShape | CoreBpmnEdge>(
  sourceItems: readonly T[],
  candidateItems: readonly T[],
): boolean {
  const sourceById = uniqueDiagramItems(sourceItems);
  const candidateById = uniqueDiagramItems(candidateItems);
  if (!sourceById || !candidateById) return false;

  for (const [diId, source] of sourceById) {
    const candidate = candidateById.get(diId);
    if (!candidate || stableJson(source) !== stableJson(candidate)) {
      return false;
    }
  }
  return true;
}

function contains(
  outer: CoreBpmnShape,
  inner: CoreBpmnShape,
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function finitePositive(shape: CoreBpmnShape): boolean {
  return (
    [shape.x, shape.y, shape.width, shape.height].every(Number.isFinite) &&
    shape.width > 0 &&
    shape.height > 0
  );
}

function interiorsOverlap(
  left: CoreBpmnShape,
  right: CoreBpmnShape,
): boolean {
  return (
    Math.min(left.x + left.width, right.x + right.width) >
      Math.max(left.x, right.x) &&
    Math.min(left.y + left.height, right.y + right.height) >
      Math.max(left.y, right.y)
  );
}

/**
 * Proves the sole cross-family operation supported by TEB. It deliberately does
 * not participate in the generic profile transition graph.
 */
export function inspectCoreToCollaborationSwimlaneConversion(
  input: InspectCoreToSwimlaneConversionInput,
): CoreToSwimlaneConversionInspection {
  const issues = new Set<BpmnFamilyConversionRuleId>();
  const source = input.sourceSnapshot;
  const candidate = input.candidateSnapshot;
  const targetProfileId = collaborationConversionTarget(input.sourceProfileId);

  if (
    !isCoreBpmnProfileId(input.sourceProfileId) ||
    input.targetProfileId !== targetProfileId ||
    source?.profileId !== input.sourceProfileId ||
    candidate?.profileId !== targetProfileId
  ) {
    issues.add(bpmnFamilyConversionRuleIds.profile);
  }

  const primaryProcessId = source?.planeElementId;
  const primaryProcess = primaryProcessId
    ? source?.elements.find(
        (element) =>
          element.id === primaryProcessId && element.type === "bpmn:Process",
      )
    : undefined;
  if (
    !source ||
    source.planeCount !== 1 ||
    !primaryProcessId ||
    !primaryProcess
  ) {
    issues.add(bpmnFamilyConversionRuleIds.sourcePlane);
  }

  const collaborationId = candidate?.collaborationId;
  const participant = candidate?.participants[0];
  const lanes = candidate?.lanes ?? [];
  if (
    !candidate ||
    candidate.planeCount !== 1 ||
    !collaborationId ||
    candidate.planeElementId !== collaborationId ||
    candidate.participants.length !== 1 ||
    !participant ||
    participant.processId !== primaryProcessId ||
    lanes.length !== 2 ||
    lanes.some(
      (lane) =>
        lane.participantId !== participant.id ||
        lane.processId !== primaryProcessId ||
        lane.parentLaneId !== undefined ||
        lane.depth !== 0,
    )
  ) {
    issues.add(bpmnFamilyConversionRuleIds.aggregate);
  }

  if (source && candidate && primaryProcessId) {
    const sourceIds = new Set(source.elements.map((element) => element.id));
    const added = candidate.elements.filter((element) => !sourceIds.has(element.id));
    const countType = (type: string) =>
      added.filter((element) => element.type === type).length;
    const exactAddedTypes =
      added.length === 5 &&
      countType("bpmn:Collaboration") === 1 &&
      countType("bpmn:Participant") === 1 &&
      countType("bpmn:LaneSet") === 1 &&
      countType("bpmn:Lane") === 2;
    const laneIds = new Set(lanes.map((lane) => lane.id));
    const addedLaneIds = new Set(
      added
        .filter((element) => element.type === "bpmn:Lane")
        .map((element) => element.id),
    );
    const exactLaneIds =
      laneIds.size === 2 &&
      addedLaneIds.size === 2 &&
      [...laneIds].every((id) => addedLaneIds.has(id));
    const exactAggregateIds =
      added.some(
        (element) =>
          element.id === collaborationId &&
          element.type === "bpmn:Collaboration",
      ) &&
      added.some(
        (element) =>
          element.id === participant?.id &&
          element.type === "bpmn:Participant",
      );

    if (
      !exactExistingSemantics(
        source.elements,
        candidate.elements,
        primaryProcessId,
      ) ||
      !exactAddedTypes ||
      !exactLaneIds ||
      !exactAggregateIds ||
      candidate.elements.some(
        (element) => element.type === "bpmn:MessageFlow",
      )
    ) {
      issues.add(bpmnFamilyConversionRuleIds.semantics);
    }

    const sourceShapeIds = new Set(source.shapes.map((shape) => shape.diId));
    const sourceEdgeIds = new Set(source.edges.map((edge) => edge.diId));
    const addedShapes = candidate.shapes.filter(
      (shape) => !sourceShapeIds.has(shape.diId),
    );
    const addedEdges = candidate.edges.filter(
      (edge) => !sourceEdgeIds.has(edge.diId),
    );
    const expectedNewShapeTargets = new Set([
      participant?.id,
      ...lanes.map((lane) => lane.id),
    ]);
    const actualNewShapeTargets = new Set(
      addedShapes.map((shape) => shape.elementId),
    );
    if (
      !exactExistingDiagram(source.shapes, candidate.shapes) ||
      !exactExistingDiagram(source.edges, candidate.edges) ||
      addedEdges.length !== 0 ||
      addedShapes.length !== 3 ||
      actualNewShapeTargets.size !== 3 ||
      [...expectedNewShapeTargets].some(
        (elementId) => !elementId || !actualNewShapeTargets.has(elementId),
      )
    ) {
      issues.add(bpmnFamilyConversionRuleIds.diagram);
    }

    const horizontal = input.orientation === "horizontal";
    const participantShape = candidate.shapes.find(
      (shape) => shape.elementId === participant?.id,
    );
    const laneShapes = lanes.map((lane) =>
      candidate.shapes.find((shape) => shape.elementId === lane.id),
    );
    if (
      !participantShape ||
      !finitePositive(participantShape) ||
      participantShape.isHorizontal !== horizontal ||
      laneShapes.some(
        (shape) =>
          !shape ||
          !finitePositive(shape) ||
          shape.isHorizontal !== horizontal ||
          !contains(participantShape, shape),
      ) ||
      (laneShapes[0] &&
        laneShapes[1] &&
        interiorsOverlap(laneShapes[0], laneShapes[1])) ||
      source.shapes.some((shape) => !contains(participantShape, shape))
    ) {
      issues.add(bpmnFamilyConversionRuleIds.orientation);
    }
  }

  if (
    issues.size > 0 ||
    !primaryProcessId ||
    !collaborationId ||
    !participant ||
    lanes.length !== 2
  ) {
    return { accepted: false, ruleIds: [...issues] };
  }

  return {
    accepted: true,
    ruleIds: [],
    primaryProcessId,
    collaborationId,
    participantId: participant.id,
    laneIds: [lanes[0]!.id, lanes[1]!.id],
  };
}
