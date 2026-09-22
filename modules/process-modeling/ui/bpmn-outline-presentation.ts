import type { CoreBpmnElement } from "../domain/core-profile";
import { isLaneResponsibilityType } from "../domain/swimlane-role-authoring";

export function bpmnOutlineTypeLabel(
  element: CoreBpmnElement,
  byId: ReadonlyMap<string, CoreBpmnElement> = new Map(),
): string {
  if (element.type === "bpmn:Participant") {
    return element.processId
      ? "Bên tham gia có quy trình"
      : "Bên tham gia chỉ trao đổi";
  }
  if (element.type === "bpmn:Lane") {
    return element.parentId && byId.get(element.parentId)?.type === "bpmn:Lane"
      ? "Vai trò con"
      : "Nhóm chức năng";
  }
  if (element.type === "bpmn:TextAnnotation") {
    return "Ghi chú";
  }
  if (element.type === "bpmn:Group") {
    return "Nhóm trực quan";
  }
  if (element.type === "bpmn:Association") {
    return "Liên kết chú thích";
  }
  if (element.type === "bpmn:DataInputAssociation") {
    return "Dữ liệu đi vào công việc";
  }
  if (element.type === "bpmn:DataOutputAssociation") {
    return "Dữ liệu đi ra từ công việc";
  }
  if (element.type === "bpmn:SubProcess") {
    return "Quy trình con";
  }
  if (element.type === "bpmn:CallActivity") {
    return "Dùng lại quy trình";
  }
  if (element.type === "bpmn:DataObjectReference") {
    return "Tài liệu dữ liệu";
  }
  if (element.type === "bpmn:DataStoreReference") {
    return "Kho dữ liệu";
  }
  if (element.type === "bpmn:ComplexGateway") {
    return "Hợp nhánh theo điều kiện";
  }
  if (element.type === "bpmn:IntermediateCatchEvent") {
    return element.eventDefinition?.kind === "MESSAGE"
      ? "Chờ thông điệp"
      : element.eventDefinition?.kind === "TIMER"
        ? element.eventDefinition.timerKind === "DATE"
          ? "Chờ đến một thời điểm"
          : "Chờ một khoảng thời gian"
        : "Sự kiện chờ chưa cấu hình";
  }
  if (element.type === "bpmn:IntermediateThrowEvent") {
    return element.eventDefinition?.kind === "MESSAGE"
      ? "Gửi thông điệp"
      : "Đánh dấu mốc";
  }
  if (element.type === "bpmn:BoundaryEvent") {
    const definition =
      element.eventDefinition?.kind === "MESSAGE"
        ? "Thông điệp"
        : element.eventDefinition?.kind === "TIMER"
          ? "Hẹn giờ"
          : "Chưa cấu hình";
    const behavior =
      element.cancelActivity === false ? "không ngắt công việc" : "ngắt công việc";
    const host = element.attachedToId
      ? byId.get(element.attachedToId)?.name || "công việc chưa đặt tên"
      : "chưa gắn công việc";
    return `${definition} tại biên · ${behavior} · ${host}`;
  }
  const exactTaskLabels: Readonly<Record<string, string>> = {
    "bpmn:StartEvent": "Điểm bắt đầu",
    "bpmn:EndEvent": "Điểm kết thúc",
    "bpmn:Task": "Công việc",
    "bpmn:ReceiveTask": "Nhận thông điệp",
    "bpmn:UserTask": "Công việc của người",
    "bpmn:ServiceTask": "Công việc tự động",
    "bpmn:ManualTask": "Công việc thủ công",
    "bpmn:ExclusiveGateway": "Chọn một hướng",
    "bpmn:ParallelGateway": "Chạy song song",
    "bpmn:InclusiveGateway": "Chọn một hoặc nhiều hướng",
    "bpmn:EventBasedGateway": "Chờ sự kiện đầu tiên",
    "bpmn:SequenceFlow": "Đường thực hiện",
    "bpmn:MessageFlow": "Trao đổi thông điệp",
  };
  if (exactTaskLabels[element.type]) return exactTaskLabels[element.type]!;
  return "Thành phần sơ đồ";
}

export function bpmnOutlineAdvancedMetadata(
  element: CoreBpmnElement,
): string | null {
  if (element.type === "bpmn:CallActivity") {
    return element.calledElementId
      ? "Đã liên kết với quy trình dùng chung"
      : "Chưa chọn quy trình dùng chung";
  }
  if (element.type === "bpmn:DataObjectReference") {
    return element.dataObjectRefId
      ? "Đã liên kết dữ liệu"
      : "Chưa liên kết dữ liệu";
  }
  if (element.type === "bpmn:DataStoreReference") {
    return element.dataStoreRefId
      ? "Đã liên kết kho dữ liệu"
      : "Chưa liên kết kho dữ liệu";
  }
  if (
    element.type === "bpmn:DataInputAssociation" ||
    element.type === "bpmn:DataOutputAssociation"
  ) {
    return element.sourceId && element.targetId
      ? "Đã nối dữ liệu với công việc"
      : "Đường dữ liệu chưa hoàn chỉnh";
  }
  if (element.type === "bpmn:MessageFlow") {
    return element.sourceId && element.targetId
      ? "Đã nối hai bên tham gia"
      : "Trao đổi thông điệp chưa hoàn chỉnh";
  }
  if (element.type === "bpmn:Association") {
    return element.sourceId && element.targetId
      ? "Đã liên kết với phần chú thích"
      : "Liên kết chú thích chưa hoàn chỉnh";
  }
  if (element.type === "bpmn:ComplexGateway") {
    return element.activationCondition
      ? `Điều kiện: ${element.activationCondition}`
      : "Chưa có điều kiện hợp nhánh";
  }
  return null;
}

export function bpmnOutlinePrimaryLabel(element: CoreBpmnElement): string {
  if (element.displayLabel) return element.displayLabel;
  if (element.type === "bpmn:TextAnnotation") {
    return element.text || "Chưa có nội dung";
  }
  if (element.type === "bpmn:Group") {
    return element.value || element.name || "Chưa có tiêu đề";
  }
  return element.name || "Chưa đặt tên";
}

export function bpmnOutlineColorLabel(
  fill: unknown,
  stroke: unknown,
): string | null {
  const parts = [
    typeof fill === "string" ? `nền ${fill}` : null,
    typeof stroke === "string" ? `viền ${stroke}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Màu riêng · ${parts.join(" · ")}` : null;
}

export function isBpmnResponsibilityNode(element: CoreBpmnElement): boolean {
  return isLaneResponsibilityType(element.type);
}
