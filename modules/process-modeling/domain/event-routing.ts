import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "./core-profile";

export const maxTimerExpressionCharacters = 200;

const catchingTargetTypes = new Set([
  "bpmn:IntermediateCatchEvent",
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

export function validTimerDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const offsetHour = Number(match[10] ?? "0");
  const offsetMinute = Number(match[11] ?? "0");
  const leapYear =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return (
    year > 0 &&
    daysInMonth !== undefined &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 14 &&
    offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0) &&
    Number.isFinite(Date.parse(value))
  );
}

export function validTimerDuration(value: string): boolean {
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,3})?)S)?)?$/.exec(
      value,
    );
  if (!match || !match.slice(1).some((part) => part !== undefined)) {
    return false;
  }
  const totalSeconds =
    Number(match[1] ?? "0") * 86_400 +
    Number(match[2] ?? "0") * 3_600 +
    Number(match[3] ?? "0") * 60 +
    Number(match[4] ?? "0");
  return (
    Number.isFinite(totalSeconds) &&
    totalSeconds >= 1 &&
    totalSeconds <= 365 * 86_400
  );
}

function eventTriggerSignature(
  element: CoreBpmnElement,
): string | undefined {
  if (element.type === "bpmn:ReceiveTask") {
    return element.messageRefId
      ? `MESSAGE:${element.messageRefId}`
      : undefined;
  }
  if (element.eventDefinition?.kind === "MESSAGE") {
    return `MESSAGE:${element.eventDefinition.messageRefId}`;
  }
  if (element.eventDefinition?.kind === "TIMER") {
    return `TIMER:${element.eventDefinition.timerKind}:${element.eventDefinition.expression}`;
  }
  return undefined;
}

export function hasEventRoutingMetadata(
  element: CoreBpmnElement,
): boolean {
  return (
    element.eventDefinition !== undefined ||
    element.messageRefId !== undefined ||
    element.eventGatewayType !== undefined ||
    element.instantiate !== undefined
  );
}

