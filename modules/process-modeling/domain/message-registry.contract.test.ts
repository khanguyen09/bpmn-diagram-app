import { describe, expect, it } from "vitest";
import type { CoreBpmnElement } from "./core-profile";
import {
  inspectMessageRegistry,
  normalizeMessageRegistryName,
  planMessageCleanup,
  projectMessageRegistry,
} from "./message-registry";

const messages: CoreBpmnElement[] = [
  {
    id: "Message_A",
    type: "bpmn:Message",
    name: "Phản hồi",
    incoming: [],
    outgoing: [],
  },
  {
    id: "Message_B",
    type: "bpmn:Message",
    name: "Phan hoi",
    incoming: [],
    outgoing: [],
  },
  {
    id: "Message_Orphan",
    type: "bpmn:Message",
    name: "Unused",
    incoming: [],
    outgoing: [],
  },
];

describe("Message Registry", () => {
  it("projects deterministic owners, exact counts and unknown refs", () => {
    const registry = projectMessageRegistry(messages, [
      {
        messageId: "Message_A",
        ownerId: "Catch_1",
        ownerType: "bpmn:IntermediateCatchEvent",
        definitionId: "Definition_1",
        property: "MessageEventDefinition.messageRef",
        supported: true,
      },
      {
        messageId: "Message_A",
        ownerId: "Receive_1",
        ownerType: "bpmn:ReceiveTask",
        property: "ReceiveTask.messageRef",
        supported: true,
      },
      {
        messageId: "Message_B",
        ownerId: "Flow_1",
        ownerType: "bpmn:MessageFlow",
        property: "bpmn:MessageFlow.messageRef",
        supported: false,
      },
      {
        messageId: "Message_B",
        ownerId: "Unknown_1",
        ownerType: "vendor:Owner",
        property: "MessageEventDefinition.messageRef",
        supported: true,
      },
    ]);

    expect(registry.map((entry) => entry.id)).toEqual([
      "Message_A",
      "Message_B",
      "Message_Orphan",
    ]);
    expect(registry[0]).toMatchObject({
      referenceCount: 2,
      hasUnknownReferences: false,
      owners: [
        { ownerId: "Catch_1", definitionId: "Definition_1" },
        { ownerId: "Receive_1" },
      ],
    });
    expect(registry[1]).toMatchObject({
      referenceCount: 2,
      hasUnknownReferences: true,
      owners: [],
    });
  });

  it("aborts all cleanup for omitted/stale/referenced/unknown candidates", () => {
    const registry = projectMessageRegistry(messages, [
      {
        messageId: "Message_A",
        ownerId: "Receive_1",
        ownerType: "bpmn:ReceiveTask",
        property: "ReceiveTask.messageRef",
        supported: true,
      },
      {
        messageId: "Message_B",
        ownerId: "Flow_1",
        ownerType: "bpmn:MessageFlow",
        property: "bpmn:MessageFlow.messageRef",
        supported: false,
      },
    ]);
    for (const plan of [
      planMessageCleanup(registry, {
        candidateIds: ["Missing"],
        expectedReferenceCounts: { Missing: 0 },
      }),
      planMessageCleanup(registry, {
        candidateIds: ["Message_Orphan"],
        expectedReferenceCounts: {},
      }),
      planMessageCleanup(registry, {
        candidateIds: ["Message_A", "Message_Orphan"],
        expectedReferenceCounts: {
          Message_A: 1,
          Message_Orphan: 0,
        },
      }),
      planMessageCleanup(registry, {
        candidateIds: ["Message_B", "Message_Orphan"],
        expectedReferenceCounts: {
          Message_B: 1,
          Message_Orphan: 0,
        },
      }),
    ]) {
      expect(plan).toMatchObject({ accepted: false, deleteIds: [] });
    }
  });

  it("accepts exact zero-ref candidates in requested order and defines empty intent", () => {
    const registry = projectMessageRegistry(messages, []);
    expect(
      planMessageCleanup(registry, {
        candidateIds: ["Message_Orphan", "Message_A"],
        expectedReferenceCounts: {
          Message_Orphan: 0,
          Message_A: 0,
        },
      }),
    ).toEqual({
      accepted: true,
      deleteIds: ["Message_Orphan", "Message_A"],
    });
    expect(
      planMessageCleanup(registry, {
        candidateIds: [],
        expectedReferenceCounts: {},
      }),
    ).toEqual({ accepted: true, deleteIds: [] });
  });

  it("uses one accent-insensitive normalization for search and duplicate warnings", () => {
    expect(normalizeMessageRegistryName("  PHẢN   HỒI ")).toBe("phan hoi");
    const issues = inspectMessageRegistry(projectMessageRegistry(messages, []));
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-MSG-006",
          elementId: "Message_A",
        }),
        expect.objectContaining({
          ruleId: "BPMN-MSG-006",
          elementId: "Message_B",
        }),
        expect.objectContaining({
          ruleId: "BPMN-MSG-005",
          elementId: "Message_Orphan",
        }),
      ]),
    );
  });
});
