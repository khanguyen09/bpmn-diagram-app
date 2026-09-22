import { describe, expect, it } from "vitest";
import {
  isCollaborationPlacementObstacleType,
  isValidBpmnConnectionSourceType,
} from "./bpmn-component-interaction";

describe("BPMN component interaction contracts", () => {
  it("accepts only the declared first endpoint for each guided connector", () => {
    expect(isValidBpmnConnectionSourceType("sequence", "bpmn:Task")).toBe(true);
    expect(
      isValidBpmnConnectionSourceType("sequence", "bpmn:Participant"),
    ).toBe(false);
    expect(
      isValidBpmnConnectionSourceType("message", "bpmn:Participant"),
    ).toBe(true);
    expect(isValidBpmnConnectionSourceType("message", "bpmn:Task")).toBe(true);
    expect(
      isValidBpmnConnectionSourceType("association", "bpmn:TextAnnotation"),
    ).toBe(true);
    expect(
      isValidBpmnConnectionSourceType("association", "bpmn:Association"),
    ).toBe(false);
    expect(
      isValidBpmnConnectionSourceType(
        "data-association",
        "bpmn:DataObjectReference",
      ),
    ).toBe(true);
    expect(
      isValidBpmnConnectionSourceType("data-association", "bpmn:CallActivity"),
    ).toBe(true);
    expect(
      isValidBpmnConnectionSourceType("data-association", "bpmn:Participant"),
    ).toBe(false);
    expect(
      isValidBpmnConnectionSourceType("data-association", "bpmn:StartEvent"),
    ).toBe(false);
  });

  it("avoids flow, annotation and data shapes without treating lane frames as obstacles", () => {
    expect(isCollaborationPlacementObstacleType("bpmn:Task")).toBe(true);
    expect(
      isCollaborationPlacementObstacleType("bpmn:DataStoreReference"),
    ).toBe(true);
    expect(isCollaborationPlacementObstacleType("bpmn:TextAnnotation")).toBe(
      true,
    );
    expect(isCollaborationPlacementObstacleType("bpmn:Lane")).toBe(false);
    expect(isCollaborationPlacementObstacleType("bpmn:Participant")).toBe(false);
  });
});
