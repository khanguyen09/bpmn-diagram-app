import { BpmnModdle } from "bpmn-moddle";
import type {
  BaseElement,
  BPMNEdge,
  BPMNShape,
  Definitions,
  FlowElement,
  FlowNode,
  Process,
  SequenceFlow,
} from "bpmn-moddle";
import {
  inspectCoreSnapshot,
  projectCoreOutline,
} from "../../application/inspect-core-snapshot";
import {
  inspectCollaborationSnapshot,
  isCollaborationBpmnProfileId,
  projectCollaborationOutline,
  type CollaborationBpmnProfileId,
  type CollaborationBpmnSnapshot,
} from "../../domain/collaboration-profile";
import {
  coreBpmnProfile,
  supportedBpmnProfiles,
  coreBpmnVisualProfile,
  supportsBoundaryEvents,
  supportsIntermediateEvents,
  supportsStructuredRouting,
  supportsFullAuthoring,
  supportsActivityContainers,
  supportsDataAuthoring,
  type BpmnProfileId,
  type BpmnInspectionIssue,
  type BpmnInspectionResult,
  type CoreBpmnElement,
  type CoreBpmnProfileId,
  type CoreBpmnSnapshot,
} from "../../domain/core-profile";
import {
  maxConditionExpressionCharacters,
} from "../../domain/conditional-routing";
import {
  maxTimerExpressionCharacters,
} from "../../domain/event-routing";
import {
  isNodeIconKey,
  nodeVisualNamespace,
  supportsNodeVisual,
} from "../../domain/node-visual";
import { tebModdleDescriptor } from "../../application/teb-moddle-contract";
import {
  inspectMessageRegistry,
  projectMessageRegistry,
  type MessageReferenceObservation,
} from "../../domain/message-registry";
import {
  inspectCategoryRegistry,
  projectCategoryRegistry,
  type CategoryReferenceObservation,
} from "../../domain/category-registry";
import {
  bpmnIoColorNamespace,
  isAllowedBpmnFillColor,
  isAllowedBpmnStrokeColor,
} from "../../domain/full-authoring";
import {
  projectDataStoreRegistry,
  type DataStoreReferenceObservation,
} from "../../domain/data-authoring";

export const bpmnImportLimits = {
  maxBytes: 1024 * 1024,
  maxDepth: 64,
  maxElements: 10_000,
} as const;

const coreNamespaceUris = new Set([
  "http://www.w3.org/2001/XMLSchema-instance",
  "http://www.omg.org/spec/BPMN/20100524/MODEL",
  "http://www.omg.org/spec/BPMN/20100524/DI",
  "http://www.omg.org/spec/DD/20100524/DC",
  "http://www.omg.org/spec/DD/20100524/DI",
]);

// bpmn-js uses this private Activity property as the required input target.
// It is XML representation, not an independently authorable BPMN shape.
function isNativeDataInputTarget(
  candidate: BaseElement,
  profileId: BpmnProfileId,
): boolean {
  const property = candidate as ModdleElement;
  const owner = property.$parent as ModdleElement | undefined;
  return supportsDataAuthoring(profileId) &&
    property.$type === "bpmn:Property" &&
    typeof property.id === "string" && property.id.trim().length > 0 &&
    property.name === "__targetRef_placeholder" &&
    Boolean(owner && [
      "bpmn:Task", "bpmn:UserTask", "bpmn:ServiceTask", "bpmn:ManualTask",
      "bpmn:ReceiveTask", "bpmn:SubProcess", "bpmn:CallActivity",
    ].includes(owner.$type) && owner.properties?.includes(property) &&
      owner.dataInputAssociations?.some((association) =>
        association.$parent === owner && association.targetRef === property)) &&
    Object.keys(property).every((key) => ["$type", "id", "name"].includes(key)) &&
    (property.$descriptor?.properties ?? []).every((descriptor) =>
      !descriptor.name || ["id", "name"].includes(descriptor.name) ||
      (property as unknown as Record<string, unknown>)[descriptor.name] === undefined) &&
    Object.keys(property.$attrs ?? {}).length === 0;
}

function containedProperties(definitions: Definitions): readonly ModdleElement[] {
  const properties: ModdleElement[] = [];
  const pending = [definitions as unknown as ModdleElement];
  const visited = new Set<ModdleElement>();
  while (pending.length > 0) {
    const element = pending.pop()!;
    if (visited.has(element)) continue;
    visited.add(element);
    if (element.$type === "bpmn:Property") properties.push(element);
    for (const descriptor of element.$descriptor?.properties ?? []) {
      if (descriptor.isReference || !descriptor.name) continue;
      const value = (element as unknown as Record<string, unknown>)[descriptor.name];
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child === "object" && "$type" in child) {
          pending.push(child as ModdleElement);
        }
      }
    }
  }
  return properties;
}

function boundaryIssue(
  ruleId: string,
  message: string,
  recovery: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: "error",
    disposition: "fatal",
    message,
    recovery,
  };
}

function recoverableIssue(
  ruleId: string,
  message: string,
  recovery: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: "warning",
    disposition: "recoverable",
    message,
    recovery,
  };
}

function hasOwn(element: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(element, property);
}

function rejected(
  issues: readonly BpmnInspectionIssue[],
  profileId: BpmnProfileId,
): BpmnInspectionResult {
  return {
    accepted: false,
    safeToPersist: false,
    readyToSeal: false,
    profileId,
    issues,
    outline: [],
  };
}

