import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "./core-profile";
import {
  maxTimerExpressionCharacters,
  validTimerDate,
  validTimerDuration,
} from "./event-routing";

const taskTypes = new Set([
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
]);
const boundaryHostTypes = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ReceiveTask",
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

function validTimer(element: CoreBpmnElement): boolean {
  const definition = element.eventDefinition;
  if (!definition || definition.kind !== "TIMER") return false;
  return (
    Array.from(definition.expression).length <=
      maxTimerExpressionCharacters &&
    (definition.timerKind === "DATE"
      ? validTimerDate(definition.expression)
      : validTimerDuration(definition.expression))
  );
}

export function inspectTaskAndBoundaryEvents(
  elements: readonly CoreBpmnElement[],
  taskTypesEnabled: boolean,
  intermediateEventsEnabled: boolean,
  boundaryEventsEnabled: boolean,
  subprocessTimersEnabled = false,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const elementsById = new Map(
    elements.map((element) => [element.id, element] as const),
  );
  const messages = new Set(
    elements
      .filter((element) => element.type === "bpmn:Message")
      .map((element) => element.id),
  );

  for (const task of elements.filter((element) => taskTypes.has(element.type))) {
    if (!taskTypesEnabled) continue;
    if (!task.name?.trim()) {
      issues.push(issue(
        "BPMN-TASK-001",
        "Specialized Task cần tên trách nhiệm dễ hiểu.",
        "Đặt tên hành động trước khi seal.",
        "recoverable",
        task.id,
      ));
    }
  }

  for (const event of elements.filter(
    (element) => element.type === "bpmn:IntermediateThrowEvent",
  )) {
    if (!intermediateEventsEnabled) continue;
    if (
      event.eventDefinition &&
      event.eventDefinition.kind !== "MESSAGE"
    ) {
      issues.push(issue(
        "BPMN-THROW-001",
        "Intermediate Throw chỉ hỗ trợ None hoặc Message.",
        "Bỏ definition để dùng None, hoặc chọn Message definition.",
        "fatal",
        event.id,
      ));
    } else if (
      event.eventDefinition?.kind === "MESSAGE" &&
      !messages.has(event.eventDefinition.messageRefId)
    ) {
      issues.push(issue(
        "BPMN-MSG-004",
        "Message Throw tham chiếu root Message không tồn tại.",
        "Chọn một Definitions-root Message hợp lệ.",
        "fatal",
        event.id,
      ));
    }
    if (event.incoming.length > 1 || event.outgoing.length > 1) {
      issues.push(issue(
        "BPMN-THROW-001",
        "Intermediate Throw không hỗ trợ nhiều incoming/outgoing.",
        "Giữ đúng một incoming và một outgoing.",
        "fatal",
        event.id,
      ));
    } else if (
      event.incoming.length !== 1 ||
      event.outgoing.length !== 1
    ) {
      issues.push(issue(
        "BPMN-THROW-001",
        "Intermediate Throw đang thiếu incoming hoặc outgoing.",
        "Hoàn tất đường đi một-in/một-out trước khi seal.",
        "recoverable",
        event.id,
      ));
    }
  }

  for (const boundary of elements.filter(
    (element) => element.type === "bpmn:BoundaryEvent",
  )) {
    if (!boundaryEventsEnabled) continue;
    const host = boundary.attachedToId
      ? elementsById.get(boundary.attachedToId)
      : undefined;
    if (!boundary.attachedToId) {
      issues.push(issue(
        "BPMN-BOUNDARY-001",
        "Boundary Event chưa gắn Activity.",
        "Gắn event vào một Task được hỗ trợ trước khi seal.",
        "recoverable",
        boundary.id,
      ));
    } else if (
      !host ||
      !(boundaryHostTypes.has(host.type) ||
        (subprocessTimersEnabled && host.type === "bpmn:SubProcess" &&
          !host.triggeredByEvent && boundary.eventDefinition?.kind === "TIMER")) ||
      host.processId !== boundary.processId ||
      (subprocessTimersEnabled &&
        host.parentContainerId !== boundary.parentContainerId)
    ) {
      issues.push(issue(
        "BPMN-BOUNDARY-001",
        "Boundary Event gắn sai Activity hoặc khác Process.",
        subprocessTimersEnabled
          ? "Gắn vào Task hoặc Timer vào Subprocess thường trong cùng phạm vi cha."
          : "Gắn vào Task/User/Service/Manual/Receive Task cùng Process.",
        "fatal",
        boundary.id,
      ));
    }
    if (!boundary.eventDefinition) {
      issues.push(issue(
        "BPMN-BOUNDARY-002",
        "Boundary Event chưa chọn Message hoặc Timer definition.",
        "Chọn đúng một Message hoặc Timer trước khi seal.",
        "recoverable",
        boundary.id,
      ));
    } else if (
      boundary.eventDefinition.kind === "MESSAGE" &&
      !messages.has(boundary.eventDefinition.messageRefId)
    ) {
      issues.push(issue(
        "BPMN-MSG-004",
        "Boundary Message tham chiếu root Message không tồn tại.",
        "Chọn một Definitions-root Message hợp lệ.",
        "fatal",
        boundary.id,
      ));
    } else if (
      boundary.eventDefinition.kind === "TIMER" &&
      !validTimer(boundary)
    ) {
      issues.push(issue(
        "BPMN-TIMER-001",
        "Boundary Timer không có bounded DATE/DURATION hợp lệ.",
        "Dùng RFC3339 date hoặc duration từ 1 giây đến 365 ngày.",
        "fatal",
        boundary.id,
      ));
    }
    if (boundary.incoming.length > 0 || boundary.outgoing.length > 1) {
      issues.push(issue(
        "BPMN-BOUNDARY-003",
        "Boundary Event phải zero-in và không quá một outgoing.",
        "Xóa incoming và giữ đúng một exception flow.",
        "fatal",
        boundary.id,
      ));
    } else if (boundary.outgoing.length === 0) {
      issues.push(issue(
        "BPMN-BOUNDARY-003",
        "Boundary Event chưa có outgoing exception flow.",
        "Nối một outgoing trước khi seal.",
        "recoverable",
        boundary.id,
      ));
    }
  }

  return issues;
}
