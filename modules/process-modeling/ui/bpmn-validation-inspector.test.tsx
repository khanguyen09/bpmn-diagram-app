import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "../domain/core-profile";
import { BpmnValidationInspector } from "./bpmn-validation-inspector";

const issues: readonly BpmnInspectionIssue[] = [
  {
    ruleId: "task-name",
    severity: "warning",
    disposition: "recoverable",
    elementId: "Task_present",
    message: "Task chưa có tên.",
    recovery: "Đặt tên ngắn gọn cho Task.",
  },
  {
    ruleId: "task-name",
    severity: "warning",
    disposition: "recoverable",
    elementId: "Task_stale",
    message: "Task chưa có tên.",
    recovery: "Đặt tên ngắn gọn cho Task.",
  },
  {
    ruleId: "process-owner",
    severity: "warning",
    disposition: "fatal",
    message: "Quy trình chưa có chủ sở hữu.",
    recovery: "Chọn một chủ sở hữu cho quy trình.",
  },
];

const outline: readonly CoreBpmnElement[] = [
  {
    id: "Task_present",
    type: "bpmn:Task",
    name: "Kiểm tra",
    incoming: [],
    outgoing: [],
  },
];

describe("BpmnValidationInspector", () => {
  it("renders a compact grouped hierarchy with semantic filters and live totals", () => {
    const html = renderToStaticMarkup(
      <BpmnValidationInspector
        issues={issues}
        outline={outline}
        onNavigate={vi.fn()}
      />,
    );

    expect(html).toContain('data-bpmn-validation-inspector="true"');
    expect(html).toContain("2 vấn đề · 3 vị trí");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Lọc vấn đề theo mức độ"');
    expect(html).toContain('data-bpmn-issue-filter="all"');
    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('data-bpmn-issue-group="error"');
    expect(html).toContain('data-bpmn-issue-group="warning"');
    expect(html).toContain("Sơ đồ còn thiếu thông tin bắt buộc");
    expect(html).toContain("Công việc chưa có tên");
    expect(html).toContain("Cách xử lý");
    expect(html).toContain('data-bpmn-issue-category="model"');
    expect(html).toContain('data-bpmn-issue-category="advisory"');
    expect(html).toContain("Gợi ý hoàn thiện");
    const primarySummaries =
      html.match(
        /<summary class="bpmn-validation-inspector__group-summary">[\s\S]*?<\/summary>/g,
      ) ?? [];
    expect(primarySummaries).toHaveLength(2);
    expect(primarySummaries.join(" ")).not.toMatch(
      /task-name|process-owner|bpmn:Task|Task_present|Task_stale/,
    );
    expect(html.match(/<summary>Chi tiết kỹ thuật<\/summary>/g)).toHaveLength(
      2,
    );
    expect(html).toContain("task-name");
    expect(html).toContain("Task chưa có tên.");
    expect(html).toContain("Đặt tên ngắn gọn cho Task.");
    expect(
      html
        .match(/<button[^>]*>/g)
        ?.every((button) => button.includes('class="button ')),
    ).toBe(true);
  });

  it("makes only current outline elements actionable", () => {
    const html = renderToStaticMarkup(
      <BpmnValidationInspector
        issues={issues}
        outline={outline}
        onNavigate={vi.fn()}
      />,
    );

    expect(html).toContain('data-bpmn-element-navigation="available"');
    expect(html).toContain('aria-label="Đi tới Kiểm tra, vị trí 1"');
    expect(html).toContain('<code>Task_stale</code>');
    expect(html).toContain('<code>Task_present</code>');
    expect(html).toContain('<code>bpmn:Task</code>');
    expect(html).toContain('data-bpmn-element-navigation="static"');
    expect(html).not.toMatch(/<button[^>]+aria-label="[^"]*Task_stale/);
    expect(html).not.toMatch(/<button[^>]+aria-label="[^"]*Task_present/);
    expect(html).not.toMatch(/<button[^>]+aria-label="[^"]*bpmn:Task/);
    expect(html).toContain("Toàn bộ sơ đồ");
    expect(html).not.toMatch(
      /<button[^>]+aria-label="Đi tới phần tử Toàn bộ sơ đồ/,
    );
  });

  it("does not mutate the raw issue multiset while rendering", () => {
    const frozenIssues = Object.freeze(
      issues.map((item) => Object.freeze({ ...item })),
    );

    expect(() =>
      renderToStaticMarkup(
        <BpmnValidationInspector
          issues={frozenIssues}
          outline={outline}
          onNavigate={vi.fn()}
        />,
      ),
    ).not.toThrow();
    expect(frozenIssues).toEqual(issues);
  });

  it("renders a quiet status when the current inspection has no issues", () => {
    const html = renderToStaticMarkup(
      <BpmnValidationInspector issues={[]} outline={outline} onNavigate={vi.fn()} />,
    );

    expect(html).toContain("Không có vấn đề cần xử lý");
    expect(html).toContain("Sơ đồ đã vượt qua lần kiểm tra hiện tại.");
    expect(html).not.toContain('role="group"');
  });

  it("keeps a heavily repeated group collapsed until the user asks for detail", () => {
    const repeatedIssues = Array.from({ length: 56 }, (_, index) => ({
      ...issues[0]!,
      elementId: `Task_${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      <BpmnValidationInspector
        issues={repeatedIssues}
        outline={[]}
        onNavigate={vi.fn()}
      />,
    );

    expect(html).toContain("1 vấn đề · 56 vị trí");
    expect(html).toContain("<details>");
    expect(html).not.toContain("<details open");
  });

  it("uses safe primary copy for an unknown check and keeps raw diagnostics closed", () => {
    const html = renderToStaticMarkup(
      <BpmnValidationInspector
        issues={[
          {
            ruleId: "VENDOR-PRIVATE-900",
            severity: "error",
            message: "Private engine detail.",
            recovery: "Use vendor recovery code 17.",
          },
        ]}
        outline={outline}
        onNavigate={vi.fn()}
      />,
    );
    const [primarySummary] =
      html.match(
        /<summary class="bpmn-validation-inspector__group-summary">[\s\S]*?<\/summary>/g,
      ) ?? [];

    expect(primarySummary).toContain("Sơ đồ có phần chưa hợp lệ");
    expect(primarySummary).not.toMatch(
      /VENDOR-PRIVATE-900|Private engine detail|vendor recovery code/,
    );
    expect(html).toContain("Chi tiết kỹ thuật");
    expect(html).toContain("VENDOR-PRIVATE-900");
    expect(html).toContain("Private engine detail.");
    expect(html).toContain("Use vendor recovery code 17.");
    expect(html).toContain(
      '<details class="bpmn-validation-inspector__technical-details">',
    );
    expect(html).not.toContain(
      '<details class="bpmn-validation-inspector__technical-details" open="">',
    );
  });

  it("keeps interactive targets large and preserves forced-color state", () => {
    const styles = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    expect(styles).toMatch(
      /\.bpmn-validation-inspector \.bpmn-validation-inspector__filter-button\s*{[^}]*min-height: 44px;/s,
    );
    expect(styles).toMatch(
      /\.bpmn-validation-inspector__group-summary\s*{[^}]*min-height: 52px;/s,
    );
    expect(styles).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\.bpmn-validation-inspector[\s\S]*\.bpmn-validation-inspector__filter-button\[aria-pressed="true"\][^}]*forced-color-adjust: none;/,
    );
  });
});
