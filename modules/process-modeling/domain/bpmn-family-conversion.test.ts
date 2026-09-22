import { describe, expect, it } from "vitest";
import {
  buildCoreSwimlaneConversionCandidate,
  type SwimlaneOrientation,
} from "../infrastructure/bpmn-io/build-core-swimlane-conversion-candidate";
import { inspectBpmnXml } from "../infrastructure/bpmn-io/inspect-bpmn-xml";
import { starterBpmnXml } from "../infrastructure/bpmn-io/starter-model";
import {
  collaborationSwimlaneLayoutsBpmnProfile,
  type CollaborationBpmnSnapshot,
} from "./collaboration-profile";
import {
  canTransitionBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreBpmnProfile,
  type CoreBpmnProfileId,
  type CoreBpmnSnapshot,
} from "./core-profile";
import {
  bpmnFamilyConversionRuleIds,
  inspectCoreToCollaborationSwimlaneConversion,
} from "./bpmn-family-conversion";

async function inspectedConversion(
  orientation: SwimlaneOrientation,
  sourceXml = starterBpmnXml,
  sourceProfileId: CoreBpmnProfileId = coreBpmnProfile.id,
) {
  const source = await inspectBpmnXml(sourceXml, sourceProfileId);
  const built = await buildCoreSwimlaneConversionCandidate(
    source.canonicalXml!,
    orientation,
  );
  const candidate = await inspectBpmnXml(
    built.xml,
    collaborationSwimlaneLayoutsBpmnProfile.id,
  );
  expect(source.safeToPersist).toBe(true);
  expect(candidate.safeToPersist).toBe(true);
  return {
    source: source.snapshot as CoreBpmnSnapshot,
    candidate: candidate.snapshot as CollaborationBpmnSnapshot,
  };
}

function inspect(
  sourceSnapshot: CoreBpmnSnapshot,
  candidateSnapshot: CollaborationBpmnSnapshot,
  orientation: SwimlaneOrientation = "horizontal",
) {
  return inspectCoreToCollaborationSwimlaneConversion({
    sourceProfileId: sourceSnapshot.profileId,
    targetProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
    orientation,
    sourceSnapshot,
    candidateSnapshot,
  });
}

describe("Core to Collaboration swimlane preservation contract", () => {
  it.each(["horizontal", "vertical"] as const)(
    "accepts the bounded %s conversion produced from the acknowledged Core XML",
    async (orientation) => {
      const { source, candidate } = await inspectedConversion(orientation);
      expect(inspect(source, candidate, orientation)).toMatchObject({
        accepted: true,
        primaryProcessId: source.planeElementId,
        collaborationId: candidate.collaborationId,
      });
    },
  );

  it("rejects any change to an existing semantic scalar or reference", async () => {
    const { source, candidate } = await inspectedConversion("horizontal");
    const changed = structuredClone(candidate);
    const existing = changed.elements.find(
      (element) => element.id === "Task_Intake",
    )!;
    Object.assign(existing, { name: "Changed during conversion" });

    expect(inspect(source, changed)).toEqual({
      accepted: false,
      ruleIds: [bpmnFamilyConversionRuleIds.semantics],
    });
  });

  it("rejects any change to an existing DI identity or geometry", async () => {
    const { source, candidate } = await inspectedConversion("horizontal");
    const changed = structuredClone(candidate);
    const existingDiId = source.shapes[0]!.diId;
    const existing = changed.shapes.find(
      (shape) => shape.diId === existingDiId,
    )!;
    Object.assign(existing, { x: existing.x + 1 });

    const result = inspect(source, changed);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.ruleIds).toContain(bpmnFamilyConversionRuleIds.diagram);
    }
  });

  it("rejects extra participants, message flows, and extra conversion nodes", async () => {
    const { source, candidate } = await inspectedConversion("horizontal");
    const changed: CollaborationBpmnSnapshot = {
      ...candidate,
      participants: [
        ...candidate.participants,
        {
          id: "Participant_Extra",
          processId: source.planeElementId,
        },
      ],
      elements: [
        ...candidate.elements,
        {
          id: "MessageFlow_Extra",
          type: "bpmn:MessageFlow",
          sourceId: candidate.participants[0]!.id,
          targetId: "Participant_Extra",
          incoming: [],
          outgoing: [],
        },
      ],
    };

    const result = inspect(source, changed);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.ruleIds).toEqual(expect.arrayContaining([
        bpmnFamilyConversionRuleIds.aggregate,
        bpmnFamilyConversionRuleIds.semantics,
      ]));
    }
  });

  it("rejects orientation flags that disagree with the explicit request", async () => {
    const { source, candidate } = await inspectedConversion("horizontal");
    const changed = structuredClone(candidate);
    const participantShape = changed.shapes.find(
      (shape) => shape.elementId === changed.participants[0]!.id,
    )!;
    Object.assign(participantShape, { isHorizontal: false });

    const result = inspect(source, changed);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.ruleIds).toContain(bpmnFamilyConversionRuleIds.orientation);
    }
  });

  it("keeps the generic profile graph fail closed for Core to Collaboration", () => {
    expect(
      canTransitionBpmnProfile(
        coreBpmnProfile.id,
        collaborationSwimlaneLayoutsBpmnProfile.id,
      ),
    ).toBe(false);
  });

  it("preserves an additional callable Process outside the primary Process plane", async () => {
    const withCallableProcess = starterBpmnXml.replace(
      "  <bpmndi:BPMNDiagram",
      '  <bpmn:process id="Process_Callable" name="Reusable process" isExecutable="false" />\n  <bpmndi:BPMNDiagram',
    );
    const { source, candidate } = await inspectedConversion(
      "horizontal",
      withCallableProcess,
      coreActivityContainersBpmnProfile.id,
    );

    expect(inspect(source, candidate)).toMatchObject({ accepted: true });
    expect(candidate.elements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "Process_Callable", type: "bpmn:Process" }),
    ]));
  });
});
