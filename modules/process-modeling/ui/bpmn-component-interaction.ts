export type BpmnConnectKind =
  | "sequence"
  | "message"
  | "association"
  | "data-association";

const flowNodeTypes = new Set([
  "bpmn:StartEvent",
  "bpmn:Task",
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:InclusiveGateway",
  "bpmn:IntermediateCatchEvent",
  "bpmn:ReceiveTask",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:IntermediateThrowEvent",
  "bpmn:BoundaryEvent",
  "bpmn:EventBasedGateway",
  "bpmn:SubProcess",
  "bpmn:CallActivity",
  "bpmn:ComplexGateway",
  "bpmn:EndEvent",
]);

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

const associationExcludedTypes = new Set([
  "bpmn:Association",
  "bpmn:SequenceFlow",
  "bpmn:MessageFlow",
  "bpmn:DataInputAssociation",
  "bpmn:DataOutputAssociation",
  "bpmn:Process",
  "bpmn:Collaboration",
  "bpmn:LaneSet",
]);

export function isValidBpmnConnectionSourceType(
  kind: BpmnConnectKind,
  type: string | null | undefined,
): boolean {
  if (!type) return false;
  if (kind === "sequence") return flowNodeTypes.has(type);
  if (kind === "message") {
    return flowNodeTypes.has(type) || type === "bpmn:Participant";
  }
  if (kind === "association") return !associationExcludedTypes.has(type);
  return activityTypes.has(type) || dataReferenceTypes.has(type);
}

export function isCollaborationPlacementObstacleType(type: string): boolean {
  return (
    flowNodeTypes.has(type) ||
    dataReferenceTypes.has(type) ||
    type === "bpmn:TextAnnotation"
  );
}
