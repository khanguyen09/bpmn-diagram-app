import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  supportsComplexRouting,
} from "../../domain/core-profile";
import {
  collaborationComplexRoutingBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
  supportsSwimlaneLayouts,
} from "../../domain/collaboration-profile";
import { collaborationStarterBpmnXml } from "./collaboration-starter-model";
import { inspectBpmnXml } from "./inspect-bpmn-xml";

function verticalStarterXml(): string {
  return collaborationStarterBpmnXml
    .replaceAll('isHorizontal="true"', 'isHorizontal="false"')
    .replace(
      '<dc:Bounds x="80" y="80" width="900" height="300" />',
      '<dc:Bounds x="80" y="80" width="300" height="900" />',
    )
    .replace(
      '<dc:Bounds x="110" y="80" width="870" height="150" />',
      '<dc:Bounds x="80" y="110" width="150" height="870" />',
    )
    .replace(
      '<dc:Bounds x="110" y="230" width="870" height="150" />',
      '<dc:Bounds x="230" y="110" width="150" height="870" />',
    )
    .replace(
      '<dc:Bounds x="170" y="137" width="36" height="36" />',
      '<dc:Bounds x="120" y="180" width="36" height="36" />',
    )
    .replace(
      '<dc:Bounds x="270" y="115" width="120" height="80" />',
      '<dc:Bounds x="95" y="300" width="120" height="80" />',
    )
    .replace(
      '<dc:Bounds x="520" y="265" width="120" height="80" />',
      '<dc:Bounds x="245" y="300" width="120" height="80" />',
    )
    .replace(
      '<dc:Bounds x="760" y="287" width="36" height="36" />',
      '<dc:Bounds x="285" y="500" width="36" height="36" />',
    )
    .replace(
      '<dc:Bounds x="80" y="470" width="900" height="100" />',
      '<dc:Bounds x="500" y="80" width="60" height="900" />',
    );
}

describe("Collaboration Swimlane Layouts profile and DI contract", () => {
  it("adds one immutable successor without changing semantic types", () => {
    expect(collaborationSwimlaneLayoutsBpmnProfile.id).toBe(
      "teb-collaboration-swimlane-layouts@1",
    );
    expect(collaborationSwimlaneLayoutsBpmnProfile.semanticTypes).toEqual(
      collaborationComplexRoutingBpmnProfile.semanticTypes,
    );
    expect(
      canTransitionBpmnProfile(
        collaborationComplexRoutingBpmnProfile.id,
        collaborationSwimlaneLayoutsBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationSwimlaneLayoutsBpmnProfile.id,
        collaborationComplexRoutingBpmnProfile.id,
      ),
    ).toBe(false);
    expect(supportsSwimlaneLayouts(collaborationComplexRoutingBpmnProfile.id))
      .toBe(false);
    expect(supportsSwimlaneLayouts(collaborationSwimlaneLayoutsBpmnProfile.id))
      .toBe(true);
    expect(supportsComplexRouting(collaborationSwimlaneLayoutsBpmnProfile.id))
      .toBe(true);
  });

  it("projects and round-trips explicit horizontal orientation", async () => {
    const result = await inspectBpmnXml(
      collaborationStarterBpmnXml,
      collaborationSwimlaneLayoutsBpmnProfile.id,
    );

    expect(result.accepted).toBe(true);
    expect(
      result.snapshot?.shapes
        .filter((shape) =>
          ["Participant_Editorial", "Lane_Author", "Lane_Editor"].includes(
            shape.elementId,
          ),
        )
        .map((shape) => shape.isHorizontal),
    ).toEqual([true, true, true]);
    expect(result.canonicalXml).toContain('isHorizontal="true"');
  });

  it("keeps the immediate predecessor's historical geometry-only rule frozen", async () => {
    const historicallyAccepted = collaborationStarterBpmnXml.replace(
      'bpmnElement="Participant_Editorial" isHorizontal="true"',
      'bpmnElement="Participant_Editorial" isHorizontal="false"',
    );
    const result = await inspectBpmnXml(
      historicallyAccepted,
      collaborationComplexRoutingBpmnProfile.id,
    );

    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "BPMN-COLLAB-DI-006" }),
      ]),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts a contained vertical Lane tree using BPMNDI truth", async () => {
    const result = await inspectBpmnXml(
      verticalStarterXml(),
      collaborationSwimlaneLayoutsBpmnProfile.id,
    );

    expect(
      result.issues.filter((issue) =>
        [
          "BPMN-COLLAB-DI-007",
          "BPMN-LANE-DI-004",
          "BPMN-LANE-DI-005",
        ].includes(issue.ruleId),
      ),
    ).toEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.canonicalXml).toContain('isHorizontal="false"');
  });

  it("fails closed for missing or mixed orientation", async () => {
    const mixed = collaborationStarterBpmnXml.replace(
      'id="Shape_Lane_Editor" bpmnElement="Lane_Editor" isHorizontal="true"',
      'id="Shape_Lane_Editor" bpmnElement="Lane_Editor" isHorizontal="false"',
    );
    const missing = collaborationStarterBpmnXml.replace(
      ' bpmnElement="Lane_Editor" isHorizontal="true"',
      ' bpmnElement="Lane_Editor"',
    );

    for (const xml of [mixed, missing]) {
      const result = await inspectBpmnXml(
        xml,
        collaborationSwimlaneLayoutsBpmnProfile.id,
      );
      expect(result.accepted).toBe(false);
      expect(result.issues.map((issue) => issue.ruleId)).toContain(
        "BPMN-LANE-DI-004",
      );
    }
  });
});
