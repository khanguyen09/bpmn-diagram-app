import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreBpmnProfile,
  coreBpmnVisualProfile,
  isBpmnProfileId,
} from "./core-profile";
import {
  collaborationBpmnProfile,
  collaborationNestedBpmnProfile,
} from "./collaboration-profile";

describe("BPMN profile registry", () => {
  it("recognizes the explicit immutable profiles", () => {
    expect(isBpmnProfileId(coreBpmnProfile.id)).toBe(true);
    expect(isBpmnProfileId(coreBpmnVisualProfile.id)).toBe(true);
    expect(isBpmnProfileId(collaborationBpmnProfile.id)).toBe(true);
    expect(isBpmnProfileId(collaborationNestedBpmnProfile.id)).toBe(true);
    expect(isBpmnProfileId("teb-collaboration-starter@3")).toBe(false);
  });

  it("allows same-profile saves and the existing Core visual upgrade only", () => {
    expect(
      canTransitionBpmnProfile(
        collaborationBpmnProfile.id,
        collaborationBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(coreBpmnProfile.id, coreBpmnVisualProfile.id),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationBpmnProfile.id,
        collaborationNestedBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationNestedBpmnProfile.id,
        collaborationBpmnProfile.id,
      ),
    ).toBe(false);
    expect(
      canTransitionBpmnProfile(
        coreBpmnVisualProfile.id,
        collaborationBpmnProfile.id,
      ),
    ).toBe(false);
    expect(
      canTransitionBpmnProfile(
        collaborationBpmnProfile.id,
        coreBpmnVisualProfile.id,
      ),
    ).toBe(false);
  });
});
