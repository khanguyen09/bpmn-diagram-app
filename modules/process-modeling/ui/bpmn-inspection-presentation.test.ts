import { describe, expect, it } from "vitest";
import type { BpmnInspectionIssue } from "../domain/core-profile";
import {
  bpmnInspectionIssueFingerprint,
  effectiveBpmnIssueSeverity,
  filterBpmnInspectionGroups,
  groupBpmnInspectionIssues,
  presentBpmnInspectionIssueGroup,
  summarizeBpmnInspectionGroups,
} from "./bpmn-inspection-presentation";

function issue(
  overrides: Partial<BpmnInspectionIssue> = {},
): BpmnInspectionIssue {
  return {
    ruleId: "task-name",
    severity: "warning",
    disposition: "recoverable",
    elementId: "Task_1",
    message: "Task chưa có tên.",
    recovery: "Đặt tên ngắn gọn cho Task.",
    ...overrides,
  };
}

describe("BPMN inspection presentation", () => {
  it("derives effective severity from disposition without rewriting raw data", () => {
    const fatalInfo = issue({ severity: "info", disposition: "fatal" });
    const recoverableError = issue({
      severity: "error",
      disposition: "recoverable",
    });
    const rawInfo = issue({ severity: "info", disposition: undefined });

    expect(effectiveBpmnIssueSeverity(fatalInfo)).toBe("error");
    expect(effectiveBpmnIssueSeverity(recoverableError)).toBe("warning");
    expect(effectiveBpmnIssueSeverity(rawInfo)).toBe("info");
    expect(fatalInfo).toMatchObject({ severity: "info", disposition: "fatal" });
    expect(recoverableError).toMatchObject({
      severity: "error",
      disposition: "recoverable",
    });
  });

  it("groups the effective fingerprint except element identity and raw severity", () => {
    const first = issue({ elementId: "Task_1" });
    const second = issue({ elementId: "Task_2" });
    const sameEffectiveDifferentRawSeverity = issue({
      elementId: "Task_3",
      severity: "error",
    });
    const differentDisposition = issue({
      elementId: "Task_4",
      disposition: "fatal",
    });
    const differentRecovery = issue({
      elementId: "Task_5",
      recovery: "Xóa Task nếu không còn cần thiết.",
    });

    expect(bpmnInspectionIssueFingerprint(first)).toBe(
      bpmnInspectionIssueFingerprint(second),
    );
    expect(bpmnInspectionIssueFingerprint(first)).toBe(
      bpmnInspectionIssueFingerprint(sameEffectiveDifferentRawSeverity),
    );

    const groups = groupBpmnInspectionIssues([
      first,
      second,
      sameEffectiveDifferentRawSeverity,
      differentDisposition,
      differentRecovery,
    ]);

    expect(groups).toHaveLength(3);
    expect(
      groups.find((group) => group.fingerprint === bpmnInspectionIssueFingerprint(first))
        ?.occurrences,
    ).toEqual([first, second, sameEffectiveDifferentRawSeverity]);
  });

  it("preserves every raw occurrence and its object identity", () => {
    const issues = Object.freeze([
      Object.freeze(issue({ elementId: "Task_1" })),
      Object.freeze(issue({ elementId: "Task_2" })),
      Object.freeze(
        issue({
          ruleId: "process-owner",
          elementId: undefined,
          severity: "error",
          disposition: "fatal",
        }),
      ),
    ]);
    const groups = groupBpmnInspectionIssues(issues);
    const flattened = groups.flatMap((group) => group.occurrences);

    expect(flattened).toHaveLength(issues.length);
    for (const original of issues) {
      expect(flattened.filter((candidate) => candidate === original)).toHaveLength(
        1,
      );
    }
  });

  it("orders groups by effective severity and keeps first-seen order within it", () => {
    const groups = groupBpmnInspectionIssues([
      issue({ ruleId: "info-first", severity: "info", disposition: undefined }),
      issue({ ruleId: "warning-first" }),
      issue({ ruleId: "error-first", disposition: "fatal" }),
      issue({ ruleId: "warning-second", severity: "error" }),
      issue({ ruleId: "error-second", severity: "error", disposition: undefined }),
    ]);

    expect(groups.map((group) => group.ruleId)).toEqual([
      "error-first",
      "error-second",
      "warning-first",
      "warning-second",
      "info-first",
    ]);
  });

  it("reports group and occurrence totals and filters by effective severity", () => {
    const groups = groupBpmnInspectionIssues([
      issue({ elementId: "Task_1" }),
      issue({ elementId: "Task_2" }),
      issue({ ruleId: "fatal", elementId: "Process_1", disposition: "fatal" }),
      issue({
        ruleId: "info",
        elementId: undefined,
        severity: "info",
        disposition: undefined,
      }),
    ]);
    const summary = summarizeBpmnInspectionGroups(groups);

    expect(summary).toEqual({
      groupCount: 3,
      occurrenceCount: 4,
      bySeverity: {
        error: { groupCount: 1, occurrenceCount: 1 },
        warning: { groupCount: 1, occurrenceCount: 2 },
        info: { groupCount: 1, occurrenceCount: 1 },
      },
    });
    expect(filterBpmnInspectionGroups(groups, "all")).toBe(groups);
    expect(filterBpmnInspectionGroups(groups, "warning")).toHaveLength(1);
    expect(filterBpmnInspectionGroups(groups, "warning")[0]?.occurrences).toHaveLength(
      2,
    );
    expect(filterBpmnInspectionGroups(groups, "error")[0]?.ruleId).toBe("fatal");
  });

  it("collapses 56 repeated rows into one readable group without dropping data", () => {
    const repeatedIssues = Array.from({ length: 56 }, (_, index) =>
      issue({ elementId: `Task_${index + 1}` }),
    );
    const groups = groupBpmnInspectionIssues(repeatedIssues);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.occurrences).toHaveLength(56);
    expect(summarizeBpmnInspectionGroups(groups)).toMatchObject({
      groupCount: 1,
      occurrenceCount: 56,
      bySeverity: {
        warning: { groupCount: 1, occurrenceCount: 56 },
      },
    });
  });

  it("projects known checks into plain language without changing raw diagnostics", () => {
    const raw = issue();
    const [group] = groupBpmnInspectionIssues([raw]);

    expect(presentBpmnInspectionIssueGroup(group!)).toEqual({
      title: "Công việc chưa có tên",
      guidance:
        "Đặt một tên ngắn gọn để người đọc hiểu bước này dùng để làm gì.",
      source: "catalogue",
    });
    expect(raw).toMatchObject({
      ruleId: "task-name",
      message: "Task chưa có tên.",
      recovery: "Đặt tên ngắn gọn cho Task.",
    });
  });

  it("gives distinct plain-language names to visually similar routing checks", () => {
    const cases = [
      ["BPMN-PAR-001", "Điểm chạy song song chưa đủ nhánh"],
      ["BPMN-XOR-001", "Điểm chọn một hướng chưa đủ nhánh"],
      ["BPMN-INC-001", "Điểm chọn nhiều hướng chưa đủ nhánh"],
      ["BPMN-EVG-001", "Điểm chờ sự kiện chưa đủ nhánh"],
      ["BPMN-EVT-001", "Sự kiện chờ chưa chọn cách kích hoạt"],
      ["BPMN-THROW-001", "Sự kiện gửi chưa nối đủ đường đi"],
      ["BPMN-CONNECT-001", "Khu vực quy trình chưa có đường đi hoàn chỉnh"],
      ["BPMN-CONNECT-003", "Có bước chưa nằm trên đường đi hoàn chỉnh"],
      ["BPMN-MSG-004", "Sự kiện thông điệp chưa chọn nội dung"],
      ["BPMN-MESSAGE-003", "Các bên tham gia chưa trao đổi thông điệp"],
    ] as const;

    expect(
      cases.map(([ruleId]) =>
        presentBpmnInspectionIssueGroup({
          ruleId,
          effectiveSeverity: "warning",
        }).title,
      ),
    ).toEqual(cases.map(([, title]) => title));
    expect(new Set(cases.map(([, title]) => title)).size).toBe(cases.length);
  });

  it("uses a safe severity-aware fallback for an unknown rule", () => {
    expect(
      presentBpmnInspectionIssueGroup({
        ruleId: "VENDOR-PRIVATE-900",
        effectiveSeverity: "error",
      }),
    ).toEqual({
      title: "Sơ đồ có phần chưa hợp lệ",
      guidance: "Xem vị trí liên quan và hoàn thiện trước khi tiếp tục.",
      source: "fallback",
    });
  });
});
