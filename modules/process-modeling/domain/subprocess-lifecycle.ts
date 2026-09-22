import type {
  CoreBpmnEdge,
  CoreBpmnElement,
  CoreBpmnShape,
} from "./core-profile";
import type {
  CollaborationLane,
  CollaborationParticipant,
} from "./collaboration-profile";

export interface SubProcessLifecycleSnapshot {
  readonly planeElementId?: string;
  readonly elements: readonly CoreBpmnElement[];
  readonly shapes: readonly CoreBpmnShape[];
  readonly edges: readonly CoreBpmnEdge[];
  readonly participants?: readonly CollaborationParticipant[];
  readonly lanes?: readonly CollaborationLane[];
}

export interface ReparentIntent {
  readonly selectedElementId: string;
  readonly expectedSourceContainerId: string;
  readonly targetContainerId: string;
  readonly expectedRevisionToken: string;
  readonly currentRevisionToken: string;
  readonly expectedClosureIds: readonly string[];
  readonly expectedReferenceIds: readonly string[];
  readonly targetLaneId?: string;
}

export interface ReparentImpact {
  readonly selectedElementId: string;
  readonly sourceContainerId: string;
  readonly closureIds: readonly string[];
  readonly referenceIds: readonly string[];
  readonly attachedBoundaryEventIds: readonly string[];
  readonly currentLaneId?: string;
  readonly eligibleTargets: readonly {
    readonly containerId: string;
    readonly type: "bpmn:Process" | "bpmn:SubProcess";
    readonly inheritedLaneId?: string;
    readonly requiresTargetLeafLane: boolean;
  }[];
}

export type ReparentBlockReason =
  | "STALE_REVISION"
  | "MISSING_ELEMENT"
  | "INELIGIBLE_FLOW_NODE"
  | "SOURCE_CONTAINER_DRIFT"
  | "INVALID_TARGET_CONTAINER"
  | "SAME_CONTAINER"
  | "CROSS_PROCESS"
  | "CROSS_POOL"
  | "NESTED_SUBPROCESS"
  | "COLLAPSED_SUBPROCESS"
  | "STALE_CLOSURE"
  | "STALE_REFERENCES"
  | "CROSS_CONTAINER_CONNECTOR"
  | "CROSS_CONTAINER_DATA_ASSOCIATION"
  | "TARGET_LANE_REQUIRED"
  | "INVALID_TARGET_LANE";

export type ReparentPlan =
  | {
      readonly accepted: true;
      readonly selectedElementId: string;
      readonly sourceContainerId: string;
      readonly targetContainerId: string;
      readonly closureIds: readonly string[];
      readonly referenceIds: readonly string[];
      readonly targetLaneId?: string;
      readonly preservedSemanticIds: readonly string[];
      readonly preservedDiIds: readonly string[];
      readonly commandCount: 1;
    }
  | {
      readonly accepted: false;
      readonly reason: ReparentBlockReason;
      readonly elementId?: string;
      readonly closureIds: readonly [];
      readonly referenceIds: readonly [];
      readonly commandCount: 0;
    };

const eligibleFlowNodeTypes = new Set([
  "bpmn:StartEvent",
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ReceiveTask",
  "bpmn:CallActivity",
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:InclusiveGateway",
  "bpmn:EventBasedGateway",
  "bpmn:ComplexGateway",
  "bpmn:IntermediateCatchEvent",
  "bpmn:IntermediateThrowEvent",
  "bpmn:EndEvent",
]);

const dataAssociationTypes = new Set([
  "bpmn:DataInputAssociation",
  "bpmn:DataOutputAssociation",
]);

const rootRegistryTypes = new Set([
  "bpmn:DataStore",
  "bpmn:Message",
  "bpmn:Category",
  "bpmn:CategoryValue",
]);

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function sameExactIds(
  expected: readonly string[],
  actual: readonly string[],
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((id, index) => id === actual[index])
  );
}

function reject(
  reason: ReparentBlockReason,
  elementId?: string,
): ReparentPlan {
  return {
    accepted: false,
    reason,
    elementId,
    closureIds: [],
    referenceIds: [],
    commandCount: 0,
  };
}

function rootProcessId(
  element: CoreBpmnElement,
  byId: ReadonlyMap<string, CoreBpmnElement>,
): string | undefined {
  if (element.type === "bpmn:Process") return element.id;
  if (element.processId) return element.processId;
  let parentId = element.parentContainerId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) return undefined;
    if (parent.type === "bpmn:Process") return parent.id;
    parentId = parent.parentContainerId;
  }
  return undefined;
}

