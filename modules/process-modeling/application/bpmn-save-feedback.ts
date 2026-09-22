import type { ProcessModelSaveResponse } from "./process-model-persistence-client";

/** Plain copy from known codes only; never display arbitrary server error text. */
export function bpmnSaveRejectionNotice(
  rejection: Extract<ProcessModelSaveResponse, { kind: "rejected" }>,
): string {
  const retained = " Sơ đồ đang mở vẫn được giữ; bản đã lưu trên máy chủ không đổi.";
  if (rejection.code === "BPMN_LIMIT_EXCEEDED") {
    return "Sơ đồ vượt giới hạn lưu. Hãy tải bản nháp xuống và chia thành các sơ đồ nhỏ hơn." + retained;
  }
  if (rejection.code === "INVALID_MODEL") {
    return "Chưa thể lưu. Kiểm tra tên sơ đồ, mô tả và thông tin vừa nhập." + retained;
  }
  if (rejection.ruleIds?.includes("BPMN-PAR-002")) {
    return "Một điểm song song đang vừa gộp vừa chia nhánh. Hãy tách thành hai điểm riêng rồi lưu lại." + retained;
  }
  if (rejection.ruleIds?.includes("BPMN-PROFILE-005")) {
    return "Kiểu sơ đồ vừa thay đổi. Hãy tải bản đang mở xuống trước khi mở lại sơ đồ." + retained;
  }
  return "Chưa thể lưu sơ đồ. Mở mục Kiểm tra để xem phần cần sửa, rồi chọn Lưu bản nháp." + retained;
}
