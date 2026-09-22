import { describe, expect, it } from "vitest";
import {
  bpmnArrangeNativeCommand,
  doesBpmnArrangeRuleAllow,
  isBpmnArrangeElementEligible,
} from "./bpmn-arrange-selection";

const shape = {
  type: "bpmn:Task",
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  parent: {},
};

describe("bounded BPMN arrange selection", () => {
  it("allows positioned shapes but excludes lanes, labels and connections", () => {
    expect(isBpmnArrangeElementEligible(shape)).toBe(true);
    expect(isBpmnArrangeElementEligible({ ...shape, type: "bpmn:Lane" })).toBe(
      false,
    );
    expect(isBpmnArrangeElementEligible({ ...shape, type: "label" })).toBe(false);
    expect(isBpmnArrangeElementEligible({ ...shape, waypoints: [{}, {}] })).toBe(
      false,
    );
  });

  it("maps only to installed native editor actions", () => {
    expect(bpmnArrangeNativeCommand("align-middle")).toEqual({
      command: "alignElements",
      type: "middle",
    });
    expect(bpmnArrangeNativeCommand("distribute-horizontal")).toEqual({
      command: "distributeElements",
      type: "horizontal",
    });
  });

  it("accepts the native rules service filtered-array contract", () => {
    const secondShape = { ...shape, x: 140 };
    const thirdShape = { ...shape, x: 270 };
    const selected = [shape, secondShape, thirdShape];

    expect(doesBpmnArrangeRuleAllow(selected, selected, 2)).toBe(true);
    expect(doesBpmnArrangeRuleAllow(selected, selected, 3)).toBe(true);
    expect(doesBpmnArrangeRuleAllow(true, selected, 2)).toBe(true);
    expect(doesBpmnArrangeRuleAllow(false, selected, 2)).toBe(false);
    expect(doesBpmnArrangeRuleAllow(null, selected, 2)).toBe(false);
  });

  it("rejects a mixed selection when native rules filter any element", () => {
    const secondShape = { ...shape, x: 140 };
    const annotation = { ...shape, type: "bpmn:TextAnnotation", x: 270 };
    const selected = [shape, secondShape, annotation];

    expect(
      doesBpmnArrangeRuleAllow([shape, secondShape], selected, 2),
    ).toBe(false);
    expect(
      doesBpmnArrangeRuleAllow([secondShape, shape], selected, 2),
    ).toBe(false);
    expect(doesBpmnArrangeRuleAllow([], selected, 2)).toBe(false);
  });
});
