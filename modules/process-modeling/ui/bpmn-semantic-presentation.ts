export type BpmnColorMode = "CLASSIC" | "SEMANTIC" | "HIGH_CONTRAST";

export type BpmnSemanticCategory =
  | "event"
  | "activity"
  | "gateway"
  | "container"
  | "message-flow"
  | "sequence-flow";

export const defaultBpmnColorMode: BpmnColorMode = "CLASSIC";
export const bpmnColorModeStorageKey = "teb:bpmn-color-mode@1";

export const bpmnColorModes = [
  {
    id: "CLASSIC",
    label: "Nét tiêu chuẩn",
    hint: "Dùng đường nét trung tính, gần với sơ đồ gốc.",
  },
  {
    id: "SEMANTIC",
    label: "Màu theo nhóm",
    hint: "Dùng màu để hỗ trợ nhận biết từng nhóm phần tử.",
  },
  {
    id: "HIGH_CONTRAST",
    label: "Tương phản cao",
    hint: "Dùng nét đậm và màu hệ thống để dễ phân biệt hơn.",
  },
] as const satisfies readonly {
  readonly id: BpmnColorMode;
  readonly label: string;
  readonly hint: string;
}[];

export const bpmnSemanticLegend = [
  { category: "event", label: "Sự kiện", detail: "Marker tròn" },
  { category: "activity", label: "Hoạt động", detail: "Khối bo góc" },
  { category: "gateway", label: "Điểm quyết định", detail: "Hình thoi" },
  {
    category: "container",
    label: "Bên tham gia / vai trò",
    detail: "Vùng cộng tác",
  },
  {
    category: "message-flow",
    label: "Trao đổi thông điệp",
    detail: "Nét đứt và đầu tròn",
  },
  {
    category: "sequence-flow",
    label: "Luồng công việc",
    detail: "Nét liền có mũi tên",
  },
] as const satisfies readonly {
  readonly category: BpmnSemanticCategory;
  readonly label: string;
  readonly detail: string;
}[];

export function isBpmnColorMode(value: unknown): value is BpmnColorMode {
  return bpmnColorModes.some((mode) => mode.id === value);
}

export function bpmnSemanticCategory(
  type: string,
): BpmnSemanticCategory | null {
  if (type.endsWith("Event") || type === "bpmn:IntermediateCatchEvent") {
    return "event";
  }
  if (type.endsWith("Task") || type === "bpmn:CallActivity") {
    return "activity";
  }
  if (type.endsWith("Gateway")) return "gateway";
  if (
    type === "bpmn:Participant" ||
    type === "bpmn:Lane" ||
    type === "bpmn:LaneSet"
  ) {
    return "container";
  }
  if (type === "bpmn:MessageFlow") return "message-flow";
  if (type === "bpmn:SequenceFlow") return "sequence-flow";
  return null;
}

export function bpmnSemanticMarker(category: BpmnSemanticCategory): string {
  return `teb-semantic-${category}`;
}