function participantIdForProcess(
  processId: string | undefined,
  participants: readonly CollaborationParticipant[],
): string | undefined {
  return participants.find((participant) => participant.processId === processId)
    ?.id;
}

function effectiveLeafLaneId(
  flowNodeId: string,
  lanes: readonly CollaborationLane[],
): string | undefined {
  const candidates = lanes.filter((lane) =>
    lane.flowNodeIds.includes(flowNodeId),
  );
  if (candidates.length === 0) return undefined;
  return [...candidates].sort(
    (left, right) => (right.depth ?? 0) - (left.depth ?? 0),
  )[0]?.id;
}

function reparentProjection(
  snapshot: SubProcessLifecycleSnapshot,
  selected: CoreBpmnElement,
) {
  const boundaryIds = snapshot.elements
    .filter(
      (element) =>
        element.type === "bpmn:BoundaryEvent" &&
        element.attachedToId === selected.id,
    )
    .map((element) => element.id);
  const closureIds = sorted([selected.id, ...boundaryIds]);
  const closure = new Set(closureIds);
  const references = new Set<string>();

  for (const element of snapshot.elements) {
    if (
      element.type === "bpmn:SequenceFlow" &&
      ((element.sourceId && closure.has(element.sourceId)) ||
        (element.targetId && closure.has(element.targetId)))
    ) {
      references.add(element.id);
    }
    if (
      dataAssociationTypes.has(element.type) &&
      ((element.associationOwnerId &&
        closure.has(element.associationOwnerId)) ||
        (element.sourceId && closure.has(element.sourceId)) ||
        (element.targetId && closure.has(element.targetId)))
    ) {
      references.add(element.id);
      if (element.sourceId) references.add(element.sourceId);
      if (element.targetId) references.add(element.targetId);
    }
  }
  return { closureIds, referenceIds: sorted(references) };
}

export function projectFlowNodeReparentImpact(
  snapshot: SubProcessLifecycleSnapshot,
  selectedElementId: string,
): ReparentImpact | undefined {
  const byId = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const selected = byId.get(selectedElementId);
  if (
    !selected ||
    !selected.parentContainerId ||
    !eligibleFlowNodeTypes.has(selected.type)
  ) {
    return undefined;
  }
  const processId = rootProcessId(selected, byId);
  if (!processId) return undefined;
  const projection = reparentProjection(snapshot, selected);
  const closure = new Set(projection.closureIds);
  const lanes = snapshot.lanes ?? [];
  const participants = snapshot.participants ?? [];
  const participantId = participantIdForProcess(processId, participants);
  if (participants.length > 0 && !participantId) return undefined;
  const eligibleTargets = snapshot.elements
    .filter(
      (candidate) =>
        candidate.id !== selected.parentContainerId &&
        (candidate.type === "bpmn:Process" ||
          candidate.type === "bpmn:SubProcess") &&
        rootProcessId(candidate, byId) === processId &&
        participantIdForProcess(rootProcessId(candidate, byId), participants) ===
          participantId &&
        (candidate.type !== "bpmn:SubProcess" ||
          ((candidate.isExpanded === true ||
            snapshot.shapes.find(
              (shape) => shape.elementId === candidate.id,
            )?.isExpanded === true) &&
            byId.get(candidate.parentContainerId ?? "")?.type !==
              "bpmn:SubProcess")) &&
        (candidate.type !== "bpmn:Process" ||
          participants.length > 0 ||
          snapshot.planeElementId === candidate.id) &&
        (candidate.type !== "bpmn:SubProcess" ||
          participants.length === 0 ||
          Boolean(effectiveLeafLaneId(candidate.id, lanes))) &&
        (candidate.type !== "bpmn:Process" ||
          participants.length === 0 ||
          lanes.some(
            (lane) =>
              lane.processId === candidate.id &&
              lane.participantId === participantId &&
              !lanes.some((child) => child.parentLaneId === lane.id),
          )),
    )
    .filter((candidate) => {
      const connectorWouldCross = snapshot.elements
        .filter((element) => element.type === "bpmn:SequenceFlow")
        .some((flow) => {
          if (
            !closure.has(flow.sourceId ?? "") &&
            !closure.has(flow.targetId ?? "")
          ) {
            return false;
          }
          const otherId = closure.has(flow.sourceId ?? "")
            ? flow.targetId
            : flow.sourceId;
          return (
            Boolean(otherId) &&
            !closure.has(otherId ?? "") &&
            byId.get(otherId ?? "")?.parentContainerId !== candidate.id
          );
        });
      const dataWouldCross = snapshot.elements
        .filter((element) => dataAssociationTypes.has(element.type))
        .some((association) => {
          const touchesClosure =
            closure.has(association.associationOwnerId ?? "") ||
            closure.has(association.sourceId ?? "") ||
            closure.has(association.targetId ?? "");
          return (
            touchesClosure &&
            [association.sourceId, association.targetId]
              .filter((id): id is string => Boolean(id))
              .some(
                (id) =>
                  !closure.has(id) &&
                  byId.get(id)?.parentContainerId !== candidate.id,
              )
          );
        });
      return !connectorWouldCross && !dataWouldCross;
    })
    .map((candidate) => ({
      containerId: candidate.id,
      type: candidate.type as "bpmn:Process" | "bpmn:SubProcess",
      inheritedLaneId:
        candidate.type === "bpmn:SubProcess"
          ? effectiveLeafLaneId(candidate.id, lanes)
          : undefined,
      requiresTargetLeafLane:
        candidate.type === "bpmn:Process" && participants.length > 0,
    }))
    .sort((left, right) => left.containerId.localeCompare(right.containerId));
  return {
    selectedElementId,
    sourceContainerId: selected.parentContainerId,
    closureIds: projection.closureIds,
    referenceIds: projection.referenceIds,
    attachedBoundaryEventIds: projection.closureIds.filter(
      (id) => id !== selectedElementId,
    ),
    currentLaneId: effectiveLeafLaneId(selectedElementId, lanes),
    eligibleTargets,
  };
}

