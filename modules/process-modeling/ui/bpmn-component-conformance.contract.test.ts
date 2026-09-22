import { describe, expect, it } from "vitest";
import {
  collaborationBpmnProfile,
  collaborationBoundaryEventsBpmnProfile,
  collaborationCatchingEventsBpmnProfile,
  collaborationComplexRoutingBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationDataAuthoringBpmnProfile,
  collaborationEventRoutingBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  collaborationIntermediateEventsBpmnProfile,
  collaborationActivityContainersBpmnProfile,
  collaborationStructuredBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
  collaborationTaskTypesBpmnProfile,
} from "../domain/collaboration-profile";
import {
  coreActivityContainersBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreBpmnProfile,
  coreCatchingEventsBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreConditionalBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreFullAuthoringBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreStructuredBpmnProfile,
  coreTaskTypesBpmnProfile,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  bpmnLauncherToolDefinitions,
  flattenBpmnLauncherItems,
  projectBpmnLauncherGroups,
  type BpmnLauncherPreparation,
  type BpmnToolDefinition,
} from "./bpmn-component-launcher";
import {
  bpmnAppendActions,
  type BpmnLibraryItem,
  type BpmnShapeCreationRecipe,
} from "./bpmn-node-library-catalogue";

type ToolId = BpmnLibraryItem["id"];
type PreparationKind = BpmnLauncherPreparation["kind"];
type ShapeItem = Extract<BpmnLibraryItem, { readonly kind: "shape" }>;
type ConnectorItem = Extract<BpmnLibraryItem, { readonly kind: "connector" }>;

type ExpectedSemantic =
  | {
      readonly kind: "shape";
      readonly type: ShapeItem["type"];
      readonly recipe: BpmnShapeCreationRecipe;
    }
  | {
      readonly kind: "connector";
      readonly connector: ConnectorItem["connector"];
    };

interface ExpectedFamilyProjection {
  readonly minimumProfileId: BpmnProfileId;
  readonly starterPreparation: PreparationKind;
}

interface ExpectedComponentConformance {
  readonly semantic: ExpectedSemantic;
  readonly placementMode: BpmnToolDefinition["placementMode"];
  readonly supportsDrag: boolean;
  readonly quickAdd: boolean;
  readonly core: ExpectedFamilyProjection | null;
  readonly collaboration: ExpectedFamilyProjection;
  readonly coreBridge?: {
    readonly minimumProfileId: typeof collaborationSwimlaneLayoutsBpmnProfile.id;
    readonly preparation: "in-place-swimlane-conversion";
    readonly orientation: "horizontal" | "vertical";
  };
}

const none = { kind: "plain" } as const;
const messageCatch = {
  kind: "catch-event",
  eventDefinitionType: "bpmn:MessageEventDefinition",
} as const;
const timerCatch = {
  kind: "catch-event",
  eventDefinitionType: "bpmn:TimerEventDefinition",
} as const;
const messageThrow = {
  kind: "throw-event",
  eventDefinitionType: "bpmn:MessageEventDefinition",
} as const;
const messageBoundary = {
  kind: "boundary-event",
  eventDefinitionType: "bpmn:MessageEventDefinition",
  cancelActivity: true,
} as const;
const timerBoundary = {
  kind: "boundary-event",
  eventDefinitionType: "bpmn:TimerEventDefinition",
  cancelActivity: true,
} as const;

function family(
  coreMinimumProfileId: BpmnProfileId,
  collaborationMinimumProfileId: BpmnProfileId,
): Pick<ExpectedComponentConformance, "core" | "collaboration"> {
  return {
    core: {
      minimumProfileId: coreMinimumProfileId,
      starterPreparation:
        coreMinimumProfileId === coreBpmnProfile.id
          ? "none"
          : "ordered-profile-ack",
    },
    collaboration: {
      minimumProfileId: collaborationMinimumProfileId,
      starterPreparation:
        collaborationMinimumProfileId === collaborationBpmnProfile.id
          ? "none"
          : "ordered-profile-ack",
    },
  };
}

