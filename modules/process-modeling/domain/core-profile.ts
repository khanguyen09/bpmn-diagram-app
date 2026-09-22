export const coreBpmnProfile = {
  id: "teb-core-starter@1",
  label: "TEB BPMN Core Starter v1",
  semanticTypes: [
    "bpmn:Process",
    "bpmn:StartEvent",
    "bpmn:Task",
    "bpmn:ExclusiveGateway",
    "bpmn:EndEvent",
    "bpmn:SequenceFlow",
  ],
} as const;

export const coreBpmnVisualProfile = {
  ...coreBpmnProfile,
  id: "teb-core-starter@2",
  label: "TEB BPMN Core Starter v2",
} as const;

export const coreStructuredBpmnProfile = {
  ...coreBpmnVisualProfile,
  id: "teb-core-structured@1",
  label: "TEB BPMN Core Structured Routing v1",
  semanticTypes: [
    ...coreBpmnVisualProfile.semanticTypes,
    "bpmn:ParallelGateway",
  ],
} as const;

export const coreConditionalBpmnProfile = {
  ...coreStructuredBpmnProfile,
  id: "teb-core-conditional@1",
  label: "TEB BPMN Core Conditional Routing v1",
  semanticTypes: [
    ...coreStructuredBpmnProfile.semanticTypes,
    "bpmn:InclusiveGateway",
  ],
} as const;

export const coreCatchingEventsBpmnProfile = {
  ...coreConditionalBpmnProfile,
  id: "teb-core-catching-events@1",
  label: "TEB BPMN Core Catching Events v1",
  semanticTypes: [
    ...coreConditionalBpmnProfile.semanticTypes,
    "bpmn:IntermediateCatchEvent",
    "bpmn:MessageEventDefinition",
    "bpmn:TimerEventDefinition",
    "bpmn:ReceiveTask",
    "bpmn:Message",
  ],
} as const;

export const coreEventRoutingBpmnProfile = {
  ...coreCatchingEventsBpmnProfile,
  id: "teb-core-event-routing@1",
  label: "TEB BPMN Core Event Routing v1",
  semanticTypes: [
    ...coreCatchingEventsBpmnProfile.semanticTypes,
    "bpmn:EventBasedGateway",
  ],
} as const;

export const coreTaskTypesBpmnProfile = {
  ...coreEventRoutingBpmnProfile,
  id: "teb-core-task-types@1",
  label: "TEB BPMN Core Task Types v1",
  semanticTypes: [
    ...coreEventRoutingBpmnProfile.semanticTypes,
    "bpmn:UserTask",
    "bpmn:ServiceTask",
    "bpmn:ManualTask",
  ],
} as const;

export const coreIntermediateEventsBpmnProfile = {
  ...coreTaskTypesBpmnProfile,
  id: "teb-core-intermediate-events@1",
  label: "TEB BPMN Core Intermediate Events v1",
  semanticTypes: [
    ...coreTaskTypesBpmnProfile.semanticTypes,
    "bpmn:IntermediateThrowEvent",
  ],
} as const;

export const coreBoundaryEventsBpmnProfile = {
  ...coreIntermediateEventsBpmnProfile,
  id: "teb-core-boundary-events@1",
  label: "TEB BPMN Core Boundary Events v1",
  semanticTypes: [
    ...coreIntermediateEventsBpmnProfile.semanticTypes,
    "bpmn:BoundaryEvent",
  ],
} as const;

export const coreFullAuthoringBpmnProfile = {
  ...coreBoundaryEventsBpmnProfile,
  id: "teb-core-full-authoring@1",
  label: "TEB BPMN Core Full Authoring v1",
  semanticTypes: [
    ...coreBoundaryEventsBpmnProfile.semanticTypes,
    "bpmn:TextAnnotation",
    "bpmn:Association",
    "bpmn:Group",
    "bpmn:Category",
    "bpmn:CategoryValue",
  ],
} as const;