export function planFlowNodeReparent(
  snapshot: SubProcessLifecycleSnapshot,
  intent: ReparentIntent,
): ReparentPlan {
  if (intent.expectedRevisionToken !== intent.currentRevisionToken) {
    return reject("STALE_REVISION", intent.selectedElementId);
  }
  const byId = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const selected = byId.get(intent.selectedElementId);
  if (!selected) return reject("MISSING_ELEMENT", intent.selectedElementId);
  if (!eligibleFlowNodeTypes.has(selected.type)) {
    return reject("INELIGIBLE_FLOW_NODE", selected.id);
  }
  if (selected.parentContainerId !== intent.expectedSourceContainerId) {
    return reject("SOURCE_CONTAINER_DRIFT", selected.id);
  }
  if (intent.targetContainerId === intent.expectedSourceContainerId) {
    return reject("SAME_CONTAINER", selected.id);
  }
  const target = byId.get(intent.targetContainerId);
  if (
    !target ||
    (target.type !== "bpmn:Process" && target.type !== "bpmn:SubProcess")
  ) {
    return reject("INVALID_TARGET_CONTAINER", intent.targetContainerId);
  }
  if (
    target.type === "bpmn:SubProcess" &&
    target.parentContainerId &&
    byId.get(target.parentContainerId)?.type === "bpmn:SubProcess"
  ) {
    return reject("NESTED_SUBPROCESS", target.id);
  }
  if (
    target.type === "bpmn:SubProcess" &&
    target.isExpanded !== true &&
    snapshot.shapes.find((shape) => shape.elementId === target.id)?.isExpanded !==
      true
  ) {
    return reject("COLLAPSED_SUBPROCESS", target.id);
  }

  const sourceProcessId = rootProcessId(selected, byId);
  const targetProcessId = rootProcessId(target, byId);
  if (!sourceProcessId || sourceProcessId !== targetProcessId) {
    return reject("CROSS_PROCESS", selected.id);
  }
  const participants = snapshot.participants ?? [];
  const sourceParticipantId = participantIdForProcess(
    sourceProcessId,
    participants,
  );
  const targetParticipantId = participantIdForProcess(
    targetProcessId,
    participants,
  );
  if (
    sourceParticipantId !== targetParticipantId ||
    (participants.length > 0 && !sourceParticipantId)
  ) {
    return reject("CROSS_POOL", selected.id);
  }
  if (
    target.type === "bpmn:Process" &&
    participants.length === 0 &&
    snapshot.planeElementId !== target.id
  ) {
    return reject("INVALID_TARGET_CONTAINER", target.id);
  }

  const projection = projectFlowNodeReparentImpact(snapshot, selected.id);
  if (!projection) return reject("INELIGIBLE_FLOW_NODE", selected.id);
  if (!sameExactIds(intent.expectedClosureIds, projection.closureIds)) {
    return reject("STALE_CLOSURE", selected.id);
  }
  if (!sameExactIds(intent.expectedReferenceIds, projection.referenceIds)) {
    return reject("STALE_REFERENCES", selected.id);
  }
  const closure = new Set(projection.closureIds);
  for (const flow of snapshot.elements.filter(
    (element) => element.type === "bpmn:SequenceFlow",
  )) {
    if (
      (flow.sourceId && closure.has(flow.sourceId)) ||
      (flow.targetId && closure.has(flow.targetId))
    ) {
      const otherId = closure.has(flow.sourceId ?? "")
        ? flow.targetId
        : flow.sourceId;
      if (
        otherId &&
        !closure.has(otherId) &&
        byId.get(otherId)?.parentContainerId !== target.id
      ) {
        return reject("CROSS_CONTAINER_CONNECTOR", flow.id);
      }
    }
  }
  for (const association of snapshot.elements.filter((element) =>
    dataAssociationTypes.has(element.type),
  )) {
    const touchesClosure =
      closure.has(association.associationOwnerId ?? "") ||
      closure.has(association.sourceId ?? "") ||
      closure.has(association.targetId ?? "");
    if (
      touchesClosure &&
      [association.sourceId, association.targetId]
        .filter((id): id is string => Boolean(id))
        .some(
          (id) =>
            !closure.has(id) && byId.get(id)?.parentContainerId !== target.id,
        )
    ) {
      return reject("CROSS_CONTAINER_DATA_ASSOCIATION", association.id);
    }
  }

  const lanes = snapshot.lanes ?? [];
  let targetLaneId: string | undefined;
  if (lanes.length > 0) {
    if (target.type === "bpmn:SubProcess") {
      targetLaneId = effectiveLeafLaneId(target.id, lanes);
      if (participants.length > 0 && !targetLaneId) {
        return reject("INVALID_TARGET_LANE", target.id);
      }
      if (intent.targetLaneId && intent.targetLaneId !== targetLaneId) {
        return reject("INVALID_TARGET_LANE", intent.targetLaneId);
      }
    } else {
      if (!intent.targetLaneId) {
        return reject("TARGET_LANE_REQUIRED", selected.id);
      }
      const lane = lanes.find((candidate) => candidate.id === intent.targetLaneId);
      const hasChildLane = lanes.some(
        (candidate) => candidate.parentLaneId === intent.targetLaneId,
      );
      if (
        !lane ||
        lane.processId !== targetProcessId ||
        lane.participantId !== sourceParticipantId ||
        hasChildLane
      ) {
        return reject("INVALID_TARGET_LANE", intent.targetLaneId);
      }
      targetLaneId = lane.id;
    }
  } else if (participants.length > 0) {
    return reject(
      intent.targetLaneId ? "INVALID_TARGET_LANE" : "TARGET_LANE_REQUIRED",
      intent.targetLaneId ?? selected.id,
    );
  } else if (intent.targetLaneId) {
    return reject("INVALID_TARGET_LANE", intent.targetLaneId);
  }

  const shapeIds = new Set(snapshot.shapes.map((shape) => shape.elementId));
  return {
    accepted: true,
    selectedElementId: selected.id,
    sourceContainerId: intent.expectedSourceContainerId,
    targetContainerId: target.id,
    closureIds: projection.closureIds,
    referenceIds: projection.referenceIds,
    targetLaneId,
    preservedSemanticIds: projection.closureIds,
    preservedDiIds: projection.closureIds.filter((id) => shapeIds.has(id)),
    commandCount: 1,
  };
}

