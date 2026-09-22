import { describe, expect, it } from "vitest";
import { collaborationSwimlaneLayoutsBpmnProfile } from "../../domain/collaboration-profile";
import { coreBpmnProfile } from "../../domain/core-profile";
import {
  ProcessModelContractError,
  coreToCollaborationConversionRequestHash,
  parseCoreToCollaborationConversionCandidate,
} from "./process-model-contract";

const validCandidate = {
  sourceProfileId: coreBpmnProfile.id,
  profileId: collaborationSwimlaneLayoutsBpmnProfile.id,
  orientation: "horizontal" as const,
  title: "  Editorial review  ",
  description: "  Current workflow  ",
  purpose: "AS_IS" as const,
  xml: "<bpmn:definitions />",
};

describe("Core to Collaboration conversion HTTP contract", () => {
  it("accepts only the exact bounded source/target request and normalizes metadata", () => {
    expect(parseCoreToCollaborationConversionCandidate(validCandidate)).toEqual({
      ...validCandidate,
      title: "Editorial review",
      description: "Current workflow",
    });
  });

  it.each([
    { ...validCandidate, sourceProfileId: "teb-collaboration-starter@1" },
    { ...validCandidate, profileId: "teb-collaboration-complex-routing@1" },
    { ...validCandidate, orientation: "diagonal" },
    { ...validCandidate, source: "EDITED" },
  ])("fails closed for an out-of-contract conversion body: %j", (candidate) => {
    expect(() => parseCoreToCollaborationConversionCandidate(candidate)).toThrow(
      ProcessModelContractError,
    );
  });

  it("applies the existing bounded XML byte limit", () => {
    expect(() => parseCoreToCollaborationConversionCandidate({
      ...validCandidate,
      xml: "x".repeat(1_048_577),
    })).toThrow(expect.objectContaining({ code: "BPMN_LIMIT_EXCEEDED" }));
  });

  it("binds idempotency identity to source revision, profiles, orientation, metadata, and canonical XML", () => {
    const base = {
      sourceProfileId: coreBpmnProfile.id,
      sourceRevisionToken: "bpmn-revision-4",
      targetProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
      orientation: "horizontal" as const,
      title: "Editorial review",
      description: "Current workflow",
      purpose: "AS_IS" as const,
      canonicalXml: "<canonical />",
    };
    const baseline = coreToCollaborationConversionRequestHash(base);

    expect(new Set([
      baseline,
      coreToCollaborationConversionRequestHash({
        ...base,
        sourceRevisionToken: "bpmn-revision-5",
      }),
      coreToCollaborationConversionRequestHash({
        ...base,
        orientation: "vertical",
      }),
      coreToCollaborationConversionRequestHash({
        ...base,
        canonicalXml: "<changed />",
      }),
      coreToCollaborationConversionRequestHash({
        ...base,
        title: "Changed title",
      }),
    ]).size).toBe(5);
  });
});


it("preserves subprocess timer capability when choosing the conversion target", () => {
  const candidate = { ...validCandidate, sourceProfileId: "teb-core-subprocess-timers@1", profileId: "teb-collaboration-subprocess-timers@1" };
  expect(parseCoreToCollaborationConversionCandidate(candidate).profileId).toBe("teb-collaboration-subprocess-timers@1");
  expect(() => parseCoreToCollaborationConversionCandidate({ ...candidate, profileId: validCandidate.profileId })).toThrow(ProcessModelContractError);
  expect(() => parseCoreToCollaborationConversionCandidate({ ...validCandidate, profileId: candidate.profileId })).toThrow(ProcessModelContractError);
});
