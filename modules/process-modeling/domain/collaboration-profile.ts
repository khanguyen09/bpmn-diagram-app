import type {
  BpmnInspectionIssue,
  CoreBpmnEdge,
  CoreBpmnElement,
  CoreBpmnShape,
} from "./core-profile";
import { inspectConditionalRouting } from "./conditional-routing";
import { inspectEventRouting } from "./event-routing";
import { inspectTaskAndBoundaryEvents } from "./task-and-boundary-events";
import {
  inspectFullAuthoringArtifacts,
  projectFullAuthoringOutlineArtifacts,
} from "./full-authoring";
import { inspectAdvancedActivities } from "./advanced-activities";
import { inspectDataAuthoring } from "./data-authoring";
import { inspectComplexRouting } from "./complex-routing";

export const collaborationBpmnProfile = {
  id: "teb-collaboration-starter@1",
  label: "TEB BPMN Collaboration Starter v1",
  semanticTypes: [
    "bpmn:Collaboration",
    "bpmn:Participant",
    "bpmn:Process",
    "bpmn:LaneSet",
    "bpmn:Lane",
    "bpmn:StartEvent",
    "bpmn:Task",
    "bpmn:ExclusiveGateway",
    "bpmn:EndEvent",
    "bpmn:SequenceFlow",
    "bpmn:MessageFlow",
  ],
} as const;

export const collaborationNestedBpmnProfile = {
  ...collaborationBpmnProfile,
  id: "teb-collaboration-starter@2",
  label: "TEB BPMN Collaboration Nested v2",
} as const;

export const collaborationStructuredBpmnProfile = {
  ...collaborationNestedBpmnProfile,
  id: "teb-collaboration-structured@1",
  label: "TEB BPMN Collaboration Structured Routing v1",
  semanticTypes: [
    ...collaborationNestedBpmnProfile.semanticTypes,
    "bpmn:ParallelGateway",
  ],
} as const;

export const collaborationConditionalBpmnProfile = {
  ...collaborationStructuredBpmnProfile,
  id: "teb-collaboration-conditional@1",
  label: "TEB BPMN Collaboration Conditional Routing v1",
  semanticTypes: [
    ...collaborationStructuredBpmnProfile.semanticTypes,
    "bpmn:InclusiveGateway",
  ],
} as const;

export const collaborationCatchingEventsBpmnProfile = {
  ...collaborationConditionalBpmnProfile,
  id: "teb-collaboration-catching-events@1",
  label: "TEB BPMN Collaboration Catching Events v1",
  semanticTypes: [
    ...collaborationConditionalBpmnProfile.semanticTypes,
    "bpmn:IntermediateCatchEvent",
    "bpmn:MessageEventDefinition",
    "bpmn:TimerEventDefinition",
    "bpmn:ReceiveTask",
    "bpmn:Message",
  ],
} as const;

export const collaborationEventRoutingBpmnProfile = {
  ...collaborationCatchingEventsBpmnProfile,
  id: "teb-collaboration-event-routing@1",
  label: "TEB BPMN Collaboration Event Routing v1",
  semanticTypes: [
    ...collaborationCatchingEventsBpmnProfile.semanticTypes,
    "bpmn:EventBasedGateway",
  ],
} as const;

export const collaborationTaskTypesBpmnProfile = {
  ...collaborationEventRoutingBpmnProfile,
  id: "teb-collaboration-task-types@1",
  label: "TEB BPMN Collaboration Task Types v1",
  semanticTypes: [
    ...collaborationEventRoutingBpmnProfile.semanticTypes,
    "bpmn:UserTask",
    "bpmn:ServiceTask",
    "bpmn:ManualTask",
  ],
} as const;

export const collaborationIntermediateEventsBpmnProfile = {
  ...collaborationTaskTypesBpmnProfile,
  id: "teb-collaboration-intermediate-events@1",
  label: "TEB BPMN Collaboration Intermediate Events v1",
  semanticTypes: [
    ...collaborationTaskTypesBpmnProfile.semanticTypes,
    "bpmn:IntermediateThrowEvent",
  ],
} as const;

export const collaborationBoundaryEventsBpmnProfile = {
  ...collaborationIntermediateEventsBpmnProfile,
  id: "teb-collaboration-boundary-events@1",
  label: "TEB BPMN Collaboration Boundary Events v1",
  semanticTypes: [
    ...collaborationIntermediateEventsBpmnProfile.semanticTypes,
    "bpmn:BoundaryEvent",
  ],
} as const;

export const collaborationFullAuthoringBpmnProfile = {
  ...collaborationBoundaryEventsBpmnProfile,
  id: "teb-collaboration-full-authoring@1",
  label: "TEB BPMN Collaboration Full Authoring v1",
  semanticTypes: [
    ...collaborationBoundaryEventsBpmnProfile.semanticTypes,
    "bpmn:TextAnnotation",
    "bpmn:Association",
    "bpmn:Group",
    "bpmn:Category",
    "bpmn:CategoryValue",
  ],
} as const;

export const collaborationActivityContainersBpmnProfile = {
  ...collaborationFullAuthoringBpmnProfile,
  id: "teb-collaboration-activity-containers@1",
  label: "TEB BPMN Collaboration Activity Containers v1",
  semanticTypes: [
    ...collaborationFullAuthoringBpmnProfile.semanticTypes,
    "bpmn:SubProcess",
    "bpmn:CallActivity",
  ],
} as const;

export const collaborationDataAuthoringBpmnProfile = {
  ...collaborationActivityContainersBpmnProfile,
  id: "teb-collaboration-data-authoring@1",
  label: "TEB BPMN Collaboration Data Authoring v1",
  semanticTypes: [
    ...collaborationActivityContainersBpmnProfile.semanticTypes,
    "bpmn:DataObject",
    "bpmn:DataObjectReference",
    "bpmn:DataStore",
    "bpmn:DataStoreReference",
    "bpmn:DataInputAssociation",
    "bpmn:DataOutputAssociation",
  ],
} as const;

