export const maxChildRoleLanes = 8;
export const maxChildRoleNameGraphemes = 120;

export type ChildRoleNameError = "required" | "too_long";
export type ChildRoleNameWarning = "duplicate";

export interface ChildRoleNameAssessment {
  readonly normalizedName: string;
  readonly graphemeCount: number;
  readonly error?: ChildRoleNameError;
  readonly warning?: ChildRoleNameWarning;
}

const responsibilityTypes = new Set([
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:IntermediateCatchEvent",
  "bpmn:IntermediateThrowEvent",
  "bpmn:Task",
  "bpmn:ReceiveTask",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
]);

const graphemeSegmenter = new Intl.Segmenter("und", {
  granularity: "grapheme",
});

export function normalizeChildRoleName(value: string): string {
  return value.trim().normalize("NFC").replace(/\s+/gu, " ");
}

export function countGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export function hasDuplicateNormalizedRoleName(
  candidate: string,
  existingNames: readonly string[],
): boolean {
  const normalizedCandidate = normalizeChildRoleName(candidate).toLocaleLowerCase(
    "und",
  );
  return existingNames.some(
    (name) =>
      normalizeChildRoleName(name).toLocaleLowerCase("und") ===
      normalizedCandidate,
  );
}

export function assessChildRoleName(
  value: string,
  existingNames: readonly string[] = [],
): ChildRoleNameAssessment {
  const normalizedName = normalizeChildRoleName(value);
  const graphemeCount = countGraphemes(normalizedName);
  const error =
    graphemeCount === 0
      ? "required"
      : graphemeCount > maxChildRoleNameGraphemes
        ? "too_long"
        : undefined;
  const warning =
    !error && hasDuplicateNormalizedRoleName(normalizedName, existingNames)
      ? "duplicate"
      : undefined;

  return {
    normalizedName,
    graphemeCount,
    ...(error ? { error } : {}),
    ...(warning ? { warning } : {}),
  };
}

export function canAddChildRole(currentChildCount: number): boolean {
  return (
    Number.isInteger(currentChildCount) &&
    currentChildCount >= 2 &&
    currentChildCount < maxChildRoleLanes
  );
}

export function isLaneResponsibilityType(type: string): boolean {
  return responsibilityTypes.has(type);
}
