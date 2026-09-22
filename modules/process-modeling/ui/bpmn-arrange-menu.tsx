"use client";

import { AlignCenter, ChevronDown } from "lucide-react";
import { useRef } from "react";
import type { BpmnArrangeAction } from "../application/bpmn-arrange-selection";

const arrangeActions = [
  ["align-left", "Căn trái", "align"],
  ["align-center", "Căn giữa trái–phải", "align"],
  ["align-right", "Căn phải", "align"],
  ["align-top", "Căn trên", "align"],
  ["align-middle", "Căn giữa trên–dưới", "align"],
  ["align-bottom", "Căn dưới", "align"],
  ["distribute-horizontal", "Giãn đều theo chiều ngang", "distribute"],
  ["distribute-vertical", "Giãn đều theo chiều dọc", "distribute"],
] as const satisfies readonly [BpmnArrangeAction, string, "align" | "distribute"][];

export function BpmnArrangeMenu({
  selectionCount,
  canAlign,
  canDistribute,
  onArrange,
}: {
  readonly selectionCount: number;
  readonly canAlign: boolean;
  readonly canDistribute: boolean;
  readonly onArrange: (action: BpmnArrangeAction) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const enabled = canAlign || canDistribute;
  return (
    <details className="bpmn-arrange-menu" ref={detailsRef}>
      <summary
        ref={summaryRef}
        title={
          enabled
            ? "Sắp xếp các thành phần đang chọn"
            : "Chọn ít nhất 2 thành phần phù hợp để sắp xếp"
        }
        aria-label={
          enabled
            ? `Sắp xếp ${selectionCount} thành phần đang chọn`
            : "Sắp xếp, cần chọn ít nhất hai thành phần phù hợp"
        }
        aria-disabled={!enabled}
        onClick={(event) => {
          if (!enabled) event.preventDefault();
        }}
      >
        <AlignCenter size={17} strokeWidth={1.5} aria-hidden="true" />
        <span>Sắp xếp</span>
        <b aria-hidden="true">{selectionCount}</b>
        <ChevronDown size={15} strokeWidth={1.5} aria-hidden="true" />
      </summary>
      <div role="group" aria-label="Căn và giãn đều thành phần">
        {arrangeActions.map(([action, label, family]) => {
          const available = family === "align" ? canAlign : canDistribute;
          return (
            <button
              key={action}
              type="button"
              disabled={!available}
              onClick={() => {
                onArrange(action);
                if (detailsRef.current) detailsRef.current.open = false;
                summaryRef.current?.focus();
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </details>
  );
}