export const coreActivityContainersBpmnProfile = {
  ...coreFullAuthoringBpmnProfile,
  id: "teb-core-activity-containers@1",
  label: "TEB BPMN Core Activity Containers v1",
  semanticTypes: [
    ...coreFullAuthoringBpmnProfile.semanticTypes,
    "bpmn:SubProcess",
    "bpmn:CallActivity",
  ],
} as const;

export const coreDataAuthoringBpmnProfile = {
  ...coreActivityContainersBpmnProfile,
  id: "teb-core-data-authoring@1",
  label: "TEB BPMN Core Data Authoring v1",
  semanticTypes: [
    ...coreActivityContainersBpmnProfile.semanticTypes,
    "bpmn:DataObject",
    "bpmn:DataObjectReference",
    "bpmn:DataStore",
    "bpmn:DataStoreReference",
    "bpmn:DataInputAssociation",
    "bpmn:DataOutputAssociation",
  ],
} as const;

export const coreComplexRoutingBpmnProfile = {
  ...coreDataAuthoringBpmnProfile,
  id: "teb-core-complex-routing@1",
  label: "TEB BPMN Core Complex Routing v1",
  semanticTypes: [
    ...coreDataAuthoringBpmnProfile.semanticTypes,
    "bpmn:ComplexGateway",
  ],
} as const;

export const coreSubprocessTimersBpmnProfile = {
  ...coreComplexRoutingBpmnProfile,
  id: "teb-core-subprocess-timers@1",
  label: "TEB BPMN Core Subprocess Timers v1",
} as const;

export const supportedCoreBpmnProfiles = [
  coreBpmnProfile,
  coreBpmnVisualProfile,
  coreStructuredBpmnProfile,
  coreConditionalBpmnProfile,
  coreCatchingEventsBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreTaskTypesBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreFullAuthoringBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreSubprocessTimersBpmnProfile,
] as const;

export type CoreBpmnProfileId =
  (typeof supportedCoreBpmnProfiles)[number]["id"];

export function isCoreBpmnProfileId(value: unknown): value is CoreBpmnProfileId {
  return supportedCoreBpmnProfiles.some((profile) => profile.id === value);
}

export function isCoreStructuredBpmnProfileId(
  value: unknown,
): value is typeof coreStructuredBpmnProfile.id {
  return value === coreStructuredBpmnProfile.id;
}

export function isCoreConditionalBpmnProfileId(
  value: unknown,
): value is typeof coreConditionalBpmnProfile.id {
  return value === coreConditionalBpmnProfile.id;
}

export function isCoreCatchingEventsBpmnProfileId(
  value: unknown,
): value is typeof coreCatchingEventsBpmnProfile.id {
  return value === coreCatchingEventsBpmnProfile.id;
}

export function isCoreEventRoutingBpmnProfileId(
  value: unknown,
): value is typeof coreEventRoutingBpmnProfile.id {
  return value === coreEventRoutingBpmnProfile.id;
}

export function isCoreTaskTypesBpmnProfileId(
  value: unknown,
): value is typeof coreTaskTypesBpmnProfile.id {
  return value === coreTaskTypesBpmnProfile.id;
}

export function isCoreIntermediateEventsBpmnProfileId(
  value: unknown,
): value is typeof coreIntermediateEventsBpmnProfile.id {
  return value === coreIntermediateEventsBpmnProfile.id;
}

export function isCoreBoundaryEventsBpmnProfileId(
  value: unknown,
): value is typeof coreBoundaryEventsBpmnProfile.id {
  return value === coreBoundaryEventsBpmnProfile.id;
}

export function isCoreFullAuthoringBpmnProfileId(
  value: unknown,
): value is typeof coreFullAuthoringBpmnProfile.id {
  return value === coreFullAuthoringBpmnProfile.id;
}

export function isCoreActivityContainersBpmnProfileId(
  value: unknown,
): value is typeof coreActivityContainersBpmnProfile.id {
  return value === coreActivityContainersBpmnProfile.id;
}

export function isCoreDataAuthoringBpmnProfileId(
  value: unknown,
): value is typeof coreDataAuthoringBpmnProfile.id {
  return value === coreDataAuthoringBpmnProfile.id;
}

