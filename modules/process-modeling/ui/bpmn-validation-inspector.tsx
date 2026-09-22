"use client";

import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Info,
  LocateFixed,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import type {
  BpmnInspectionIssue,
  BpmnIssueSeverity,
  CoreBpmnElement,
} from "../domain/core-profile";
import {
  filterBpmnInspectionGroups,
  groupBpmnInspectionIssues,
  presentBpmnInspectionIssueGroup,
  summarizeBpmnInspectionGroups,
  type BpmnInspectionFilter,
  type BpmnInspectionIssueGroup,
} from "./bpmn-inspection-presentation";

import {
  categorizeBpmnIssue,
  bpmnIssueCategoryLabels,
  bpmnIssueCategoryExplanation,
} from "./bpmn-issue-category";

interface BpmnValidationInspectorProps {
  readonly issues: readonly BpmnInspectionIssue[];
  readonly outline: readonly CoreBpmnElement[];
  readonly onNavigate: (elementId: string) => void;
}

const severityLabels: Readonly<Record<BpmnIssueSeverity, string>> = {
  error: "Lỗi",
  warning: "Cảnh báo",
  info: "Thông tin",
};

const filterLabels: Readonly<Record<BpmnInspectionFilter, string>> = {
  all: "Tất cả",
  ...severityLabels,
};

const filters: readonly BpmnInspectionFilter[] = [
  "all",
  "error",
  "warning",
  "info",
];

const automaticallyExpandedOccurrenceLimit = 3;

