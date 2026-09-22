import {
  coreCatchingEventsBpmnProfile,
  coreConditionalBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreTaskTypesBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreFullAuthoringBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreStructuredBpmnProfile,
  coreBpmnProfile,
  isCoreBpmnProfileId,
  supportsConditionalRouting,
  supportsCatchingEvents,
  supportsEventRouting,
  supportsTaskTypes,
  supportsIntermediateEvents,
  supportsBoundaryEvents,
  supportsStructuredRouting,
  supportsFullAuthoring,
  supportsActivityContainers,
  supportsDataAuthoring,
  supportsComplexRouting,
  supportsSubprocessTimers,
  type BpmnInspectionIssue,
  type CoreBpmnElement,
  type CoreBpmnSnapshot,
} from "../domain/core-profile";
import { inspectConditionalRouting } from "../domain/conditional-routing";
import { inspectEventRouting } from "../domain/event-routing";
import { inspectTaskAndBoundaryEvents } from "../domain/task-and-boundary-events";
import {
  inspectFullAuthoringArtifacts,
  projectFullAuthoringOutlineArtifacts,
} from "../domain/full-authoring";
import { inspectAdvancedActivities } from "../domain/advanced-activities";
import { inspectDataAuthoring } from "../domain/data-authoring";
import { inspectComplexRouting } from "../domain/complex-routing";

const starterFlowNodeTypes = [
  "bpmn:StartEvent",
  "bpmn:Task",
  "bpmn:ExclusiveGateway",
  "bpmn:EndEvent",
] as const;

function issue(
  ruleId: string,
  message: string,
  recovery: string,
  disposition: BpmnInspectionIssue["disposition"],
  elementId?: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: "error",
    disposition,
    elementId,
    message,
    recovery,
  };
}