function lexicalIssues(
  xml: string,
  profileId: BpmnProfileId,
  compatibleColors = false,
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const bytes = new TextEncoder().encode(xml).byteLength;

  if (bytes > bpmnImportLimits.maxBytes) {
    issues.push(
      boundaryIssue(
        "BPMN-LIMIT-001",
        "Tệp vượt giới hạn 1 MiB của Core Starter.",
        "Giảm kích thước model hoặc chia nhỏ trước khi import.",
      ),
    );
  }
  if (/<!DOCTYPE|<!ENTITY|<\s*xi:include|<\?xml-stylesheet/i.test(xml)) {
    issues.push(
      boundaryIssue(
        "BPMN-SEC-001",
        "Tệp chứa khai báo XML bên ngoài hoặc có thể thực thi.",
        "Xóa DTD, entity, XInclude và stylesheet khỏi tệp.",
      ),
    );
  }
  if (/\b(?:schemaLocation|noNamespaceSchemaLocation)\s*=/i.test(xml)) {
    issues.push(
      boundaryIssue(
        "BPMN-SEC-002",
        "Tệp yêu cầu schema location bên ngoài.",
        "Dùng XML tự chứa trong namespace BPMN/DI được hỗ trợ.",
      ),
    );
  }

  for (const match of xml.matchAll(/\bxmlns(?::[\w.-]+)?\s*=\s*["']([^"']+)["']/g)) {
    const allowed =
      coreNamespaceUris.has(match[1]) ||
      ((profileId === coreBpmnVisualProfile.id ||
        supportsStructuredRouting(profileId) ||
        isCollaborationBpmnProfileId(profileId)) &&
        match[1] === nodeVisualNamespace) ||
      (supportsFullAuthoring(profileId) &&
        (match[1] === bpmnIoColorNamespace ||
          (compatibleColors && match[1] === bpmnInColorNamespace)));
    if (!allowed) {
      issues.push(
        boundaryIssue(
          "BPMN-PROFILE-004",
          "Tệp chứa namespace extension ngoài Core Starter.",
          "Loại bỏ vendor extension trước khi import.",
        ),
      );
      break;
    }
  }

  const tebNamespaceMatches = [
    ...xml.matchAll(/\bxmlns:teb\s*=\s*["']([^"']+)["']/g),
  ];
  const tebTags = [...xml.matchAll(/<\s*(\/?)teb:([\w.-]+)([^>]*)>/g)];
  if (profileId === coreBpmnProfile.id && (tebNamespaceMatches.length || tebTags.length)) {
    issues.push(
      boundaryIssue(
        "BPMN-VISUAL-001",
        "Core Starter v1 không hỗ trợ node visual.",
        "Nâng profile lên Core Starter v2 trước khi chọn icon.",
      ),
    );
  }
  if (
    profileId === coreBpmnVisualProfile.id ||
    supportsStructuredRouting(profileId) ||
    isCollaborationBpmnProfileId(profileId)
  ) {
    if (
      tebTags.length > 0 &&
      (tebNamespaceMatches.length !== 1 ||
        tebNamespaceMatches[0]?.[1] !== nodeVisualNamespace)
    ) {
      issues.push(
        boundaryIssue(
          "BPMN-VISUAL-002",
          "Namespace node visual không đúng contract.",
          "Dùng namespace TEB visual v1 duy nhất.",
        ),
      );
    }
    for (const tag of tebTags) {
      const closing = tag[1] === "/";
      const name = tag[2];
      const attributes = tag[3];
      if (
        closing ||
        name !== "nodeVisual" ||
        !/\/\s*$/.test(attributes) ||
        !/^\s+iconKey\s*=\s*["'][a-z-]+["']\s*\/\s*$/.test(attributes)
      ) {
        issues.push(
          boundaryIssue(
            "BPMN-VISUAL-003",
            "Node visual chứa element, attribute hoặc nội dung không được hỗ trợ.",
            "Chỉ dùng một teb:nodeVisual tự đóng với iconKey từ catalog.",
          ),
        );
        break;
      }
    }
  }

  const idMatches = [...xml.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  if (new Set(idMatches).size !== idMatches.length) {
    issues.push(
      boundaryIssue(
        "BPMN-ID-001",
        "Tệp chứa ID trùng lặp.",
        "Đặt ID duy nhất cho mọi semantic và DI element.",
      ),
    );
  }

  const tagMatches = [...xml.matchAll(/<\s*(\/?)([\w:.-]+)([^>]*)>/g)];
  for (const tag of tagMatches) {
    const tagName = tag[2];
    const attributes = tag[3];
    const biocAttributes = [
      ...attributes.matchAll(/\bbioc:([\w.-]+)\s*=\s*["']([^"']*)["']/g),
    ];
    for (const attribute of biocAttributes) {
      const name = attribute[1];
      const value = attribute[2];
      const shape = tagName === "bpmndi:BPMNShape";
      const edge = tagName === "bpmndi:BPMNEdge";
      if (
        !supportsFullAuthoring(profileId) ||
        (!shape && !edge) ||
        !["fill", "stroke"].includes(name) ||
        (edge && name === "fill") ||
        (name === "fill"
          ? !isAllowedBpmnFillColor(value)
          : !isAllowedBpmnStrokeColor(value))
      ) {
        issues.push(
          boundaryIssue(
            "BPMN-COLOR-001",
            "Màu BPMN DI nằm ngoài Full Authoring palette contract.",
            "Chỉ dùng canonical bioc:fill/stroke #RRGGBB từ palette Studio.",
          ),
        );
      }
    }
    if (/<\s*\/?\s*bioc:/u.test(tag[0])) {
      issues.push(
        boundaryIssue(
          "BPMN-COLOR-001",
          "bioc chỉ được dùng như thuộc tính BPMN DI.",
          "Xóa bioc element và chỉ giữ fill/stroke trên BPMNShape/BPMNEdge.",
        ),
      );
    }
  }
  if (tagMatches.length > bpmnImportLimits.maxElements) {
    issues.push(
      boundaryIssue(
        "BPMN-LIMIT-002",
        "Tệp có quá nhiều XML element.",
        "Giảm model xuống tối đa 10.000 element cho slice này.",
      ),
    );
  }

  let depth = 0;
  let maxDepth = 0;
  for (const match of tagMatches) {
    const closing = match[1] === "/";
    const selfClosing = /\/\s*$/.test(match[3]);
    if (closing) depth = Math.max(0, depth - 1);
    else if (!selfClosing && !match[2].startsWith("?")) {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  if (maxDepth > bpmnImportLimits.maxDepth) {
    issues.push(
      boundaryIssue(
        "BPMN-LIMIT-003",
        "Tệp vượt độ sâu XML cho phép.",
        "Giảm nesting xuống tối đa 64 cấp.",
      ),
    );
  }

  return issues;
}

function isProcess(element: BaseElement): element is Process {
  return element.$type === "bpmn:Process";
}

function isSequenceFlow(element: FlowElement): element is SequenceFlow {
  return element.$type === "bpmn:SequenceFlow";
}

function flowIds(flow: readonly SequenceFlow[] | undefined) {
  return (flow ?? []).map((item) => item.id);
}

type FormalExpressionElement = ModdleElement & {
  body?: unknown;
  language?: unknown;
  evaluatesToTypeRef?: unknown;
  $attrs?: Record<string, unknown>;
};

function eventMetadata(element: ModdleElement) {
  const definition = element.eventDefinitions?.[0];
  const messageDefinition =
    definition?.$type === "bpmn:MessageEventDefinition"
      ? definition
      : undefined;
  const timerDefinition =
    definition?.$type === "bpmn:TimerEventDefinition"
      ? definition
      : undefined;
  const timerExpression = timerDefinition?.timeDate
    ? { kind: "DATE" as const, value: timerDefinition.timeDate }
    : timerDefinition?.timeDuration
      ? { kind: "DURATION" as const, value: timerDefinition.timeDuration }
      : undefined;

  return {
    ...(messageDefinition?.messageRef?.id
      ? {
          eventDefinition: {
            id: messageDefinition.id,
            kind: "MESSAGE" as const,
            messageRefId: messageDefinition.messageRef.id,
          },
        }
      : {}),
    ...(timerExpression
      ? {
          eventDefinition: {
            id: timerDefinition!.id,
            kind: "TIMER" as const,
            timerKind: timerExpression.kind,
            expression:
              typeof timerExpression.value.body === "string"
                ? timerExpression.value.body
                : "",
          },
        }
      : {}),
    ...(element.messageRef?.id
      ? { messageRefId: element.messageRef.id }
      : {}),
    ...(typeof element.eventGatewayType === "string"
      ? { eventGatewayType: element.eventGatewayType as "Exclusive" }
      : {}),
    ...(typeof element.instantiate === "boolean"
      ? { instantiate: element.instantiate }
      : {}),
    ...(element.attachedToRef?.id
      ? { attachedToId: element.attachedToRef.id }
      : {}),
    ...(element.$type === "bpmn:BoundaryEvent"
      ? { cancelActivity: element.cancelActivity !== false }
      : {}),
  };
}

function dataAssociationSourceRefs(
  association: ModdleElement,
): readonly ModdleElement[] {
  const sourceRef = (association as unknown as { sourceRef?: unknown }).sourceRef;
  return Array.isArray(sourceRef)
    ? sourceRef as ModdleElement[]
    : sourceRef
      ? [sourceRef as ModdleElement]
      : [];
}

function projectAdvancedProcess(
  process: ModdleElement,
  participantId?: string,
): readonly CoreBpmnElement[] {
  const projected: CoreBpmnElement[] = [{
    id: process.id,
    type: process.$type,
    ...(process.name ? { name: process.name } : {}),
    isExecutable: process.isExecutable === true,
    ...(participantId ? { participantId } : {}),
    incoming: [],
    outgoing: [],
  }];

  const appendContainer = (
    container: ModdleElement,
    rootProcessId: string,
    depth: number,
  ) => {
    for (const element of container.flowElements ?? []) {
      const flow = element.$type === "bpmn:SequenceFlow";
      const defaultFlow = element.default;
      const activationCondition = element.activationCondition;
      const projectedElement: CoreBpmnElement = {
        id: element.id,
        type: element.$type,
        ...(element.name ? { name: element.name } : {}),
        parentContainerId: container.id,
        parentId: container.id,
        processId: rootProcessId,
        ...(participantId ? { participantId } : {}),
        ...(flow && element.sourceRef?.id
          ? { sourceId: element.sourceRef.id }
          : {}),
        ...(flow && element.targetRef?.id
          ? { targetId: element.targetRef.id }
          : {}),
        ...(flow && element.conditionExpression
          ? {
              conditionExpression:
                typeof element.conditionExpression.body === "string"
                  ? element.conditionExpression.body
                  : "",
            }
          : {}),
        ...(defaultFlow?.id ? { defaultFlowId: defaultFlow.id } : {}),
        ...(element.$type === "bpmn:SubProcess"
          ? { triggeredByEvent: element.triggeredByEvent === true }
          : {}),
        ...(element.$type === "bpmn:CallActivity" &&
        typeof element.calledElement === "string"
          ? { calledElementId: element.calledElement }
          : {}),
        ...(element.$type === "bpmn:DataObject"
          ? { isCollection: element.isCollection === true }
          : {}),
        ...(element.dataObjectRef?.id
          ? { dataObjectRefId: element.dataObjectRef.id }
          : {}),
        ...(element.dataStoreRef?.id
          ? { dataStoreRefId: element.dataStoreRef.id }
          : {}),
        ...(activationCondition
          ? {
              activationCondition:
                typeof activationCondition.body === "string"
                  ? activationCondition.body
                  : "",
            }
          : {}),
        ...(typeof element.gatewayDirection === "string"
          ? { gatewayDirection: element.gatewayDirection }
          : {}),
        ...eventMetadata(element),
        incoming: flowIds(element.incoming),
        outgoing: flowIds(element.outgoing),
        ...(nodeIcon(element) ? { iconKey: nodeIcon(element) } : {}),
      };
      projected.push(projectedElement);

      for (const association of element.dataInputAssociations ?? []) {
        const source = dataAssociationSourceRefs(association)[0];
        projected.push({
          id: association.id,
          type: association.$type,
          ...(source?.id ? { sourceId: source.id } : {}),
          targetId: element.id,
          associationOwnerId: element.id,
          parentContainerId: container.id,
          parentId: element.id,
          processId: rootProcessId,
          ...(participantId ? { participantId } : {}),
          incoming: [],
          outgoing: [],
        });
      }
      for (const association of element.dataOutputAssociations ?? []) {
        projected.push({
          id: association.id,
          type: association.$type,
          sourceId: element.id,
          ...(association.targetRef?.id
            ? { targetId: association.targetRef.id }
            : {}),
          associationOwnerId: element.id,
          parentContainerId: container.id,
          parentId: element.id,
          processId: rootProcessId,
          ...(participantId ? { participantId } : {}),
          incoming: [],
          outgoing: [],
        });
      }

      if (
        element.$type === "bpmn:SubProcess" &&
        depth < 2
      ) {
        appendContainer(element, rootProcessId, depth + 1);
      }
    }
    for (const artifact of container.artifacts ?? []) {
      projected.push(projectArtifact(artifact, {
        parentId: container.id,
        processId: rootProcessId,
        ...(participantId ? { participantId } : {}),
      }));
    }
  };
  appendContainer(process, process.id, 0);
  return projected;
}

function createSnapshot(
  definitions: Definitions,
  elementsById: Record<string, BaseElement>,
  profileId: CoreBpmnProfileId,
): CoreBpmnSnapshot {
  if (supportsActivityContainers(profileId)) {
    const planeElementId = definitions.diagrams[0]?.plane?.bpmnElement?.id;
    const processes = definitions.rootElements
      .filter(isProcess) as unknown as ModdleElement[];
    const elements: CoreBpmnElement[] = processes.flatMap((process) =>
      projectAdvancedProcess(process)
    );
    elements.push(...projectCategories(definitions));
    elements.push(
      ...definitions.rootElements
        .filter(
          (element) =>
            element.$type === "bpmn:Message" ||
            element.$type === "bpmn:DataStore",
        )
        .map((root) => {
          const element = root as unknown as ModdleElement;
          return {
            id: element.id,
            type: element.$type,
            ...(element.name ? { name: element.name } : {}),
            incoming: [],
            outgoing: [],
          };
        }),
    );
    const planeElements = definitions.diagrams.flatMap(
      (diagram) => diagram.plane?.planeElement ?? [],
    );
    return {
      profileId,
      planeElementId,
      planeCount: definitions.diagrams.filter((diagram) => diagram.plane).length,
      elements,
      shapes: planeElements
        .filter(
          (element): element is BPMNShape =>
            element.$type === "bpmndi:BPMNShape",
        )
        .filter((shape) => shape.bpmnElement?.id && shape.bounds)
        .map(projectShape),
      edges: planeElements
        .filter(
          (element): element is BPMNEdge =>
            element.$type === "bpmndi:BPMNEdge",
        )
        .filter((edge) => edge.bpmnElement?.id)
        .map(projectEdge),
    };
  }
  const process = definitions.rootElements.find(isProcess);
  const flowElements = process?.flowElements ?? [];
  const processArtifacts =
    (process as unknown as ModdleElement | undefined)?.artifacts ?? [];
  const additionalProcesses = definitions.rootElements
    .filter(isProcess)
    .filter((candidate) => candidate.id !== process?.id)
    .flatMap((candidate) =>
      projectAdvancedProcess(candidate as unknown as ModdleElement)
    );
  const elements = [
    ...(process
      ? [{
          id: process.id,
          type: process.$type,
          ...(process.name ? { name: process.name } : {}),
          isExecutable: process.isExecutable === true,
          incoming: [],
          outgoing: [],
        }]
      : []),
    ...flowElements.map((element) => {
      const node = element as FlowNode;
      const flow = isSequenceFlow(element) ? element : undefined;
      const conditionExpression = flow as
        | (SequenceFlow & {
            conditionExpression?: { body?: unknown };
          })
        | undefined;
      const defaultFlow = (
        element as FlowElement & { default?: SequenceFlow }
      ).default;
      const moddleElement = element as unknown as ModdleElement;
      const extensionValues =
        (
          element as FlowElement & {
            extensionElements?: {
              values?: Array<{ $type?: string; iconKey?: unknown }>;
            };
          }
        ).extensionElements?.values ?? [];
      const nodeVisual = (
        extensionValues as unknown as Array<{
          $type?: string;
          iconKey?: unknown;
        }>
      ).find(
        (value) => value.$type === "teb:NodeVisual",
      );
      return {
        id: element.id,
        type: element.$type,
        ...(element.name ? { name: element.name } : {}),
        ...(process
          ? {
              parentContainerId: process.id,
              parentId: process.id,
              processId: process.id,
            }
          : {}),
        ...(flow?.sourceRef?.id ? { sourceId: flow.sourceRef.id } : {}),
        ...(flow?.targetRef?.id ? { targetId: flow.targetRef.id } : {}),
        ...(conditionExpression?.conditionExpression
          ? {
              conditionExpression:
                typeof conditionExpression.conditionExpression.body === "string"
                  ? conditionExpression.conditionExpression.body
                  : "",
            }
          : {}),
        ...(defaultFlow?.id ? { defaultFlowId: defaultFlow.id } : {}),
        ...eventMetadata(moddleElement),
        ...(typeof moddleElement.gatewayDirection === "string"
          ? { gatewayDirection: moddleElement.gatewayDirection }
          : {}),
        incoming: flowIds(node.incoming),
        outgoing: flowIds(node.outgoing),
        ...(typeof nodeVisual?.iconKey === "string"
          ? { iconKey: nodeVisual.iconKey }
          : {}),
      };
    }),
    ...processArtifacts.map((artifact) =>
      projectArtifact(artifact, {
        ...(process ? { parentId: process.id, processId: process.id } : {}),
      }),
    ),
    ...additionalProcesses,
    ...projectCategories(definitions),
    ...definitions.rootElements
      .filter((element) => element.$type === "bpmn:Message")
      .map((message) => ({
        id: message.id,
        type: message.$type,
        ...("name" in message &&
        typeof (message as BaseElement & { name?: unknown }).name === "string"
          ? { name: (message as BaseElement & { name: string }).name }
          : {}),
        incoming: [],
        outgoing: [],
      })),
  ];

  for (const element of Object.values(elementsById)) {
    if (
      element.$type.startsWith("bpmn:") &&
      element.$type !== "bpmn:Definitions" &&
      element.$type !== "bpmn:MessageEventDefinition" &&
      element.$type !== "bpmn:TimerEventDefinition" &&
      element.$type !== "bpmn:FormalExpression" &&
      element.$type !== "bpmn:Message" &&
      !elements.some((candidate) => candidate.id === element.id)
    ) {
      elements.push({
        id: element.id,
        type: element.$type,
        ...("name" in element &&
        typeof (element as BaseElement & { name?: unknown }).name === "string"
          ? { name: (element as BaseElement & { name: string }).name }
          : {}),
        incoming: [],
        outgoing: [],
      });
    }
  }

  const planeElements = definitions.diagrams.flatMap(
    (diagram) => diagram.plane?.planeElement ?? [],
  );
  const shapes = planeElements
    .filter((element): element is BPMNShape => element.$type === "bpmndi:BPMNShape")
    .filter((shape) => shape.bpmnElement?.id && shape.bounds)
    .map(projectShape);
  const edges = planeElements
    .filter((element): element is BPMNEdge => element.$type === "bpmndi:BPMNEdge")
    .filter((edge) => edge.bpmnElement?.id)
    .map(projectEdge);

  return {
    profileId,
    planeElementId: definitions.diagrams[0]?.plane?.bpmnElement?.id,
    planeCount: definitions.diagrams.filter((diagram) => diagram.plane).length,
    elements,
    shapes,
    edges,
  };
}

type ModdleElement = BaseElement & {
  name?: string;
  isExecutable?: boolean;
  triggeredByEvent?: boolean;
  calledElement?: string;
  isCollection?: boolean;
  dataObjectRef?: ModdleElement;
  dataStoreRef?: ModdleElement;
  dataInputAssociations?: ModdleElement[];
  properties?: ModdleElement[];
  dataOutputAssociations?: ModdleElement[];
  activationCondition?: FormalExpressionElement;
  gatewayDirection?: string;
  text?: string;
  textFormat?: string;
  associationDirection?: string;
  categoryValueRef?: ModdleElement;
  categoryValue?: ModdleElement[];
  value?: string;
  processRef?: ModdleElement;
  sourceRef?: ModdleElement;
  targetRef?: ModdleElement;
  flowElements?: ModdleElement[];
  laneSets?: Array<ModdleElement & { lanes?: ModdleElement[] }>;
  lanes?: ModdleElement[];
  flowNodeRef?: ModdleElement[];
  childLaneSet?: ModdleElement;
  participants?: ModdleElement[];
  messageFlows?: ModdleElement[];
  artifacts?: ModdleElement[];
  incoming?: SequenceFlow[];
  outgoing?: SequenceFlow[];
  conditionExpression?: {
    $type?: string;
    body?: unknown;
    language?: unknown;
    evaluatesToTypeRef?: unknown;
    $attrs?: Record<string, unknown>;
  };
  default?: ModdleElement;
  extensionElements?: {
    values?: Array<{ $type?: string; iconKey?: unknown }>;
  };
  eventDefinitions?: ModdleElement[];
  messageRef?: ModdleElement;
  timeDate?: FormalExpressionElement;
  timeDuration?: FormalExpressionElement;
  timeCycle?: FormalExpressionElement;
  eventGatewayType?: unknown;
  instantiate?: unknown;
  implementation?: unknown;
  operationRef?: unknown;
  attachedToRef?: ModdleElement;
  cancelActivity?: unknown;
  itemRef?: unknown;
  renderings?: unknown[];
  resources?: unknown[];
  ioSpecification?: unknown;
  dataInputs?: unknown[];
  dataOutputs?: unknown[];
  loopCharacteristics?: unknown;
  isForCompensation?: unknown;
  completionQuantity?: unknown;
  startQuantity?: unknown;
  eventDefinitionRef?: unknown[];
  parallelMultiple?: unknown;
  $parent?: ModdleElement;
  $descriptor?: {
    properties?: Array<{
      name?: string;
      isReference?: boolean;
      isMany?: boolean;
    }>;
  };
};

function projectArtifact(
  element: ModdleElement,
  context: {
    readonly parentId?: string;
    readonly processId?: string;
    readonly participantId?: string;
  } = {},
): CoreBpmnElement {
  return {
    id: element.id,
    type: element.$type,
    ...(element.name ? { name: element.name } : {}),
    ...(typeof element.text === "string" ? { text: element.text } : {}),
    ...(typeof element.textFormat === "string"
      ? { textFormat: element.textFormat }
      : {}),
    ...(element.sourceRef?.id ? { sourceId: element.sourceRef.id } : {}),
    ...(element.targetRef?.id ? { targetId: element.targetRef.id } : {}),
    ...(typeof element.associationDirection === "string"
      ? { associationDirection: element.associationDirection }
      : {}),
    ...(element.categoryValueRef?.id
      ? { categoryValueRefId: element.categoryValueRef.id }
      : {}),
    ...context,
    incoming: [],
    outgoing: [],
  };
}

function projectCategories(
  definitions: Definitions,
): readonly CoreBpmnElement[] {
  const categories = (
    definitions.rootElements as unknown as ModdleElement[]
  ).filter((element) => element.$type === "bpmn:Category");
  return categories.flatMap((category) => [
    {
      id: category.id,
      type: category.$type,
      categoryValueIds: (category.categoryValue ?? []).map(
        (value) => value.id,
      ),
      incoming: [],
      outgoing: [],
    },
    ...(category.categoryValue ?? []).map((value) => ({
      id: value.id,
      type: value.$type,
      ...(typeof value.value === "string" ? { value: value.value } : {}),
      parentId: category.id,
      incoming: [],
      outgoing: [],
    })),
  ]);
}

function projectShape(shape: BPMNShape) {
  const colored = shape as BPMNShape & {
    id: string;
    fill?: unknown;
    stroke?: unknown;
    isExpanded?: unknown;
    isHorizontal?: unknown;
    isMarkerVisible?: unknown;
  };
  return {
    diId: colored.id,
    elementId: shape.bpmnElement!.id,
    x: shape.bounds!.x,
    y: shape.bounds!.y,
    width: shape.bounds!.width,
    height: shape.bounds!.height,
    ...(typeof colored.fill === "string" ? { fill: colored.fill } : {}),
    ...(typeof colored.stroke === "string" ? { stroke: colored.stroke } : {}),
    ...(typeof colored.isExpanded === "boolean"
      ? { isExpanded: colored.isExpanded }
      : {}),
    ...(typeof colored.isHorizontal === "boolean"
      ? { isHorizontal: colored.isHorizontal }
      : {}),
    ...(typeof colored.isMarkerVisible === "boolean"
      ? { isMarkerVisible: colored.isMarkerVisible }
      : {}),
    ...(shape.label?.bounds
      ? {
          labelBounds: {
            x: shape.label.bounds.x,
            y: shape.label.bounds.y,
            width: shape.label.bounds.width,
            height: shape.label.bounds.height,
          },
        }
      : {}),
  };
}

function projectEdge(edge: BPMNEdge) {
  const colored = edge as BPMNEdge & {
    id: string;
    fill?: unknown;
    stroke?: unknown;
  };
  return {
    diId: colored.id,
    elementId: edge.bpmnElement!.id,
    waypoints: edge.waypoint.map((point) => ({ x: point.x, y: point.y })),
    ...(typeof colored.fill === "string" ? { fill: colored.fill } : {}),
    ...(typeof colored.stroke === "string" ? { stroke: colored.stroke } : {}),
    ...(edge.label?.bounds
      ? {
          labelBounds: {
            x: edge.label.bounds.x,
            y: edge.label.bounds.y,
            width: edge.label.bounds.width,
            height: edge.label.bounds.height,
          },
        }
      : {}),
  };
}

function messageReferenceObservations(
  elementsById: Record<string, BaseElement>,
  profileId: BpmnProfileId,
): readonly MessageReferenceObservation[] {
  const observations: MessageReferenceObservation[] = [];
  for (const rawElement of Object.values(elementsById)) {
    const element = rawElement as unknown as ModdleElement;
    for (const property of element.$descriptor?.properties ?? []) {
      if (!property.isReference || !property.name) continue;
      const rawValue = (element as unknown as Record<string, unknown>)[
        property.name
      ];
      const values = property.isMany
        ? Array.isArray(rawValue)
          ? rawValue
          : []
        : rawValue
          ? [rawValue]
          : [];
      for (const value of values) {
        const target = value as ModdleElement;
        if (target?.$type !== "bpmn:Message" || !target.id) continue;
        const parent = element.$parent;
        const supportedDefinitionOwner =
          element.$type === "bpmn:MessageEventDefinition" &&
          property.name === "messageRef" &&
          (parent?.$type === "bpmn:IntermediateCatchEvent" ||
            (parent?.$type === "bpmn:IntermediateThrowEvent" &&
              supportsIntermediateEvents(profileId)) ||
            (parent?.$type === "bpmn:BoundaryEvent" &&
              supportsBoundaryEvents(profileId)));
        const supportedReceiveOwner =
          element.$type === "bpmn:ReceiveTask" &&
          property.name === "messageRef";
        observations.push({
          messageId: target.id,
          ownerId:
            supportedDefinitionOwner && parent?.id
              ? parent.id
              : element.id,
          ownerType:
            supportedDefinitionOwner && parent
              ? parent.$type
              : element.$type,
          ...(supportedDefinitionOwner
            ? { definitionId: element.id }
            : {}),
          property: supportedReceiveOwner
            ? "ReceiveTask.messageRef"
            : supportedDefinitionOwner
              ? "MessageEventDefinition.messageRef"
              : `${element.$type}.${property.name}`,
          supported:
            supportedDefinitionOwner || supportedReceiveOwner,
        });
      }
    }
  }
  return observations;
}

function categoryReferenceObservations(
  elementsById: Record<string, BaseElement>,
  profileId: BpmnProfileId,
): readonly CategoryReferenceObservation[] {
  const observations: CategoryReferenceObservation[] = [];
  for (const rawElement of Object.values(elementsById)) {
    const element = rawElement as unknown as ModdleElement;
    for (const property of element.$descriptor?.properties ?? []) {
      if (!property.isReference || !property.name) continue;
      const rawValue = (element as unknown as Record<string, unknown>)[
        property.name
      ];
      const values = property.isMany
        ? Array.isArray(rawValue) ? rawValue : []
        : rawValue ? [rawValue] : [];
      for (const value of values) {
        const target = value as ModdleElement;
        if (target?.$type !== "bpmn:CategoryValue" || !target.id) continue;
        const supported =
          supportsFullAuthoring(profileId) &&
          element.$type === "bpmn:Group" &&
          property.name === "categoryValueRef";
        observations.push({
          categoryValueId: target.id,
          ownerId: element.id,
          ownerType: element.$type,
          property: supported
            ? "Group.categoryValueRef"
            : `${element.$type}.${property.name}`,
          supported,
        });
      }
    }
  }
  return observations;
}

function dataStoreReferenceObservations(
  elementsById: Record<string, BaseElement>,
  profileId: BpmnProfileId,
): readonly DataStoreReferenceObservation[] {
  const observations: DataStoreReferenceObservation[] = [];
  for (const rawElement of Object.values(elementsById)) {
    const element = rawElement as unknown as ModdleElement;
    for (const property of element.$descriptor?.properties ?? []) {
      if (!property.isReference || !property.name) continue;
      const rawValue = (element as unknown as Record<string, unknown>)[
        property.name
      ];
      const values = property.isMany
        ? Array.isArray(rawValue) ? rawValue : []
        : rawValue ? [rawValue] : [];
      for (const value of values) {
        const target = value as ModdleElement;
        if (target?.$type !== "bpmn:DataStore" || !target.id) continue;
        const supported =
          supportsDataAuthoring(profileId) &&
          element.$type === "bpmn:DataStoreReference" &&
          property.name === "dataStoreRef";
        observations.push({
          dataStoreId: target.id,
          referenceId: element.id,
          supported,
        });
      }
    }
  }
  return observations;
}

function nodeIcon(element: ModdleElement) {
  const visual = (
    (element.extensionElements?.values ?? []) as unknown as Array<{
      $type?: string;
      iconKey?: unknown;
    }>
  ).find(
    (value) => value.$type === "teb:NodeVisual",
  );
  return typeof visual?.iconKey === "string" ? visual.iconKey : undefined;
}

function createCollaborationSnapshot(
  definitions: Definitions,
  elementsById: Record<string, BaseElement>,
  profileId: CollaborationBpmnProfileId,
): CollaborationBpmnSnapshot {
  const roots = definitions.rootElements as unknown as ModdleElement[];
  const collaborations = roots.filter(
    (element) => element.$type === "bpmn:Collaboration",
  );
  const collaboration = collaborations[0];
  const processes = roots.filter((element) => element.$type === "bpmn:Process");
  const participants = (collaboration?.participants ?? []).map((participant) => ({
    id: participant.id,
    ...(participant.name ? { name: participant.name } : {}),
    ...(participant.processRef?.id
      ? { processId: participant.processRef.id }
      : {}),
  }));
  const participantByProcess = new Map(
    participants
      .filter((participant) => participant.processId)
      .map((participant) => [participant.processId!, participant.id] as const),
  );
  const elements: CoreBpmnSnapshot["elements"][number][] = [];

  if (collaboration) {
    elements.push({
      id: collaboration.id,
      type: collaboration.$type,
      incoming: [],
      outgoing: [],
    });
  }
  for (const participant of participants) {
    elements.push({
      id: participant.id,
      type: "bpmn:Participant",
      ...(participant.name ? { name: participant.name } : {}),
      ...(participant.processId ? { processId: participant.processId } : {}),
      participantId: participant.id,
      parentId: collaboration?.id,
      incoming: [],
      outgoing: [],
    });
  }

  const lanes: CollaborationBpmnSnapshot["lanes"][number][] = [];
  const appendLaneSet = (
    laneSet: ModdleElement,
    process: ModdleElement,
    participantId: string | undefined,
    parentLaneId: string | undefined,
    depth: number,
  ) => {
    elements.push({
      id: laneSet.id,
      type: laneSet.$type,
      processId: process.id,
      ...(participantId ? { participantId } : {}),
      ...(parentLaneId ? { parentId: parentLaneId } : {}),
      incoming: [],
      outgoing: [],
    });
    for (const lane of laneSet.lanes ?? []) {
      const flowNodeIds = (lane.flowNodeRef ?? []).map((node) => node.id);
      lanes.push({
        id: lane.id,
        ...(lane.name ? { name: lane.name } : {}),
        participantId: participantId ?? "",
        processId: process.id,
        ...(parentLaneId ? { parentLaneId } : {}),
        ...(profileId !== "teb-collaboration-starter@1" ? { depth } : {}),
        flowNodeIds,
      });
      elements.push({
        id: lane.id,
        type: lane.$type,
        ...(lane.name ? { name: lane.name } : {}),
        processId: process.id,
        ...(participantId ? { participantId } : {}),
        parentId: parentLaneId ?? participantId,
        incoming: [],
        outgoing: [],
      });
      if (lane.childLaneSet) {
        appendLaneSet(
          lane.childLaneSet,
          process,
          participantId,
          lane.id,
          depth + 1,
        );
      }
    }
  };
  for (const process of processes) {
    const participantId = participantByProcess.get(process.id);
    elements.push({
      id: process.id,
      type: process.$type,
      ...(process.name ? { name: process.name } : {}),
      ...(supportsActivityContainers(profileId)
        ? { isExecutable: process.isExecutable === true }
        : {}),
      ...(participantId ? { participantId } : {}),
      incoming: [],
      outgoing: [],
    });
    for (const laneSet of process.laneSets ?? []) {
      appendLaneSet(laneSet, process, participantId, undefined, 0);
    }
    if (supportsActivityContainers(profileId)) {
      elements.push(
        ...projectAdvancedProcess(process, participantId).slice(1),
      );
      continue;
    }
    for (const element of process.flowElements ?? []) {
      const sequence = element.$type === "bpmn:SequenceFlow";
      const iconKey = nodeIcon(element);
      elements.push({
        id: element.id,
        type: element.$type,
        ...(element.name ? { name: element.name } : {}),
        processId: process.id,
        ...(participantId ? { participantId } : {}),
        ...(sequence && element.sourceRef?.id
          ? { sourceId: element.sourceRef.id }
          : {}),
        ...(sequence && element.targetRef?.id
          ? { targetId: element.targetRef.id }
          : {}),
        ...(sequence && element.conditionExpression
          ? {
              conditionExpression:
                typeof element.conditionExpression.body === "string"
                  ? element.conditionExpression.body
                  : "",
            }
          : {}),
        ...(element.default?.id
          ? { defaultFlowId: element.default.id }
          : {}),
        ...eventMetadata(element),
        incoming: flowIds(element.incoming),
        outgoing: flowIds(element.outgoing),
        ...(iconKey ? { iconKey } : {}),
      });
    }
    for (const artifact of process.artifacts ?? []) {
      elements.push(projectArtifact(artifact, {
        parentId: process.id,
        processId: process.id,
        ...(participantId ? { participantId } : {}),
      }));
    }
  }
  for (const artifact of collaboration?.artifacts ?? []) {
    elements.push(projectArtifact(artifact, {
      parentId: collaboration.id,
    }));
  }
  for (const flow of collaboration?.messageFlows ?? []) {
    elements.push({
      id: flow.id,
      type: flow.$type,
      ...(flow.name ? { name: flow.name } : {}),
      parentId: collaboration.id,
      ...(flow.sourceRef?.id ? { sourceId: flow.sourceRef.id } : {}),
      ...(flow.targetRef?.id ? { targetId: flow.targetRef.id } : {}),
      incoming: [],
      outgoing: [],
    });
  }
  for (const message of roots.filter(
    (element) => element.$type === "bpmn:Message",
  )) {
    elements.push({
      id: message.id,
      type: message.$type,
      ...(message.name ? { name: message.name } : {}),
      incoming: [],
      outgoing: [],
    });
  }
  if (supportsDataAuthoring(profileId)) {
    for (const store of roots.filter(
      (element) => element.$type === "bpmn:DataStore",
    )) {
      elements.push({
        id: store.id,
        type: store.$type,
        ...(store.name ? { name: store.name } : {}),
        incoming: [],
        outgoing: [],
      });
    }
  }
  elements.push(...projectCategories(definitions));
  for (const element of Object.values(elementsById)
    .filter(
      (candidate) =>
        candidate.$type.startsWith("bpmn:") &&
        candidate.$type !== "bpmn:Definitions" &&
        candidate.$type !== "bpmn:MessageEventDefinition" &&
        candidate.$type !== "bpmn:TimerEventDefinition" &&
        candidate.$type !== "bpmn:FormalExpression" &&
        candidate.$type !== "bpmn:Message" &&
        !isNativeDataInputTarget(candidate, profileId) &&
        !elements.some((known) => known.id === candidate.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id))) {
    elements.push({
      id: element.id,
      type: element.$type,
      ...("name" in element &&
      typeof (element as BaseElement & { name?: unknown }).name === "string"
        ? { name: (element as BaseElement & { name: string }).name }
        : {}),
      incoming: [],
      outgoing: [],
    });
  }

  const plane = definitions.diagrams[0]?.plane;
  const planeElements = definitions.diagrams.flatMap(
    (diagram) => diagram.plane?.planeElement ?? [],
  );
  const shapes = planeElements
    .filter((element): element is BPMNShape => element.$type === "bpmndi:BPMNShape")
    .filter((shape) => shape.bpmnElement?.id && shape.bounds)
    .map(projectShape);
  const edges = planeElements
    .filter((element): element is BPMNEdge => element.$type === "bpmndi:BPMNEdge")
    .filter((edge) => edge.bpmnElement?.id)
    .map(projectEdge);
  return {
    profileId,
    collaborationId:
      collaborations.length === 1 ? collaboration?.id : undefined,
    planeElementId: plane?.bpmnElement?.id,
    planeCount: definitions.diagrams.filter((diagram) => diagram.plane).length,
    elements,
    participants,
    lanes,
    shapes,
    edges,
  };
}

export async function inspectBpmnXml(
  xml: string,
  profileId: BpmnProfileId = coreBpmnProfile.id,
): Promise<BpmnInspectionResult> {
  const initialIssues = lexicalIssues(xml, profileId);
  if (initialIssues.some((item) => item.disposition === "fatal")) {
    return rejected(initialIssues, profileId);
  }

  try {
    const moddle = new BpmnModdle(
      profileId === coreBpmnVisualProfile.id ||
      supportsStructuredRouting(profileId) ||
      isCollaborationBpmnProfileId(profileId)
        ? { teb: tebModdleDescriptor }
        : undefined,
    );
    const parsed = await moddle.fromXML(xml);
    const definitions = parsed.rootElement as Definitions;
    if (definitions.$type !== "bpmn:Definitions") {
      return rejected([
        boundaryIssue(
          "BPMN-XML-001",
          "Root element không phải BPMN Definitions.",
          "Export lại tệp dưới định dạng BPMN 2.0 XML.",
        ),
      ], profileId);
    }

    const snapshot =
      isCollaborationBpmnProfileId(profileId)
        ? createCollaborationSnapshot(
            definitions,
            parsed.elementsById,
            profileId,
          )
        : createSnapshot(definitions, parsed.elementsById, profileId);
    const messageRegistry = projectMessageRegistry(
      snapshot.elements,
      messageReferenceObservations(parsed.elementsById, profileId),
    );
    const categoryRegistry = projectCategoryRegistry(
      snapshot.elements,
      categoryReferenceObservations(parsed.elementsById, profileId),
    );
    const dataStoreRegistry = projectDataStoreRegistry(
      snapshot.elements,
      dataStoreReferenceObservations(parsed.elementsById, profileId),
    );
    const visualIssues: BpmnInspectionIssue[] = [];
    const conditionalExpressionIssues: BpmnInspectionIssue[] = [];
    const eventContractIssues: BpmnInspectionIssue[] = [];
    // ID-indexed maps omit id-less contained properties; traverse containment too.
    for (const property of containedProperties(definitions)) {
      if (!isNativeDataInputTarget(property, profileId)) {
        eventContractIssues.push(boundaryIssue(
          "BPMN-PROFILE-003",
          "Thuộc tính dữ liệu nằm ngoài phạm vi hỗ trợ.",
          "Chỉ giữ tham chiếu nội bộ do đường dữ liệu đi vào công việc tạo ra.",
        ));
      }
    }
    for (const parsedElement of Object.values(parsed.elementsById)) {
      const input = parsedElement as ModdleElement;
      if (input.$type === "bpmn:DataInputAssociation" &&
          input.targetRef?.$type === "bpmn:Property" &&
          input.$parent !== input.targetRef.$parent) {
        eventContractIssues.push(boundaryIssue(
          "BPMN-PROFILE-003",
          "Tham chiếu dữ liệu không thuộc công việc nhận dữ liệu.",
          "Nối lại đường dữ liệu vào đúng công việc.",
        ));
      }
      const extensionValues =
        (
          parsedElement as BaseElement & {
            extensionElements?: {
              values?: Array<{ $type?: string }>;
            };
          }
        ).extensionElements?.values ?? [];
      const nodeVisualCount = (
        extensionValues as unknown as Array<{ $type?: string }>
      ).filter((value) => value.$type === "teb:NodeVisual").length;
      if (nodeVisualCount > 1) {
        visualIssues.push(
          boundaryIssue(
            "BPMN-VISUAL-006",
            "Một BPMN element chứa node visual trùng lặp.",
            "Giữ tối đa một teb:nodeVisual trên mỗi flow node.",
          ),
        );
      }
      const conditionExpression = (
        parsedElement as BaseElement & {
          conditionExpression?: {
            $type?: string;
            body?: unknown;
            language?: unknown;
            evaluatesToTypeRef?: unknown;
            $attrs?: Record<string, unknown>;
          };
        }
      ).conditionExpression;
      if (conditionExpression) {
        const body = conditionExpression.body;
        const rawAttributes = conditionExpression.$attrs ?? {};
        const unsupportedAttributes =
          conditionExpression.language !== undefined ||
          conditionExpression.evaluatesToTypeRef !== undefined ||
          Object.entries(rawAttributes).some(
            ([name, value]) =>
              name !== "xsi:type" || value !== "bpmn:tFormalExpression",
          );
        if (
          conditionExpression.$type !== "bpmn:FormalExpression" ||
          typeof body !== "string" ||
          !body.trim() ||
          Array.from(body).length > maxConditionExpressionCharacters ||
          unsupportedAttributes
        ) {
          conditionalExpressionIssues.push(
            boundaryIssue(
              "BPMN-COND-002",
              "Condition phải là FormalExpression text thuần, không thuộc tính thực thi và tối đa 500 ký tự.",
              "Dùng condition text thuần không rỗng; bỏ language, type reference và extension.",
            ),
          );
        }
      }

      const eventElement = parsedElement as unknown as ModdleElement;
      if (
        eventElement.$type === "bpmn:SubProcess" &&
        [
          "loopCharacteristics",
          "isForCompensation",
          "ioSpecification",
          "resources",
          "completionQuantity",
          "startQuantity",
        ].some((property) => hasOwn(eventElement, property))
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-SUBPROCESS-005",
            "SubProcess chứa execution/loop/resource metadata ngoài profile.",
            "Chỉ giữ expanded embedded hierarchy và bounded flow semantics.",
          ),
        );
      }
      if (
        eventElement.$type === "bpmn:CallActivity" &&
        [
          "loopCharacteristics",
          "isForCompensation",
          "ioSpecification",
          "resources",
          "completionQuantity",
          "startQuantity",
        ].some((property) => hasOwn(eventElement, property))
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-CALL-004",
            "Call Activity chứa IO/execution metadata ngoài modeling reference.",
            "Chỉ giữ calledElement local stable ID.",
          ),
        );
      }
      if (
        ["bpmn:DataObject", "bpmn:DataObjectReference", "bpmn:DataStore",
          "bpmn:DataStoreReference"].includes(eventElement.$type) &&
        ["itemSubjectRef", "dataState", "capacity"].some(
          (property) => hasOwn(eventElement, property),
        )
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-DATA-003",
            "Data element chứa schema/state/capacity ngoài bounded profile.",
            "Chỉ giữ stable ID, name, backing reference và DI.",
          ),
        );
      }
      if (
        ["bpmn:DataInputAssociation", "bpmn:DataOutputAssociation"].includes(
          eventElement.$type,
        ) &&
        ["transformation", "assignment"].some(
          (property) => hasOwn(eventElement, property),
        )
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-DATA-ASSOC-002",
            "Data Association transformation/assignment nằm ngoài profile.",
            "Chỉ giữ directional Activity-owned source/target reference.",
          ),
        );
      }
      if (eventElement.$type === "bpmn:ComplexGateway") {
        const expression = eventElement.activationCondition;
        const attributes = expression?.$attrs ?? {};
        if (
          expression &&
          (expression.$type !== "bpmn:FormalExpression" ||
            typeof expression.body !== "string" ||
            expression.language !== undefined ||
            expression.evaluatesToTypeRef !== undefined ||
            Object.entries(attributes).some(
              ([name, value]) =>
                name !== "xsi:type" || value !== "bpmn:tFormalExpression",
            ))
        ) {
          eventContractIssues.push(
            boundaryIssue(
              "BPMN-COMPLEX-005",
              "activationCondition chứa expression metadata ngoài inert profile.",
              "Dùng plain-text bpmn:FormalExpression không language/type/extension.",
            ),
          );
        }
      }
      if (
        eventElement.$type === "bpmn:IntermediateCatchEvent" ||
        eventElement.$type === "bpmn:BoundaryEvent"
      ) {
        const definitions = eventElement.eventDefinitions ?? [];
        const supportedDefinitions = definitions.filter((definition) =>
          definition.$type === "bpmn:MessageEventDefinition" ||
          definition.$type === "bpmn:TimerEventDefinition"
        );
        if (definitions.length === 0) {
          eventContractIssues.push(
            recoverableIssue(
              "BPMN-EVT-001",
              "Intermediate Catch Event chưa chọn Message hoặc Timer definition.",
              "Chọn đúng một supported catching event definition trước khi seal.",
            ),
          );
        } else if (
          definitions.length !== 1 ||
          supportedDefinitions.length !== 1
        ) {
          eventContractIssues.push(
            boundaryIssue(
              "BPMN-EVT-001",
              "Intermediate Catch Event chứa nhiều hoặc unsupported definition.",
              "Giữ đúng một Message hoặc Timer definition.",
            ),
          );
        } else {
          const definition = supportedDefinitions[0]!;
          if (
            typeof definition.id !== "string" ||
            !definition.id.trim()
          ) {
            eventContractIssues.push(
              boundaryIssue(
                "BPMN-EVT-001",
                "Event Definition thiếu semantic ID ổn định.",
                "Đặt ID duy nhất cho Message hoặc Timer Event Definition.",
              ),
            );
          }
          if (
            definition.$type === "bpmn:MessageEventDefinition" &&
            !definition.messageRef?.id
          ) {
            eventContractIssues.push(
              recoverableIssue(
                "BPMN-MSG-004",
                "Message Event Definition thiếu root messageRef.",
                "Tham chiếu một bpmn:Message ở Definitions root trước khi seal.",
              ),
            );
          }
          if (
            definition.$type === "bpmn:MessageEventDefinition" &&
            definition.operationRef !== undefined
          ) {
            eventContractIssues.push(
              boundaryIssue(
                "BPMN-MSG-008",
                "Message Event Definition chứa operationRef ngoài modeling profile.",
                "Bỏ operationRef và chỉ giữ root messageRef.",
              ),
            );
          }
          if (definition.$type === "bpmn:TimerEventDefinition") {
            const expressions = [
              definition.timeDate,
              definition.timeDuration,
              definition.timeCycle,
            ].filter(Boolean) as FormalExpressionElement[];
            const selectedCount =
              Number(Boolean(definition.timeDate)) +
              Number(Boolean(definition.timeDuration));
            const expression = expressions[0];
            const attributes = expression?.$attrs ?? {};
            const inertExpression =
              expression?.$type === "bpmn:FormalExpression" &&
              typeof expression.body === "string" &&
              Array.from(expression.body).length <=
                maxTimerExpressionCharacters &&
              expression.language === undefined &&
              expression.evaluatesToTypeRef === undefined &&
              Object.entries(attributes).every(
                ([name, value]) =>
                  name === "xsi:type" &&
                  value === "bpmn:tFormalExpression",
              );
            if (expressions.length === 0) {
              eventContractIssues.push(
                recoverableIssue(
                  "BPMN-TIMER-001",
                  "Timer Event Definition chưa có date hoặc duration.",
                  "Nhập timeDate hoặc timeDuration trước khi seal.",
                ),
              );
            } else if (
              selectedCount !== 1 ||
              definition.timeCycle !== undefined ||
              expressions.length !== 1 ||
              !inertExpression
            ) {
              eventContractIssues.push(
                boundaryIssue(
                  "BPMN-TIMER-001",
                  "Timer chỉ hỗ trợ đúng một inert timeDate hoặc timeDuration.",
                  "Bỏ timeCycle, language, type reference và extension attributes.",
                ),
              );
            }
          }
        }
      }
      if (eventElement.$type === "bpmn:IntermediateThrowEvent") {
        const definitions = eventElement.eventDefinitions ?? [];
        if (
          definitions.length > 1 ||
          (definitions.length === 1 &&
            definitions[0]?.$type !== "bpmn:MessageEventDefinition")
        ) {
          eventContractIssues.push(
            boundaryIssue(
              "BPMN-THROW-001",
              "Intermediate Throw chỉ hỗ trợ None hoặc đúng một Message definition.",
              "Bỏ definition hoặc dùng một MessageEventDefinition.",
            ),
          );
        } else if (definitions[0]) {
          const definition = definitions[0];
          if (!definition.id?.trim()) {
            eventContractIssues.push(
              boundaryIssue(
                "BPMN-THROW-001",
                "Message Throw definition thiếu stable ID.",
                "Đặt ID duy nhất cho MessageEventDefinition.",
              ),
            );
          }
          if (!definition.messageRef?.id) {
            eventContractIssues.push(
              recoverableIssue(
                "BPMN-MSG-004",
                "Message Throw chưa chọn root Message.",
                "Chọn một Definitions-root Message trước khi seal.",
              ),
            );
          }
          if (definition.operationRef !== undefined) {
            eventContractIssues.push(
              boundaryIssue(
                "BPMN-MSG-008",
                "Message Throw operationRef nằm ngoài modeling profile.",
                "Bỏ operationRef và chỉ giữ root messageRef.",
              ),
            );
          }
        }
      }
      if (
        eventElement.$type === "bpmn:ReceiveTask" &&
        (eventElement.implementation !== undefined ||
          eventElement.operationRef !== undefined ||
          eventElement.instantiate === true)
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-RECEIVE-001",
            "Receive Task chứa thuộc tính thực thi ngoài bounded profile.",
            "Bỏ implementation/operation và đặt instantiate=false.",
          ),
        );
      }
      if (
        [
          "bpmn:Task",
          "bpmn:UserTask",
          "bpmn:ServiceTask",
          "bpmn:ManualTask",
        ].includes(eventElement.$type) &&
        [
          "implementation",
          "operationRef",
          "renderings",
          "resources",
          "ioSpecification",
          "dataInputs",
          "dataOutputs",
          ...(!supportsDataAuthoring(profileId)
            ? ["dataInputAssociations", "dataOutputAssociations"]
            : []),
          "loopCharacteristics",
          "isForCompensation",
          "completionQuantity",
          "startQuantity",
        ].some((property) => hasOwn(eventElement, property))
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-TASK-002",
            "Task chứa execution/resource/IO metadata ngoài bounded profile.",
            "Chỉ giữ ID, name, incoming/outgoing, DI và node visual.",
          ),
        );
      }
      if (
        [
          "bpmn:IntermediateCatchEvent",
          "bpmn:IntermediateThrowEvent",
          "bpmn:BoundaryEvent",
        ].includes(eventElement.$type) &&
        [
          "eventDefinitionRef",
          "dataInputs",
          "dataOutputs",
          "dataInputAssociations",
          "dataOutputAssociations",
          "parallelMultiple",
        ].some((property) => hasOwn(eventElement, property))
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-EVT-002",
            "Event chứa reference/data/multiple metadata ngoài bounded profile.",
            "Chỉ giữ nested Message/Timer definition được profile hỗ trợ.",
          ),
        );
      }
      if (
        eventElement.$type === "bpmn:Message" &&
        eventElement.itemRef !== undefined
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-MSG-008",
            "Root Message itemRef/payload schema nằm ngoài registry profile.",
            "Bỏ itemRef; registry chỉ quản lý stable ID và bounded name.",
          ),
        );
      }
      if (
        eventElement.$type === "bpmn:MessageFlow" &&
        eventElement.messageRef !== undefined
      ) {
        eventContractIssues.push(
          boundaryIssue(
            "BPMN-MSG-008",
            "MessageFlow.messageRef chưa thuộc supported owner set.",
            "Bỏ hidden ref; registry hiện chỉ hỗ trợ Event Definition và Receive Task.",
          ),
        );
      }
    }
    for (const element of snapshot.elements) {
      if (element.iconKey && !supportsNodeVisual(element.type)) {
        visualIssues.push(
          boundaryIssue(
            "BPMN-VISUAL-004",
            "Biểu tượng đang gắn vào thành phần chưa được hỗ trợ.",
            "Chỉ chọn biểu tượng cho điểm bắt đầu, công việc, điểm quyết định hoặc điểm kết thúc.",
          ),
        );
      } else if (element.iconKey && !isNodeIconKey(element.iconKey)) {
        visualIssues.push(
          boundaryIssue(
            "BPMN-VISUAL-005",
            "Biểu tượng đã chọn không còn trong danh sách.",
            "Chọn lại biểu tượng trong danh sách của ứng dụng.",
          ),
        );
      }
    }
    const issues = [
      ...initialIssues,
      ...visualIssues,
      ...conditionalExpressionIssues,
      ...eventContractIssues,
      ...inspectMessageRegistry(messageRegistry),
      ...(supportsFullAuthoring(profileId)
        ? inspectCategoryRegistry(categoryRegistry)
        : []),
      ...(isCollaborationBpmnProfileId(profileId)
        ? inspectCollaborationSnapshot(snapshot as CollaborationBpmnSnapshot)
        : inspectCoreSnapshot(snapshot as CoreBpmnSnapshot)),
    ];
    if (parsed.warnings.length > 0) {
      issues.push(
        boundaryIssue(
          "BPMN-XML-002",
          "Parser phát hiện tham chiếu hoặc cấu trúc XML không hoàn chỉnh.",
          "Sửa các cảnh báo XML trước khi import.",
        ),
      );
    }
    const safeToPersist = !issues.some(
      (item) => item.disposition === "fatal",
    );
    if (!safeToPersist) {
      return {
        ...rejected(issues, profileId),
        messageRegistry,
        categoryRegistry,
        dataStoreRegistry,
        outline:
          isCollaborationBpmnProfileId(profileId)
            ? projectCollaborationOutline(
                snapshot as CollaborationBpmnSnapshot,
              )
            : projectCoreOutline(snapshot as CoreBpmnSnapshot),
      };
    }

    const serialized = await moddle.toXML(definitions, { format: true });
    const reparsed = await moddle.fromXML(serialized.xml);
    const secondSnapshot =
      isCollaborationBpmnProfileId(profileId)
        ? createCollaborationSnapshot(
            reparsed.rootElement as Definitions,
            reparsed.elementsById,
            profileId,
          )
        : createSnapshot(
            reparsed.rootElement as Definitions,
            reparsed.elementsById,
            profileId,
          );
    const secondMessageRegistry = projectMessageRegistry(
      secondSnapshot.elements,
      messageReferenceObservations(reparsed.elementsById, profileId),
    );
    const secondCategoryRegistry = projectCategoryRegistry(
      secondSnapshot.elements,
      categoryReferenceObservations(reparsed.elementsById, profileId),
    );
    const secondDataStoreRegistry = projectDataStoreRegistry(
      secondSnapshot.elements,
      dataStoreReferenceObservations(reparsed.elementsById, profileId),
    );
    const secondSerialization = await moddle.toXML(
      reparsed.rootElement as Definitions,
      { format: true },
    );
    if (
      JSON.stringify(snapshot) !== JSON.stringify(secondSnapshot) ||
      JSON.stringify(messageRegistry) !==
        JSON.stringify(secondMessageRegistry) ||
      JSON.stringify(categoryRegistry) !==
        JSON.stringify(secondCategoryRegistry) ||
      JSON.stringify(dataStoreRegistry) !==
        JSON.stringify(secondDataStoreRegistry) ||
      serialized.xml !== secondSerialization.xml
    ) {
      return rejected(
        [
          boundaryIssue(
            "BPMN-ROUNDTRIP-001",
            "BPMN không ổn định qua vòng parse/serialize an toàn.",
            "Export lại model bằng Studio trước khi lưu.",
          ),
        ],
        profileId,
      );
    }
    const readyToSeal = !issues.some(
      (item) => item.disposition === "recoverable",
    );
    return {
      accepted: true,
      safeToPersist: true,
      readyToSeal,
      profileId,
      issues,
      outline:
        isCollaborationBpmnProfileId(profileId)
          ? projectCollaborationOutline(snapshot as CollaborationBpmnSnapshot)
          : projectCoreOutline(snapshot as CoreBpmnSnapshot),
      snapshot,
      messageRegistry,
      categoryRegistry,
      dataStoreRegistry,
      canonicalXml: serialized.xml,
    };
  } catch {
    return rejected([
      boundaryIssue(
        "BPMN-XML-001",
        "Không thể đọc BPMN XML.",
        "Kiểm tra XML well-formed và namespace BPMN/DI.",
      ),
    ], profileId);
  }
}