function SeverityIcon({ severity }: { readonly severity: BpmnIssueSeverity }) {
  if (severity === "error") return <AlertCircle aria-hidden="true" />;
  if (severity === "warning") return <AlertTriangle aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

function issueCountLabel(groupCount: number, occurrenceCount: number) {
  return `${groupCount} vấn đề · ${occurrenceCount} vị trí`;
}

function IssueOccurrences({
  group,
  navigableElements,
  onNavigate,
}: {
  readonly group: BpmnInspectionIssueGroup;
  readonly navigableElements: ReadonlyMap<string, CoreBpmnElement>;
  readonly onNavigate: (elementId: string) => void;
}) {
  return (
    <ul
      className="bpmn-validation-inspector__occurrences"
      aria-label="Các vị trí liên quan"
    >
      {group.occurrences.map((issue, index) => {
        const occurrenceNumber = index + 1;
        const element = issue.elementId
          ? navigableElements.get(issue.elementId)
          : undefined;
        const elementDescription = element?.name?.trim() || "Phần tử trên sơ đồ";

        return (
          <li
            key={`${issue.elementId ?? "model"}-${index}`}
            data-bpmn-issue-occurrence="true"
          >
            {issue.elementId && element ? (
              <Button
                variant="ghost"
                className="bpmn-validation-inspector__navigate"
                data-bpmn-element-navigation="available"
                aria-label={`Đi tới ${elementDescription}, vị trí ${occurrenceNumber}`}
                onClick={() => onNavigate(issue.elementId!)}
              >
                <LocateFixed aria-hidden="true" />
                <span>
                  <strong>{elementDescription}</strong>
                  <small>
                    Vị trí {occurrenceNumber} · Chọn để xem trên sơ đồ
                  </small>
                </span>
              </Button>
            ) : (
              <span
                className="bpmn-validation-inspector__static-reference"
                data-bpmn-element-navigation="static"
              >
                <span aria-hidden="true" className="bpmn-validation-inspector__static-mark">
                  ·
                </span>
                <span>
                  <strong>
                    {issue.elementId
                      ? "Vị trí không còn trên sơ đồ"
                      : "Toàn bộ sơ đồ"}
                  </strong>
                  <small>
                    {issue.elementId
                      ? "Không thể tự động đi tới vị trí này"
                      : "Vấn đề không gắn với một vị trí cụ thể"}
                  </small>
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TechnicalIssueDetails({
  group,
  navigableElements,
}: {
  readonly group: BpmnInspectionIssueGroup;
  readonly navigableElements: ReadonlyMap<string, CoreBpmnElement>;
}) {
  return (
    <details className="bpmn-validation-inspector__technical-details">
      <summary>Chi tiết kỹ thuật</summary>
      <dl>
        <div>
          <dt>Mã kiểm tra</dt>
          <dd>
            <code>{group.ruleId}</code>
          </dd>
        </div>
        <div>
          <dt>Thông báo gốc</dt>
          <dd>{group.message}</dd>
        </div>
        <div>
          <dt>Hướng xử lý gốc</dt>
          <dd>{group.recovery}</dd>
        </div>
      </dl>
      <ul aria-label="Định danh kỹ thuật của các vị trí liên quan">
        {group.occurrences.map((issue, index) => {
          const element = issue.elementId
            ? navigableElements.get(issue.elementId)
            : undefined;
          return (
            <li key={`${issue.elementId ?? "model"}-${index}`}>
              <code>{issue.elementId ?? "model"}</code>
              {element ? <code>{element.type}</code> : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function BpmnValidationInspector({
  issues,
  outline,
  onNavigate,
}: BpmnValidationInspectorProps) {
  const headingId = useId();
  const statusId = useId();
  const [filter, setFilter] = useState<BpmnInspectionFilter>("all");
  const groups = useMemo(() => groupBpmnInspectionIssues(issues), [issues]);
  const summary = useMemo(() => summarizeBpmnInspectionGroups(groups), [groups]);
  const visibleGroups = useMemo(
    () => filterBpmnInspectionGroups(groups, filter),
    [filter, groups],
  );
  const visibleSummary = useMemo(
    () => summarizeBpmnInspectionGroups(visibleGroups),
    [visibleGroups],
  );
  const navigableElements = useMemo(
    () => new Map(outline.map((element) => [element.id, element])),
    [outline],
  );

  if (groups.length === 0) {
    return (
      <section
        className="bpmn-validation-inspector bpmn-validation-inspector--empty"
        data-bpmn-validation-inspector="true"
        aria-labelledby={headingId}
      >
        <div>
          <p className="bpmn-validation-inspector__eyebrow">Kiểm tra sơ đồ</p>
          <h3 id={headingId}>Không có vấn đề cần xử lý</h3>
        </div>
        <p role="status">Sơ đồ đã vượt qua lần kiểm tra hiện tại.</p>
      </section>
    );
  }

  return (
    <section
      className="bpmn-validation-inspector"
      data-bpmn-validation-inspector="true"
      aria-labelledby={headingId}
    >
      <header className="bpmn-validation-inspector__header">
        <div>
          <p className="bpmn-validation-inspector__eyebrow">Kiểm tra sơ đồ</p>
          <h3 id={headingId}>Vấn đề cần xử lý</h3>
        </div>
        <p>{issueCountLabel(summary.groupCount, summary.occurrenceCount)}</p>
      </header>

      <dl
        className="bpmn-validation-inspector__severity-summary"
        aria-label="Tóm tắt theo mức độ"
      >
        {(["error", "warning", "info"] as const).map((severity) => {
          const count = summary.bySeverity[severity];
          return (
            <div key={severity} data-severity={severity}>
              <dt>
                <SeverityIcon severity={severity} />
                {severityLabels[severity]}
              </dt>
              <dd>
                <strong>{count.groupCount}</strong> vấn đề ·{" "}
                {count.occurrenceCount} vị trí
              </dd>
            </div>
          );
        })}
      </dl>

      <div
        className="bpmn-validation-inspector__filters"
        role="group"
        aria-label="Lọc vấn đề theo mức độ"
        aria-describedby={statusId}
      >
        {filters.map((candidate) => {
          const count =
            candidate === "all"
              ? {
                  groupCount: summary.groupCount,
                  occurrenceCount: summary.occurrenceCount,
                }
              : summary.bySeverity[candidate];
          const selected = filter === candidate;

          return (
            <Button
              key={candidate}
              variant={selected ? "secondary" : "ghost"}
              className="bpmn-validation-inspector__filter-button"
              data-bpmn-issue-filter={candidate}
              aria-pressed={selected}
              aria-label={`${filterLabels[candidate]}, ${issueCountLabel(
                count.groupCount,
                count.occurrenceCount,
              )}`}
              onClick={() => setFilter(candidate)}
            >
              <span>{filterLabels[candidate]}</span>
              <strong>{count.groupCount}</strong>
            </Button>
          );
        })}
      </div>

      <p
        id={statusId}
        className="bpmn-validation-inspector__filter-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Đang hiển thị {issueCountLabel(
          visibleSummary.groupCount,
          visibleSummary.occurrenceCount,
        )}.
      </p>

      {visibleGroups.length > 0 ? (
        <ul className="bpmn-validation-inspector__groups">
          {visibleGroups.map((group, index) => {
            const plainCopy = presentBpmnInspectionIssueGroup(group);
            const category = categorizeBpmnIssue(group);
            return (
              <li
                key={group.fingerprint}
                data-bpmn-issue-group={group.effectiveSeverity}
                data-bpmn-issue-category={category}
              >
                <details
                  open={
                    index === 0 &&
                    group.occurrences.length <=
                      automaticallyExpandedOccurrenceLimit
                  }
                >
                  <summary className="bpmn-validation-inspector__group-summary">
                    <span
                      className="bpmn-validation-inspector__severity-icon"
                      data-severity={group.effectiveSeverity}
                    >
                      <SeverityIcon severity={group.effectiveSeverity} />
                    </span>
                    <span className="bpmn-validation-inspector__group-copy">
                      <small>{severityLabels[group.effectiveSeverity]} · {bpmnIssueCategoryLabels[category]}</small>
                      <strong>{plainCopy.title}</strong>
                    </span>
                    <span className="bpmn-validation-inspector__group-count">
                      <span aria-hidden="true">{group.occurrences.length}</span>
                      <span className="sr-only">
                        {group.occurrences.length} vị trí
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="bpmn-validation-inspector__chevron"
                    />
                  </summary>
                  <div className="bpmn-validation-inspector__group-detail">
                    <p>{bpmnIssueCategoryExplanation(category)}</p>
                    <p>
                      <strong>Cách xử lý</strong>
                      <span>{plainCopy.guidance}</span>
                    </p>
                    <IssueOccurrences
                      group={group}
                      navigableElements={navigableElements}
                      onNavigate={onNavigate}
                    />
                    <TechnicalIssueDetails
                      group={group}
                      navigableElements={navigableElements}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bpmn-validation-inspector__no-filter-results">
          Không có vấn đề ở mức độ này.
        </p>
      )}
    </section>
  );
}
