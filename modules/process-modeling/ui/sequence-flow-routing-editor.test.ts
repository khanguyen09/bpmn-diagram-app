import { describe, expect, it } from "vitest";
import {
  editSequenceFlowRouting,
  maxSequenceFlowConditionLength,
  normalizeSequenceFlowRouting,
  sequenceFlowRoutingError,
} from "./sequence-flow-routing-editor";

describe("Sequence Flow routing editor", () => {
  it("clears a condition when the branch becomes default", () => {
    expect(
      editSequenceFlowRouting(
        { condition: "amount > 1000", isDefault: false },
        { kind: "default", checked: true },
      ),
    ).toEqual({ condition: "", isDefault: true });
  });

  it("removes default status when a condition is entered", () => {
    expect(
      editSequenceFlowRouting(
        { condition: "", isDefault: true },
        { kind: "condition", value: "approved" },
      ),
    ).toEqual({ condition: "approved", isDefault: false });
  });

  it("validates required and maximum condition length", () => {
    expect(sequenceFlowRoutingError({ condition: " ", isDefault: false })).toBe(
      "Nhánh không mặc định cần một điều kiện.",
    );
    expect(
      sequenceFlowRoutingError({
        condition: "x".repeat(maxSequenceFlowConditionLength + 1),
        isDefault: false,
      }),
    ).toContain("500");
    expect(
      sequenceFlowRoutingError({ condition: "", isDefault: true }),
    ).toBeNull();
  });

  it("trims a condition without changing its plain-text content", () => {
    expect(
      normalizeSequenceFlowRouting({
        condition: "  amount >= 1000  ",
        isDefault: false,
      }),
    ).toEqual({ condition: "amount >= 1000", isDefault: false });
  });
});
