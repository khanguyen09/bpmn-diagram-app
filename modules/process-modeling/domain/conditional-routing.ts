import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "./core-profile";

export const maxConditionExpressionCharacters = 500;

const conditionalGatewayTypes = new Set([
  "bpmn:ExclusiveGateway",
  "bpmn:InclusiveGateway",
]);

function issue(
  ruleId: string,
  message: string,
  recovery: string,
  disposition: BpmnInspectionIssue["disposition"],
  elementId?: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: disposition === "fatal" ? "error" : "warning",
    disposition,
    elementId,
    message,
    recovery,
  };
}

export function hasConditionalRoutingMetadata(
  element: CoreBpmnElement,
): boolean {
  return (
    element.conditionExpression !== undefined ||
    element.defaultFlowId !== undefined
  );
}

export function inspectConditionalRouting(
  elements: readonly CoreBpmnElement[],
  enabled: boolean,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const elementsById = new Map(
    elements.map((element) => [element.id, element] as const),
  );
  const flows = elements.filter(
    (element) => element.type === "bpmn:SequenceFlow",
  );
  const flowsBySource = new Map<string, CoreBpmnElement[]>();
  for (const flow of flows) {
    if (!flow.sourceId) continue;
    flowsBySource.set(flow.sourceId, [
      ...(flowsBySource.get(flow.sourceId) ?? []),
      flow,
    ]);
  }

  if (!enabled) {
    for (const element of elements.filter(hasConditionalRoutingMetadata)) {
      issues.push(issue(
        "BPMN-PROFILE-005",
        "Conditional metadata nằm ngoài immutable profile hiện tại.",
        "Nâng explicit lên Conditional Routing trước khi dùng condition hoặc default.",
        "fatal",
        element.id,
      ));
    }
    return issues;
  }

  for (const owner of elements.filter(
    (element) => element.defaultFlowId !== undefined,
  )) {
    const defaultFlow = owner.defaultFlowId
      ? elementsById.get(owner.defaultFlowId)
      : undefined;
    const outgoing = flowsBySource.get(owner.id) ?? [];
    const validOwner = conditionalGatewayTypes.has(owner.type);
    const isSplit = owner.incoming.length === 1 && outgoing.length >= 2;
    if (
      !validOwner ||
      !isSplit ||
      !defaultFlow ||
      defaultFlow.type !== "bpmn:SequenceFlow" ||
      defaultFlow.sourceId !== owner.id ||
      !outgoing.some((flow) => flow.id === defaultFlow.id)
    ) {
      issues.push(issue(
        "BPMN-DEFAULT-001",
        "Gateway default không tham chiếu một outgoing Sequence Flow của chính split.",
        "Chọn đúng một outgoing flow của XOR hoặc Inclusive split.",
        "fatal",
        owner.id,
      ));
    } else if (defaultFlow.conditionExpression !== undefined) {
      issues.push(issue(
        "BPMN-DEFAULT-001",
        "Default Sequence Flow không được có condition.",
        "Xóa condition trên default flow hoặc chọn flow khác làm default.",
        "fatal",
        defaultFlow.id,
      ));
    }
  }

  for (const flow of flows.filter(
    (candidate) => candidate.conditionExpression !== undefined,
  )) {
    const source = flow.sourceId ? elementsById.get(flow.sourceId) : undefined;
    const outgoing = source ? flowsBySource.get(source.id) ?? [] : [];
    const sourceIsSplit =
      source !== undefined &&
      conditionalGatewayTypes.has(source.type) &&
      source.incoming.length === 1 &&
      outgoing.length >= 2;
    if (
      !sourceIsSplit ||
      source?.defaultFlowId === flow.id
    ) {
      issues.push(issue(
        "BPMN-COND-002",
        "Condition chỉ hợp lệ trên non-default outgoing flow của XOR hoặc Inclusive split.",
        "Xóa condition hoặc chuyển flow sang một conditional gateway split hợp lệ.",
        "fatal",
        flow.id,
      ));
    }
  }

  for (const gateway of elements.filter((element) =>
    conditionalGatewayTypes.has(element.type),
  )) {
    const incomingCount = gateway.incoming.length;
    const outgoing = flowsBySource.get(gateway.id) ?? [];
    const outgoingCount = outgoing.length;
    const family = gateway.type === "bpmn:InclusiveGateway"
      ? "Inclusive"
      : "XOR";
    const incompleteRule = gateway.type === "bpmn:InclusiveGateway"
      ? "BPMN-INC-001"
      : "BPMN-XOR-001";

    if (incomingCount > 1 && outgoingCount > 1) {
      issues.push(issue(
        "BPMN-MIX-001",
        `${family} Gateway không được vừa join vừa split trong Conditional Routing.`,
        "Tách thành một gateway join và một gateway split riêng.",
        "fatal",
        gateway.id,
      ));
      continue;
    }

    const split = incomingCount === 1 && outgoingCount >= 2;
    const join = incomingCount >= 2 && outgoingCount === 1;
    if (!split && !join) {
      issues.push(issue(
        incompleteRule,
        `${family} Gateway đang xây dở hoặc chưa có topology split/join hợp lệ.`,
        "Dùng một incoming và ít nhất hai outgoing cho split, hoặc ngược lại cho join.",
        "recoverable",
        gateway.id,
      ));
      continue;
    }

    if (join) {
      if (
        gateway.defaultFlowId !== undefined ||
        outgoing[0]?.conditionExpression !== undefined
      ) {
        issues.push(issue(
          "BPMN-DEFAULT-001",
          `${family} join không được có default hoặc condition trên outgoing flow.`,
          "Xóa default và condition khỏi gateway join.",
          "fatal",
          gateway.id,
        ));
      }
      continue;
    }

    if (!gateway.defaultFlowId) {
      issues.push(issue(
        incompleteRule,
        `${family} split cần đúng một default flow để làm fallback.`,
        "Chọn một outgoing Sequence Flow làm default.",
        "recoverable",
        gateway.id,
      ));
    }
    for (const flow of outgoing) {
      if (flow.id === gateway.defaultFlowId) continue;
      if (!flow.conditionExpression?.trim()) {
        issues.push(issue(
          "BPMN-COND-001",
          "Non-default outgoing Sequence Flow chưa có condition.",
          "Nhập condition text thuần hoặc chọn flow này làm default.",
          "recoverable",
          flow.id,
        ));
      }
    }
  }

  return issues;
}
