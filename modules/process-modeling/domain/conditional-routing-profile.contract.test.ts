import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreBpmnProfile,
  coreBpmnVisualProfile,
  coreConditionalBpmnProfile,
  coreStructuredBpmnProfile,
  isBpmnProfileId,
  isCoreConditionalBpmnProfileId,
  supportsConditionalRouting,
  supportsStructuredRouting,
  type CoreBpmnElement,
} from "./core-profile";
import {
  collaborationBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationStructuredBpmnProfile,
  isCollaborationConditionalBpmnProfileId,
} from "./collaboration-profile";
import { inspectConditionalRouting } from "./conditional-routing";

const node = (
  id: string,
  type: string,
  incoming: readonly string[],
  outgoing: readonly string[],
  defaultFlowId?: string,
): CoreBpmnElement => ({
  id,
  type,
  incoming,
  outgoing,
  ...(defaultFlowId ? { defaultFlowId } : {}),
});

const flow = (
  id: string,
  sourceId: string,
  targetId: string,
  conditionExpression?: string,
): CoreBpmnElement => ({
  id,
  type: "bpmn:SequenceFlow",
  sourceId,
  targetId,
  incoming: [],
  outgoing: [],
  ...(conditionExpression !== undefined ? { conditionExpression } : {}),
});

describe("Conditional Routing profile contract", () => {
  it("adds only Inclusive Gateway and recognizes inherited capabilities", () => {
    expect(coreConditionalBpmnProfile).toMatchObject({
      id: "teb-core-conditional@1",
    });
    expect(collaborationConditionalBpmnProfile).toMatchObject({
      id: "teb-collaboration-conditional@1",
    });
    expect(coreConditionalBpmnProfile.semanticTypes).toContain(
      "bpmn:InclusiveGateway",
    );
    expect(collaborationConditionalBpmnProfile.semanticTypes).toContain(
      "bpmn:InclusiveGateway",
    );
    for (const profile of [
      coreBpmnProfile,
      coreBpmnVisualProfile,
      coreStructuredBpmnProfile,
      collaborationBpmnProfile,
      collaborationNestedBpmnProfile,
      collaborationStructuredBpmnProfile,
    ]) {
      expect(profile.semanticTypes).not.toContain("bpmn:InclusiveGateway");
    }
    expect(isBpmnProfileId(coreConditionalBpmnProfile.id)).toBe(true);
    expect(isCoreConditionalBpmnProfileId(coreConditionalBpmnProfile.id)).toBe(
      true,
    );
    expect(
      isCollaborationConditionalBpmnProfileId(
        collaborationConditionalBpmnProfile.id,
      ),
    ).toBe(true);
    expect(supportsStructuredRouting(coreConditionalBpmnProfile.id)).toBe(true);
    expect(supportsConditionalRouting(coreStructuredBpmnProfile.id)).toBe(
      false,
    );
    expect(supportsConditionalRouting(coreConditionalBpmnProfile.id)).toBe(
      true,
    );
  });

  it("allows only exact same-family Structured to Conditional transitions", () => {
    expect(
      canTransitionBpmnProfile(
        coreStructuredBpmnProfile.id,
        coreConditionalBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationStructuredBpmnProfile.id,
        collaborationConditionalBpmnProfile.id,
      ),
    ).toBe(true);
    for (const [current, candidate] of [
      [coreBpmnVisualProfile.id, coreConditionalBpmnProfile.id],
      [coreConditionalBpmnProfile.id, coreStructuredBpmnProfile.id],
      [
        collaborationNestedBpmnProfile.id,
        collaborationConditionalBpmnProfile.id,
      ],
      [
        collaborationConditionalBpmnProfile.id,
        collaborationStructuredBpmnProfile.id,
      ],
      [
        coreStructuredBpmnProfile.id,
        collaborationConditionalBpmnProfile.id,
      ],
    ] as const) {
      expect(canTransitionBpmnProfile(current, candidate)).toBe(false);
    }
  });

  it("accepts complete XOR and Inclusive topology without blanket join blocking", () => {
    const xor = node(
      "Gateway_Xor",
      "bpmn:ExclusiveGateway",
      ["Flow_In"],
      ["Flow_Yes", "Flow_Default"],
      "Flow_Default",
    );
    const inclusiveJoin = node(
      "Gateway_Join",
      "bpmn:InclusiveGateway",
      ["Flow_A", "Flow_B"],
      ["Flow_After"],
    );
    const issues = inspectConditionalRouting(
      [
        xor,
        inclusiveJoin,
        flow("Flow_Yes", xor.id, "Task_Yes", "approved"),
        flow("Flow_Default", xor.id, "Task_Default"),
        flow("Flow_After", inclusiveJoin.id, "End_1"),
      ],
      true,
    );
    expect(issues).toEqual([]);
  });

  it("distinguishes recoverable incompleteness from fatal placement/default errors", () => {
    const incomplete = node(
      "Gateway_Incomplete",
      "bpmn:InclusiveGateway",
      ["Flow_In"],
      ["Flow_A", "Flow_B"],
    );
    const parallel = node(
      "Gateway_Parallel",
      "bpmn:ParallelGateway",
      ["Flow_Parallel_In"],
      ["Flow_Parallel_Out"],
      "Flow_Parallel_Out",
    );
    const mixed = node(
      "Gateway_Mixed",
      "bpmn:InclusiveGateway",
      ["Flow_In_A", "Flow_In_B"],
      ["Flow_Out_A", "Flow_Out_B"],
    );
    const issues = inspectConditionalRouting(
      [
        incomplete,
        parallel,
        mixed,
        flow("Flow_A", incomplete.id, "Task_A"),
        flow("Flow_B", incomplete.id, "Task_B"),
        flow(
          "Flow_Parallel_Out",
          parallel.id,
          "Task_C",
          "not allowed",
        ),
        flow("Flow_Out_A", mixed.id, "Task_D"),
        flow("Flow_Out_B", mixed.id, "Task_E"),
      ],
      true,
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-INC-001",
          disposition: "recoverable",
          elementId: incomplete.id,
        }),
        expect.objectContaining({
          ruleId: "BPMN-DEFAULT-001",
          disposition: "fatal",
          elementId: parallel.id,
        }),
        expect.objectContaining({
          ruleId: "BPMN-COND-002",
          disposition: "fatal",
          elementId: "Flow_Parallel_Out",
        }),
        expect.objectContaining({
          ruleId: "BPMN-MIX-001",
          disposition: "fatal",
          elementId: mixed.id,
        }),
      ]),
    );
  });

  it("fatal-rejects hidden conditional metadata when capability is disabled", () => {
    const issues = inspectConditionalRouting(
      [
        flow("Flow_Hidden", "Gateway_Xor", "Task_1", "hidden"),
        node(
          "Gateway_Xor",
          "bpmn:ExclusiveGateway",
          ["Flow_In"],
          ["Flow_Hidden", "Flow_Default"],
          "Flow_Default",
        ),
      ],
      false,
    );
    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: "BPMN-PROFILE-005",
        disposition: "fatal",
        elementId: "Flow_Hidden",
      }),
      expect.objectContaining({
        ruleId: "BPMN-PROFILE-005",
        disposition: "fatal",
        elementId: "Gateway_Xor",
      }),
    ]);
  });
});