export const collaborationComplexRoutingBpmnProfile = {
  ...collaborationDataAuthoringBpmnProfile,
  id: "teb-collaboration-complex-routing@1",
  label: "TEB BPMN Collaboration Complex Routing v1",
  semanticTypes: [
    ...collaborationDataAuthoringBpmnProfile.semanticTypes,
    "bpmn:ComplexGateway",
  ],
} as const;

export const collaborationSwimlaneLayoutsBpmnProfile = {
  ...collaborationComplexRoutingBpmnProfile,
  id: "teb-collaboration-swimlane-layouts@1",
  label: "TEB BPMN Collaboration Swimlane Layouts v1",
} as const;

export const collaborationSubprocessTimersBpmnProfile = {
  ...collaborationSwimlaneLayoutsBpmnProfile,
  id: "teb-collaboration-subprocess-timers@1",
  label: "TEB BPMN Collaboration Subprocess Timers v1",
} as const;

export const supportedCollaborationBpmnProfiles = [
  collaborationBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationStructuredBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationCatchingEventsBpmnProfile,
  collaborationEventRoutingBpmnProfile,
  collaborationTaskTypesBpmnProfile,
  collaborationIntermediateEventsBpmnProfile,
  collaborationBoundaryEventsBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  collaborationActivityContainersBpmnProfile,
  collaborationDataAuthoringBpmnProfile,
  collaborationComplexRoutingBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
  collaborationSubprocessTimersBpmnProfile,
] as const;

export type CollaborationBpmnProfileId =
  (typeof supportedCollaborationBpmnProfiles)[number]["id"];

export function isCollaborationBpmnProfileId(
  value: unknown,
): value is CollaborationBpmnProfileId {
  return supportedCollaborationBpmnProfiles.some(
    (profile) => profile.id === value,
  );
}

export function isCollaborationStructuredBpmnProfileId(
  value: unknown,
): value is typeof collaborationStructuredBpmnProfile.id {
  return value === collaborationStructuredBpmnProfile.id;
}

export function isCollaborationConditionalBpmnProfileId(
  value: unknown,
): value is typeof collaborationConditionalBpmnProfile.id {
  return value === collaborationConditionalBpmnProfile.id;
}

export function isCollaborationCatchingEventsBpmnProfileId(
  value: unknown,
): value is typeof collaborationCatchingEventsBpmnProfile.id {
  return value === collaborationCatchingEventsBpmnProfile.id;
}

export function isCollaborationEventRoutingBpmnProfileId(
  value: unknown,
): value is typeof collaborationEventRoutingBpmnProfile.id {
  return value === collaborationEventRoutingBpmnProfile.id;
}

export function isCollaborationTaskTypesBpmnProfileId(
  value: unknown,
): value is typeof collaborationTaskTypesBpmnProfile.id {
  return value === collaborationTaskTypesBpmnProfile.id;
}

export function isCollaborationIntermediateEventsBpmnProfileId(
  value: unknown,
): value is typeof collaborationIntermediateEventsBpmnProfile.id {
  return value === collaborationIntermediateEventsBpmnProfile.id;
}

export function isCollaborationBoundaryEventsBpmnProfileId(
  value: unknown,
): value is typeof collaborationBoundaryEventsBpmnProfile.id {
  return value === collaborationBoundaryEventsBpmnProfile.id;
}

export function isCollaborationFullAuthoringBpmnProfileId(
  value: unknown,
): value is typeof collaborationFullAuthoringBpmnProfile.id {
  return value === collaborationFullAuthoringBpmnProfile.id;
}

export function isCollaborationActivityContainersBpmnProfileId(
  value: unknown,
): value is typeof collaborationActivityContainersBpmnProfile.id {
  return value === collaborationActivityContainersBpmnProfile.id;
}

export function isCollaborationDataAuthoringBpmnProfileId(
  value: unknown,
): value is typeof collaborationDataAuthoringBpmnProfile.id {
  return value === collaborationDataAuthoringBpmnProfile.id;
}

export function isCollaborationComplexRoutingBpmnProfileId(
  value: unknown,
): value is typeof collaborationComplexRoutingBpmnProfile.id {
  return value === collaborationComplexRoutingBpmnProfile.id;
}

export function isCollaborationSwimlaneLayoutsBpmnProfileId(
  value: unknown,
): value is typeof collaborationSwimlaneLayoutsBpmnProfile.id {
  return value === collaborationSwimlaneLayoutsBpmnProfile.id;
}

export function supportsSwimlaneLayouts(value: unknown): boolean {
  return isCollaborationSwimlaneLayoutsBpmnProfileId(value) ||
    value === collaborationSubprocessTimersBpmnProfile.id;
}

export function supportsCollaborationActivityContainers(value: unknown): boolean {
  return (
    isCollaborationActivityContainersBpmnProfileId(value) ||
    isCollaborationDataAuthoringBpmnProfileId(value) ||
    isCollaborationComplexRoutingBpmnProfileId(value) ||
    supportsSwimlaneLayouts(value)
  );
}

export function supportsCollaborationDataAuthoring(value: unknown): boolean {
  return (
    isCollaborationDataAuthoringBpmnProfileId(value) ||
    isCollaborationComplexRoutingBpmnProfileId(value) ||
    supportsSwimlaneLayouts(value)
  );
}

export function supportsCollaborationComplexRouting(value: unknown): boolean {
  return (
    isCollaborationComplexRoutingBpmnProfileId(value) ||
    supportsSwimlaneLayouts(value)
  );
}

