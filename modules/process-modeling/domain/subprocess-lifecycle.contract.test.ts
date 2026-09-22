import { describe, expect, it } from "vitest";
import {
  planDataStoreCleanupCommand,
  planFlowNodeReparentCommand,
  planSubProcessDeleteCommand,
  projectFlowNodeReparentImpact,
  projectSubProcessDeleteImpact,
} from "../index";
import type { SubProcessLifecycleSnapshot } from "./subprocess-lifecycle";

function snapshot(): SubProcessLifecycleSnapshot {
  return {
    planeElementId: "Process_1",
    elements: [
      {
        id: "Process_1",
        type: "bpmn:Process",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Sub_1",
        type: "bpmn:SubProcess",
        parentContainerId: "Process_1",
        isExpanded: true,
        incoming: ["Flow_In"],
        outgoing: ["Flow_Out"],
      },
      {
        id: "Task_Outside",
        type: "bpmn:Task",
        parentContainerId: "Process_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Task_Inside",
        type: "bpmn:Task",
        parentContainerId: "Sub_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Boundary_1",
        type: "bpmn:BoundaryEvent",
        parentContainerId: "Sub_1",
        attachedToId: "Task_Inside",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Store_1",
        type: "bpmn:DataStore",
        incoming: [],
        outgoing: [],
      },
      {
        id: "StoreRef_1",
        type: "bpmn:DataStoreReference",
        parentContainerId: "Sub_1",
        dataStoreRefId: "Store_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Object_1",
        type: "bpmn:DataObject",
        parentContainerId: "Sub_1",
        isCollection: false,
        incoming: [],
        outgoing: [],
      },
      {
        id: "ObjectRef_1",
        type: "bpmn:DataObjectReference",
        parentContainerId: "Sub_1",
        dataObjectRefId: "Object_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "DataAssoc_1",
        type: "bpmn:DataInputAssociation",
        parentContainerId: "Sub_1",
        associationOwnerId: "Task_Inside",
        sourceId: "StoreRef_1",
        targetId: "Task_Inside",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Flow_Internal",
        type: "bpmn:SequenceFlow",
        parentContainerId: "Sub_1",
        sourceId: "Task_Inside",
        targetId: "Boundary_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Flow_In",
        type: "bpmn:SequenceFlow",
        parentContainerId: "Process_1",
        sourceId: "Task_Outside",
        targetId: "Sub_1",
        incoming: [],
        outgoing: [],
      },
    ],
    shapes: [
      {
        elementId: "Sub_1",
        x: 100,
        y: 100,
        width: 420,
        height: 240,
        isExpanded: true,
      },
      {
        elementId: "Task_Inside",
        x: 180,
        y: 160,
        width: 100,
        height: 80,
      },
      {
        elementId: "Boundary_1",
        x: 250,
        y: 220,
        width: 36,
        height: 36,
      },
    ],
    edges: [],
  };
}