export function inspectEventRouting(
  elements: readonly CoreBpmnElement[],
  catchingEnabled: boolean,
  eventRoutingEnabled: boolean,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const elementsById = new Map(
    elements.map((element) => [element.id, element] as const),
  );
  const messagesById = new Map(
    elements
      .filter((element) => element.type === "bpmn:Message")
      .map((message) => [message.id, message] as const),
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

  if (!catchingEnabled) {
    for (const element of elements.filter(hasEventRoutingMetadata)) {
      issues.push(issue(
        "BPMN-PROFILE-006",
        "Event-routing metadata nằm ngoài immutable profile hiện tại.",
        "Nâng explicit lên Catching Events trước khi dùng event definitions.",
        "fatal",
        element.id,
      ));
    }
    return issues;
  }

  for (const message of messagesById.values()) {
    if (!message.name?.trim()) {
      issues.push(issue(
        "BPMN-MSG-004",
        "Root Message cần tên semantic không rỗng.",
        "Đặt tên thông điệp được chờ hoặc nhận.",
        "recoverable",
        message.id,
      ));
    }
  }

  for (const element of elements.filter(
    (candidate) => candidate.type === "bpmn:IntermediateCatchEvent",
  )) {
    if (!element.eventDefinition) {
      issues.push(issue(
        "BPMN-EVT-001",
        "Intermediate Catch Event chưa có Message hoặc Timer definition.",
        "Chọn đúng một Message Catch hoặc Timer Catch definition.",
        "recoverable",
        element.id,
      ));
      continue;
    }
    if (element.eventDefinition.kind === "MESSAGE") {
      const message = messagesById.get(
        element.eventDefinition.messageRefId,
      );
      if (!message) {
        issues.push(issue(
          "BPMN-MSG-004",
          "Message Catch Event tham chiếu root Message không tồn tại.",
          "Chọn một root Message có ID và tên hợp lệ.",
          "fatal",
          element.id,
        ));
      }
    } else {
      const expression = element.eventDefinition.expression;
      const validLength =
        Array.from(expression).length <= maxTimerExpressionCharacters;
      const validValue =
        element.eventDefinition.timerKind === "DATE"
          ? validTimerDate(expression)
          : validTimerDuration(expression);
      if (!expression.trim() || !validLength || !validValue) {
        issues.push(issue(
          "BPMN-TIMER-001",
          "Timer phải dùng DATE có timezone hoặc bounded ISO DURATION hợp lệ.",
          "Dùng RFC 3339 date hoặc duration như PT15M; tối đa 200 ký tự.",
          "fatal",
          element.id,
        ));
      }
    }
    if (element.incoming.length !== 1 || element.outgoing.length !== 1) {
      issues.push(issue(
        "BPMN-EVT-001",
        "Catching Event cần đúng một incoming và một outgoing Sequence Flow.",
        "Kết nối event như một bước chờ trung gian duy nhất.",
        element.incoming.length > 1 || element.outgoing.length > 1
          ? "fatal"
          : "recoverable",
        element.id,
      ));
    }
  }

  for (const task of elements.filter(
    (candidate) => candidate.type === "bpmn:ReceiveTask",
  )) {
    if (task.instantiate === true) {
      issues.push(issue(
        "BPMN-RECEIVE-001",
        "Receive Task instantiating nằm ngoài bounded modeling profile.",
        "Đặt instantiate=false và dùng task trong Process hiện hữu.",
        "fatal",
        task.id,
      ));
    }
    if (!task.messageRefId) {
      issues.push(issue(
        "BPMN-MSG-004",
        "Receive Task chưa tham chiếu root Message.",
        "Chọn một root Message có ID và tên hợp lệ.",
        "recoverable",
        task.id,
      ));
    } else if (!messagesById.has(task.messageRefId)) {
      issues.push(issue(
        "BPMN-MSG-004",
        "Receive Task tham chiếu root Message không tồn tại.",
        "Chọn một root Message có ID và tên hợp lệ.",
        "fatal",
        task.id,
      ));
    }
  }

  if (!eventRoutingEnabled) {
    for (const gateway of elements.filter(
      (element) =>
        element.type === "bpmn:EventBasedGateway" ||
        element.eventGatewayType !== undefined,
    )) {
      issues.push(issue(
        "BPMN-PROFILE-006",
        "Event-Based Gateway nằm ngoài Catching Events profile.",
        "Nâng explicit lên Event Routing trước khi tạo gateway.",
        "fatal",
        gateway.id,
      ));
    }
    return issues;
  }

  for (const gateway of elements.filter(
    (element) => element.type === "bpmn:EventBasedGateway",
  )) {
    const outgoing = flowsBySource.get(gateway.id) ?? [];
    if (
      gateway.eventGatewayType !== "Exclusive" ||
      gateway.instantiate === true
    ) {
      issues.push(issue(
        "BPMN-EVG-001",
        "Event-Based Gateway chỉ hỗ trợ Exclusive, non-instantiating.",
        "Đặt eventGatewayType=Exclusive và instantiate=false.",
        "fatal",
        gateway.id,
      ));
    }
    if (gateway.incoming.length > 1) {
      issues.push(issue(
        "BPMN-EVG-001",
        "Event-Based Gateway không hỗ trợ join hoặc mixed topology.",
        "Giữ đúng một incoming và dùng gateway chỉ để diverge.",
        "fatal",
        gateway.id,
      ));
    } else if (gateway.incoming.length !== 1 || outgoing.length < 2) {
      issues.push(issue(
        "BPMN-EVG-001",
        "Event-Based Gateway cần một incoming và ít nhất hai outgoing.",
        "Hoàn tất diverging event branches trước khi seal.",
        "recoverable",
        gateway.id,
      ));
    }

    const seenTargets = new Set<string>();
    const signatures = new Map<string, string>();
    for (const flow of outgoing) {
      const target = flow.targetId
        ? elementsById.get(flow.targetId)
        : undefined;
      if (
        !target ||
        !catchingTargetTypes.has(target.type) ||
        target.processId !== gateway.processId
      ) {
        issues.push(issue(
          "BPMN-EVG-001",
          "Outgoing Event-Based flow phải tới catching target cùng Process.",
          "Nối trực tiếp tới Message Catch, Timer Catch hoặc Receive Task.",
          "fatal",
          flow.id,
        ));
        continue;
      }
      if (seenTargets.has(target.id)) {
        issues.push(issue(
          "BPMN-EVG-001",
          "Event-Based Gateway có nhiều flow tới cùng một target.",
          "Giữ mỗi catching target đúng một lần.",
          "fatal",
          target.id,
        ));
      }
      seenTargets.add(target.id);
      if (
        target.incoming.length !== 1 ||
        target.incoming[0] !== flow.id ||
        target.outgoing.length !== 1
      ) {
        issues.push(issue(
          "BPMN-EVG-001",
          "Catching target cần đúng một incoming từ gateway và một outgoing.",
          "Loại bỏ incoming ngoài gateway và hoàn tất outgoing branch.",
          "fatal",
          target.id,
        ));
      }
      const signature = eventTriggerSignature(target);
      if (signature) {
        const existingTarget = signatures.get(signature);
        if (existingTarget && existingTarget !== target.id) {
          issues.push(issue(
            "BPMN-EVG-002",
            "Event-Based branches có trigger signature trùng nhau.",
            "Dùng Message hoặc Timer trigger khác nhau để tránh nhánh mơ hồ.",
            "recoverable",
            target.id,
          ));
        } else {
          signatures.set(signature, target.id);
        }
      }
    }
  }

  return issues;
}