export function isCoreComplexRoutingBpmnProfileId(
  value: unknown,
): value is typeof coreComplexRoutingBpmnProfile.id {
  return value === coreComplexRoutingBpmnProfile.id;
}

export function canTransitionCoreBpmnProfile(
  current: CoreBpmnProfileId,
  candidate: CoreBpmnProfileId,
) {
  return (
    current === candidate ||
    (current === coreBpmnProfile.id &&
      candidate === coreBpmnVisualProfile.id) ||
    ((current === coreBpmnProfile.id ||
      current === coreBpmnVisualProfile.id) &&
      candidate === coreStructuredBpmnProfile.id) ||
    (current === coreStructuredBpmnProfile.id &&
      candidate === coreConditionalBpmnProfile.id) ||
    (current === coreConditionalBpmnProfile.id &&
      candidate === coreCatchingEventsBpmnProfile.id) ||
    (current === coreCatchingEventsBpmnProfile.id &&
      candidate === coreEventRoutingBpmnProfile.id) ||
    (current === coreEventRoutingBpmnProfile.id &&
      candidate === coreTaskTypesBpmnProfile.id) ||
    (current === coreTaskTypesBpmnProfile.id &&
      candidate === coreIntermediateEventsBpmnProfile.id) ||
    (current === coreIntermediateEventsBpmnProfile.id &&
      candidate === coreBoundaryEventsBpmnProfile.id) ||
    (current === coreBoundaryEventsBpmnProfile.id &&
      candidate === coreFullAuthoringBpmnProfile.id) ||
    (current === coreFullAuthoringBpmnProfile.id &&
      candidate === coreActivityContainersBpmnProfile.id) ||
    (current === coreActivityContainersBpmnProfile.id &&
      candidate === coreDataAuthoringBpmnProfile.id) ||
    (current === coreDataAuthoringBpmnProfile.id &&
      candidate === coreComplexRoutingBpmnProfile.id) ||
    (current === coreComplexRoutingBpmnProfile.id &&
      candidate === coreSubprocessTimersBpmnProfile.id)
  );
}

export type BpmnProfileId = CoreBpmnProfileId | CollaborationBpmnProfileId;

export const supportedBpmnProfiles = [
  ...supportedCoreBpmnProfiles,
  ...supportedCollaborationBpmnProfiles,
] as const;

export function isBpmnProfileId(value: unknown): value is BpmnProfileId {
  return supportedBpmnProfiles.some((profile) => profile.id === value);
}

export function isStructuredBpmnProfileId(
  value: unknown,
): value is
  | typeof coreStructuredBpmnProfile.id
  | typeof collaborationStructuredBpmnProfile.id {
  return (
    isCoreStructuredBpmnProfileId(value) ||
    isCollaborationStructuredBpmnProfileId(value)
  );
}

export function supportsStructuredRouting(value: unknown): boolean {
  return (
    isStructuredBpmnProfileId(value) ||
    supportsConditionalRouting(value)
  );
}

export function supportsConditionalRouting(value: unknown): boolean {
  return (
    isCoreConditionalBpmnProfileId(value) ||
    isCollaborationConditionalBpmnProfileId(value) ||
    supportsCatchingEvents(value)
  );
}

export function supportsCatchingEvents(value: unknown): boolean {
  return (
    isCoreCatchingEventsBpmnProfileId(value) ||
    isCollaborationCatchingEventsBpmnProfileId(value) ||
    supportsEventRouting(value)
  );
}

export function supportsEventRouting(value: unknown): boolean {
  return (
    isCoreEventRoutingBpmnProfileId(value) ||
    isCollaborationEventRoutingBpmnProfileId(value) ||
    supportsTaskTypes(value)
  );
}

export function supportsTaskTypes(value: unknown): boolean {
  return (
    isCoreTaskTypesBpmnProfileId(value) ||
    isCollaborationTaskTypesBpmnProfileId(value) ||
    supportsIntermediateEvents(value)
  );
}

export function supportsIntermediateEvents(value: unknown): boolean {
  return (
    isCoreIntermediateEventsBpmnProfileId(value) ||
    isCollaborationIntermediateEventsBpmnProfileId(value) ||
    supportsBoundaryEvents(value)
  );
}