export function supportsNestedLanes(value: unknown): boolean {
  return (
    isCollaborationBpmnProfileId(value) &&
    value !== collaborationBpmnProfile.id
  );
}

export function canTransitionCollaborationBpmnProfile(
  current: CollaborationBpmnProfileId,
  candidate: CollaborationBpmnProfileId,
) {
  return (
    current === candidate ||
    (current === collaborationBpmnProfile.id &&
      candidate === collaborationNestedBpmnProfile.id) ||
    ((current === collaborationBpmnProfile.id ||
      current === collaborationNestedBpmnProfile.id) &&
      candidate === collaborationStructuredBpmnProfile.id) ||
    (current === collaborationStructuredBpmnProfile.id &&
      candidate === collaborationConditionalBpmnProfile.id) ||
    (current === collaborationConditionalBpmnProfile.id &&
      candidate === collaborationCatchingEventsBpmnProfile.id) ||
    (current === collaborationCatchingEventsBpmnProfile.id &&
      candidate === collaborationEventRoutingBpmnProfile.id) ||
    (current === collaborationEventRoutingBpmnProfile.id &&
      candidate === collaborationTaskTypesBpmnProfile.id) ||
    (current === collaborationTaskTypesBpmnProfile.id &&
      candidate === collaborationIntermediateEventsBpmnProfile.id) ||
    (current === collaborationIntermediateEventsBpmnProfile.id &&
      candidate === collaborationBoundaryEventsBpmnProfile.id) ||
    (current === collaborationBoundaryEventsBpmnProfile.id &&
      candidate === collaborationFullAuthoringBpmnProfile.id) ||
    (current === collaborationFullAuthoringBpmnProfile.id &&
      candidate === collaborationActivityContainersBpmnProfile.id) ||
    (current === collaborationActivityContainersBpmnProfile.id &&
      candidate === collaborationDataAuthoringBpmnProfile.id) ||
    (current === collaborationDataAuthoringBpmnProfile.id &&
      candidate === collaborationComplexRoutingBpmnProfile.id) ||
    (current === collaborationComplexRoutingBpmnProfile.id &&
      candidate === collaborationSwimlaneLayoutsBpmnProfile.id) ||
    (current === collaborationSwimlaneLayoutsBpmnProfile.id &&
      candidate === collaborationSubprocessTimersBpmnProfile.id)
  );
}

export interface CollaborationParticipant {
  readonly id: string;
  readonly name?: string;
  readonly processId?: string;
}

export interface CollaborationLane {
  readonly id: string;
  readonly name?: string;
  readonly participantId: string;
  readonly processId: string;
  readonly parentLaneId?: string;
  readonly depth?: number;
  readonly flowNodeIds: readonly string[];
}

export interface CollaborationBpmnSnapshot {
  readonly profileId: CollaborationBpmnProfileId;
  readonly collaborationId?: string;
  readonly planeElementId?: string;
  readonly planeCount: number;
  readonly elements: readonly CoreBpmnElement[];
  readonly participants: readonly CollaborationParticipant[];
  readonly lanes: readonly CollaborationLane[];
  readonly shapes: readonly CoreBpmnShape[];
  readonly edges: readonly CoreBpmnEdge[];
}

const starterFlowNodeTypes = [
  "bpmn:StartEvent",
  "bpmn:Task",
  "bpmn:ExclusiveGateway",
  "bpmn:EndEvent",
] as const;
export const maxCollaborationLaneDepth = 1;

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

