import type { BpmnInspectionIssue, CoreBpmnElement } from "./core-profile";

export interface CategoryReferenceObservation {
  readonly categoryValueId: string;
  readonly ownerId: string;
  readonly ownerType: string;
  readonly property: string;
  readonly supported: boolean;
}

export interface CategoryRegistryEntry {
  readonly categoryId: string;
  readonly categoryValueId: string;
  readonly title: string;
  readonly ownerGroupIds: readonly string[];
  readonly referenceCount: number;
  readonly hasUnknownReferences: boolean;
}

export interface CategoryCleanupIntent {
  readonly candidateValueIds: readonly string[];
  readonly expectedReferenceCounts: Readonly<Record<string, number>>;
}

export type CategoryCleanupPlan =
  | {
      readonly accepted: true;
      readonly deleteCategoryValueIds: readonly string[];
      readonly deleteCategoryIds: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly reason:
        | "DUPLICATE_CANDIDATE"
        | "MISSING_CATEGORY_VALUE"
        | "STALE_REFERENCE_COUNT"
        | "REFERENCED"
        | "UNKNOWN_REFERENCE";
      readonly categoryValueId?: string;
      readonly deleteCategoryValueIds: readonly [];
      readonly deleteCategoryIds: readonly [];
    };

export function projectCategoryRegistry(
  elements: readonly CoreBpmnElement[],
  references: readonly CategoryReferenceObservation[],
): readonly CategoryRegistryEntry[] {
  const categories = new Map(
    elements
      .filter((element) => element.type === "bpmn:Category")
      .map((element) => [element.id, element] as const),
  );
  return elements
    .filter((element) => element.type === "bpmn:CategoryValue")
    .map((value) => {
      const observations = references.filter(
        (reference) => reference.categoryValueId === value.id,
      );
      const owners = observations
        .filter(
          (reference) =>
            reference.supported &&
            reference.ownerType === "bpmn:Group" &&
            reference.property === "Group.categoryValueRef",
        )
        .map((reference) => reference.ownerId)
        .sort();
      return {
        categoryId:
          value.parentId && categories.has(value.parentId)
            ? value.parentId
            : value.parentId ?? "",
        categoryValueId: value.id,
        title: value.value ?? "",
        ownerGroupIds: owners,
        referenceCount: observations.length,
        hasUnknownReferences: observations.some(
          (reference) => !reference.supported,
        ),
      };
    });
}

export function planCategoryCleanup(
  registry: readonly CategoryRegistryEntry[],
  elements: readonly CoreBpmnElement[],
  intent: CategoryCleanupIntent,
): CategoryCleanupPlan {
  if (
    new Set(intent.candidateValueIds).size !==
    intent.candidateValueIds.length
  ) {
    return {
      accepted: false,
      reason: "DUPLICATE_CANDIDATE",
      deleteCategoryValueIds: [],
      deleteCategoryIds: [],
    };
  }
  const byId = new Map(
    registry.map((entry) => [entry.categoryValueId, entry] as const),
  );
  for (const id of intent.candidateValueIds) {
    const entry = byId.get(id);
    if (!entry) {
      return {
        accepted: false,
        reason: "MISSING_CATEGORY_VALUE",
        categoryValueId: id,
        deleteCategoryValueIds: [],
        deleteCategoryIds: [],
      };
    }
    if (intent.expectedReferenceCounts[id] !== entry.referenceCount) {
      return {
        accepted: false,
        reason: "STALE_REFERENCE_COUNT",
        categoryValueId: id,
        deleteCategoryValueIds: [],
        deleteCategoryIds: [],
      };
    }
    if (entry.hasUnknownReferences) {
      return {
        accepted: false,
        reason: "UNKNOWN_REFERENCE",
        categoryValueId: id,
        deleteCategoryValueIds: [],
        deleteCategoryIds: [],
      };
    }
    if (entry.referenceCount !== 0) {
      return {
        accepted: false,
        reason: "REFERENCED",
        categoryValueId: id,
        deleteCategoryValueIds: [],
        deleteCategoryIds: [],
      };
    }
  }
  const selected = new Set(intent.candidateValueIds);
  const deleteCategoryIds = elements
    .filter((element) => element.type === "bpmn:Category")
    .filter((category) =>
      (category.categoryValueIds ?? []).every((id) => selected.has(id)),
    )
    .map((category) => category.id);
  return {
    accepted: true,
    deleteCategoryValueIds: [...intent.candidateValueIds],
    deleteCategoryIds,
  };
}

export function inspectCategoryRegistry(
  registry: readonly CategoryRegistryEntry[],
): readonly BpmnInspectionIssue[] {
  return registry.flatMap((entry): readonly BpmnInspectionIssue[] => {
    const issues: BpmnInspectionIssue[] = [];
    if (entry.referenceCount === 0) {
      issues.push({
        ruleId: "BPMN-CATEGORY-002",
        severity: "warning",
        disposition: "recoverable",
        elementId: entry.categoryValueId,
        message: "CategoryValue không còn Group tham chiếu.",
        recovery: "Reuse hoặc cleanup bằng exact-ID confirmation.",
      });
    }
    if (entry.hasUnknownReferences) {
      issues.push({
        ruleId: "BPMN-CATEGORY-003",
        severity: "error",
        disposition: "fatal",
        elementId: entry.categoryValueId,
        message: "CategoryValue có inbound reference ngoài profile.",
        recovery: "Loại bỏ unknown owner trước khi cleanup.",
      });
    }
    return issues;
  });
}
