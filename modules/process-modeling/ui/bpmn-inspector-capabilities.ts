export type BpmnInspectorActivationIntent =
  | "DIRECT_CANVAS"
  | "VALIDATION_NAVIGATION"
  | "CONNECT_WORKFLOW";

export type BpmnInspectorFamily =
  | "flow-node"
  | "event"
  | "routing"
  | "container"
  | "data"
  | "artifact"
  | "collaboration"
  | "connection"
  | "unknown";

export interface BpmnInspectorCapability {
  readonly family: BpmnInspectorFamily;
  readonly supportsDisplayName: boolean;
  readonly showsEndpointSummary: boolean;
}

export interface BpmnPlainReferenceItem {
  readonly id: string;
  readonly name?: string | null;
}

export interface BpmnPlainReferenceOption {
  readonly value: string;
  readonly label: string;
}

export interface BpmnPlainConnectionPresentation {
  readonly title: string;
  readonly direction: string;
  readonly source: string;
  readonly target: string;
}

export function resolveBpmnSemanticElement<T>(
  element:
    | (T & { readonly labelTarget?: T | null })
    | null
    | undefined,
): T | null {
  if (!element) return null;
  return element.labelTarget ?? element;
}

export function compactBpmnSelectionText(
  value: string,
  maxGraphemes = 72,
): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  const limit = Math.max(0, Math.floor(maxGraphemes));
  if (!normalized || limit === 0) return "";

  const graphemes = [
    ...new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(
      normalized,
    ),
  ].map((segment) => segment.segment);
  if (graphemes.length <= limit) return normalized;
  if (limit === 1) return "…";
  return `${graphemes.slice(0, limit - 1).join("").trimEnd()}…`;
}

export function reconcileBpmnArtifactDraft(
  draft: string,
  previousSnapshot: string,
  nextSemantic: string,
): string {
  return draft === previousSnapshot ? nextSemantic : draft;
}

const familyByType: Readonly<Record<string, BpmnInspectorFamily>> = {
  "bpmn:Task": "flow-node",
  "bpmn:UserTask": "flow-node",
  "bpmn:ServiceTask": "flow-node",
  "bpmn:ManualTask": "flow-node",
  "bpmn:ReceiveTask": "flow-node",
  "bpmn:StartEvent": "event",
  "bpmn:EndEvent": "event",
  "bpmn:IntermediateCatchEvent": "event",
  "bpmn:IntermediateThrowEvent": "event",
  "bpmn:BoundaryEvent": "event",
  "bpmn:ExclusiveGateway": "routing",
  "bpmn:ParallelGateway": "routing",
  "bpmn:InclusiveGateway": "routing",
  "bpmn:ComplexGateway": "routing",
  "bpmn:EventBasedGateway": "routing",
  "bpmn:SubProcess": "container",
  "bpmn:CallActivity": "container",
  "bpmn:DataObjectReference": "data",
  "bpmn:DataStoreReference": "data",
  "bpmn:TextAnnotation": "artifact",
  "bpmn:Group": "artifact",
  "bpmn:Participant": "collaboration",
  "bpmn:Lane": "collaboration",
  "bpmn:SequenceFlow": "connection",
  "bpmn:MessageFlow": "connection",
  "bpmn:Association": "connection",
  "bpmn:DataAssociation": "connection",
  "bpmn:DataInputAssociation": "connection",
  "bpmn:DataOutputAssociation": "connection",
};

const connectionTypesWithEndpointSummary = new Set([
  "bpmn:MessageFlow",
  "bpmn:Association",
  "bpmn:DataAssociation",
  "bpmn:DataInputAssociation",
  "bpmn:DataOutputAssociation",
]);

export function shouldActivateInspectorEdit(
  intent: BpmnInspectorActivationIntent,
): boolean {
  return intent === "DIRECT_CANVAS";
}

export function getBpmnInspectorCapability(
  type: string,
): BpmnInspectorCapability {
  const family = familyByType[type] ?? "unknown";
  const supportsDisplayName =
    family !== "unknown" &&
    ![
      "bpmn:TextAnnotation",
      "bpmn:Group",
      "bpmn:Association",
      "bpmn:DataAssociation",
      "bpmn:DataInputAssociation",
      "bpmn:DataOutputAssociation",
    ].includes(type);

  return {
    family,
    supportsDisplayName,
    showsEndpointSummary: connectionTypesWithEndpointSummary.has(type),
  };
}

export function supportsEditableBpmnName(type: string): boolean {
  return getBpmnInspectorCapability(type).supportsDisplayName;
}

export function buildPlainReferenceOptions(
  items: readonly BpmnPlainReferenceItem[],
  unnamedLabel: string,
): readonly BpmnPlainReferenceOption[] {
  const normalizedItems = items.map((item) => ({
    value: item.id,
    label: item.name?.trim() || unnamedLabel,
  }));
  const totals = new Map<string, number>();
  for (const item of normalizedItems) {
    const key = item.label.toLocaleLowerCase("vi");
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const occurrences = new Map<string, number>();
  return normalizedItems.map((item) => {
    const key = item.label.toLocaleLowerCase("vi");
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return {
      value: item.value,
      label:
        (totals.get(key) ?? 0) > 1 && occurrence > 1
          ? `${item.label} · mục ${occurrence}`
          : item.label,
    };
  });
}

export function buildPlainConnectionPresentation(
  type: string,
  sourceLabel: string,
  targetLabel: string,
): BpmnPlainConnectionPresentation | null {
  const source = sourceLabel.trim() || "Điểm đầu chưa xác định";
  const target = targetLabel.trim() || "Điểm cuối chưa xác định";
  const copy: Readonly<
    Record<string, Pick<BpmnPlainConnectionPresentation, "title" | "direction">>
  > = {
    "bpmn:MessageFlow": {
      title: "Trao đổi thông điệp",
      direction: "Bên gửi → Bên nhận",
    },
    "bpmn:Association": {
      title: "Liên kết chú thích",
      direction: "Thành phần → Nội dung giải thích",
    },
    "bpmn:DataAssociation": {
      title: "Đường dữ liệu",
      direction: "Nguồn dữ liệu → Nơi nhận dữ liệu",
    },
    "bpmn:DataInputAssociation": {
      title: "Dữ liệu đi vào công việc",
      direction: "Nguồn dữ liệu → Công việc",
    },
    "bpmn:DataOutputAssociation": {
      title: "Dữ liệu đi ra từ công việc",
      direction: "Công việc → Nơi lưu dữ liệu",
    },
  };
  const presentation = copy[type];
  return presentation ? { ...presentation, source, target } : null;
}