const bpmnInColorNamespace = "http://www.omg.org/spec/BPMN/non-normative/color/1.0";

/** Explicit file-import adapter. Persisted-profile inspection remains unchanged. */
export async function prepareBpmnFileImport(
  xml: string,
  profileId: BpmnProfileId,
): Promise<{ readonly inspection: BpmnInspectionResult; readonly notices: readonly string[] }> {
  if (!xml.includes(bpmnInColorNamespace)) {
    return { inspection: await inspectBpmnXml(xml, profileId), notices: [] };
  }
  const preflight = lexicalIssues(xml, profileId, true);
  if (preflight.some((item) => item.disposition === "fatal")) {
    return { inspection: rejected(preflight, profileId), notices: [] };
  }
  const invalid = () => ({
    inspection: rejected([boundaryIssue(
      "BPMN-COLOR-001",
      "Màu nhập vào chưa tương thích với bảng màu Studio.",
      "Chỉ dùng background-color/border-color trên DI với màu trong bảng Studio; không dùng màu chữ hoặc màu xung đột.",
    )], profileId),
    notices: [],
  });
  try {
    const moddle = new BpmnModdle({ teb: tebModdleDescriptor });
    const parsed = await moddle.fromXML(xml);
    // Never let serialization silently discard unknown elements/references.
    if (parsed.warnings.length) return invalid();
    type ColorElement = BaseElement & {
      $descriptor: { properties: readonly { name: string; isReference?: boolean }[] };
      $attrs: Record<string, string>;
      get(name: string): unknown;
      set(name: string, value: unknown): void;
    };
    const colorPrefixes = new Set([...xml.matchAll(/xmlns:([\w.-]+)\s*=\s*["']([^"']+)["']/g)]
      .filter((match) => match[2] === bpmnInColorNamespace).map((match) => match[1]));
    const pending = [parsed.rootElement as ColorElement];
    const visited = new Set<ColorElement>();
    let count = 0;
    while (pending.length) {
      const element = pending.pop()!;
      if (visited.has(element)) continue;
      visited.add(element);
      // Unknown attributes are retained by moddle in $attrs; do not launder them.
      for (const [name, value] of Object.entries(element.$attrs ?? {})) {
        if (name.startsWith("xmlns") && value === bpmnInColorNamespace) {
          delete element.$attrs[name];
        } else if (!name.startsWith("xmlns") && name.includes(":")) {
          // Existing inspection validates TEB and other extensions after conversion.
          const prefix = name.split(":")[0];
          if (colorPrefixes.has(prefix)) return invalid();
        }
      }
      for (const [source, target, validate] of [
        ["background-color", "fill", isAllowedBpmnFillColor],
        ["border-color", "stroke", isAllowedBpmnStrokeColor],
      ] as const) {
        const value = element.get(`color:${source}`);
        if (value === undefined) continue;
        const shape = element.$type === "bpmndi:BPMNShape";
        const edge = element.$type === "bpmndi:BPMNEdge";
        const existing = element.get(`bioc:${target}`);
        if ((!shape && !edge) || (edge && target === "fill") ||
          !validate(value) || (existing !== undefined && existing !== value)) return invalid();
        element.set(`bioc:${target}`, value);
        element.set(`color:${source}`, undefined);
        count += 1;
      }
      if (element.get("color:color") !== undefined) return invalid();
      for (const property of element.$descriptor.properties) {
        if (property.isReference) continue;
        const value = element.get(property.name);
        for (const child of Array.isArray(value) ? value : [value]) {
          if (child && typeof child === "object" && "$type" in child) pending.push(child as ColorElement);
        }
      }
    }
    const serialized = await moddle.toXML(parsed.rootElement, { format: true });
    const inspection = await inspectBpmnXml(serialized.xml ?? "", profileId);
    return {
      inspection,
      notices: inspection.safeToPersist && count > 0
        ? ["Đã chuyển màu BPMN tương thích sang bảng màu Studio, giữ nguyên màu và nội dung quy trình."]
        : [],
    };
  } catch {
    return invalid();
  }
}