describe("SubProcess lifecycle policy", () => {
  it("accepts one exact reparent aggregate and preserves semantic/DI IDs", () => {
    const baseline = snapshot();
    const current = {
      ...baseline,
      elements: baseline.elements.filter(
        (element) => element.id !== "DataAssoc_1",
      ),
    };
    const plan = planFlowNodeReparentCommand(current, {
      selectedElementId: "Task_Inside",
      expectedSourceContainerId: "Sub_1",
      targetContainerId: "Process_1",
      expectedRevisionToken: "rev-1",
      currentRevisionToken: "rev-1",
      expectedClosureIds: ["Boundary_1", "Task_Inside"],
      expectedReferenceIds: ["Flow_Internal"],
    });
    expect(plan).toMatchObject({
      accepted: true,
      closureIds: ["Boundary_1", "Task_Inside"],
      preservedSemanticIds: ["Boundary_1", "Task_Inside"],
      preservedDiIds: ["Boundary_1", "Task_Inside"],
      commandCount: 1,
    });
  });

  it("fails closed when a connector or DataAssociation would cross container", () => {
    const current = snapshot();
    expect(
      planFlowNodeReparentCommand(current, {
        selectedElementId: "Task_Outside",
        expectedSourceContainerId: "Process_1",
        targetContainerId: "Sub_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        expectedClosureIds: ["Task_Outside"],
        expectedReferenceIds: ["Flow_In"],
      }),
    ).toMatchObject({
      accepted: false,
      reason: "CROSS_CONTAINER_CONNECTOR",
      commandCount: 0,
    });
    expect(
      planFlowNodeReparentCommand(current, {
        selectedElementId: "Task_Inside",
        expectedSourceContainerId: "Sub_1",
        targetContainerId: "Process_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        expectedClosureIds: ["Boundary_1", "Task_Inside"],
        expectedReferenceIds: [
          "DataAssoc_1",
          "Flow_Internal",
          "StoreRef_1",
          "Task_Inside",
        ],
      }),
    ).toMatchObject({
      accepted: false,
      reason: "CROSS_CONTAINER_DATA_ASSOCIATION",
      commandCount: 0,
    });
  });

  it("projects valid targets and enforces effective leaf Lane responsibility", () => {
    const baseline = snapshot();
    const current: SubProcessLifecycleSnapshot = {
      ...baseline,
      planeElementId: "Collaboration_1",
      elements: baseline.elements.filter(
        (element) =>
          !["Flow_In", "Flow_Internal", "DataAssoc_1"].includes(element.id),
      ),
      participants: [
        {
          id: "Participant_1",
          processId: "Process_1",
        },
      ],
      lanes: [
        {
          id: "Lane_Parent",
          participantId: "Participant_1",
          processId: "Process_1",
          flowNodeIds: [],
        },
        {
          id: "Lane_Leaf",
          participantId: "Participant_1",
          processId: "Process_1",
          parentLaneId: "Lane_Parent",
          depth: 1,
          flowNodeIds: ["Sub_1"],
        },
      ],
    };
    expect(projectFlowNodeReparentImpact(current, "Task_Outside")).toMatchObject({
      sourceContainerId: "Process_1",
      eligibleTargets: [
        {
          containerId: "Sub_1",
          inheritedLaneId: "Lane_Leaf",
          requiresTargetLeafLane: false,
        },
      ],
    });
    expect(
      planFlowNodeReparentCommand(current, {
        selectedElementId: "Task_Inside",
        expectedSourceContainerId: "Sub_1",
        targetContainerId: "Process_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        expectedClosureIds: ["Boundary_1", "Task_Inside"],
        expectedReferenceIds: [],
      }),
    ).toMatchObject({
      accepted: false,
      reason: "TARGET_LANE_REQUIRED",
      commandCount: 0,
    });
    expect(
      planFlowNodeReparentCommand(current, {
        selectedElementId: "Task_Inside",
        expectedSourceContainerId: "Sub_1",
        targetContainerId: "Process_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        expectedClosureIds: ["Boundary_1", "Task_Inside"],
        expectedReferenceIds: [],
        targetLaneId: "Lane_Leaf",
      }),
    ).toMatchObject({
      accepted: true,
      targetLaneId: "Lane_Leaf",
      commandCount: 1,
    });
  });

  it("binds exact cascade impact and retains shared Definitions roots", () => {
    const current = snapshot();
    const impact = projectSubProcessDeleteImpact(current, "Sub_1", "rev-1");
    expect(impact).toMatchObject({
      incidentSequenceFlowIds: ["Flow_In"],
      internalSequenceFlowIds: ["Flow_Internal"],
      orphanDataObjectIds: ["Object_1"],
      retainedRootRegistryIds: ["Store_1"],
    });
    expect(
      planSubProcessDeleteCommand(current, {
        action: "CASCADE",
        subProcessId: "Sub_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        expectedDeleteElementIds: impact!.deleteElementIds,
        expectedRetainedRootRegistryIds: impact!.retainedRootRegistryIds,
      }),
    ).toMatchObject({
      accepted: true,
      retainedRootRegistryIds: ["Store_1"],
      commandCount: 1,
    });
    expect(
      planSubProcessDeleteCommand(current, {
        action: "CASCADE",
        subProcessId: "Sub_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-2",
        expectedDeleteElementIds: impact!.deleteElementIds,
        expectedRetainedRootRegistryIds: impact!.retainedRootRegistryIds,
      }),
    ).toEqual({
      accepted: false,
      reason: "STALE_REVISION",
      deleteElementIds: [],
      retainedRootRegistryIds: [],
      commandCount: 0,
    });

    const sharedSnapshot: SubProcessLifecycleSnapshot = {
      ...current,
      elements: [
        ...current.elements,
        {
          id: "ObjectRef_Outside",
          type: "bpmn:DataObjectReference",
          parentContainerId: "Process_1",
          dataObjectRefId: "Object_1",
          incoming: [],
          outgoing: [],
        },
      ],
    };
    const sharedImpact = projectSubProcessDeleteImpact(
      sharedSnapshot,
      "Sub_1",
      "rev-1",
    )!;
    expect(sharedImpact.sharedLocalDataObjectIds).toEqual(["Object_1"]);
    expect(
      planSubProcessDeleteCommand(sharedSnapshot, {
        action: "CASCADE",
        subProcessId: "Sub_1",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        expectedDeleteElementIds: sharedImpact.deleteElementIds,
        expectedRetainedRootRegistryIds:
          sharedImpact.retainedRootRegistryIds,
      }),
    ).toMatchObject({
      accepted: false,
      reason: "SHARED_LOCAL_DATA_OBJECT",
      commandCount: 0,
    });
  });

  it("requires exact sorted DataStore reference sets on the fresh registry", () => {
    const registry = [
      {
        dataStoreId: "Store_1",
        name: "Same name",
        referenceIds: ["Ref_A", "Ref_B"],
        referenceCount: 2,
        hasUnknownReferences: false,
      },
    ];
    expect(
      planDataStoreCleanupCommand(registry, {
        action: "DELETE",
        expectedRevisionToken: "rev-1",
        currentRevisionToken: "rev-1",
        candidateStoreIds: ["Store_1"],
        expectedReferenceCounts: { Store_1: 2 },
        expectedReferenceIds: { Store_1: ["Ref_B", "Ref_A"] },
      }),
    ).toMatchObject({
      accepted: false,
      reason: "INVALID_REFERENCE_SET",
      commandCount: 0,
    });
    expect(
      planDataStoreCleanupCommand(
        [
          {
            dataStoreId: "Orphan_1",
            name: "Same name",
            referenceIds: [],
            referenceCount: 0,
            hasUnknownReferences: false,
          },
        ],
        {
          action: "DELETE",
          expectedRevisionToken: "rev-1",
          currentRevisionToken: "rev-1",
          candidateStoreIds: ["Orphan_1"],
          expectedReferenceCounts: { Orphan_1: 0 },
          expectedReferenceIds: { Orphan_1: [] },
        },
      ),
    ).toEqual({
      accepted: true,
      deleteDataStoreIds: ["Orphan_1"],
      commandCount: 1,
    });
  });
});
