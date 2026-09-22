import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreFullAuthoringBpmnProfile,
  supportsActivityContainers,
  supportsComplexRouting,
  supportsDataAuthoring,
} from "./core-profile";
import {
  collaborationActivityContainersBpmnProfile,
  collaborationComplexRoutingBpmnProfile,
  collaborationDataAuthoringBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  projectCollaborationOutline,
} from "./collaboration-profile";
import { inspectComplexRouting } from "./complex-routing";
import { inspectAdvancedActivities } from "./advanced-activities";
import {
  planDataStoreCleanup,
  projectDataStoreRegistry,
} from "./data-authoring";

describe("Advanced Full Authoring immutable profile lineage", () => {
  it("adds exact capability deltas in both families", () => {
    for (const [previous, current, delta] of [
      [
        coreFullAuthoringBpmnProfile,
        coreActivityContainersBpmnProfile,
        ["bpmn:SubProcess", "bpmn:CallActivity"],
      ],
      [
        coreActivityContainersBpmnProfile,
        coreDataAuthoringBpmnProfile,
        [
          "bpmn:DataObject",
          "bpmn:DataObjectReference",
          "bpmn:DataStore",
          "bpmn:DataStoreReference",
          "bpmn:DataInputAssociation",
          "bpmn:DataOutputAssociation",
        ],
      ],
      [
        coreDataAuthoringBpmnProfile,
        coreComplexRoutingBpmnProfile,
        ["bpmn:ComplexGateway"],
      ],
      [
        collaborationFullAuthoringBpmnProfile,
        collaborationActivityContainersBpmnProfile,
        ["bpmn:SubProcess", "bpmn:CallActivity"],
      ],
      [
        collaborationActivityContainersBpmnProfile,
        collaborationDataAuthoringBpmnProfile,
        [
          "bpmn:DataObject",
          "bpmn:DataObjectReference",
          "bpmn:DataStore",
          "bpmn:DataStoreReference",
          "bpmn:DataInputAssociation",
          "bpmn:DataOutputAssociation",
        ],
      ],
      [
        collaborationDataAuthoringBpmnProfile,
        collaborationComplexRoutingBpmnProfile,
        ["bpmn:ComplexGateway"],
      ],
    ] as const) {
      expect(
        current.semanticTypes.filter(
          (type) => !previous.semanticTypes.includes(type as never),
        ),
      ).toEqual(delta);
      expect(canTransitionBpmnProfile(previous.id, current.id)).toBe(true);
    }
    expect(
      canTransitionBpmnProfile(
        coreFullAuthoringBpmnProfile.id,
        coreDataAuthoringBpmnProfile.id,
      ),
    ).toBe(false);
    expect(
      canTransitionBpmnProfile(
        coreDataAuthoringBpmnProfile.id,
        collaborationComplexRoutingBpmnProfile.id,
      ),
    ).toBe(false);
  });

  it("composes successor capabilities without widening predecessors", () => {
    expect(
      supportsActivityContainers(coreActivityContainersBpmnProfile.id),
    ).toBe(true);
    expect(supportsDataAuthoring(coreActivityContainersBpmnProfile.id)).toBe(
      false,
    );
    expect(supportsDataAuthoring(coreComplexRoutingBpmnProfile.id)).toBe(true);
    expect(supportsComplexRouting(coreDataAuthoringBpmnProfile.id)).toBe(false);
    expect(
      supportsComplexRouting(collaborationComplexRoutingBpmnProfile.id),
    ).toBe(true);
  });

  it("projects data references and directional associations into the collaboration outline", () => {
    const outline = projectCollaborationOutline({
      profileId: collaborationComplexRoutingBpmnProfile.id,
      planeCount: 1,
      participants: [],
      lanes: [],
      shapes: [],
      edges: [],
      elements: [
        {
          id: "DataRef_1",
          type: "bpmn:DataObjectReference",
          parentContainerId: "Process_1",
          participantId: "Participant_1",
          dataObjectRefId: "DataObject_1",
          incoming: [],
          outgoing: [],
        },
        {
          id: "DataInput_1",
          type: "bpmn:DataInputAssociation",
          parentContainerId: "Process_1",
          participantId: "Participant_1",
          sourceId: "DataRef_1",
          targetId: "Task_1",
          incoming: [],
          outgoing: [],
        },
      ],
    });

    expect(outline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "DataRef_1",
          parentId: "Participant_1",
        }),
        expect.objectContaining({
          id: "DataInput_1",
          sourceId: "DataRef_1",
          targetId: "Task_1",
        }),
      ]),
    );
  });

  it("separates recoverable join drafting from unsupported Complex semantics", () => {
    expect(
      inspectComplexRouting([
        {
          id: "Complex_Draft",
          type: "bpmn:ComplexGateway",
          gatewayDirection: "Converging",
          incoming: ["Flow_1"],
          outgoing: [],
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-COMPLEX-003",
          disposition: "recoverable",
        }),
        expect.objectContaining({
          ruleId: "BPMN-COMPLEX-004",
          disposition: "recoverable",
        }),
      ]),
    );
    expect(
      inspectComplexRouting([
        {
          id: "Complex_Invalid",
          type: "bpmn:ComplexGateway",
          gatewayDirection: "Diverging",
          activationCondition: "x",
          defaultFlowId: "Flow_Default",
          incoming: ["Flow_1"],
          outgoing: ["Flow_2", "Flow_3"],
        },
      ]).map((item) => item.ruleId),
    ).toEqual(
      expect.arrayContaining([
        "BPMN-COMPLEX-001",
        "BPMN-COMPLEX-002",
        "BPMN-COMPLEX-003",
      ]),
    );
    expect(
      inspectComplexRouting([
        {
          id: "Complex_Pending_Outgoing",
          type: "bpmn:ComplexGateway",
          gatewayDirection: "Converging",
          activationCondition: "Hai nguồn đã tới",
          incoming: ["Flow_1", "Flow_2"],
          outgoing: [],
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        ruleId: "BPMN-COMPLEX-003",
        disposition: "recoverable",
      }),
    ]);
  });

  it("rejects transitive local callable Process cycles", () => {
    const issues = inspectAdvancedActivities(
      {
        elements: [
          {
            id: "Process_Main",
            type: "bpmn:Process",
            isExecutable: false,
            incoming: [],
            outgoing: [],
          },
          {
            id: "Process_A",
            type: "bpmn:Process",
            isExecutable: false,
            incoming: [],
            outgoing: [],
          },
          {
            id: "Process_B",
            type: "bpmn:Process",
            isExecutable: false,
            incoming: [],
            outgoing: [],
          },
          {
            id: "Call_Main",
            type: "bpmn:CallActivity",
            parentContainerId: "Process_Main",
            calledElementId: "Process_A",
            incoming: [],
            outgoing: [],
          },
          {
            id: "Call_A",
            type: "bpmn:CallActivity",
            parentContainerId: "Process_A",
            calledElementId: "Process_B",
            incoming: [],
            outgoing: [],
          },
          {
            id: "Call_B",
            type: "bpmn:CallActivity",
            parentContainerId: "Process_B",
            calledElementId: "Process_A",
            incoming: [],
            outgoing: [],
          },
        ],
        shapes: [],
      },
      ["Process_Main"],
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-CALL-003",
          elementId: "Call_A",
          disposition: "fatal",
        }),
        expect.objectContaining({
          ruleId: "BPMN-CALL-003",
          elementId: "Call_B",
          disposition: "fatal",
        }),
      ]),
    );
  });

  it("requires exact unreferenced DataStore cleanup intent", () => {
    const registry = projectDataStoreRegistry(
      [
        {
          id: "Store_Used",
          type: "bpmn:DataStore",
          name: "Used",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Store_Orphan",
          type: "bpmn:DataStore",
          name: "Orphan",
          incoming: [],
          outgoing: [],
        },
      ],
      [
        {
          dataStoreId: "Store_Used",
          referenceId: "StoreRef_1",
          supported: true,
        },
      ],
    );
    expect(
      planDataStoreCleanup(registry, {
        candidateStoreIds: ["Store_Used"],
        expectedReferenceCounts: { Store_Used: 1 },
        expectedReferenceIds: { Store_Used: ["StoreRef_1"] },
      }),
    ).toMatchObject({ accepted: false, reason: "REFERENCED" });
    expect(
      planDataStoreCleanup(registry, {
        candidateStoreIds: ["Store_Orphan"],
        expectedReferenceCounts: { Store_Orphan: 1 },
        expectedReferenceIds: { Store_Orphan: [] },
      }),
    ).toMatchObject({ accepted: false, reason: "STALE_REFERENCE_COUNT" });
    expect(
      planDataStoreCleanup(registry, {
        candidateStoreIds: ["Store_Orphan"],
        expectedReferenceCounts: { Store_Orphan: 0 },
        expectedReferenceIds: { Store_Orphan: [] },
      }),
    ).toEqual({
      accepted: true,
      deleteDataStoreIds: ["Store_Orphan"],
    });
  });
});
