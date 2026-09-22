import { describe, expect, it } from "vitest";
import type { MessageRegistryEntry } from "../domain/message-registry";
import {
  duplicateMessageNameIds,
  filterMessageRegistry,
  messageOwnerImpactLabel,
  orphanMessageEntries,
} from "./bpmn-message-registry-picker";

const registry: readonly MessageRegistryEntry[] = [
  {
    id: "Message_Order",
    name: "Yêu cầu duyệt",
    owners: [
      {
        ownerId: "Receive_1",
        ownerType: "bpmn:ReceiveTask",
        property: "ReceiveTask.messageRef",
      },
    ],
    referenceCount: 1,
    hasUnknownReferences: false,
  },
  {
    id: "Message_Orphan",
    name: "Thông báo",
    owners: [],
    referenceCount: 0,
    hasUnknownReferences: false,
  },
  {
    id: "Message_Unknown",
    name: "Legacy",
    owners: [],
    referenceCount: 1,
    hasUnknownReferences: true,
  },
];

describe("Message Registry picker", () => {
  it("searches by accent-insensitive name, stable ID and owner", () => {
    expect(filterMessageRegistry(registry, "yeu cau").map((item) => item.id))
      .toEqual(["Message_Order"]);
    expect(filterMessageRegistry(registry, "receive_1").map((item) => item.id))
      .toEqual(["Message_Order"]);
    expect(filterMessageRegistry(registry, "orphan").map((item) => item.id))
      .toEqual(["Message_Orphan"]);
  });

  it("warns on normalized duplicate names without merging identities", () => {
    expect(duplicateMessageNameIds(registry, "  YEU CẦU   DUYỆT  "))
      .toEqual(["Message_Order"]);
    expect(
      duplicateMessageNameIds(registry, "Yêu cầu duyệt", "Message_Order"),
    ).toEqual([]);
  });

  it("only previews known zero-reference orphans", () => {
    expect(orphanMessageEntries(registry).map((item) => item.id)).toEqual([
      "Message_Orphan",
    ]);
    expect(messageOwnerImpactLabel(registry[2]!)).toContain(
      "có nơi chưa được hỗ trợ",
    );
  });
});