export interface SubProcessDeleteImpact {
  readonly subProcessId: string;
  readonly revisionToken: string;
  readonly descendantIds: readonly string[];
  readonly boundaryEventIds: readonly string[];
  readonly internalSequenceFlowIds: readonly string[];
  readonly incidentSequenceFlowIds: readonly string[];
  readonly artifactIds: readonly string[];
  readonly dataReferenceIds: readonly string[];
  readonly dataAssociationIds: readonly string[];
  readonly orphanDataObjectIds: readonly string[];
  readonly sharedLocalDataObjectIds: readonly string[];
  readonly retainedRootRegistryIds: readonly string[];
  readonly deleteElementIds: readonly string[];
}

export interface SubProcessDeleteIntent {
  readonly action: "CANCEL" | "CASCADE";
  readonly subProcessId: string;
  readonly expectedRevisionToken: string;
  readonly currentRevisionToken: string;
  readonly expectedDeleteElementIds: readonly string[];
  readonly expectedRetainedRootRegistryIds: readonly string[];
}

export type SubProcessDeletePlan =
  | {
      readonly accepted: true;
      readonly impact: SubProcessDeleteImpact;
      readonly deleteElementIds: readonly string[];
      readonly retainedRootRegistryIds: readonly string[];
      readonly commandCount: 1;
    }
  | {
      readonly accepted: false;
      readonly reason:
        | "CANCELLED"
        | "STALE_REVISION"
        | "MISSING_SUBPROCESS"
        | "SHARED_LOCAL_DATA_OBJECT"
        | "STALE_IMPACT";
      readonly deleteElementIds: readonly [];
      readonly retainedRootRegistryIds: readonly [];
      readonly commandCount: 0;
    };

