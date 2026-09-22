import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreFullAuthoringBpmnProfile,
  coreStructuredBpmnProfile,
  coreBpmnProfile,
  coreBpmnVisualProfile,
  supportedBpmnProfiles,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  collaborationActivityContainersBpmnProfile,
  collaborationBoundaryEventsBpmnProfile,
  collaborationBpmnProfile,
  collaborationComplexRoutingBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  collaborationStructuredBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
} from "../domain/collaboration-profile";
import { planBpmnProfileUpgrade } from "./bpmn-profile-upgrade-plan";

describe("BPMN profile upgrade planner", () => {
  it("includes Full Authoring in the Core Boundary to Activity path", () => {
    expect(
      planBpmnProfileUpgrade(
        coreBoundaryEventsBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ),
    ).toEqual({
      kind: "upgrade-required",
      fromProfileId: coreBoundaryEventsBpmnProfile.id,
      minimumProfileId: coreActivityContainersBpmnProfile.id,
      steps: [
        coreFullAuthoringBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ],
    });
  });

  it("includes Full Authoring in the Collaboration Boundary to Activity path", () => {
    expect(
      planBpmnProfileUpgrade(
        collaborationBoundaryEventsBpmnProfile.id,
        collaborationActivityContainersBpmnProfile.id,
      ),
    ).toEqual({
      kind: "upgrade-required",
      fromProfileId: collaborationBoundaryEventsBpmnProfile.id,
      minimumProfileId: collaborationActivityContainersBpmnProfile.id,
      steps: [
        collaborationFullAuthoringBpmnProfile.id,
        collaborationActivityContainersBpmnProfile.id,
      ],
    });
  });

  it("plans every adjacent advanced Core successor without skipping", () => {
    const plan = planBpmnProfileUpgrade(
      coreBoundaryEventsBpmnProfile.id,
      coreComplexRoutingBpmnProfile.id,
    );

    expect(plan.kind).toBe("upgrade-required");
    expect(plan.steps).toEqual([
      coreFullAuthoringBpmnProfile.id,
      coreActivityContainersBpmnProfile.id,
      coreDataAuthoringBpmnProfile.id,
      coreComplexRoutingBpmnProfile.id,
    ]);
  });

  it("uses only the declared immediate Collaboration successor for swimlane layouts", () => {
    expect(
      planBpmnProfileUpgrade(
        collaborationComplexRoutingBpmnProfile.id,
        collaborationSwimlaneLayoutsBpmnProfile.id,
      ).steps,
    ).toEqual([collaborationSwimlaneLayoutsBpmnProfile.id]);
  });

  it("uses the existing legal direct Starter v1 to Structured edge", () => {
    expect(
      planBpmnProfileUpgrade(
        coreBpmnProfile.id,
        coreStructuredBpmnProfile.id,
      ).steps,
    ).toEqual([coreStructuredBpmnProfile.id]);
    expect(
      planBpmnProfileUpgrade(
        coreBpmnVisualProfile.id,
        coreStructuredBpmnProfile.id,
      ).steps,
    ).toEqual([coreStructuredBpmnProfile.id]);
    expect(
      planBpmnProfileUpgrade(
        collaborationBpmnProfile.id,
        collaborationStructuredBpmnProfile.id,
      ).steps,
    ).toEqual([collaborationStructuredBpmnProfile.id]);
  });

  it("keeps the current later profile when an earlier minimum is already satisfied", () => {
    expect(
      planBpmnProfileUpgrade(
        coreComplexRoutingBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ),
    ).toEqual({
      kind: "already-satisfied",
      fromProfileId: coreComplexRoutingBpmnProfile.id,
      minimumProfileId: coreActivityContainersBpmnProfile.id,
      steps: [],
    });
    expect(
      planBpmnProfileUpgrade(
        coreActivityContainersBpmnProfile.id,
        coreActivityContainersBpmnProfile.id,
      ).steps,
    ).toEqual([]);
  });

  it("rejects cross-family conversion instead of planning it", () => {
    expect(
      planBpmnProfileUpgrade(
        coreBoundaryEventsBpmnProfile.id,
        collaborationActivityContainersBpmnProfile.id,
      ),
    ).toEqual({
      kind: "incompatible",
      fromProfileId: coreBoundaryEventsBpmnProfile.id,
      minimumProfileId: collaborationActivityContainersBpmnProfile.id,
      reason: "CROSS_FAMILY",
      steps: [],
    });
  });

  it("returns only domain-approved edges and never mutates the profile catalogue", () => {
    const originalIds = supportedBpmnProfiles.map((profile) => profile.id);

    for (const current of originalIds) {
      for (const minimum of originalIds) {
        const plan = planBpmnProfileUpgrade(current, minimum);
        if (plan.kind !== "upgrade-required") continue;

        let previous: BpmnProfileId = current;
        for (const step of plan.steps) {
          expect(canTransitionBpmnProfile(previous, step)).toBe(true);
          expect(step).not.toBe(previous);
          previous = step;
        }
        expect(previous).toBe(minimum);
      }
    }

    expect(supportedBpmnProfiles.map((profile) => profile.id)).toEqual(
      originalIds,
    );
  });
});
