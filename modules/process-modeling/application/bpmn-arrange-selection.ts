export type BpmnArrangeAction =
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontal"
  | "distribute-vertical";

export interface BpmnArrangeElementLike {
  readonly type?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly parent?: unknown;
  readonly waypoints?: readonly unknown[];
}

export function isBpmnArrangeElementEligible(
  element: BpmnArrangeElementLike,
): boolean {
  return Boolean(
    element.parent &&
      element.type !== "label" &&
      element.type !== "bpmn:Lane" &&
      !element.waypoints &&
      Number.isFinite(element.x) &&
      Number.isFinite(element.y) &&
      Number.isFinite(element.width) &&
      Number.isFinite(element.height),
  );
}

export function doesBpmnArrangeRuleAllow(
  result: boolean | readonly unknown[] | null | undefined,
  selectedElements: readonly unknown[],
  minimumCount: 2 | 3,
): boolean {
  if (selectedElements.length < minimumCount) return false;
  if (result === true) return true;
  if (!Array.isArray(result) || result.length !== selectedElements.length) {
    return false;
  }

  const allowedElements = new Set(result);
  return (
    allowedElements.size === selectedElements.length &&
    selectedElements.every((element) => allowedElements.has(element))
  );
}

export function bpmnArrangeNativeCommand(action: BpmnArrangeAction): {
  readonly command: "alignElements" | "distributeElements";
  readonly type: string;
} {
  if (action.startsWith("align-")) {
    return { command: "alignElements", type: action.slice("align-".length) };
  }
  return {
    command: "distributeElements",
    type: action === "distribute-horizontal" ? "horizontal" : "vertical",
  };
}