function descendantIds(
  elements: readonly CoreBpmnElement[],
  containerId: string,
): string[] {
  const found = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of elements) {
      if (
        element.parentContainerId &&
        (element.parentContainerId === containerId ||
          found.has(element.parentContainerId)) &&
        !found.has(element.id)
      ) {
        found.add(element.id);
        changed = true;
      }
    }
  }
  return sorted(found);
}

export function projectSubProcessDeleteImpact(
  snapshot: SubProcessLifecycleSnapshot,
  subProcessId: string,
  revisionToken: string,
): SubProcessDeleteImpact | undefined {
  const subProcess = snapshot.elements.find(
    (element) =>
      element.id === subProcessId && element.type === "bpmn:SubProcess",
  );
  if (!subProcess) return undefined;

  const descendants = descendantIds(snapshot.elements, subProcessId);
  const closure = new Set([subProcessId, ...descendants]);
  const byId = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const boundaryEventIds = sorted(
    snapshot.elements
      .filter(
        (element) =>
          element.type === "bpmn:BoundaryEvent" &&
          closure.has(element.attachedToId ?? ""),
      )
      .map((element) => element.id),
  );
  boundaryEventIds.forEach((id) => closure.add(id));

  const sequenceFlows = snapshot.elements.filter(
    (element) => element.type === "bpmn:SequenceFlow",
  );
  const internalSequenceFlowIds = sorted(
    sequenceFlows
      .filter(
        (flow) =>
          closure.has(flow.sourceId ?? "") &&
          closure.has(flow.targetId ?? ""),
      )
      .map((flow) => flow.id),
  );
  const incidentSequenceFlowIds = sorted(
    sequenceFlows
      .filter(
        (flow) =>
          closure.has(flow.sourceId ?? "") !==
          closure.has(flow.targetId ?? ""),
      )
      .map((flow) => flow.id),
  );
  const dataAssociationIds = sorted(
    snapshot.elements
      .filter(
        (element) =>
          dataAssociationTypes.has(element.type) &&
          (closure.has(element.associationOwnerId ?? "") ||
            closure.has(element.sourceId ?? "") ||
            closure.has(element.targetId ?? "")),
      )
      .map((element) => element.id),
  );
  const dataReferenceIds = sorted(
    snapshot.elements
      .filter(
        (element) =>
          closure.has(element.id) &&
          (element.type === "bpmn:DataObjectReference" ||
            element.type === "bpmn:DataStoreReference"),
      )
      .map((element) => element.id),
  );
  const artifactIds = sorted(
    snapshot.elements
      .filter(
        (element) =>
          (closure.has(element.id) &&
            (element.type === "bpmn:TextAnnotation" ||
              element.type === "bpmn:Association" ||
              element.type === "bpmn:Group")) ||
          (element.type === "bpmn:Association" &&
            (closure.has(element.sourceId ?? "") ||
              closure.has(element.targetId ?? ""))),
      )
      .map((element) => element.id),
  );
  const deletingObjectRefs = snapshot.elements.filter(
    (element) =>
      closure.has(element.id) &&
      element.type === "bpmn:DataObjectReference" &&
      Boolean(element.dataObjectRefId),
  );
  const orphanDataObjectIds = sorted(
    deletingObjectRefs
      .map((reference) => reference.dataObjectRefId!)
      .filter((dataObjectId) => {
        const backing = byId.get(dataObjectId);
        return (
          backing?.type === "bpmn:DataObject" &&
          !snapshot.elements.some(
            (element) =>
              !closure.has(element.id) &&
              element.type === "bpmn:DataObjectReference" &&
              element.dataObjectRefId === dataObjectId,
          )
        );
      }),
  );
  const sharedLocalDataObjectIds = sorted(
    deletingObjectRefs
      .map((reference) => reference.dataObjectRefId!)
      .filter((dataObjectId) =>
        snapshot.elements.some(
          (element) =>
            !closure.has(element.id) &&
            element.type === "bpmn:DataObjectReference" &&
            element.dataObjectRefId === dataObjectId,
        ),
      ),
  );
  const retainedRootRegistryIds = new Set<string>();
  for (const element of snapshot.elements) {
    if (closure.has(element.id)) {
      for (const refId of [
        element.dataStoreRefId,
        element.messageRefId,
        element.categoryValueRefId,
      ]) {
        if (refId && rootRegistryTypes.has(byId.get(refId)?.type ?? "")) {
          retainedRootRegistryIds.add(refId);
          const referencedRoot = byId.get(refId);
          if (
            referencedRoot?.type === "bpmn:CategoryValue" &&
            referencedRoot.parentId &&
            byId.get(referencedRoot.parentId)?.type === "bpmn:Category"
          ) {
            retainedRootRegistryIds.add(referencedRoot.parentId);
          }
        }
      }
    }
  }
  const deleteElementIds = sorted([
    ...closure,
    ...internalSequenceFlowIds,
    ...incidentSequenceFlowIds,
    ...artifactIds,
    ...dataAssociationIds,
    ...orphanDataObjectIds,
  ]);
  return {
    subProcessId,
    revisionToken,
    descendantIds: descendants,
    boundaryEventIds,
    internalSequenceFlowIds,
    incidentSequenceFlowIds,
    artifactIds,
    dataReferenceIds,
    dataAssociationIds,
    orphanDataObjectIds,
    sharedLocalDataObjectIds,
    retainedRootRegistryIds: sorted(retainedRootRegistryIds),
    deleteElementIds,
  };
}