export function supportsBoundaryEvents(value: unknown): boolean {
  return (
    isCoreBoundaryEventsBpmnProfileId(value) ||
    isCollaborationBoundaryEventsBpmnProfileId(value) ||
    supportsFullAuthoring(value)
  );
}

export function supportsFullAuthoring(value: unknown): boolean {
  return (
    isCoreFullAuthoringBpmnProfileId(value) ||
    isCollaborationFullAuthoringBpmnProfileId(value) ||
    supportsActivityContainers(value)
  );
}

export function supportsActivityContainers(value: unknown): boolean {
  return (
    isCoreActivityContainersBpmnProfileId(value) ||
    isCollaborationActivityContainersBpmnProfileId(value) ||
    supportsDataAuthoring(value)
  );
}

export function supportsDataAuthoring(value: unknown): boolean {
  return (
    isCoreDataAuthoringBpmnProfileId(value) ||
    isCollaborationDataAuthoringBpmnProfileId(value) ||
    supportsComplexRouting(value)
  );
}

export function supportsComplexRouting(value: unknown): boolean {
  return (
    isCoreComplexRoutingBpmnProfileId(value) ||
    supportsCollaborationComplexRouting(value) ||
    supportsSubprocessTimers(value)
  );
}

export function supportsSubprocessTimers(value: unknown): boolean {
  return value === coreSubprocessTimersBpmnProfile.id ||
    value === "teb-collaboration-subprocess-timers@1";
}

export function acknowledgedBpmnAuthoringProfile(
  profileId: BpmnProfileId,
  conditionalProfileAcknowledged: boolean,
): BpmnProfileId {
  if (conditionalProfileAcknowledged) return profileId;
  if (profileId === coreConditionalBpmnProfile.id) {
    return coreStructuredBpmnProfile.id;
  }
  if (profileId === collaborationConditionalBpmnProfile.id) {
    return collaborationStructuredBpmnProfile.id;
  }
  return profileId;
}

export function canTransitionBpmnProfile(
  current: BpmnProfileId,
  candidate: BpmnProfileId,
) {
  if (current === candidate) return true;
  if (
    isCoreBpmnProfileId(current) &&
    isCoreBpmnProfileId(candidate) &&
    canTransitionCoreBpmnProfile(current, candidate)
  ) return true;
  return (
    isCollaborationBpmnProfileId(current) &&
    isCollaborationBpmnProfileId(candidate) &&
    canTransitionCollaborationBpmnProfile(current, candidate)
  );
}

export type CoreBpmnSemanticType =
  (typeof coreComplexRoutingBpmnProfile.semanticTypes)[number];

export type CatchingEventDefinition =
  | {
      readonly id: string;
      readonly kind: "MESSAGE";
      readonly messageRefId: string;
    }
  | {
      readonly id: string;
      readonly kind: "TIMER";
      readonly timerKind: "DATE" | "DURATION";
      readonly expression: string;
    };

export type BpmnIssueSeverity = "error" | "warning" | "info";
export type BpmnIssueDisposition = "fatal" | "recoverable";

export interface BpmnInspectionIssue {
  readonly ruleId: string;
  readonly severity: BpmnIssueSeverity;
  /**
   * Present on every server inspection issue. Optional for compatibility with
   * local UI-only transport failures that are not inspection catalogue entries.
   */
  readonly disposition?: BpmnIssueDisposition;
  readonly elementId?: string;
  readonly message: string;
  readonly recovery: string;
}