/** Suggests a fully validated profile; callers still acknowledge durable upgrades. */
export async function inspectBpmnFileImport(
  xml: string,
  profileId: BpmnProfileId = coreBpmnProfile.id,
  inferProfile = false,
): Promise<BpmnInspectionResult & { readonly importNotices: readonly string[] }> {
  const initial = await prepareBpmnFileImport(xml, profileId);
  if (initial.inspection.safeToPersist || !inferProfile) {
    return { ...initial.inspection, importNotices: initial.notices };
  }
  // Fatal XML/security/limit failures cannot be solved by selecting another profile.
  if (initial.inspection.issues.some((item) => /^BPMN-(SEC|LIMIT|XML|ID)-/.test(item.ruleId))) {
    return { ...initial.inspection, importNotices: initial.notices };
  }
  for (const profile of supportedBpmnProfiles) {
    if (profile.id === profileId) continue;
    const candidate = await prepareBpmnFileImport(xml, profile.id);
    if (candidate.inspection.safeToPersist) {
      return { ...candidate.inspection, importNotices: [
        ...candidate.notices,
        `Tệp phù hợp với ${profile.label}. Cần lưu cấu hình này trước khi tiếp tục chỉnh sửa.`,
      ] };
    }
  }
  return { ...initial.inspection, importNotices: initial.notices };
}
