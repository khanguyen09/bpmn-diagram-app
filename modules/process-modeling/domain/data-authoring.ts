import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
  CoreBpmnSnapshot,
} from "./core-profile";

const activityTypes = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ReceiveTask",
  "bpmn:SubProcess",
  "bpmn:CallActivity",
]);
const dataReferenceTypes = new Set([
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
]);

function issue(
  ruleId: string,
  message: string,
  recovery: string,
  disposition: "fatal" | "recoverable",
  elementId?: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: disposition === "fatal" ? "error" : "warning",
    disposition,
    elementId,
    message,
    recovery,
  };
}

export function inspectDataAuthoring(
  snapshot: Pick<CoreBpmnSnapshot, "elements" | "shapes" | "edges">,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const byId = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const shapeIds = new Set(snapshot.shapes.map((shape) => shape.elementId));
  const edgeIds = new Set(snapshot.edges.map((edge) => edge.elementId));

  for (const definition of snapshot.elements.filter(
    (element) => element.type === "bpmn:DataObject",
  )) {
    if (definition.isCollection !== false || !definition.parentContainerId) {
      issues.push(issue(
        "BPMN-DATA-001",
        "DataObject v1 phải là non-collection và thuộc một ProcessContainer.",
        "Đặt isCollection=false và giữ backing object trong đúng container.",
        "fatal",
        definition.id,
      ));
    }
  }

  for (const reference of snapshot.elements.filter((element) =>
    dataReferenceTypes.has(element.type),
  )) {
    const backingId =
      reference.type === "bpmn:DataObjectReference"
        ? reference.dataObjectRefId
        : reference.dataStoreRefId;
    const backing = backingId ? byId.get(backingId) : undefined;
    const expectedType =
      reference.type === "bpmn:DataObjectReference"
        ? "bpmn:DataObject"
        : "bpmn:DataStore";
    if (
      !backing ||
      backing.type !== expectedType ||
      (expectedType === "bpmn:DataObject" &&
        backing.parentContainerId !== reference.parentContainerId)
    ) {
      issues.push(issue(
        "BPMN-DATA-002",
        "Data reference không resolve exact backing definition hợp lệ.",
        "Chọn DataObject cùng container hoặc Definitions-root DataStore.",
        "fatal",
        reference.id,
      ));
    }
    if (!shapeIds.has(reference.id)) {
      issues.push(issue(
        "BPMN-DATA-DI-001",
        "Visible data reference thiếu BPMNShape.",
        "Bổ sung finite positive bounds.",
        "fatal",
        reference.id,
      ));
    }
  }

  for (const association of snapshot.elements.filter(
    (element) =>
      element.type === "bpmn:DataInputAssociation" ||
      element.type === "bpmn:DataOutputAssociation",
  )) {
    const owner = association.associationOwnerId
      ? byId.get(association.associationOwnerId)
      : undefined;
    const source = association.sourceId
      ? byId.get(association.sourceId)
      : undefined;
    const target = association.targetId
      ? byId.get(association.targetId)
      : undefined;
    const input = association.type === "bpmn:DataInputAssociation";
    const dataReference = input ? source : target;
    const activity = input ? target : source;
    if (
      !owner ||
      !activity ||
      owner.id !== activity.id ||
      !activityTypes.has(activity.type) ||
      !dataReference ||
      !dataReferenceTypes.has(dataReference.type) ||
      activity.parentContainerId !== dataReference.parentContainerId ||
      association.parentContainerId !== activity.parentContainerId
    ) {
      issues.push(issue(
        "BPMN-DATA-ASSOC-001",
        "Data Association phải nối đúng một Activity và một data reference cùng scope.",
        "Tạo connector theo hướng Data→Activity hoặc Activity→Data trong cùng container.",
        "fatal",
        association.id,
      ));
    }
    if (!edgeIds.has(association.id)) {
      issues.push(issue(
        "BPMN-DATA-ASSOC-DI-001",
        "Data Association thiếu BPMNEdge.",
        "Bổ sung ít nhất hai finite waypoints.",
        "fatal",
        association.id,
      ));
    }
  }
  return issues;
}

export interface DataStoreReferenceObservation {
  readonly dataStoreId: string;
  readonly referenceId: string;
  readonly supported: boolean;
}

