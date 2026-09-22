import { describe, expect, it } from "vitest";
import { coreBpmnProfile, type CoreBpmnSnapshot } from "../domain/core-profile";
import {
  inspectCoreSnapshot,
  projectCoreOutline,
  snapshotsAreEquivalent,
} from "./inspect-core-snapshot";

const snapshot: CoreBpmnSnapshot = {
  profileId: coreBpmnProfile.id,
  elements: [
    { id: "Process_1", type: "bpmn:Process", incoming: [], outgoing: [] },
    {
      id: "Start_1",
      type: "bpmn:StartEvent",
      incoming: [],
      outgoing: ["Flow_1"],
    },
    {
      id: "Task_1",
      type: "bpmn:Task",
      name: "Review",
      incoming: ["Flow_1"],
      outgoing: ["Flow_2"],
    },
    {
      id: "End_1",
      type: "bpmn:EndEvent",
      incoming: ["Flow_2"],
      outgoing: [],
    },
    {
      id: "Flow_1",
      type: "bpmn:SequenceFlow",
      sourceId: "Start_1",
      targetId: "Task_1",
      incoming: [],
      outgoing: [],
    },
    {
      id: "Flow_2",
      type: "bpmn:SequenceFlow",
      sourceId: "Task_1",
      targetId: "End_1",
      incoming: [],
      outgoing: [],
    },
  ],
  shapes: [
    { elementId: "Start_1", x: 0, y: 0, width: 36, height: 36 },
    { elementId: "Task_1", x: 80, y: 0, width: 100, height: 80 },
    { elementId: "End_1", x: 220, y: 0, width: 36, height: 36 },
  ],
  edges: [
    {
      elementId: "Flow_1",
      waypoints: [
        { x: 36, y: 18 },
        { x: 80, y: 18 },
      ],
    },
    {
      elementId: "Flow_2",
      waypoints: [
        { x: 180, y: 18 },
        { x: 220, y: 18 },
      ],
    },
  ],
};

describe("Core Starter snapshot policy", () => {
  it("accepts the bounded semantic and DI profile", () => {
    expect(inspectCoreSnapshot(snapshot)).toEqual([]);
    expect(projectCoreOutline(snapshot).map((item) => item.id)).toEqual([
      "Start_1",
      "Task_1",
      "End_1",
      "Flow_1",
      "Flow_2",
    ]);
    expect(snapshotsAreEquivalent(snapshot, structuredClone(snapshot))).toBe(true);
  });

  it("fails closed for unsupported elements and broken DI/references", () => {
    const invalid: CoreBpmnSnapshot = {
      ...snapshot,
      elements: [
        ...snapshot.elements,
        {
          id: "Service_1",
          type: "bpmn:ServiceTask",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Flow_broken",
          type: "bpmn:SequenceFlow",
          sourceId: "missing",
          targetId: "Task_1",
          incoming: [],
          outgoing: [],
        },
      ],
    };

    expect(inspectCoreSnapshot(invalid).map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        "BPMN-PROFILE-003",
        "BPMN-REF-001",
        "BPMN-DI-002",
      ]),
    );
  });

  it("rejects disconnected and non-terminating Core flow nodes", () => {
    const disconnected: CoreBpmnSnapshot = {
      ...snapshot,
      elements: [
        ...snapshot.elements,
        {
          id: "Task_Orphan",
          type: "bpmn:Task",
          name: "Orphan",
          incoming: [],
          outgoing: [],
        },
      ],
      shapes: [
        ...snapshot.shapes,
        { elementId: "Task_Orphan", x: 320, y: 0, width: 100, height: 80 },
      ],
    };

    const issues = inspectCoreSnapshot(disconnected);
    expect(issues.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining(["BPMN-CONNECT-002", "BPMN-CONNECT-003"]),
    );
    expect(
      issues
        .filter((item) => item.ruleId.startsWith("BPMN-CONNECT-"))
        .every((item) => item.disposition === "recoverable"),
    ).toBe(true);
  });

  it("rejects non-finite, non-positive and incomplete DI geometry", () => {
    const invalidGeometry: CoreBpmnSnapshot = {
      ...snapshot,
      shapes: snapshot.shapes.map((shape) =>
        shape.elementId === "Task_1"
          ? { ...shape, width: 0, x: Number.POSITIVE_INFINITY }
          : shape,
      ),
      edges: snapshot.edges.map((edge) =>
        edge.elementId === "Flow_1"
          ? { ...edge, waypoints: [{ x: Number.NaN, y: 10 }] }
          : edge,
      ),
    };

    expect(
      inspectCoreSnapshot(invalidGeometry).map((item) => item.ruleId),
    ).toEqual(expect.arrayContaining(["BPMN-DI-003", "BPMN-DI-004"]));
    expect(
      inspectCoreSnapshot(invalidGeometry)
        .filter((item) => item.ruleId.startsWith("BPMN-DI-"))
        .every((item) => item.disposition === "fatal"),
    ).toBe(true);
  });
});
