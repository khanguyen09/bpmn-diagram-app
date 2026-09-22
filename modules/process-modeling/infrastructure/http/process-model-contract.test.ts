import { describe, expect, it } from "vitest";
import { starterBpmnXml } from "../bpmn-io/starter-model";
import { collaborationStarterBpmnXml } from "../bpmn-io/collaboration-starter-model";
import {
  collaborationCatchingEventsBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationEventRoutingBpmnProfile,
  collaborationTaskTypesBpmnProfile,
  collaborationIntermediateEventsBpmnProfile,
  collaborationBoundaryEventsBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
} from "../../domain/collaboration-profile";
import {
  supportedBpmnProfiles,
  coreCatchingEventsBpmnProfile,
  coreConditionalBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreTaskTypesBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreBoundaryEventsBpmnProfile,
} from "../../domain/core-profile";
import {
  ProcessModelContractError,
  modelRequestHash,
  parseProcessModelCandidate,
} from "./process-model-contract";

describe("process model HTTP contract", () => {
  it("accepts the explicit Conditional and Event Routing discriminators", () => {
    for (const profileId of [
      coreConditionalBpmnProfile.id,
      coreCatchingEventsBpmnProfile.id,
      coreEventRoutingBpmnProfile.id,
      coreTaskTypesBpmnProfile.id,
      coreIntermediateEventsBpmnProfile.id,
      coreBoundaryEventsBpmnProfile.id,
      collaborationConditionalBpmnProfile.id,
      collaborationCatchingEventsBpmnProfile.id,
      collaborationEventRoutingBpmnProfile.id,
      collaborationTaskTypesBpmnProfile.id,
      collaborationIntermediateEventsBpmnProfile.id,
      collaborationBoundaryEventsBpmnProfile.id,
    ]) {
      expect(
        parseProcessModelCandidate({
          title: "Conditional routing",
          description: "",
          purpose: "TO_BE",
          profileId,
          xml: starterBpmnXml,
        }).profileId,
      ).toBe(profileId);
    }
  });
  it("accepts the explicit Collaboration Nested v2 discriminator", () => {
    expect(
      parseProcessModelCandidate({
        title: "Nested collaboration",
        description: "",
        purpose: "TO_BE",
        profileId: collaborationNestedBpmnProfile.id,
        xml: collaborationStarterBpmnXml,
      }).profileId,
    ).toBe(collaborationNestedBpmnProfile.id);
  });
  it("accepts the explicit Collaboration Swimlane Layouts discriminator", () => {
    expect(
      parseProcessModelCandidate({
        title: "Oriented collaboration",
        description: "",
        purpose: "TO_BE",
        profileId: collaborationSwimlaneLayoutsBpmnProfile.id,
        xml: collaborationStarterBpmnXml,
      }).profileId,
    ).toBe(collaborationSwimlaneLayoutsBpmnProfile.id);
  });
  it("accepts strict bounded metadata and XML", () => {
    expect(parseProcessModelCandidate({
      title: "Editorial review",
      description: "",
      purpose: "AS_IS",
      xml: starterBpmnXml,
      source: "EDITED",
    }).title).toBe("Editorial review");
  });

  it("accepts the explicit Collaboration discriminator without changing the Core default", () => {
    expect(
      parseProcessModelCandidate({
        title: "Editorial collaboration",
        description: "",
        purpose: "TO_BE",
        profileId: "teb-collaboration-starter@1",
        xml: collaborationStarterBpmnXml,
      }).profileId,
    ).toBe("teb-collaboration-starter@1");
    expect(
      parseProcessModelCandidate({
        title: "Core default",
        description: "",
        purpose: "AS_IS",
        xml: starterBpmnXml,
      }).profileId,
    ).toBe("teb-core-starter@1");
  });

  it("rejects unknown fields and XML above one MiB", () => {
    expect(() => parseProcessModelCandidate({
      title: "Editorial review",
      description: "",
      purpose: "AS_IS",
      xml: starterBpmnXml,
      trustedByClient: true,
    })).toThrow(ProcessModelContractError);

    try {
      parseProcessModelCandidate({
        title: "Editorial review",
        description: "",
        purpose: "AS_IS",
        xml: "x".repeat(1_048_577),
      });
      throw new Error("Expected size rejection.");
    } catch (error) {
      expect(error).toMatchObject({ code: "BPMN_LIMIT_EXCEEDED" });
    }
  });

  it("hashes canonical metadata independently of property order", () => {
    const left = modelRequestHash({
      title: "A",
      description: "B",
      purpose: "AS_IS",
      profileId: "teb-core-starter@1",
      canonicalXml: starterBpmnXml,
    });
    const right = modelRequestHash({
      canonicalXml: starterBpmnXml,
      purpose: "AS_IS",
      description: "B",
      title: "A",
      profileId: "teb-core-starter@1",
    });
    expect(left).toBe(right);
  });

  it("treats revision source as part of the idempotent command payload", () => {
    const edited = modelRequestHash({
      title: "A",
      description: "",
      purpose: "AS_IS",
      profileId: "teb-core-starter@1",
      canonicalXml: starterBpmnXml,
      source: "EDITED",
    });
    const imported = modelRequestHash({
      title: "A",
      description: "",
      purpose: "AS_IS",
      profileId: "teb-core-starter@1",
      canonicalXml: starterBpmnXml,
      source: "IMPORTED",
    });
    expect(edited).not.toBe(imported);
  });

  it("binds the BPMN profile into the idempotent command hash", () => {
    const base = {
      title: "A",
      description: "",
      purpose: "AS_IS" as const,
      canonicalXml: starterBpmnXml,
    };
    expect(
      modelRequestHash({ ...base, profileId: "teb-core-starter@1" }),
    ).not.toBe(
      modelRequestHash({
        ...base,
        profileId: "teb-collaboration-starter@1",
      }),
    );
  });
});


it.each(supportedBpmnProfiles)("HTTP candidate contract accepts supported profile $id", ({ id }) => {
  expect(parseProcessModelCandidate({ title: "Contract parity", purpose: "TO_BE", profileId: id, xml: starterBpmnXml }).profileId).toBe(id);
});
it("HTTP candidate contract rejects unregistered successor profile", () => {
  expect(() => parseProcessModelCandidate({ title: "Unknown", purpose: "TO_BE", profileId: "teb-core-subprocess-timers@999", xml: starterBpmnXml })).toThrow(ProcessModelContractError);
});
