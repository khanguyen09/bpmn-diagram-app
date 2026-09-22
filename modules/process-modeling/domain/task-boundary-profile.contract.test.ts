import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreTaskTypesBpmnProfile,
  supportsBoundaryEvents,
  supportsEventRouting,
  supportsIntermediateEvents,
  supportsTaskTypes,
  type CoreBpmnElement,
} from "./core-profile";
import {
  collaborationBoundaryEventsBpmnProfile,
  collaborationEventRoutingBpmnProfile,
  collaborationIntermediateEventsBpmnProfile,
  collaborationTaskTypesBpmnProfile,
} from "./collaboration-profile";
import { inspectTaskAndBoundaryEvents } from "./task-and-boundary-events";

describe("Task, Intermediate and Boundary profile lineage", () => {
  it("adds exact semantic set differences", () => {
    expect(
      coreTaskTypesBpmnProfile.semanticTypes.filter(
        (type) => !coreEventRoutingBpmnProfile.semanticTypes.includes(type as never),
      ),
    ).toEqual([
      "bpmn:UserTask",
      "bpmn:ServiceTask",
      "bpmn:ManualTask",
    ]);
    expect(
      coreIntermediateEventsBpmnProfile.semanticTypes.filter(
        (type) => !coreTaskTypesBpmnProfile.semanticTypes.includes(type as never),
      ),
    ).toEqual(["bpmn:IntermediateThrowEvent"]);
    expect(
      coreBoundaryEventsBpmnProfile.semanticTypes.filter(
        (type) =>
          !coreIntermediateEventsBpmnProfile.semanticTypes.includes(type as never),
      ),
    ).toEqual(["bpmn:BoundaryEvent"]);
  });

  it("allows only adjacent same-family transitions", () => {
    for (const [from, to] of [
      [coreEventRoutingBpmnProfile.id, coreTaskTypesBpmnProfile.id],
      [coreTaskTypesBpmnProfile.id, coreIntermediateEventsBpmnProfile.id],
      [coreIntermediateEventsBpmnProfile.id, coreBoundaryEventsBpmnProfile.id],
      [
        collaborationEventRoutingBpmnProfile.id,
        collaborationTaskTypesBpmnProfile.id,
      ],
      [
        collaborationTaskTypesBpmnProfile.id,
        collaborationIntermediateEventsBpmnProfile.id,
      ],
      [
        collaborationIntermediateEventsBpmnProfile.id,
        collaborationBoundaryEventsBpmnProfile.id,
      ],
    ] as const) {
      expect(canTransitionBpmnProfile(from, to)).toBe(true);
    }
    for (const [from, to] of [
      [coreEventRoutingBpmnProfile.id, coreBoundaryEventsBpmnProfile.id],
      [coreBoundaryEventsBpmnProfile.id, coreIntermediateEventsBpmnProfile.id],
      [coreTaskTypesBpmnProfile.id, collaborationIntermediateEventsBpmnProfile.id],
    ] as const) {
      expect(canTransitionBpmnProfile(from, to)).toBe(false);
    }
    expect(supportsEventRouting(coreBoundaryEventsBpmnProfile.id)).toBe(true);
    expect(supportsTaskTypes(coreBoundaryEventsBpmnProfile.id)).toBe(true);
    expect(supportsIntermediateEvents(coreBoundaryEventsBpmnProfile.id)).toBe(
      true,
    );
    expect(supportsBoundaryEvents(coreBoundaryEventsBpmnProfile.id)).toBe(true);
  });

  it("validates Message Throw and Boundary attachment/topology", () => {
    const elements: CoreBpmnElement[] = [
      {
        id: "Message_1",
        type: "bpmn:Message",
        name: "Timeout warning",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Task_1",
        type: "bpmn:UserTask",
        name: "Review",
        processId: "Process_1",
        incoming: ["Flow_In"],
        outgoing: ["Flow_Main"],
      },
      {
        id: "Throw_1",
        type: "bpmn:IntermediateThrowEvent",
        processId: "Process_1",
        eventDefinition: {
          id: "Definition_Throw",
          kind: "MESSAGE",
          messageRefId: "Message_1",
        },
        incoming: ["Flow_Throw_In"],
        outgoing: ["Flow_Throw_Out"],
      },
      {
        id: "Boundary_1",
        type: "bpmn:BoundaryEvent",
        processId: "Process_1",
        attachedToId: "Task_1",
        cancelActivity: false,
        eventDefinition: {
          id: "Definition_Timer",
          kind: "TIMER",
          timerKind: "DURATION",
          expression: "PT15M",
        },
        incoming: [],
        outgoing: ["Flow_Boundary"],
      },
    ];
    expect(
      inspectTaskAndBoundaryEvents(elements, true, true, true),
    ).toEqual([]);
  });

  it("separates recoverable incompleteness from fatal Boundary errors", () => {
    const issues = inspectTaskAndBoundaryEvents(
      [
        {
          id: "Boundary_Missing",
          type: "bpmn:BoundaryEvent",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Boundary_Invalid",
          type: "bpmn:BoundaryEvent",
          processId: "Process_A",
          attachedToId: "Task_Other",
          incoming: ["Flow_In"],
          outgoing: ["Flow_A", "Flow_B"],
        },
        {
          id: "Task_Other",
          type: "bpmn:Task",
          processId: "Process_B",
          incoming: [],
          outgoing: [],
        },
      ],
      true,
      true,
      true,
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-BOUNDARY-001",
          elementId: "Boundary_Missing",
          disposition: "recoverable",
        }),
        expect.objectContaining({
          ruleId: "BPMN-BOUNDARY-001",
          elementId: "Boundary_Invalid",
          disposition: "fatal",
        }),
        expect.objectContaining({
          ruleId: "BPMN-BOUNDARY-003",
          elementId: "Boundary_Invalid",
          disposition: "fatal",
        }),
      ]),
    );
  });
});

describe("successor subprocess timer scope", () => {
  const host: CoreBpmnElement = { id: "Sub", type: "bpmn:SubProcess", processId: "P", parentContainerId: "P", incoming: [], outgoing: [] };
  const timer: CoreBpmnElement = { id: "Timer", type: "bpmn:BoundaryEvent", processId: "P", parentContainerId: "P", attachedToId: "Sub", incoming: [], outgoing: ["Timeout"], eventDefinition: { id: "Def", kind: "TIMER", timerKind: "DURATION", expression: "PT10M" } };
  it("keeps old profiles frozen and allows ordinary subprocess timer only in successor", () => {
    expect(inspectTaskAndBoundaryEvents([host, timer], true, true, true)).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "BPMN-BOUNDARY-001" })]));
    expect(inspectTaskAndBoundaryEvents([host, timer], true, true, true, true)).toEqual([]);
  });
  it.each([
    { ...host, triggeredByEvent: true }, { ...host, type: "bpmn:Transaction" },
    { ...host, type: "bpmn:CallActivity" }, { ...host, parentContainerId: "Other" }, { ...host, processId: "Other" },
  ])("rejects unsupported host/scope %#", (invalidHost) => {
    expect(inspectTaskAndBoundaryEvents([invalidHost, timer], true, true, true, true)).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "BPMN-BOUNDARY-001", disposition: "fatal" })]));
  });
});
