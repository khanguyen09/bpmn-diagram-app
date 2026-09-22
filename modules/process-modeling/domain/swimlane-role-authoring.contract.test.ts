import { describe, expect, it } from "vitest";
import {
  collaborationBpmnProfile,
  collaborationBoundaryEventsBpmnProfile,
  collaborationCatchingEventsBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationEventRoutingBpmnProfile,
  collaborationIntermediateEventsBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationStructuredBpmnProfile,
  collaborationTaskTypesBpmnProfile,
  supportsNestedLanes,
} from "./collaboration-profile";
import {
  assessChildRoleName,
  canAddChildRole,
  hasDuplicateNormalizedRoleName,
  isLaneResponsibilityType,
  maxChildRoleLanes,
} from "./swimlane-role-authoring";
import {
  coreBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreBpmnVisualProfile,
} from "./core-profile";

describe("Swimlane child-role authoring policy", () => {
  it("projects nested capability across every Collaboration successor only", () => {
    expect(supportsNestedLanes(collaborationBpmnProfile.id)).toBe(false);
    for (const profile of [
      collaborationNestedBpmnProfile,
      collaborationStructuredBpmnProfile,
      collaborationConditionalBpmnProfile,
      collaborationCatchingEventsBpmnProfile,
      collaborationEventRoutingBpmnProfile,
      collaborationTaskTypesBpmnProfile,
      collaborationIntermediateEventsBpmnProfile,
      collaborationBoundaryEventsBpmnProfile,
    ]) {
      expect(supportsNestedLanes(profile.id)).toBe(true);
    }
    for (const value of [
      coreBpmnProfile.id,
      coreBpmnVisualProfile.id,
      coreBoundaryEventsBpmnProfile.id,
      "teb-collaboration-starter@3",
      undefined,
    ]) {
      expect(supportsNestedLanes(value)).toBe(false);
    }
  });

  it("normalizes and validates 1..120 graphemes", () => {
    expect(assessChildRoleName("  Content   Writer  ")).toEqual({
      normalizedName: "Content Writer",
      graphemeCount: 14,
    });
    expect(assessChildRoleName(" \n ")).toMatchObject({
      normalizedName: "",
      graphemeCount: 0,
      error: "required",
    });
    expect(assessChildRoleName("👩🏽‍💻")).toMatchObject({
      graphemeCount: 1,
    });
    expect(assessChildRoleName("a".repeat(120))).not.toHaveProperty("error");
    expect(assessChildRoleName("a".repeat(121))).toMatchObject({
      graphemeCount: 121,
      error: "too_long",
    });
  });

  it("warns for normalized duplicate names without rejecting them", () => {
    expect(
      hasDuplicateNormalizedRoleName("  BIÊN   TẬP ", ["Biên tập"]),
    ).toBe(true);
    expect(assessChildRoleName("  BIÊN   TẬP ", ["Biên tập"])).toEqual({
      normalizedName: "BIÊN TẬP",
      graphemeCount: 8,
      warning: "duplicate",
    });
  });

  it("caps repeated additions at eight child roles", () => {
    expect(maxChildRoleLanes).toBe(8);
    expect(canAddChildRole(1)).toBe(false);
    for (let count = 2; count < maxChildRoleLanes; count += 1) {
      expect(canAddChildRole(count)).toBe(true);
    }
    expect(canAddChildRole(maxChildRoleLanes)).toBe(false);
    expect(canAddChildRole(2.5)).toBe(false);
  });

  it("counts supported Task/Event responsibilities but not Boundary Events", () => {
    for (const type of [
      "bpmn:StartEvent",
      "bpmn:EndEvent",
      "bpmn:IntermediateCatchEvent",
      "bpmn:IntermediateThrowEvent",
      "bpmn:Task",
      "bpmn:ReceiveTask",
      "bpmn:UserTask",
      "bpmn:ServiceTask",
      "bpmn:ManualTask",
    ]) {
      expect(isLaneResponsibilityType(type)).toBe(true);
    }
    for (const type of [
      "bpmn:BoundaryEvent",
      "bpmn:ExclusiveGateway",
      "bpmn:ParallelGateway",
      "bpmn:MessageFlow",
      "unknown",
    ]) {
      expect(isLaneResponsibilityType(type)).toBe(false);
    }
  });
});
