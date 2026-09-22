export interface SequenceFlowRoutingDraft {
  readonly condition: string;
  readonly isDefault: boolean;
}

export type SequenceFlowRoutingEdit =
  | { readonly kind: "condition"; readonly value: string }
  | { readonly kind: "default"; readonly checked: boolean };

export const maxSequenceFlowConditionLength = 500;

export function editSequenceFlowRouting(
  draft: SequenceFlowRoutingDraft,
  edit: SequenceFlowRoutingEdit,
): SequenceFlowRoutingDraft {
  if (edit.kind === "default") {
    return {
      condition: edit.checked ? "" : draft.condition,
      isDefault: edit.checked,
    };
  }
  return {
    condition: edit.value,
    isDefault: edit.value.trim() ? false : draft.isDefault,
  };
}

export function sequenceFlowRoutingError(
  draft: SequenceFlowRoutingDraft,
): string | null {
  if (draft.condition.length > maxSequenceFlowConditionLength) {
    return `Điều kiện tối đa ${maxSequenceFlowConditionLength} ký tự.`;
  }
  if (!draft.isDefault && !draft.condition.trim()) {
    return "Nhánh không mặc định cần một điều kiện.";
  }
  return null;
}

export function normalizeSequenceFlowRouting(
  draft: SequenceFlowRoutingDraft,
): SequenceFlowRoutingDraft {
  return {
    condition: draft.isDefault ? "" : draft.condition.trim(),
    isDefault: draft.isDefault,
  };
}