export interface DataStoreRegistryEntry {
  readonly dataStoreId: string;
  readonly name: string;
  readonly referenceIds: readonly string[];
  readonly referenceCount: number;
  readonly hasUnknownReferences: boolean;
}

export interface DataStoreCleanupIntent {
  readonly candidateStoreIds: readonly string[];
  readonly expectedReferenceCounts: Readonly<Record<string, number>>;
  readonly expectedReferenceIds: Readonly<Record<string, readonly string[]>>;
}

export type DataStoreCleanupPlan =
  | {
      readonly accepted: true;
      readonly deleteDataStoreIds: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly reason:
        | "DUPLICATE_CANDIDATE"
        | "MISSING_DATA_STORE"
        | "STALE_REFERENCE_COUNT"
        | "INVALID_REFERENCE_SET"
        | "STALE_REFERENCE_SET"
        | "REFERENCED"
        | "UNKNOWN_REFERENCE";
      readonly dataStoreId?: string;
      readonly deleteDataStoreIds: readonly [];
    };

export function projectDataStoreRegistry(
  elements: readonly CoreBpmnElement[],
  references: readonly DataStoreReferenceObservation[],
): readonly DataStoreRegistryEntry[] {
  return elements
    .filter((element) => element.type === "bpmn:DataStore")
    .map((store) => {
      const observations = references.filter(
        (reference) => reference.dataStoreId === store.id,
      );
      return {
        dataStoreId: store.id,
        name: store.name ?? "",
        referenceIds: observations
          .filter((reference) => reference.supported)
          .map((reference) => reference.referenceId)
          .sort(),
        referenceCount: observations.length,
        hasUnknownReferences: observations.some(
          (reference) => !reference.supported,
        ),
      };
    });
}

export function planDataStoreCleanup(
  registry: readonly DataStoreRegistryEntry[],
  intent: DataStoreCleanupIntent,
): DataStoreCleanupPlan {
  if (
    new Set(intent.candidateStoreIds).size !==
    intent.candidateStoreIds.length
  ) {
    return {
      accepted: false,
      reason: "DUPLICATE_CANDIDATE",
      deleteDataStoreIds: [],
    };
  }
  const byId = new Map(
    registry.map((entry) => [entry.dataStoreId, entry] as const),
  );
  for (const id of intent.candidateStoreIds) {
    const entry = byId.get(id);
    if (!entry) {
      return {
        accepted: false,
        reason: "MISSING_DATA_STORE",
        dataStoreId: id,
        deleteDataStoreIds: [],
      };
    }
    if (intent.expectedReferenceCounts[id] !== entry.referenceCount) {
      return {
        accepted: false,
        reason: "STALE_REFERENCE_COUNT",
        dataStoreId: id,
        deleteDataStoreIds: [],
      };
    }
    const expectedReferenceIds = intent.expectedReferenceIds[id];
    if (
      !expectedReferenceIds ||
      new Set(expectedReferenceIds).size !== expectedReferenceIds.length ||
      expectedReferenceIds.some(
        (referenceId, index) =>
          index > 0 && expectedReferenceIds[index - 1]! >= referenceId,
      )
    ) {
      return {
        accepted: false,
        reason: "INVALID_REFERENCE_SET",
        dataStoreId: id,
        deleteDataStoreIds: [],
      };
    }
    if (
      expectedReferenceIds.length !== entry.referenceIds.length ||
      expectedReferenceIds.some(
        (referenceId, index) => referenceId !== entry.referenceIds[index],
      )
    ) {
      return {
        accepted: false,
        reason: "STALE_REFERENCE_SET",
        dataStoreId: id,
        deleteDataStoreIds: [],
      };
    }
    if (entry.hasUnknownReferences) {
      return {
        accepted: false,
        reason: "UNKNOWN_REFERENCE",
        dataStoreId: id,
        deleteDataStoreIds: [],
      };
    }
    if (entry.referenceCount !== 0) {
      return {
        accepted: false,
        reason: "REFERENCED",
        dataStoreId: id,
        deleteDataStoreIds: [],
      };
    }
  }
  return {
    accepted: true,
    deleteDataStoreIds: [...intent.candidateStoreIds],
  };
}