export function inspectCoreSnapshot(
  snapshot: CoreBpmnSnapshot,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const structured = supportsStructuredRouting(snapshot.profileId);
  const conditional = supportsConditionalRouting(snapshot.profileId);
  const catching = supportsCatchingEvents(snapshot.profileId);
  const eventRouting = supportsEventRouting(snapshot.profileId);
  const taskTypes = supportsTaskTypes(snapshot.profileId);
  const intermediateEvents = supportsIntermediateEvents(snapshot.profileId);
  const boundaryEvents = supportsBoundaryEvents(snapshot.profileId);
  const fullAuthoring = supportsFullAuthoring(snapshot.profileId);
  const activityContainers = supportsActivityContainers(snapshot.profileId);
  const dataAuthoring = supportsDataAuthoring(snapshot.profileId);
  const complexRouting = supportsComplexRouting(snapshot.profileId);
  const supportedTypes = new Set<string>(
    complexRouting
      ? coreComplexRoutingBpmnProfile.semanticTypes
      : dataAuthoring
        ? coreDataAuthoringBpmnProfile.semanticTypes
        : activityContainers
          ? coreActivityContainersBpmnProfile.semanticTypes
          : fullAuthoring
      ? coreFullAuthoringBpmnProfile.semanticTypes
      : boundaryEvents
      ? coreBoundaryEventsBpmnProfile.semanticTypes
      : intermediateEvents
        ? coreIntermediateEventsBpmnProfile.semanticTypes
        : taskTypes
          ? coreTaskTypesBpmnProfile.semanticTypes
          : eventRouting
            ? coreEventRoutingBpmnProfile.semanticTypes
      : catching
        ? coreCatchingEventsBpmnProfile.semanticTypes
        : conditional
          ? coreConditionalBpmnProfile.semanticTypes
          : structured
            ? coreStructuredBpmnProfile.semanticTypes
            : coreBpmnProfile.semanticTypes,
  );
  const flowNodeTypes = new Set<string>([
    ...starterFlowNodeTypes,
    ...(structured ? ["bpmn:ParallelGateway"] : []),
    ...(conditional ? ["bpmn:InclusiveGateway"] : []),
    ...(catching
      ? ["bpmn:IntermediateCatchEvent", "bpmn:ReceiveTask"]
      : []),
    ...(eventRouting ? ["bpmn:EventBasedGateway"] : []),
    ...(taskTypes
      ? ["bpmn:UserTask", "bpmn:ServiceTask", "bpmn:ManualTask"]
      : []),
    ...(intermediateEvents ? ["bpmn:IntermediateThrowEvent"] : []),
    ...(boundaryEvents ? ["bpmn:BoundaryEvent"] : []),
    ...(activityContainers ? ["bpmn:SubProcess", "bpmn:CallActivity"] : []),
    ...(complexRouting ? ["bpmn:ComplexGateway"] : []),
  ]);
  const ids = new Set(snapshot.elements.map((element) => element.id));
  const elementsById = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const processes = snapshot.elements.filter(
    (element) => element.type === "bpmn:Process",
  );

  if (!isCoreBpmnProfileId(snapshot.profileId)) {
    issues.push(
      issue(
        "BPMN-PROFILE-001",
        "Phiên bản profile không được hỗ trợ.",
        `Dùng ${coreBpmnProfile.label}.`,
        "fatal",
      ),
    );
  }
  const diagramProcesses = processes.filter(
    (process) => process.id === snapshot.planeElementId,
  );
  if (
    activityContainers
      ? diagramProcesses.length !== 1
      : processes.length !== 1
  ) {
    issues.push(
      issue(
        "BPMN-PROFILE-002",
        "Core Starter cần đúng một Process.",
        "Giữ một Process duy nhất trong model.",
        "fatal",
      ),
    );
  }

  for (const element of snapshot.elements) {
    if (!supportedTypes.has(element.type)) {
      issues.push(
        issue(
          "BPMN-PROFILE-003",
          `Phần tử ${element.type} nằm ngoài Core Starter.`,
          "Chỉ dùng Start, Task, Exclusive Gateway, End và Sequence Flow.",
          "fatal",
          element.id,
        ),
      );
    }

    if (element.type === "bpmn:SequenceFlow") {
      const source = element.sourceId
        ? elementsById.get(element.sourceId)
        : undefined;
      const target = element.targetId
        ? elementsById.get(element.targetId)
        : undefined;
      if (
        !element.sourceId ||
        !element.targetId ||
        !ids.has(element.sourceId) ||
        !ids.has(element.targetId)
      ) {
        issues.push(
          issue(
            "BPMN-REF-001",
            "Sequence Flow có source hoặc target không tồn tại.",
            "Kết nối lại flow giữa hai node Core Starter.",
            "fatal",
            element.id,
          ),
        );
      } else if (
        !source ||
        !target ||
        !flowNodeTypes.has(source.type) ||
        !flowNodeTypes.has(target.type)
      ) {
        issues.push(
          issue(
            "BPMN-FLOW-001",
            "Sequence Flow phải nối giữa hai flow node Core Starter.",
            "Kết nối Start, Task, Gateway hoặc End hợp lệ.",
            "fatal",
            element.id,
          ),
        );
      }
    }
  }

  const flowNodes = snapshot.elements.filter((element) =>
    flowNodeTypes.has(element.type),
  );
  const starts = flowNodes.filter((element) => element.type === "bpmn:StartEvent");
  const ends = flowNodes.filter((element) => element.type === "bpmn:EndEvent");
  if (starts.length === 0 || ends.length === 0) {
    issues.push(
      issue(
        "BPMN-CONNECT-001",
        "Core Starter cần ít nhất một Start Event và một End Event.",
        "Bổ sung điểm bắt đầu và kết thúc cho quy trình.",
        "recoverable",
      ),
    );
  }

  for (const element of flowNodes) {
    const disconnected =
      (element.type === "bpmn:StartEvent" &&
        (element.incoming.length > 0 || element.outgoing.length === 0)) ||
      (element.type === "bpmn:EndEvent" &&
        (element.incoming.length === 0 || element.outgoing.length > 0)) ||
      ((element.type === "bpmn:Task" ||
        element.type === "bpmn:ExclusiveGateway" ||
        element.type === "bpmn:ParallelGateway" ||
        element.type === "bpmn:InclusiveGateway" ||
        element.type === "bpmn:ReceiveTask" ||
        element.type === "bpmn:EventBasedGateway" ||
        element.type === "bpmn:UserTask" ||
        element.type === "bpmn:ServiceTask" ||
        element.type === "bpmn:ManualTask" ||
        element.type === "bpmn:IntermediateThrowEvent" ||
        element.type === "bpmn:SubProcess" ||
        element.type === "bpmn:CallActivity" ||
        element.type === "bpmn:ComplexGateway") &&
        (element.incoming.length === 0 || element.outgoing.length === 0));
    if (disconnected) {
      issues.push(
        issue(
          "BPMN-CONNECT-002",
          "Flow node chưa có incoming/outgoing hợp lệ cho loại phần tử.",
          "Kết nối node vào luồng từ Start đến End.",
          "recoverable",
          element.id,
        ),
      );
    }
  }

  issues.push(...inspectConditionalRouting(snapshot.elements, conditional));
  issues.push(
    ...inspectEventRouting(snapshot.elements, catching, eventRouting),
  );
  issues.push(
    ...inspectTaskAndBoundaryEvents(
      snapshot.elements,
      taskTypes,
      intermediateEvents,
      boundaryEvents,
      supportsSubprocessTimers(snapshot.profileId),
    ),
  );
  if (fullAuthoring) {
    issues.push(...inspectFullAuthoringArtifacts(snapshot));
  }
  if (activityContainers) {
    issues.push(
      ...inspectAdvancedActivities(
        snapshot,
        snapshot.planeElementId ? [snapshot.planeElementId] : [],
      ),
    );
  }
  if (dataAuthoring) issues.push(...inspectDataAuthoring(snapshot));
  if (complexRouting) {
    issues.push(...inspectComplexRouting(snapshot.elements));
  }

  for (const gateway of flowNodes.filter(
    (element) => element.type === "bpmn:ParallelGateway",
  )) {
    const incoming = gateway.incoming.length;
    const outgoing = gateway.outgoing.length;
    if (incoming > 1 && outgoing > 1) {
      issues.push(
        issue(
          "BPMN-PAR-002",
          "Parallel Gateway không được vừa join vừa split trong Structured Routing.",
          "Tách thành một Parallel join và một Parallel split riêng.",
          "fatal",
          gateway.id,
        ),
      );
    } else if (
      !(
        (incoming === 1 && outgoing >= 2) ||
        (incoming >= 2 && outgoing === 1)
      )
    ) {
      issues.push(
        issue(
          "BPMN-PAR-001",
          "Parallel Gateway đang xây dở hoặc chưa tạo split/join hợp lệ.",
          "Dùng một incoming và ít nhất hai outgoing cho split, hoặc ngược lại cho join.",
          "recoverable",
          gateway.id,
        ),
      );
    }
  }

  const outgoingTargets = new Map<string, string[]>();
  const incomingSources = new Map<string, string[]>();
  for (const flow of snapshot.elements.filter(
    (element) => element.type === "bpmn:SequenceFlow",
  )) {
    if (!flow.sourceId || !flow.targetId) continue;
    outgoingTargets.set(flow.sourceId, [
      ...(outgoingTargets.get(flow.sourceId) ?? []),
      flow.targetId,
    ]);
    incomingSources.set(flow.targetId, [
      ...(incomingSources.get(flow.targetId) ?? []),
      flow.sourceId,
    ]);
  }
  for (const boundary of flowNodes.filter(
    (element) =>
      element.type === "bpmn:BoundaryEvent" &&
      element.attachedToId !== undefined,
  )) {
    outgoingTargets.set(boundary.attachedToId!, [
      ...(outgoingTargets.get(boundary.attachedToId!) ?? []),
      boundary.id,
    ]);
  }

  function reachableFrom(seeds: readonly string[], graph: Map<string, string[]>) {
    const reached = new Set(seeds);
    const pending = [...seeds];
    while (pending.length > 0) {
      const current = pending.shift()!;
      for (const next of graph.get(current) ?? []) {
        if (!reached.has(next)) {
          reached.add(next);
          pending.push(next);
        }
      }
    }
    return reached;
  }

  const fromStart = reachableFrom(
    starts.map((element) => element.id),
    outgoingTargets,
  );
  const toEnd = reachableFrom(
    ends.map((element) => element.id),
    incomingSources,
  );
  for (const element of flowNodes) {
    if (!fromStart.has(element.id) || !toEnd.has(element.id)) {
      issues.push(
        issue(
          "BPMN-CONNECT-003",
          "Flow node không nằm trên đường đi hoàn chỉnh từ Start đến End.",
          "Kết nối node vào một đường đi có thể tới End Event.",
          "recoverable",
          element.id,
        ),
      );
    }
  }

  const shapeIds = new Set(snapshot.shapes.map((shape) => shape.elementId));
  const edgeIds = new Set(snapshot.edges.map((edge) => edge.elementId));
  for (const shape of snapshot.shapes) {
    if (
      !Number.isFinite(shape.x) ||
      !Number.isFinite(shape.y) ||
      !Number.isFinite(shape.width) ||
      !Number.isFinite(shape.height) ||
      shape.width <= 0 ||
      shape.height <= 0
    ) {
      issues.push(
        issue(
          "BPMN-DI-003",
          "BPMNShape có bounds không hữu hạn hoặc không dương.",
          "Dùng x/y hữu hạn và width/height lớn hơn 0.",
          "fatal",
          shape.elementId,
        ),
      );
    }
  }
  for (const edge of snapshot.edges) {
    if (
      edge.waypoints.length < 2 ||
      edge.waypoints.some(
        (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
      )
    ) {
      issues.push(
        issue(
          "BPMN-DI-004",
          "BPMNEdge cần ít nhất hai waypoint hữu hạn.",
          "Sửa geometry của connector trước khi import.",
          "fatal",
          edge.elementId,
        ),
      );
    }
  }
  for (const element of snapshot.elements) {
    if (flowNodeTypes.has(element.type) && !shapeIds.has(element.id)) {
      issues.push(
        issue(
          "BPMN-DI-001",
          "Flow node thiếu BPMNShape có bounds.",
          "Bổ sung BPMN DI shape trước khi import.",
          "fatal",
          element.id,
        ),
      );
    }
    if (element.type === "bpmn:SequenceFlow" && !edgeIds.has(element.id)) {
      issues.push(
        issue(
          "BPMN-DI-002",
          "Sequence Flow thiếu BPMNEdge có waypoint.",
          "Bổ sung BPMN DI edge trước khi import.",
          "fatal",
          element.id,
        ),
      );
    }
    if (
      (element.type === "bpmn:Task" ||
        element.type === "bpmn:ExclusiveGateway" ||
        element.type === "bpmn:ParallelGateway" ||
        element.type === "bpmn:InclusiveGateway" ||
        element.type === "bpmn:ReceiveTask" ||
        element.type === "bpmn:EventBasedGateway" ||
        element.type === "bpmn:IntermediateCatchEvent" ||
        element.type === "bpmn:UserTask" ||
        element.type === "bpmn:ServiceTask" ||
        element.type === "bpmn:ManualTask" ||
        element.type === "bpmn:IntermediateThrowEvent" ||
        element.type === "bpmn:BoundaryEvent") &&
      !element.name?.trim()
    ) {
      issues.push({
        ruleId: "BPMN-NAME-001",
        severity: "warning",
        disposition: "recoverable",
        elementId: element.id,
        message: "Phần tử chưa có tên dễ hiểu.",
        recovery: "Đặt tên phản ánh hành động hoặc quyết định nghiệp vụ.",
      });
    }
  }

  return issues;
}

export function projectCoreOutline(
  snapshot: CoreBpmnSnapshot,
): readonly CoreBpmnElement[] {
  const regular = snapshot.elements.filter(
    (element) =>
      element.type !== "bpmn:Process" &&
      element.type !== "bpmn:Message" &&
      element.type !== "bpmn:Category" &&
      element.type !== "bpmn:CategoryValue" &&
      element.type !== "bpmn:TextAnnotation" &&
      element.type !== "bpmn:Association" &&
      element.type !== "bpmn:Group" &&
      !element.type.endsWith("EventDefinition"),
  );
  return supportsFullAuthoring(snapshot.profileId)
    ? [...regular, ...projectFullAuthoringOutlineArtifacts(snapshot)]
    : regular;
}

export function snapshotsAreEquivalent(
  left: CoreBpmnSnapshot,
  right: CoreBpmnSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