export interface CoreBpmnElement {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly conditionExpression?: string;
  readonly defaultFlowId?: string;
  readonly eventDefinition?: CatchingEventDefinition;
  readonly messageRefId?: string;
  readonly eventGatewayType?: "Exclusive";
  readonly instantiate?: boolean;
  readonly attachedToId?: string;
  readonly cancelActivity?: boolean;
  readonly incoming: readonly string[];
  readonly outgoing: readonly string[];
  readonly iconKey?: string;
  readonly text?: string;
  readonly textFormat?: string;
  readonly associationDirection?: string;
  readonly categoryValueRefId?: string;
  readonly value?: string;
  readonly categoryValueIds?: readonly string[];
  readonly parentContainerId?: string;
  readonly calledElementId?: string;
  readonly dataObjectRefId?: string;
  readonly dataStoreRefId?: string;
  readonly associationOwnerId?: string;
  readonly activationCondition?: string;
  readonly gatewayDirection?: string;
  readonly isExpanded?: boolean;
  readonly triggeredByEvent?: boolean;
  readonly isExecutable?: boolean;
  readonly isCollection?: boolean;
  /**
   * Read-model label resolved by an outline projection. It is never serialized
   * back into BPMN semantics.
   */
  readonly displayLabel?: string;
  readonly authoringRole?:
    | "ANNOTATION"
    | "ASSOCIATION"
    | "VISUAL_ONLY_GROUP";
  readonly authoredColor?: {
    readonly fill?: string;
    readonly stroke?: string;
  };
  readonly parentId?: string;
  readonly processId?: string;
  readonly participantId?: string;
}

export interface CoreBpmnShape {
  /** Stable bpmndi:BPMNShape identity used by bounded conversion preflights. */
  readonly diId?: string;
  readonly elementId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly isExpanded?: boolean;
  readonly isHorizontal?: boolean;
  readonly isMarkerVisible?: boolean;
  readonly labelBounds?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface CoreBpmnEdge {
  /** Stable bpmndi:BPMNEdge identity used by bounded conversion preflights. */
  readonly diId?: string;
  readonly elementId: string;
  readonly waypoints: readonly { readonly x: number; readonly y: number }[];
  readonly fill?: string;
  readonly stroke?: string;
  readonly labelBounds?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface CoreBpmnSnapshot {
  readonly profileId: CoreBpmnProfileId;
  readonly planeElementId?: string;
  readonly planeCount?: number;
  readonly elements: readonly CoreBpmnElement[];
  readonly shapes: readonly CoreBpmnShape[];
  readonly edges: readonly CoreBpmnEdge[];
}

export interface BpmnInspectionResult {
  /**
   * Backward-compatible alias for safeToPersist. This does not mean that the
   * model is complete or BPMN-valid.
   */
  readonly accepted: boolean;
  readonly safeToPersist: boolean;
  readonly readyToSeal: boolean;
  readonly profileId: BpmnProfileId;
  readonly issues: readonly BpmnInspectionIssue[];
  readonly outline: readonly CoreBpmnElement[];
  readonly snapshot?: CoreBpmnSnapshot | CollaborationBpmnSnapshot;
  readonly canonicalXml?: string;
  readonly messageRegistry?: readonly MessageRegistryEntry[];
  readonly categoryRegistry?: readonly CategoryRegistryEntry[];
  readonly dataStoreRegistry?: readonly DataStoreRegistryEntry[];
}
import {
  canTransitionCollaborationBpmnProfile,
  isCollaborationBpmnProfileId,
  isCollaborationConditionalBpmnProfileId,
  isCollaborationCatchingEventsBpmnProfileId,
  isCollaborationEventRoutingBpmnProfileId,
  isCollaborationTaskTypesBpmnProfileId,
  isCollaborationIntermediateEventsBpmnProfileId,
  isCollaborationBoundaryEventsBpmnProfileId,
  isCollaborationFullAuthoringBpmnProfileId,
  isCollaborationActivityContainersBpmnProfileId,
  isCollaborationDataAuthoringBpmnProfileId,
  supportsCollaborationComplexRouting,
  isCollaborationStructuredBpmnProfileId,
  supportedCollaborationBpmnProfiles,
  collaborationConditionalBpmnProfile,
  collaborationStructuredBpmnProfile,
  type CollaborationBpmnProfileId,
  type CollaborationBpmnSnapshot,
} from "./collaboration-profile";
import type { MessageRegistryEntry } from "./message-registry";
import type { CategoryRegistryEntry } from "./category-registry";
import type { DataStoreRegistryEntry } from "./data-authoring";
