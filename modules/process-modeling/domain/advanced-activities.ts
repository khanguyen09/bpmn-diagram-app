import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
  CoreBpmnSnapshot,
} from "./core-profile";

const flowNodeTypes = new Set([
  "bpmn:StartEvent",
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ReceiveTask",
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:InclusiveGateway",
  "bpmn:EventBasedGateway",
  "bpmn:ComplexGateway",
  "bpmn:IntermediateCatchEvent",
  "bpmn:IntermediateThrowEvent",
  "bpmn:BoundaryEvent",
  "bpmn:EndEvent",
  "bpmn:SubProcess",
  "bpmn:CallActivity",
]);

function issue(
  ruleId: string,
  message: string,
  recovery: string,
  disposition: "fatal" | "recoverable",
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

function containingProcessId(
  element: CoreBpmnElement,
  byId: ReadonlyMap<string, CoreBpmnElement>,
): string | undefined {
  let containerId = element.parentContainerId;
  const visited = new Set<string>();
  while (containerId && !visited.has(containerId)) {
    visited.add(containerId);
    const container = byId.get(containerId);
    if (!container) return undefined;
    if (container.type === "bpmn:Process") return container.id;
    containerId = container.parentContainerId;
  }
  return undefined;
}

export function inspectAdvancedActivities(
  snapshot: Pick<CoreBpmnSnapshot, "elements" | "shapes">,
  diagramProcessIds: readonly string[],
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const byId = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const shapes = new Map(
    snapshot.shapes.map((shape) => [shape.elementId, shape] as const),
  );
  const diagramProcesses = new Set(diagramProcessIds);

  for (const subprocess of snapshot.elements.filter(
    (element) => element.type === "bpmn:SubProcess",
  )) {
    const parent = subprocess.parentContainerId
      ? byId.get(subprocess.parentContainerId)
      : undefined;
    if (!parent || parent.type !== "bpmn:Process") {
      issues.push(issue(
        "BPMN-SUBPROCESS-001",
        "Expanded SubProcess v1 phải nằm trực tiếp trong Process.",
        "Giữ SubProcess ở một cấp, không lồng trong SubProcess khác.",
        "fatal",
        subprocess.id,
      ));
    }
    const subprocessShape = shapes.get(subprocess.id);
    if (
      subprocess.triggeredByEvent !== false ||
      subprocessShape?.isExpanded !== true
    ) {
      issues.push(issue(
        "BPMN-SUBPROCESS-002",
        "Profile chỉ hỗ trợ embedded expanded SubProcess thông thường.",
        "Đặt triggeredByEvent=false và BPMNShape.isExpanded=true.",
        "fatal",
        subprocess.id,
      ));
    }
    const children = snapshot.elements.filter(
      (element) => element.parentContainerId === subprocess.id,
    );
    const childFlowNodes = children.filter((element) =>
      flowNodeTypes.has(element.type),
    );
    if (
      !childFlowNodes.some((element) => element.type === "bpmn:StartEvent") ||
      !childFlowNodes.some((element) => element.type === "bpmn:EndEvent")
    ) {
      issues.push(issue(
        "BPMN-SUBPROCESS-003",
        "SubProcess chưa có internal Start và End.",
        "Hoàn thiện luồng con trước khi seal.",
        "recoverable",
        subprocess.id,
      ));
    }
    const bounds = subprocessShape;
    if (!bounds) {
      issues.push(issue(
        "BPMN-SUBPROCESS-DI-001",
        "Expanded SubProcess thiếu BPMNShape.",
        "Bổ sung finite positive bounds và isExpanded=true.",
        "fatal",
        subprocess.id,
      ));
    } else {
      for (const child of children) {
        const childShape = shapes.get(child.id);
        if (
          childShape &&
          (childShape.x < bounds.x ||
            childShape.y < bounds.y ||
            childShape.x + childShape.width > bounds.x + bounds.width ||
            childShape.y + childShape.height > bounds.y + bounds.height)
        ) {
          issues.push(issue(
            "BPMN-SUBPROCESS-DI-002",
            "Child shape nằm ngoài bounds của expanded SubProcess.",
            "Di chuyển child shape vào trong container.",
            "fatal",
            child.id,
          ));
        }
      }
    }
  }

  for (const flow of snapshot.elements.filter(
    (element) => element.type === "bpmn:SequenceFlow",
  )) {
    const source = flow.sourceId ? byId.get(flow.sourceId) : undefined;
    const target = flow.targetId ? byId.get(flow.targetId) : undefined;
    if (
      source &&
      target &&
      source.parentContainerId !== target.parentContainerId
    ) {
      issues.push(issue(
        "BPMN-SUBPROCESS-004",
        "Sequence Flow không được vượt ranh giới Process/SubProcess.",
        "Nối outer flow tới SubProcess hoặc giữ internal flow trong container.",
        "fatal",
        flow.id,
      ));
    }
  }

  const callableProcesses = new Map(
    snapshot.elements
      .filter(
        (element) =>
          element.type === "bpmn:Process" && !diagramProcesses.has(element.id),
      )
      .map((element) => [element.id, element] as const),
  );
  const callGraph = new Map<string, string[]>();
  for (const call of snapshot.elements.filter(
    (element) => element.type === "bpmn:CallActivity",
  )) {
    const ownerProcessId = containingProcessId(call, byId);
    if (!call.calledElementId) {
      issues.push(issue(
        "BPMN-CALL-001",
        "Call Activity chưa chọn reusable Process.",
        "Chọn exact Process ID trong cùng Definitions.",
        "recoverable",
        call.id,
      ));
      continue;
    }
    const target = callableProcesses.get(call.calledElementId);
    if (
      !target ||
      !ownerProcessId ||
      target.id === ownerProcessId ||
      target.isExecutable !== false ||
      target.participantId !== undefined ||
      shapes.has(target.id)
    ) {
      issues.push(issue(
        "BPMN-CALL-002",
        "calledElement không resolve tới local non-executable callable Process.",
        "Chọn Process cùng Definitions, không Participant/BPMNPlane và không self-call.",
        "fatal",
        call.id,
      ));
      continue;
    }
    callGraph.set(ownerProcessId, [
      ...(callGraph.get(ownerProcessId) ?? []),
      target.id,
    ]);
  }

  const visits = new Set<string>();
  const stack = new Set<string>();
  const cyclic = new Set<string>();
  const visit = (processId: string) => {
    if (stack.has(processId)) {
      for (const id of stack) cyclic.add(id);
      return;
    }
    if (visits.has(processId)) return;
    visits.add(processId);
    stack.add(processId);
    for (const target of callGraph.get(processId) ?? []) visit(target);
    stack.delete(processId);
  };
  for (const processId of callGraph.keys()) visit(processId);
  if (cyclic.size > 0) {
    for (const call of snapshot.elements.filter(
      (element) =>
        element.type === "bpmn:CallActivity" &&
        Boolean(
          containingProcessId(element, byId) &&
          cyclic.has(containingProcessId(element, byId)!),
        ),
    )) {
      issues.push(issue(
        "BPMN-CALL-003",
        "Call Activity tạo direct hoặc transitive Process cycle.",
        "Chọn callable Process không tham chiếu ngược caller chain.",
        "fatal",
        call.id,
      ));
    }
  }
  return issues;
}
