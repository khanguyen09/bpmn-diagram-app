import type { BpmnInspectionIssueGroup } from "./bpmn-inspection-presentation";

export type BpmnIssueCategory = "model" | "capability" | "advisory";

export const bpmnIssueCategoryLabels: Readonly<Record<BpmnIssueCategory, string>> = {
  model: "Cần sửa sơ đồ",
  capability: "Giới hạn hỗ trợ của Studio",
  advisory: "Gợi ý hoàn thiện",
};

/** Presentation only: never alter severity, disposition, or readiness gates. */
export function categorizeBpmnIssue(group: BpmnInspectionIssueGroup): BpmnIssueCategory {
  const rule = group.ruleId.toUpperCase();
  // Some rule IDs cover both invalid references and unsupported features.
  // Classify only evidence of a capability limit, never the entire rule family.
  if (
    rule === "BPMN-PROFILE-004" ||
    ((rule.startsWith("BPMN-PROFILE-") || rule.startsWith("BPMN-LIMIT-")) &&
      /nằm ngoài|chưa (?:được )?hỗ trợ|ngoài phạm vi|vượt quá/iu.test(group.message))
  ) return "capability";
  return group.effectiveSeverity === "error" ? "model" : "advisory";
}

export function bpmnIssueCategoryExplanation(category: BpmnIssueCategory): string {
  if (category === "capability") {
    return "Thành phần này chưa được cấu hình Studio hiện tại hỗ trợ. Đây không phải kết luận rằng ký hiệu sai chuẩn BPMN; xem thông báo gốc trước khi thay đổi quy trình.";
  }
  if (category === "advisory") {
    return "Xem lại để sơ đồ đầy đủ và dễ đọc hơn. Mức độ kiểm tra và điều kiện lưu mốc vẫn được giữ nguyên.";
  }
  return "Kiểm tra nội dung hoặc liên kết tại vị trí được chỉ ra. Hoàn thiện theo hướng xử lý trước khi lưu mốc.";
}
