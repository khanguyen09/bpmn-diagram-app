export const nodeIconCatalogue = [
  { id: "person", label: "Người phụ trách", glyph: "person" },
  { id: "team", label: "Nhóm", glyph: "users" },
  { id: "document", label: "Tài liệu", glyph: "file-text" },
  { id: "review", label: "Rà soát", glyph: "scan-search" },
  { id: "approval", label: "Phê duyệt", glyph: "badge-check" },
  { id: "message", label: "Thông điệp", glyph: "message-square" },
  { id: "search", label: "Tìm kiếm", glyph: "search" },
  { id: "data", label: "Dữ liệu", glyph: "database" },
  { id: "settings", label: "Thiết lập", glyph: "settings" },
  { id: "clock", label: "Thời gian", glyph: "clock" },
  { id: "shield", label: "Kiểm soát", glyph: "shield-check" },
  { id: "publish", label: "Xuất bản", glyph: "send" },
  { id: "email", label: "Email", glyph: "mail" },
  { id: "phone", label: "Cuộc gọi", glyph: "phone" },
  { id: "meeting", label: "Cuộc họp", glyph: "video" },
  { id: "notification", label: "Thông báo", glyph: "bell" },
  { id: "calendar", label: "Lịch hẹn", glyph: "calendar-days" },
  { id: "checklist", label: "Danh sách", glyph: "list-checks" },
  { id: "folder", label: "Thư mục", glyph: "folder" },
  { id: "attachment", label: "Đính kèm", glyph: "paperclip" },
  { id: "image", label: "Hình ảnh", glyph: "image" },
  { id: "idea", label: "Ý tưởng", glyph: "lightbulb" },
  { id: "target", label: "Mục tiêu", glyph: "target" },
  { id: "chart", label: "Báo cáo", glyph: "chart-no-axes-combined" },
  { id: "payment", label: "Thanh toán", glyph: "credit-card" },
  { id: "receipt", label: "Hoá đơn", glyph: "receipt" },
  { id: "package", label: "Sản phẩm", glyph: "package" },
  { id: "delivery", label: "Giao hàng", glyph: "truck" },
  { id: "location", label: "Địa điểm", glyph: "map-pin" },
  { id: "building", label: "Đơn vị", glyph: "building-2" },
  { id: "cloud", label: "Lưu trữ", glyph: "cloud" },
  { id: "automation", label: "Tự động", glyph: "zap" },
  { id: "code", label: "Lập trình", glyph: "code-2" },
  { id: "key", label: "Truy cập", glyph: "key-round" },
  { id: "support", label: "Hỗ trợ", glyph: "headphones" },
  { id: "flag", label: "Cột mốc", glyph: "flag" },
] as const;

export type NodeIconKey = (typeof nodeIconCatalogue)[number]["id"];

export const nodeVisualNamespace =
  "urn:the-experience-blogs:bpmn:extension:1";

export function isNodeIconKey(value: unknown): value is NodeIconKey {
  return nodeIconCatalogue.some((item) => item.id === value);
}

export function supportsNodeVisual(type: string) {
  return [
    "bpmn:StartEvent",
    "bpmn:Task",
    "bpmn:UserTask",
    "bpmn:ServiceTask",
    "bpmn:ManualTask",
    "bpmn:ExclusiveGateway",
    "bpmn:EndEvent",
  ].includes(type);
}