export function planSubProcessDelete(
  snapshot: SubProcessLifecycleSnapshot,
  intent: SubProcessDeleteIntent,
): SubProcessDeletePlan {
  if (intent.action === "CANCEL") {
    return {
      accepted: false,
      reason: "CANCELLED",
      deleteElementIds: [],
      retainedRootRegistryIds: [],
      commandCount: 0,
    };
  }
  if (intent.expectedRevisionToken !== intent.currentRevisionToken) {
    return {
      accepted: false,
      reason: "STALE_REVISION",
      deleteElementIds: [],
      retainedRootRegistryIds: [],
      commandCount: 0,
    };
  }
  const impact = projectSubProcessDeleteImpact(
    snapshot,
    intent.subProcessId,
    intent.currentRevisionToken,
  );
  if (!impact) {
    return {
      accepted: false,
      reason: "MISSING_SUBPROCESS",
      deleteElementIds: [],
      retainedRootRegistryIds: [],
      commandCount: 0,
    };
  }
  if (impact.sharedLocalDataObjectIds.length > 0) {
    return {
      accepted: false,
      reason: "SHARED_LOCAL_DATA_OBJECT",
      deleteElementIds: [],
      retainedRootRegistryIds: [],
      commandCount: 0,
    };
  }
  if (
    !sameExactIds(intent.expectedDeleteElementIds, impact.deleteElementIds) ||
    !sameExactIds(
      intent.expectedRetainedRootRegistryIds,
      impact.retainedRootRegistryIds,
    )
  ) {
    return {
      accepted: false,
      reason: "STALE_IMPACT",
      deleteElementIds: [],
      retainedRootRegistryIds: [],
      commandCount: 0,
    };
  }
  return {
    accepted: true,
    impact,
    deleteElementIds: impact.deleteElementIds,
    retainedRootRegistryIds: impact.retainedRootRegistryIds,
    commandCount: 1,
  };
}
