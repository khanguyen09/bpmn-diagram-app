import { describe, it, expect } from "vitest";
import { groupBpmnInspectionIssues } from "./bpmn-inspection-presentation";
import { categorizeBpmnIssue } from "./bpmn-issue-category";

const category = (ruleId: string, message: string, severity: "error" | "warning" = "error", disposition: "fatal" | "recoverable" = "fatal") => categorizeBpmnIssue(groupBpmnInspectionIssues([{ ruleId, message, severity, disposition, recovery: "Kiểm tra lại" }])[0]);

describe("BPMN inspection category", () => {
  it("distinguishes a known unsupported extension without downgrading its fatal issue", () => {
    const source = Object.freeze({ ruleId: "BPMN-PROFILE-004", message: "Namespace ngoài Core Starter", severity: "error" as const, disposition: "fatal" as const, recovery: "Giữ bản gốc" });
    const group = groupBpmnInspectionIssues([source])[0];
    expect(categorizeBpmnIssue(group)).toBe("capability");
    expect(group.effectiveSeverity).toBe("error");
    expect(group.disposition).toBe("fatal");
    expect(group.occurrences[0]).toEqual(source);
  });
  it("does not mislabel malformed references or missing boundary hosts as capability limits", () => {
    expect(category("BPMN-PROFILE-003", "Tham chiếu dữ liệu không thuộc công việc nhận dữ liệu.")).toBe("model");
    expect(category("BPMN-BOUNDARY-001", "Boundary Event gắn sai Activity hoặc khác Process.")).toBe("model");
    expect(category("BPMN-TIMER-001", "Timer phải dùng DATE có timezone hoặc bounded ISO DURATION hợp lệ.")).toBe("model");
    expect(category("BPMN-PROFILE-003", "Phần tử nằm ngoài Collaboration Starter.")).toBe("capability");
  });
  it("uses effective severity so fatal warnings never become advisory", () => {
    expect(category("task-name", "Thiếu tên", "warning", "recoverable")).toBe("advisory");
    expect(category("unknown", "Thiếu thông tin", "warning", "fatal")).toBe("model");
  });
});