const componentConformance = {
  "sequence-flow": {
    semantic: { kind: "connector", connector: "sequence" },
    placementMode: "connect",
    supportsDrag: false,
    quickAdd: false,
    ...family(coreBpmnProfile.id, collaborationBpmnProfile.id),
  },
  "message-flow": {
    semantic: { kind: "connector", connector: "message" },
    placementMode: "connect",
    supportsDrag: false,
    quickAdd: false,
    core: null,
    collaboration: {
      minimumProfileId: collaborationBpmnProfile.id,
      starterPreparation: "none",
    },
  },
  association: {
    semantic: { kind: "connector", connector: "association" },
    placementMode: "connect",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreFullAuthoringBpmnProfile.id,
      collaborationFullAuthoringBpmnProfile.id,
    ),
  },
  "data-association": {
    semantic: { kind: "connector", connector: "data-association" },
    placementMode: "connect",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreDataAuthoringBpmnProfile.id,
      collaborationDataAuthoringBpmnProfile.id,
    ),
  },
  "start-event": {
    semantic: { kind: "shape", type: "bpmn:StartEvent", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: false,
    ...family(coreBpmnProfile.id, collaborationBpmnProfile.id),
  },
  task: {
    semantic: { kind: "shape", type: "bpmn:Task", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(coreBpmnProfile.id, collaborationBpmnProfile.id),
  },
  "exclusive-gateway": {
    semantic: {
      kind: "shape",
      type: "bpmn:ExclusiveGateway",
      recipe: none,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(coreBpmnProfile.id, collaborationBpmnProfile.id),
  },
  "parallel-gateway": {
    semantic: {
      kind: "shape",
      type: "bpmn:ParallelGateway",
      recipe: none,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreStructuredBpmnProfile.id,
      collaborationStructuredBpmnProfile.id,
    ),
  },
  "inclusive-gateway": {
    semantic: {
      kind: "shape",
      type: "bpmn:InclusiveGateway",
      recipe: none,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreConditionalBpmnProfile.id,
      collaborationConditionalBpmnProfile.id,
    ),
  },
  "message-catch-event": {
    semantic: {
      kind: "shape",
      type: "bpmn:IntermediateCatchEvent",
      recipe: messageCatch,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreCatchingEventsBpmnProfile.id,
      collaborationCatchingEventsBpmnProfile.id,
    ),
  },
  "timer-catch-event": {
    semantic: {
      kind: "shape",
      type: "bpmn:IntermediateCatchEvent",
      recipe: timerCatch,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreCatchingEventsBpmnProfile.id,
      collaborationCatchingEventsBpmnProfile.id,
    ),
  },
  "receive-task": {
    semantic: { kind: "shape", type: "bpmn:ReceiveTask", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreCatchingEventsBpmnProfile.id,
      collaborationCatchingEventsBpmnProfile.id,
    ),
  },
  "user-task": {
    semantic: { kind: "shape", type: "bpmn:UserTask", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreTaskTypesBpmnProfile.id,
      collaborationTaskTypesBpmnProfile.id,
    ),
  },
  "service-task": {
    semantic: { kind: "shape", type: "bpmn:ServiceTask", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreTaskTypesBpmnProfile.id,
      collaborationTaskTypesBpmnProfile.id,
    ),
  },
  "manual-task": {
    semantic: { kind: "shape", type: "bpmn:ManualTask", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreTaskTypesBpmnProfile.id,
      collaborationTaskTypesBpmnProfile.id,
    ),
  },
  "none-throw-event": {
    semantic: {
      kind: "shape",
      type: "bpmn:IntermediateThrowEvent",
      recipe: { kind: "throw-event" },
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreIntermediateEventsBpmnProfile.id,
      collaborationIntermediateEventsBpmnProfile.id,
    ),
  },
  "message-throw-event": {
    semantic: {
      kind: "shape",
      type: "bpmn:IntermediateThrowEvent",
      recipe: messageThrow,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreIntermediateEventsBpmnProfile.id,
      collaborationIntermediateEventsBpmnProfile.id,
    ),
  },
  "message-boundary-event": {
    semantic: {
      kind: "shape",
      type: "bpmn:BoundaryEvent",
      recipe: messageBoundary,
    },
    placementMode: "attach",
    supportsDrag: true,
    quickAdd: false,
    ...family(
      coreBoundaryEventsBpmnProfile.id,
      collaborationBoundaryEventsBpmnProfile.id,
    ),
  },
  "timer-boundary-event": {
    semantic: {
      kind: "shape",
      type: "bpmn:BoundaryEvent",
      recipe: timerBoundary,
    },
    placementMode: "attach",
    supportsDrag: true,
    quickAdd: false,
    ...family(
      coreBoundaryEventsBpmnProfile.id,
      collaborationBoundaryEventsBpmnProfile.id,
    ),
  },
  "event-based-gateway": {
    semantic: {
      kind: "shape",
      type: "bpmn:EventBasedGateway",
      recipe: none,
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(
      coreEventRoutingBpmnProfile.id,
      collaborationEventRoutingBpmnProfile.id,
    ),
  },
  "end-event": {
    semantic: { kind: "shape", type: "bpmn:EndEvent", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: true,
    ...family(coreBpmnProfile.id, collaborationBpmnProfile.id),
  },
  "text-annotation": {
    semantic: {
      kind: "shape",
      type: "bpmn:TextAnnotation",
      recipe: { kind: "text-annotation" },
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: false,
    ...family(
      coreFullAuthoringBpmnProfile.id,
      collaborationFullAuthoringBpmnProfile.id,
    ),
  },
  group: {
    semantic: {
      kind: "shape",
      type: "bpmn:Group",
      recipe: { kind: "titled-group" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreFullAuthoringBpmnProfile.id,
      collaborationFullAuthoringBpmnProfile.id,
    ),
  },
  "expanded-subprocess": {
    semantic: {
      kind: "shape",
      type: "bpmn:SubProcess",
      recipe: { kind: "expanded-subprocess-starter" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreActivityContainersBpmnProfile.id,
      collaborationActivityContainersBpmnProfile.id,
    ),
  },
  "call-activity": {
    semantic: {
      kind: "shape",
      type: "bpmn:CallActivity",
      recipe: { kind: "call-activity" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreActivityContainersBpmnProfile.id,
      collaborationActivityContainersBpmnProfile.id,
    ),
  },
  "data-object": {
    semantic: {
      kind: "shape",
      type: "bpmn:DataObjectReference",
      recipe: { kind: "data-object" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreDataAuthoringBpmnProfile.id,
      collaborationDataAuthoringBpmnProfile.id,
    ),
  },
  "data-store": {
    semantic: {
      kind: "shape",
      type: "bpmn:DataStoreReference",
      recipe: { kind: "data-store" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    ...family(
      coreDataAuthoringBpmnProfile.id,
      collaborationDataAuthoringBpmnProfile.id,
    ),
  },
  "complex-gateway": {
    semantic: {
      kind: "shape",
      type: "bpmn:ComplexGateway",
      recipe: { kind: "complex-join" },
    },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: false,
    ...family(
      coreComplexRoutingBpmnProfile.id,
      collaborationComplexRoutingBpmnProfile.id,
    ),
  },
  "horizontal-swimlane-frame": {
    semantic: {
      kind: "shape",
      type: "bpmn:Participant",
      recipe: { kind: "swimlane-frame", orientation: "horizontal" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    core: null,
    collaboration: {
      minimumProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
      starterPreparation: "ordered-profile-ack",
    },
    coreBridge: {
      minimumProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
      preparation: "in-place-swimlane-conversion",
      orientation: "horizontal",
    },
  },
  "vertical-swimlane-frame": {
    semantic: {
      kind: "shape",
      type: "bpmn:Participant",
      recipe: { kind: "swimlane-frame", orientation: "vertical" },
    },
    placementMode: "place",
    supportsDrag: false,
    quickAdd: false,
    core: null,
    collaboration: {
      minimumProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
      starterPreparation: "ordered-profile-ack",
    },
    coreBridge: {
      minimumProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
      preparation: "in-place-swimlane-conversion",
      orientation: "vertical",
    },
  },
  "white-box-pool": {
    semantic: { kind: "shape", type: "bpmn:Participant", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: false,
    core: null,
    collaboration: {
      minimumProfileId: collaborationBpmnProfile.id,
      starterPreparation: "none",
    },
  },
  "black-box-pool": {
    semantic: { kind: "shape", type: "bpmn:Participant", recipe: none },
    placementMode: "place",
    supportsDrag: true,
    quickAdd: false,
    core: null,
    collaboration: {
      minimumProfileId: collaborationBpmnProfile.id,
      starterPreparation: "none",
    },
  },
} as const satisfies Record<ToolId, ExpectedComponentConformance>;

const allComponentIds = Object.keys(componentConformance) as ToolId[];

function expectedComponent(id: ToolId): ExpectedComponentConformance {
  return componentConformance[id];
}

function definitionsById(definitions: readonly BpmnToolDefinition[]) {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

function projectedById(profileId: BpmnProfileId) {
  return new Map(
    flattenBpmnLauncherItems(
      projectBpmnLauncherGroups({ acknowledgedProfileId: profileId }),
    ).map((item) => [item.id, item]),
  );
}

function liveSemantic(item: BpmnLibraryItem): ExpectedSemantic {
  return item.kind === "shape"
    ? { kind: "shape", type: item.type, recipe: item.recipe }
    : { kind: "connector", connector: item.connector };
}

describe("BPMN launcher component conformance manifest", () => {
  it("exhaustively binds all 32 stable IDs to their live definitions", () => {
    const coreDefinitions = bpmnLauncherToolDefinitions(coreBpmnProfile.id);
    const collaborationDefinitions = bpmnLauncherToolDefinitions(
      collaborationBpmnProfile.id,
    );
    const coreById = definitionsById(coreDefinitions);
    const collaborationById = definitionsById(collaborationDefinitions);

    expect(allComponentIds).toHaveLength(32);
    expect(new Set(allComponentIds).size).toBe(32);
    expect(coreDefinitions).toHaveLength(27);
    expect(new Set(coreDefinitions.map((item) => item.id)).size).toBe(27);
    expect(collaborationDefinitions).toHaveLength(32);
    expect(new Set(collaborationDefinitions.map((item) => item.id)).size).toBe(
      32,
    );

    for (const id of allComponentIds) {
      const expected = expectedComponent(id);
      const collaboration = collaborationById.get(id);
      expect(collaboration, `${id} Collaboration definition`).toBeDefined();
      expect(liveSemantic(collaboration!.tool), `${id} semantic`).toEqual(
        expected.semantic,
      );
      expect(collaboration!.minimumProfileId, `${id} Collaboration minimum`).toBe(
        expected.collaboration.minimumProfileId,
      );
      expect(collaboration!.placementMode, `${id} placement mode`).toBe(
        expected.placementMode,
      );
      expect(collaboration!.supportsDrag, `${id} drag capability`).toBe(
        expected.supportsDrag,
      );

      const core = coreById.get(id);
      if (expected.core) {
        expect(core, `${id} Core definition`).toBeDefined();
        expect(liveSemantic(core!.tool), `${id} Core semantic`).toEqual(
          expected.semantic,
        );
        expect(core!.minimumProfileId, `${id} Core minimum`).toBe(
          expected.core.minimumProfileId,
        );
        expect(core!.placementMode, `${id} Core placement mode`).toBe(
          expected.placementMode,
        );
        expect(core!.supportsDrag, `${id} Core drag capability`).toBe(
          expected.supportsDrag,
        );
      } else {
        expect(core, `${id} excluded from Core registry`).toBeUndefined();
      }
    }
  });

  it("projects exact Core 29 and Collaboration 32 preparation states", () => {
    const coreStarter = projectedById(coreBpmnProfile.id);
    const coreLatest = projectedById(coreComplexRoutingBpmnProfile.id);
    const collaborationStarter = projectedById(collaborationBpmnProfile.id);
    const collaborationLatest = projectedById(
      collaborationSwimlaneLayoutsBpmnProfile.id,
    );

    expect(coreStarter.size).toBe(29);
    expect(coreLatest.size).toBe(29);
    expect(collaborationStarter.size).toBe(32);
    expect(collaborationLatest.size).toBe(32);

    for (const id of allComponentIds) {
      const expected = expectedComponent(id);
      const coreStarterItem = coreStarter.get(id);
      const coreLatestItem = coreLatest.get(id);
      if (expected.core) {
        expect(coreStarterItem?.preparation.kind, `${id} Core starter`).toBe(
          expected.core.starterPreparation,
        );
        expect(coreStarterItem?.minimumProfileId, `${id} Core target`).toBe(
          expected.core.minimumProfileId,
        );
        expect(coreLatestItem?.preparation.kind, `${id} latest Core`).toBe(
          "none",
        );
      } else if (expected.coreBridge) {
        expect(coreStarterItem?.minimumProfileId, `${id} Core bridge target`).toBe(
          expected.coreBridge.minimumProfileId,
        );
        expect(coreStarterItem?.placementMode, `${id} Core bridge placement`).toBe(
          expected.placementMode,
        );
        expect(coreStarterItem?.supportsDrag, `${id} Core bridge drag`).toBe(
          expected.supportsDrag,
        );
        expect(coreStarterItem?.preparation, `${id} Core bridge`).toEqual({
          kind: expected.coreBridge.preparation,
          minimumProfileId: expected.coreBridge.minimumProfileId,
          minimumProfileLabel: collaborationSwimlaneLayoutsBpmnProfile.label,
          orientation: expected.coreBridge.orientation,
        });
        expect(coreLatestItem?.preparation, `${id} latest Core bridge`).toEqual(
          coreStarterItem?.preparation,
        );
      } else {
        expect(coreStarterItem, `${id} absent from Core projection`).toBeUndefined();
        expect(coreLatestItem, `${id} absent from latest Core`).toBeUndefined();
      }

      expect(
        collaborationStarter.get(id)?.preparation.kind,
        `${id} Collaboration starter`,
      ).toBe(expected.collaboration.starterPreparation);
      expect(
        collaborationStarter.get(id)?.minimumProfileId,
        `${id} Collaboration target`,
      ).toBe(expected.collaboration.minimumProfileId);
      expect(
        collaborationLatest.get(id)?.preparation.kind,
        `${id} latest Collaboration`,
      ).toBe("none");
    }
  });

  it("keeps quick-add eligibility exhaustive and identical across latest families", () => {
    const expectedQuickAddIds = allComponentIds
      .filter((id) => componentConformance[id].quickAdd)
      .sort();
    const coreQuickAddIds = bpmnAppendActions(coreComplexRoutingBpmnProfile.id)
      .map((item) => item.id)
      .sort();
    const collaborationQuickAddIds = bpmnAppendActions(
      collaborationSwimlaneLayoutsBpmnProfile.id,
    )
      .map((item) => item.id)
      .sort();

    expect(expectedQuickAddIds).toHaveLength(14);
    expect(coreQuickAddIds).toEqual(expectedQuickAddIds);
    expect(collaborationQuickAddIds).toEqual(expectedQuickAddIds);
  });
});
