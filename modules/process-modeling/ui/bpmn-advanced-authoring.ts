export type DataAssociationDirection = "INPUT" | "OUTPUT";

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

export function inferDataAssociationDirection(
  sourceType: string,
  targetType: string,
): DataAssociationDirection | null {
  if (dataReferenceTypes.has(sourceType) && activityTypes.has(targetType)) {
    return "INPUT";
  }
  if (activityTypes.has(sourceType) && dataReferenceTypes.has(targetType)) {
    return "OUTPUT";
  }
  return null;
}

export function complexActivationError(
  value: string,
  graphemeLength = [...value].length,
): string | undefined {
  if (!value.trim()) return "Điều kiện kích hoạt là bắt buộc.";
  if (graphemeLength > 500) {
    return "Điều kiện kích hoạt tối đa 500 ký tự.";
  }
  return undefined;
}
