import { describe, expect, it } from "vitest";
import {
  canTransitionCoreBpmnProfile,
  coreBpmnProfile,
  coreBpmnVisualProfile,
  isCoreBpmnProfileId,
} from "./core-profile";

describe("Core BPMN profile registry", () => {
  it("keeps v1 readable and permits only the directed visual upgrade", () => {
    expect(isCoreBpmnProfileId(coreBpmnProfile.id)).toBe(true);
    expect(isCoreBpmnProfileId(coreBpmnVisualProfile.id)).toBe(true);
    expect(canTransitionCoreBpmnProfile(coreBpmnProfile.id, coreBpmnProfile.id)).toBe(true);
    expect(
      canTransitionCoreBpmnProfile(coreBpmnProfile.id, coreBpmnVisualProfile.id),
    ).toBe(true);
    expect(
      canTransitionCoreBpmnProfile(coreBpmnVisualProfile.id, coreBpmnProfile.id),
    ).toBe(false);
  });
});