function reachable(
  seeds: readonly string[],
  graph: ReadonlyMap<string, readonly string[]>,
) {
  const found = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of graph.get(current) ?? []) {
      if (!found.has(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return found;
}

export function inspectCollaborationSnapshot(
  snapshot: CollaborationBpmnSnapshot,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const activityContainers =
    supportsCollaborationActivityContainers(snapshot.profileId);
  const dataAuthoring =
    supportsCollaborationDataAuthoring(snapshot.profileId);
  const complexRouting =
    supportsCollaborationComplexRouting(snapshot.profileId);
  const fullAuthoring =
    isCollaborationFullAuthoringBpmnProfileId(snapshot.profileId) ||
    activityContainers;
  const conditional =
    isCollaborationConditionalBpmnProfileId(snapshot.profileId) ||
    isCollaborationCatchingEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationEventRoutingBpmnProfileId(snapshot.profileId) ||
    isCollaborationTaskTypesBpmnProfileId(snapshot.profileId) ||
    isCollaborationIntermediateEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const catching =
    isCollaborationCatchingEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationEventRoutingBpmnProfileId(snapshot.profileId) ||
    isCollaborationTaskTypesBpmnProfileId(snapshot.profileId) ||
    isCollaborationIntermediateEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const eventRouting =
    isCollaborationEventRoutingBpmnProfileId(snapshot.profileId) ||
    isCollaborationTaskTypesBpmnProfileId(snapshot.profileId) ||
    isCollaborationIntermediateEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const taskTypes =
    isCollaborationTaskTypesBpmnProfileId(snapshot.profileId) ||
    isCollaborationIntermediateEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const intermediateEvents =
    isCollaborationIntermediateEventsBpmnProfileId(snapshot.profileId) ||
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const boundaryEvents =
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const structured =
    isCollaborationStructuredBpmnProfileId(snapshot.profileId) || conditional;
  const flowNodeTypes = new Set<string>([
    ...starterFlowNodeTypes,
    ...(structured
      ? ["bpmn:ParallelGateway"]
      : []),
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
  const allowedTypes = new Set<string>(
    complexRouting
      ? collaborationComplexRoutingBpmnProfile.semanticTypes
      : dataAuthoring
        ? collaborationDataAuthoringBpmnProfile.semanticTypes
        : activityContainers
          ? collaborationActivityContainersBpmnProfile.semanticTypes
          : fullAuthoring
      ? collaborationFullAuthoringBpmnProfile.semanticTypes
      : boundaryEvents
      ? collaborationBoundaryEventsBpmnProfile.semanticTypes
      : intermediateEvents
        ? collaborationIntermediateEventsBpmnProfile.semanticTypes
        : taskTypes
          ? collaborationTaskTypesBpmnProfile.semanticTypes
          : eventRouting
            ? collaborationEventRoutingBpmnProfile.semanticTypes
      : catching
        ? collaborationCatchingEventsBpmnProfile.semanticTypes
        : conditional
          ? collaborationConditionalBpmnProfile.semanticTypes
          : structured
            ? collaborationStructuredBpmnProfile.semanticTypes
            : collaborationBpmnProfile.semanticTypes,
  );
  const elementsById = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const participantByProcess = new Map<string, string>();

  if (!snapshot.collaborationId) {
    issues.push(issue(
      "BPMN-COLLAB-001",
      "Collaboration profile cần đúng một Collaboration root.",
      "Tạo một Collaboration chứa các Pool.",
      "fatal",
    ));
  }
  if (
    snapshot.collaborationId &&
    snapshot.planeElementId !== snapshot.collaborationId
  ) {
    issues.push(issue(
      "BPMN-COLLAB-DI-001",
      "BPMNPlane phải tham chiếu Collaboration root.",
      "Export lại diagram với Collaboration làm plane root.",
      "fatal",
      snapshot.collaborationId,
    ));
  }
  if (snapshot.planeCount !== 1) {
    issues.push(issue(
      "BPMN-COLLAB-DI-004",
      "Collaboration profile cần đúng một BPMNPlane.",
      "Giữ một diagram plane duy nhất cho Collaboration.",
      "fatal",
      snapshot.collaborationId,
    ));
  }
  if (snapshot.participants.length < 2) {
    issues.push(issue(
      "BPMN-COLLAB-002",
      "Collaboration cần ít nhất hai Pool để hoàn tất.",
      "Thêm Pool thứ hai trước khi tạo version.",
      "recoverable",
    ));
  }

  for (const element of snapshot.elements) {
    if (!allowedTypes.has(element.type)) {
      issues.push(issue(
        "BPMN-PROFILE-003",
        `Phần tử ${element.type} nằm ngoài Collaboration Starter.`,
        "Chỉ dùng Pool, Lane, Core flow node, Sequence Flow và Message Flow.",
        "fatal",
        element.id,
      ));
    }
    if (
      [
        "bpmn:Lane",
        "bpmn:Task",
        "bpmn:ExclusiveGateway",
        "bpmn:ParallelGateway",
        "bpmn:InclusiveGateway",
        "bpmn:IntermediateCatchEvent",
        "bpmn:ReceiveTask",
        "bpmn:EventBasedGateway",
        "bpmn:UserTask",
        "bpmn:ServiceTask",
        "bpmn:ManualTask",
        "bpmn:IntermediateThrowEvent",
        "bpmn:BoundaryEvent",
        "bpmn:MessageFlow",
      ].includes(element.type) &&
      !element.name?.trim()
    ) {
      issues.push(issue(
        "BPMN-COLLAB-NAME-002",
        "Phần tử Collaboration chưa có tên dễ hiểu.",
        "Đặt tên phản ánh vai trò, hành động hoặc thông điệp.",
        "recoverable",
        element.id,
      ));
    }
  }

  for (const participant of snapshot.participants) {
    if (!participant.name?.trim()) {
      issues.push(issue(
        "BPMN-COLLAB-NAME-001",
        "Pool chưa có tên dễ hiểu.",
        "Đặt tên tổ chức, vai trò hoặc hệ thống cho Pool.",
        "recoverable",
        participant.id,
      ));
    }
    if (participant.processId) {
      if (participantByProcess.has(participant.processId)) {
        issues.push(issue(
          "BPMN-COLLAB-REF-002",
          "Một Process được nhiều Pool cùng tham chiếu.",
          "Mỗi Process chỉ thuộc một Pool.",
          "fatal",
          participant.id,
        ));
      }
      participantByProcess.set(participant.processId, participant.id);
      const process = elementsById.get(participant.processId);
      if (!process || process.type !== "bpmn:Process") {
        issues.push(issue(
          "BPMN-COLLAB-REF-001",
          "Pool tham chiếu Process không tồn tại.",
          "Gắn Pool với một Process hợp lệ hoặc chuyển thành black-box Pool.",
          "fatal",
          participant.id,
        ));
      }
    }
  }

  for (const process of snapshot.elements.filter(
    (element) => element.type === "bpmn:Process",
  )) {
    if (!participantByProcess.has(process.id) && !activityContainers) {
      issues.push(issue(
        "BPMN-COLLAB-REF-003",
        "Process không thuộc Pool nào.",
        "Gắn Process với đúng một Participant.",
        "fatal",
        process.id,
      ));
    }
  }

  for (const gateway of snapshot.elements.filter(
    (element) => element.type === "bpmn:ParallelGateway",
  )) {
    const incoming = gateway.incoming.length;
    const outgoing = gateway.outgoing.length;
    if (incoming > 1 && outgoing > 1) {
      issues.push(issue(
        "BPMN-PAR-002",
        "Parallel Gateway không được vừa join vừa split trong Structured Routing.",
        "Tách thành một Parallel join và một Parallel split riêng.",
        "fatal",
        gateway.id,
      ));
    } else if (
      !(
        (incoming === 1 && outgoing >= 2) ||
        (incoming >= 2 && outgoing === 1)
      )
    ) {
      issues.push(issue(
        "BPMN-PAR-001",
        "Parallel Gateway đang xây dở hoặc chưa tạo split/join hợp lệ.",
        "Dùng một incoming và ít nhất hai outgoing cho split, hoặc ngược lại cho join.",
        "recoverable",
        gateway.id,
      ));
    }
  }

  issues.push(...inspectConditionalRouting(snapshot.elements, conditional));
  issues.push(
    ...inspectEventRouting(snapshot.elements, catching, eventRouting),
  );
  if (fullAuthoring) {
    issues.push(
      ...inspectFullAuthoringArtifacts(snapshot, snapshot.participants),
    );
  }
  if (activityContainers) {
    issues.push(
      ...inspectAdvancedActivities(
        snapshot,
        snapshot.participants.flatMap((participant) =>
          participant.processId ? [participant.processId] : [],
        ),
      ),
    );
  }
  if (dataAuthoring) issues.push(...inspectDataAuthoring(snapshot));
  if (complexRouting) {
    issues.push(...inspectComplexRouting(snapshot.elements));
  }
  issues.push(
    ...inspectTaskAndBoundaryEvents(
      snapshot.elements,
      taskTypes,
      intermediateEvents,
      boundaryEvents,
      snapshot.profileId === collaborationSubprocessTimersBpmnProfile.id,
    ),
  );

  const laneById = new Map(
    snapshot.lanes.map((lane) => [lane.id, lane] as const),
  );
  const childrenByLane = new Map<string, CollaborationLane[]>();
  for (const lane of snapshot.lanes) {
    if (lane.parentLaneId) {
      childrenByLane.set(lane.parentLaneId, [
        ...(childrenByLane.get(lane.parentLaneId) ?? []),
        lane,
      ]);
    }
  }
  const membershipByNode = new Map<string, CollaborationLane[]>();
  for (const lane of snapshot.lanes) {
    if (
      snapshot.profileId === collaborationBpmnProfile.id &&
      lane.parentLaneId
    ) {
      issues.push(issue(
        "BPMN-LANE-005",
        "Collaboration Starter v1 không hỗ trợ nested Lane.",
        "Nâng model lên Collaboration Nested v2 trước khi chia Lane con.",
        "fatal",
        lane.id,
      ));
    }
    if (
      snapshot.profileId !== collaborationBpmnProfile.id &&
      (lane.depth ?? 0) > maxCollaborationLaneDepth
    ) {
      issues.push(issue(
        "BPMN-LANE-006",
        "Lane vượt quá hai cấp được hỗ trợ trong Collaboration Nested v2.",
        "Giữ tối đa Lane cấp 1 và Lane con cấp 2.",
        "fatal",
        lane.id,
      ));
    }
    if (lane.parentLaneId) {
      const parent = laneById.get(lane.parentLaneId);
      if (
        !parent ||
        parent.processId !== lane.processId ||
        parent.participantId !== lane.participantId ||
        (parent.depth ?? 0) + 1 !== (lane.depth ?? 0)
      ) {
        issues.push(issue(
          "BPMN-LANE-007",
          "Lane con không thuộc đúng parent Lane/Process/Pool.",
          "Sửa childLaneSet để tạo một ownership chain hợp lệ.",
          "fatal",
          lane.id,
        ));
      }
    } else if ((lane.depth ?? 0) !== 0) {
      issues.push(issue(
        "BPMN-LANE-007",
        "Top-level Lane có depth không hợp lệ.",
        "Đặt top-level Lane trực tiếp trong LaneSet của Process.",
        "fatal",
        lane.id,
      ));
    }
    if (!participantByProcess.has(lane.processId)) {
      issues.push(issue(
        "BPMN-LANE-001",
        "Lane không thuộc Process/Pool hợp lệ.",
        "Đặt Lane trong LaneSet của white-box Pool.",
        "fatal",
        lane.id,
      ));
    }
    for (const nodeId of lane.flowNodeIds) {
      const node = elementsById.get(nodeId);
      if (
        !node ||
        !flowNodeTypes.has(node.type) ||
        node.processId !== lane.processId
      ) {
        issues.push(issue(
          "BPMN-LANE-002",
          "Lane tham chiếu FlowNode không tồn tại hoặc thuộc Process khác.",
          "Chỉ gán node của cùng Process vào Lane.",
          "fatal",
          lane.id,
        ));
      }
      membershipByNode.set(nodeId, [
        ...(membershipByNode.get(nodeId) ?? []),
        lane,
      ]);
    }
  }

  const effectiveLaneByNode = new Map<string, CollaborationLane>();
  for (const [nodeId, memberships] of membershipByNode) {
    const deepestDepth = Math.max(
      ...memberships.map((lane) => lane.depth ?? 0),
    );
    const deepest = memberships.filter(
      (lane) => (lane.depth ?? 0) === deepestDepth,
    );
    if (deepest.length !== 1) {
      issues.push(issue(
        "BPMN-LANE-003",
        "FlowNode được gán vào nhiều nhánh Lane.",
        "Giữ một ownership path duy nhất cho mỗi node.",
        "fatal",
        nodeId,
      ));
      continue;
    }
    const effective = deepest[0]!;
    const membershipIds = new Set(memberships.map((lane) => lane.id));
    let ancestorId = effective.parentLaneId;
    let brokenPath = false;
    while (ancestorId) {
      if (!membershipIds.has(ancestorId)) brokenPath = true;
      ancestorId = laneById.get(ancestorId)?.parentLaneId;
    }
    if (
      brokenPath ||
      memberships.some(
        (lane) =>
          lane.id !== effective.id &&
          !isLaneAncestor(lane.id, effective, laneById),
      )
    ) {
      issues.push(issue(
        "BPMN-LANE-003",
        "FlowNode có Lane references không tạo thành một ancestor chain.",
        "Giữ references trên đúng một nhánh Lane từ parent đến leaf.",
        "fatal",
        nodeId,
      ));
      continue;
    }
    effectiveLaneByNode.set(nodeId, effective);
    if (
      snapshot.profileId !== collaborationBpmnProfile.id &&
      (childrenByLane.get(effective.id)?.length ?? 0) > 0
    ) {
      issues.push(issue(
        "BPMN-LANE-008",
        "FlowNode chưa được gán tới leaf Lane sâu nhất.",
        "Di chuyển node vào một Lane con để hoàn tất ownership path.",
        "fatal",
        nodeId,
      ));
    }
  }

  for (const process of snapshot.elements.filter(
    (element) => element.type === "bpmn:Process",
  )) {
    if (activityContainers && !participantByProcess.has(process.id)) continue;
    const processLanes = snapshot.lanes.filter(
      (lane) => lane.processId === process.id,
    );
    const nodes = snapshot.elements.filter(
      (element) => flowNodeTypes.has(element.type) && element.processId === process.id,
    );
    const laneAssignableNodes = nodes.filter(
      (element) => element.parentContainerId === process.id ||
        element.parentContainerId === undefined,
    );
    if (processLanes.length) {
      for (const node of laneAssignableNodes) {
        if (!effectiveLaneByNode.has(node.id)) {
          issues.push(issue(
            "BPMN-LANE-004",
            "FlowNode chưa được gán vào Lane của Process.",
            "Kéo node vào một Lane trước khi tạo version.",
            "recoverable",
            node.id,
          ));
        }
      }
    }

    const sequenceFlows = snapshot.elements.filter(
      (element) =>
        element.type === "bpmn:SequenceFlow" && element.processId === process.id,
    );
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    for (const flow of sequenceFlows) {
      const source = flow.sourceId ? elementsById.get(flow.sourceId) : undefined;
      const target = flow.targetId ? elementsById.get(flow.targetId) : undefined;
      if (
        !source ||
        !target ||
        !flowNodeTypes.has(source.type) ||
        !flowNodeTypes.has(target.type)
      ) {
        issues.push(issue(
          "BPMN-REF-001",
          "Sequence Flow có endpoint không hợp lệ.",
          "Nối lại Sequence Flow giữa hai FlowNode.",
          "fatal",
          flow.id,
        ));
        continue;
      }
      if (
        source.processId !== process.id ||
        target.processId !== process.id
      ) {
        issues.push(issue(
          "BPMN-COLLAB-FLOW-001",
          "Sequence Flow không được vượt qua ranh giới Pool.",
          "Dùng Message Flow để giao tiếp giữa hai Pool.",
          "fatal",
          flow.id,
        ));
      }
      outgoing.set(source.id, [...(outgoing.get(source.id) ?? []), target.id]);
      incoming.set(target.id, [...(incoming.get(target.id) ?? []), source.id]);
    }
    for (const boundary of nodes.filter(
      (node) =>
        node.type === "bpmn:BoundaryEvent" &&
        node.attachedToId !== undefined,
    )) {
      outgoing.set(boundary.attachedToId!, [
        ...(outgoing.get(boundary.attachedToId!) ?? []),
        boundary.id,
      ]);
    }
    const starts = nodes.filter((node) => node.type === "bpmn:StartEvent");
    const ends = nodes.filter((node) => node.type === "bpmn:EndEvent");
    if (!starts.length || !ends.length) {
      issues.push(issue(
        "BPMN-CONNECT-001",
        "White-box Pool cần Start Event và End Event.",
        "Bổ sung đường đi hoàn chỉnh từ Start đến End.",
        "recoverable",
        process.id,
      ));
    } else {
      const fromStart = reachable(starts.map((node) => node.id), outgoing);
      const toEnd = reachable(ends.map((node) => node.id), incoming);
      for (const node of nodes) {
        if (!fromStart.has(node.id) || !toEnd.has(node.id)) {
          issues.push(issue(
            "BPMN-CONNECT-003",
            "FlowNode không nằm trên đường đi hoàn chỉnh từ Start đến End.",
            "Kết nối node vào đường đi hoàn chỉnh của Pool.",
            "recoverable",
            node.id,
          ));
        }
      }
    }
  }

  const participantForEndpoint = (elementId: string | undefined) => {
    if (!elementId) return undefined;
    const participant = snapshot.participants.find((item) => item.id === elementId);
    if (participant) return participant.id;
    const element = elementsById.get(elementId);
    return element && flowNodeTypes.has(element.type)
      ? element.participantId
      : undefined;
  };
  const messageFlows = snapshot.elements.filter(
    (element) => element.type === "bpmn:MessageFlow",
  );
  if (!messageFlows.length) {
    issues.push(issue(
      "BPMN-MESSAGE-003",
      "Collaboration chưa có Message Flow.",
      "Nối hai Pool khác nhau bằng Message Flow trước khi tạo version.",
      "recoverable",
    ));
  }
  for (const flow of messageFlows) {
    const sourceParticipant = participantForEndpoint(flow.sourceId);
    const targetParticipant = participantForEndpoint(flow.targetId);
    if (!sourceParticipant || !targetParticipant) {
      issues.push(issue(
        "BPMN-MESSAGE-001",
        "Message Flow có endpoint không tồn tại hoặc không thuộc Pool.",
        "Chọn Participant hoặc FlowNode hợp lệ ở mỗi đầu.",
        "fatal",
        flow.id,
      ));
    } else if (sourceParticipant === targetParticipant) {
      issues.push(issue(
        "BPMN-MESSAGE-002",
        "Message Flow phải nối hai Pool khác nhau.",
        "Dùng Sequence Flow cho luồng nội bộ trong cùng Pool.",
        "fatal",
        flow.id,
      ));
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
      issues.push(issue(
        "BPMN-DI-003",
        "BPMNShape có bounds không hữu hạn hoặc không dương.",
        "Dùng bounds hữu hạn và lớn hơn 0.",
        "fatal",
        shape.elementId,
      ));
    }
  }
  if (shapeIds.size !== snapshot.shapes.length) {
    issues.push(issue(
      "BPMN-COLLAB-DI-005",
      "Một semantic element có nhiều BPMNShape.",
      "Giữ đúng một DI shape cho mỗi Pool, Lane và FlowNode.",
      "fatal",
    ));
  }
  const shapeById = new Map(
    snapshot.shapes.map((shape) => [shape.elementId, shape] as const),
  );
  for (const [parentLaneId, children] of childrenByLane) {
    for (let leftIndex = 0; leftIndex < children.length; leftIndex += 1) {
      const left = shapeById.get(children[leftIndex]!.id);
      if (!left) continue;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < children.length;
        rightIndex += 1
      ) {
        const right = shapeById.get(children[rightIndex]!.id);
        if (
          right &&
          left.x < right.x + right.width &&
          left.x + left.width > right.x &&
          left.y < right.y + right.height &&
          left.y + left.height > right.y
        ) {
          issues.push(issue(
            "BPMN-LANE-DI-002",
            "Các Lane con cùng parent bị chồng lấn.",
            "Resize các Lane con để không có vùng giao nhau.",
            "fatal",
            parentLaneId,
          ));
        }
      }
    }
  }
  for (const [nodeId, lane] of effectiveLaneByNode) {
    const nodeShape = shapeById.get(nodeId);
    const laneShape = shapeById.get(lane.id);
    if (!nodeShape || !laneShape) continue;
    const centerX = nodeShape.x + nodeShape.width / 2;
    const centerY = nodeShape.y + nodeShape.height / 2;
    if (
      centerX <= laneShape.x ||
      centerX >= laneShape.x + laneShape.width ||
      centerY <= laneShape.y ||
      centerY >= laneShape.y + laneShape.height
    ) {
      issues.push(issue(
        "BPMN-LANE-DI-003",
        "FlowNode nằm ngoài effective leaf Lane.",
        "Di chuyển node vào đúng Lane semantic sở hữu.",
        "fatal",
        nodeId,
      ));
    }
  }
  for (const participant of snapshot.participants) {
    const participantShape = shapeById.get(participant.id);
    const swimlaneLayouts = supportsSwimlaneLayouts(snapshot.profileId);
    if (
      !swimlaneLayouts &&
      participantShape &&
      participantShape.width <= participantShape.height
    ) {
      issues.push(issue(
        "BPMN-COLLAB-DI-006",
        "Collaboration Starter v1 chỉ hỗ trợ Pool nằm ngang.",
        "Đổi Pool sang layout ngang trước khi lưu.",
        "fatal",
        participant.id,
      ));
    }
    if (
      swimlaneLayouts &&
      participantShape &&
      typeof participantShape.isHorizontal !== "boolean"
    ) {
      issues.push(issue(
        "BPMN-COLLAB-DI-007",
        "Pool chưa khai báo orientation BPMNDI tường minh.",
        "Đặt isHorizontal=true hoặc false trên BPMNShape của Participant.",
        "fatal",
        participant.id,
      ));
    }
    const participantLanes = snapshot.lanes.filter(
      (candidate) => candidate.participantId === participant.id,
    );
    if (swimlaneLayouts && participantShape) {
      const siblingGroups = new Map<string, CollaborationLane[]>();
      for (const lane of participantLanes) {
        const ownerId = lane.parentLaneId ?? participant.id;
        const siblings = siblingGroups.get(ownerId) ?? [];
        siblings.push(lane);
        siblingGroups.set(ownerId, siblings);
      }
      for (const [ownerId, siblings] of siblingGroups) {
        for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
          const left = shapeById.get(siblings[leftIndex]!.id);
          if (!left) continue;
          for (
            let rightIndex = leftIndex + 1;
            rightIndex < siblings.length;
            rightIndex += 1
          ) {
            const right = shapeById.get(siblings[rightIndex]!.id);
            if (!right) continue;
            const crossAxisAligned = participantShape.isHorizontal
              ? left.x === right.x && left.width === right.width
              : left.y === right.y && left.height === right.height;
            const interiorsOverlap =
              left.x < right.x + right.width &&
              left.x + left.width > right.x &&
              left.y < right.y + right.height &&
              left.y + left.height > right.y;
            if (!crossAxisAligned || interiorsOverlap) {
              issues.push(issue(
                "BPMN-LANE-DI-005",
                "Các Lane cùng cấp không chia đúng theo trục của owning Pool.",
                participantShape.isHorizontal
                  ? "Xếp Lane ngang theo trục Y với cùng x/width."
                  : "Xếp Lane dọc theo trục X với cùng y/height.",
                "fatal",
                ownerId,
              ));
            }
          }
        }
      }
    }
    for (const lane of participantLanes) {
      const laneShape = shapeById.get(lane.id);
      const ownerShape = lane.parentLaneId
        ? shapeById.get(lane.parentLaneId)
        : participantShape;
      if (
        ownerShape &&
        laneShape &&
        (laneShape.x < ownerShape.x ||
          laneShape.y < ownerShape.y ||
          laneShape.x + laneShape.width >
            ownerShape.x + ownerShape.width ||
          laneShape.y + laneShape.height >
            ownerShape.y + ownerShape.height)
      ) {
        issues.push(issue(
          "BPMN-LANE-DI-001",
          "Lane DI nằm ngoài bounds của semantic owner.",
          "Đặt Lane hoàn toàn bên trong parent Lane hoặc Participant.",
          "fatal",
          lane.id,
        ));
      }
      if (
        swimlaneLayouts &&
        laneShape &&
        (typeof laneShape.isHorizontal !== "boolean" ||
          laneShape.isHorizontal !== participantShape?.isHorizontal)
      ) {
        issues.push(issue(
          "BPMN-LANE-DI-004",
          "Lane tree có orientation thiếu hoặc khác owning Pool.",
          "Giữ cùng isHorizontal cho Participant và mọi Lane trong tree.",
          "fatal",
          lane.id,
        ));
      }
    }
  }
  for (const edge of snapshot.edges) {
    if (
      edge.waypoints.length < 2 ||
      edge.waypoints.some(
        (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
      )
    ) {
      issues.push(issue(
        "BPMN-DI-004",
        "BPMNEdge cần ít nhất hai waypoint hữu hạn.",
        "Sửa geometry của connector.",
        "fatal",
        edge.elementId,
      ));
    }
  }
  for (const element of snapshot.elements) {
    if (
      (element.type === "bpmn:Participant" ||
        element.type === "bpmn:Lane" ||
        flowNodeTypes.has(element.type)) &&
      !shapeIds.has(element.id)
    ) {
      issues.push(issue(
        "BPMN-COLLAB-DI-002",
        "Pool, Lane hoặc FlowNode thiếu BPMNShape.",
        "Bổ sung DI shape trước khi import.",
        "fatal",
        element.id,
      ));
    }
    if (
      (element.type === "bpmn:SequenceFlow" ||
        element.type === "bpmn:MessageFlow") &&
      !edgeIds.has(element.id)
    ) {
      issues.push(issue(
        "BPMN-COLLAB-DI-003",
        "Sequence Flow hoặc Message Flow thiếu BPMNEdge.",
        "Bổ sung DI edge trước khi import.",
        "fatal",
        element.id,
      ));
    }
  }
  return issues;
}

export function projectCollaborationOutline(
  snapshot: CollaborationBpmnSnapshot,
): readonly CoreBpmnElement[] {
  const activityContainers =
    supportsCollaborationActivityContainers(snapshot.profileId);
  const complexRouting =
    supportsCollaborationComplexRouting(snapshot.profileId);
  const dataAuthoring =
    supportsCollaborationDataAuthoring(snapshot.profileId);
  const fullAuthoring =
    isCollaborationFullAuthoringBpmnProfileId(snapshot.profileId) ||
    activityContainers;
  const boundaryEvents =
    isCollaborationBoundaryEventsBpmnProfileId(snapshot.profileId) ||
    fullAuthoring;
  const intermediateEvents =
    isCollaborationIntermediateEventsBpmnProfileId(snapshot.profileId) ||
    boundaryEvents;
  const taskTypes =
    isCollaborationTaskTypesBpmnProfileId(snapshot.profileId) ||
    intermediateEvents;
  const eventRouting =
    isCollaborationEventRoutingBpmnProfileId(snapshot.profileId) ||
    taskTypes;
  const conditional =
    isCollaborationConditionalBpmnProfileId(snapshot.profileId) ||
    isCollaborationCatchingEventsBpmnProfileId(snapshot.profileId) ||
    eventRouting;
  const catching =
    isCollaborationCatchingEventsBpmnProfileId(snapshot.profileId) ||
    eventRouting;
  const flowNodeTypes = new Set<string>([
    ...starterFlowNodeTypes,
    ...(isCollaborationStructuredBpmnProfileId(snapshot.profileId) || conditional
      ? ["bpmn:ParallelGateway"]
      : []),
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
  const nodes = snapshot.elements.filter((element) => flowNodeTypes.has(element.type));
  const messages = snapshot.elements.filter(
    (element) => element.type === "bpmn:MessageFlow",
  );
  const dataArtifacts = dataAuthoring
    ? snapshot.elements
        .filter((element) =>
          [
            "bpmn:DataObjectReference",
            "bpmn:DataStoreReference",
            "bpmn:DataInputAssociation",
            "bpmn:DataOutputAssociation",
          ].includes(element.type),
        )
        .map((element) => ({
          ...element,
          parentId: element.participantId ?? element.parentContainerId,
        }))
    : [];
  const outline: CoreBpmnElement[] = [];
  for (const participant of snapshot.participants) {
    outline.push({
      id: participant.id,
      type: "bpmn:Participant",
      name: participant.name,
      processId: participant.processId,
      incoming: [],
      outgoing: [],
    });
    const lanes = snapshot.lanes.filter(
      (lane) => lane.participantId === participant.id,
    );
    const appendLane = (lane: CollaborationLane) => {
      outline.push({
        id: lane.id,
        type: "bpmn:Lane",
        name: lane.name,
        parentId: lane.parentLaneId ?? participant.id,
        processId: lane.processId,
        participantId: participant.id,
        incoming: [],
        outgoing: [],
      });
      const children = lanes.filter(
        (candidate) => candidate.parentLaneId === lane.id,
      );
      for (const child of children) appendLane(child);
      if (children.length === 0) for (const nodeId of lane.flowNodeIds) {
        const node = nodes.find((item) => item.id === nodeId);
        if (node) outline.push({ ...node, parentId: lane.id });
      }
    };
    for (const lane of lanes.filter((candidate) => !candidate.parentLaneId)) {
      appendLane(lane);
    }
    for (const node of nodes.filter(
      (item) =>
        item.participantId === participant.id &&
        !lanes.some((lane) => lane.flowNodeIds.includes(item.id)),
    )) {
      outline.push({ ...node, parentId: participant.id });
    }
  }
  return [
    ...outline,
    ...messages,
    ...dataArtifacts,
    ...(fullAuthoring
      ? projectFullAuthoringOutlineArtifacts(snapshot)
      : []),
  ];
}

function isLaneAncestor(
  ancestorId: string,
  lane: CollaborationLane,
  laneById: ReadonlyMap<string, CollaborationLane>,
) {
  let parentId = lane.parentLaneId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = laneById.get(parentId)?.parentLaneId;
  }
  return false;
}
