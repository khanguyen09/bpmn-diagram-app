import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "./core-profile";

export type MessageOwnerProperty =
  | "MessageEventDefinition.messageRef"
  | "ReceiveTask.messageRef";

export interface MessageRegistryOwner {
  readonly ownerId: string;
  readonly ownerType: string;
  readonly definitionId?: string;
  readonly property: MessageOwnerProperty;
}

export interface MessageReferenceObservation {
  readonly messageId: string;
  readonly ownerId: string;
  readonly ownerType: string;
  readonly definitionId?: string;
  readonly property: string;
  readonly supported: boolean;
}

export interface MessageRegistryEntry {
  readonly id: string;
  readonly name: string;
  readonly owners: readonly MessageRegistryOwner[];
  readonly referenceCount: number;
  readonly hasUnknownReferences: boolean;
}

export interface MessageCleanupIntent {
  readonly candidateIds: readonly string[];
  readonly expectedReferenceCounts: Readonly<Record<string, number>>;
}

export type MessageCleanupPlan =
  | {
      readonly accepted: true;
      readonly deleteIds: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly reason:
        | "DUPLICATE_CANDIDATE"
        | "MISSING_MESSAGE"
        | "STALE_REFERENCE_COUNT"
        | "REFERENCED"
        | "UNKNOWN_REFERENCE";
      readonly messageId?: string;
      readonly deleteIds: readonly [];
    };

export function normalizeMessageRegistryName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

export function projectMessageRegistry(
  elements: readonly CoreBpmnElement[],
  references: readonly MessageReferenceObservation[],
): readonly MessageRegistryEntry[] {
  const observationsByMessage = new Map<string, MessageReferenceObservation[]>();
  for (const reference of references) {
    observationsByMessage.set(reference.messageId, [
      ...(observationsByMessage.get(reference.messageId) ?? []),
      reference,
    ]);
  }
  return elements
    .filter((element) => element.type === "bpmn:Message")
    .map((message) => {
      const observations = observationsByMessage.get(message.id) ?? [];
      const isSupportedObservation = (
        observation: MessageReferenceObservation,
      ) =>
        observation.supported &&
        ((observation.property === "ReceiveTask.messageRef" &&
          observation.ownerType === "bpmn:ReceiveTask") ||
          (observation.property === "MessageEventDefinition.messageRef" &&
            [
              "bpmn:IntermediateCatchEvent",
              "bpmn:IntermediateThrowEvent",
              "bpmn:BoundaryEvent",
            ].includes(observation.ownerType)));
      const owners = observations
        .filter(isSupportedObservation)
        .map((observation): MessageRegistryOwner => ({
          ownerId: observation.ownerId,
          ownerType: observation.ownerType,
          ...(observation.definitionId
            ? { definitionId: observation.definitionId }
            : {}),
          property:
            observation.property === "ReceiveTask.messageRef"
              ? "ReceiveTask.messageRef"
              : "MessageEventDefinition.messageRef",
        }))
        .sort((left, right) =>
          left.ownerId.localeCompare(right.ownerId) ||
          (left.definitionId ?? "").localeCompare(right.definitionId ?? "")
        );
      return {
        id: message.id,
        name: message.name ?? "",
        owners,
        referenceCount: observations.length,
        hasUnknownReferences: observations.some(
          (observation) => !isSupportedObservation(observation),
        ),
      };
    });
}

export function planMessageCleanup(
  registry: readonly MessageRegistryEntry[],
  intent: MessageCleanupIntent,
): MessageCleanupPlan {
  if (new Set(intent.candidateIds).size !== intent.candidateIds.length) {
    return {
      accepted: false,
      reason: "DUPLICATE_CANDIDATE",
      deleteIds: [],
    };
  }
  const byId = new Map(registry.map((entry) => [entry.id, entry] as const));
  for (const id of intent.candidateIds) {
    const entry = byId.get(id);
    if (!entry) {
      return {
        accepted: false,
        reason: "MISSING_MESSAGE",
        messageId: id,
        deleteIds: [],
      };
    }
    if (intent.expectedReferenceCounts[id] !== entry.referenceCount) {
      return {
        accepted: false,
        reason: "STALE_REFERENCE_COUNT",
        messageId: id,
        deleteIds: [],
      };
    }
    if (entry.hasUnknownReferences) {
      return {
        accepted: false,
        reason: "UNKNOWN_REFERENCE",
        messageId: id,
        deleteIds: [],
      };
    }
    if (entry.referenceCount !== 0) {
      return {
        accepted: false,
        reason: "REFERENCED",
        messageId: id,
        deleteIds: [],
      };
    }
  }
  return { accepted: true, deleteIds: [...intent.candidateIds] };
}

export function inspectMessageRegistry(
  registry: readonly MessageRegistryEntry[],
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const idsByNormalizedName = new Map<string, string[]>();
  for (const entry of registry) {
    const length = Array.from(entry.name).length;
    if (!entry.name.trim()) {
      issues.push({
        ruleId: "BPMN-MSG-004",
        severity: "warning",
        disposition: "recoverable",
        elementId: entry.id,
        message: "Root Message cần tên semantic không rỗng.",
        recovery: "Đặt tên thông điệp trước khi seal.",
      });
    } else if (
      length > 180 ||
      /[\u0000-\u001F\u007F]/.test(entry.name)
    ) {
      issues.push({
        ruleId: "BPMN-MSG-007",
        severity: "error",
        disposition: "fatal",
        elementId: entry.id,
        message: "Tên root Message vượt bounded plain-text contract.",
        recovery: "Dùng tên text thuần tối đa 180 ký tự.",
      });
    }
    if (entry.referenceCount === 0) {
      issues.push({
        ruleId: "BPMN-MSG-005",
        severity: "warning",
        disposition: "recoverable",
        elementId: entry.id,
        message: "Root Message không còn owner tham chiếu.",
        recovery: "Reuse Message hoặc cleanup orphan bằng exact-ID confirmation.",
      });
    }
    if (entry.hasUnknownReferences) {
      issues.push({
        ruleId: "BPMN-MSG-008",
        severity: "error",
        disposition: "fatal",
        elementId: entry.id,
        message: "Root Message có inbound reference ngoài profile được hỗ trợ.",
        recovery: "Loại bỏ owner/ref chưa hỗ trợ; cleanup sẽ không xóa Message này.",
      });
    }
    const normalized = normalizeMessageRegistryName(entry.name);
    if (normalized) {
      idsByNormalizedName.set(normalized, [
        ...(idsByNormalizedName.get(normalized) ?? []),
        entry.id,
      ]);
    }
  }
  for (const ids of idsByNormalizedName.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      issues.push({
        ruleId: "BPMN-MSG-006",
        severity: "warning",
        disposition: "recoverable",
        elementId: id,
        message: "Nhiều root Message có cùng tên chuẩn hóa.",
        recovery: "Reuse theo stable ID nếu cùng ngữ nghĩa; không tự động merge.",
      });
    }
  }
  return issues;
}
