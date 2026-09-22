import { describe, expect, it } from "vitest";
import {
  collaborationBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationStructuredBpmnProfile,
} from "../domain/collaboration-profile";
import {
  coreBpmnProfile,
  coreBpmnVisualProfile,
  coreStructuredBpmnProfile,
} from "../domain/core-profile";
import {
  bpmnNodeLibraryGroups,
  filterBpmnNodeLibrary,
} from "./bpmn-node-library-catalogue";

function itemIds(profileId: Parameters<typeof bpmnNodeLibraryGroups>[0]) {
  return bpmnNodeLibraryGroups(profileId).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe("Structured Routing node-library projection", () => {
  it.each([
    [coreBpmnProfile.id, false],
    [coreBpmnVisualProfile.id, false],
    [collaborationBpmnProfile.id, false],
    [collaborationNestedBpmnProfile.id, false],
    [coreStructuredBpmnProfile.id, true],
    [collaborationStructuredBpmnProfile.id, true],
  ] as const)(
    "projects Parallel Gateway only for capable profile %s",
    (profileId, supportsParallel) => {
      expect(itemIds(profileId).includes("parallel-gateway")).toBe(
        supportsParallel,
      );
    },
  );

  it("keeps the exact Core and Collaboration item sets bounded", () => {
    expect(itemIds(coreBpmnVisualProfile.id)).toEqual([
      "sequence-flow",
      "start-event",
      "end-event",
      "task",
      "exclusive-gateway",
    ]);
    expect(itemIds(coreStructuredBpmnProfile.id)).toEqual([
      "sequence-flow",
      "start-event",
      "end-event",
      "task",
      "exclusive-gateway",
      "parallel-gateway",
    ]);
    expect(itemIds(collaborationStructuredBpmnProfile.id)).toEqual([
      "sequence-flow",
      "start-event",
      "end-event",
      "task",
      "exclusive-gateway",
      "parallel-gateway",
      "message-flow",
      "white-box-pool",
      "black-box-pool",
    ]);
  });

  it("never advertises deferred gateways as editable", () => {
    for (const profileId of [
      coreBpmnProfile.id,
      coreBpmnVisualProfile.id,
      coreStructuredBpmnProfile.id,
      collaborationBpmnProfile.id,
      collaborationNestedBpmnProfile.id,
      collaborationStructuredBpmnProfile.id,
    ]) {
      expect(itemIds(profileId)).not.toEqual(
        expect.arrayContaining([
          "inclusive-gateway",
          "event-based-gateway",
          "complex-gateway",
        ]),
      );
    }
  });

  it("finds Parallel Gateway through Vietnamese and BPMN aliases only when supported", () => {
    expect(
      filterBpmnNodeLibrary(
        bpmnNodeLibraryGroups(coreStructuredBpmnProfile.id),
        "song song",
      ).flatMap((group) => group.items.map((item) => item.id)),
    ).toEqual(["parallel-gateway"]);
    expect(
      filterBpmnNodeLibrary(
        bpmnNodeLibraryGroups(coreStructuredBpmnProfile.id),
        "and",
      ).flatMap((group) => group.items.map((item) => item.id)),
    ).toEqual(["parallel-gateway"]);
    expect(
      filterBpmnNodeLibrary(
        bpmnNodeLibraryGroups(coreBpmnVisualProfile.id),
        "song song",
      ),
    ).toEqual([]);
  });
});
