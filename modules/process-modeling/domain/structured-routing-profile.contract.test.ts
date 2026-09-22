import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreBpmnProfile,
  coreStructuredBpmnProfile,
  coreBpmnVisualProfile,
  isBpmnProfileId,
  isCoreStructuredBpmnProfileId,
  isStructuredBpmnProfileId,
} from "./core-profile";
import {
  collaborationBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationStructuredBpmnProfile,
  isCollaborationStructuredBpmnProfileId,
} from "./collaboration-profile";

describe("Structured Routing profile contract", () => {
  it("keeps Parallel Gateway out of every frozen profile", () => {
    for (const profile of [
      coreBpmnProfile,
      coreBpmnVisualProfile,
      collaborationBpmnProfile,
      collaborationNestedBpmnProfile,
    ]) {
      expect(profile.semanticTypes).not.toContain("bpmn:ParallelGateway");
    }
  });

  it("recognizes only the two explicit Structured profiles", () => {
    expect(coreStructuredBpmnProfile).toMatchObject({
      id: "teb-core-structured@1",
    });
    expect(collaborationStructuredBpmnProfile).toMatchObject({
      id: "teb-collaboration-structured@1",
    });
    expect(coreStructuredBpmnProfile.semanticTypes).toContain(
      "bpmn:ParallelGateway",
    );
    expect(collaborationStructuredBpmnProfile.semanticTypes).toContain(
      "bpmn:ParallelGateway",
    );

    expect(isBpmnProfileId(coreStructuredBpmnProfile.id)).toBe(true);
    expect(isBpmnProfileId(collaborationStructuredBpmnProfile.id)).toBe(true);
    expect(isCoreStructuredBpmnProfileId(coreStructuredBpmnProfile.id)).toBe(
      true,
    );
    expect(
      isCollaborationStructuredBpmnProfileId(
        collaborationStructuredBpmnProfile.id,
      ),
    ).toBe(true);
    expect(isStructuredBpmnProfileId(coreBpmnVisualProfile.id)).toBe(false);
    expect(isStructuredBpmnProfileId("teb-core-structured@2")).toBe(false);
  });

  it("allows only one-way same-family Structured upgrades", () => {
    expect(
      canTransitionBpmnProfile(
        coreBpmnVisualProfile.id,
        coreStructuredBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        coreStructuredBpmnProfile.id,
        coreBpmnVisualProfile.id,
      ),
    ).toBe(false);
    expect(
      canTransitionBpmnProfile(
        collaborationNestedBpmnProfile.id,
        collaborationStructuredBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationStructuredBpmnProfile.id,
        collaborationNestedBpmnProfile.id,
      ),
    ).toBe(false);
    expect(
      canTransitionBpmnProfile(
        coreStructuredBpmnProfile.id,
        collaborationStructuredBpmnProfile.id,
      ),
    ).toBe(false);
  });
});
