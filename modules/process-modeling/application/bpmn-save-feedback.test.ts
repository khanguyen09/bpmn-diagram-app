import { describe, expect, it } from "vitest";
import { bpmnSaveRejectionNotice } from "./bpmn-save-feedback";

describe("SDD58 save rejection feedback", () => {
  it("explains the actual mixed parallel split/join rule without claiming all branches are invalid", () => {
    const notice = bpmnSaveRejectionNotice({ kind: "rejected", code: "BPMN_INSPECTION_FAILED", ruleIds: ["BPMN-PAR-002"] });
    expect(notice).toContain("tách thành hai điểm");
    expect(notice).not.toContain("BPMN-PAR-002");
  });
  it.each([
    ["INVALID_MODEL", "tên sơ đồ"],
    ["BPMN_LIMIT_EXCEEDED", "vượt giới hạn"],
  ] as const)("maps %s to a plain actionable instruction", (code, expected) => {
    expect(bpmnSaveRejectionNotice({ kind: "rejected", code })).toContain(expected);
  });
  it("uses a safe fallback and explains that the server copy is unchanged", () => {
    const notice = bpmnSaveRejectionNotice({ kind: "rejected", ruleIds: ["BPMN-UNKNOWN-001"] });
    expect(notice).toContain("Kiểm tra");
    expect(notice).toContain("máy chủ không đổi");
    expect(notice).not.toContain("BPMN-UNKNOWN-001");
  });
});
