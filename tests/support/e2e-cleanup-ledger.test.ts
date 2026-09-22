import { describe, expect, it } from "vitest";
import {
  partitionE2eLedgerRows,
  type E2eLedgerRow,
} from "./e2e-cleanup-ledger";

function row(
  entityKind: E2eLedgerRow["entityKind"],
  entityId: string,
): E2eLedgerRow {
  return {
    runId: "sdd44_ledger_run",
    entityKind,
    entityId,
    ownerId: "owner-id",
    identityLabel: `identity-${entityId}`,
  };
}

describe("exact E2E cleanup ledger", () => {
  it("partitions only exact recorded identities by deletion boundary", () => {
    const partition = partitionE2eLedgerRows([
      row("AUTH_SESSION", "session-1"),
      row("PROCESS_MODEL", "model-1"),
      row("POST", "post-1"),
      row("PROCESS_MODEL", "model-2"),
    ]);

    expect(partition.posts.map(({ entityId }) => entityId)).toEqual(["post-1"]);
    expect(partition.processModels.map(({ entityId }) => entityId)).toEqual([
      "model-1",
      "model-2",
    ]);
    expect(partition.authSessions.map(({ entityId }) => entityId)).toEqual([
      "session-1",
    ]);
  });

  it("accepts an empty ledger after suites performed exact cleanup", () => {
    expect(partitionE2eLedgerRows([])).toEqual({
      posts: [],
      processModels: [],
      authSessions: [],
    });
  });

  it("fails closed for an unknown ledger entity kind", () => {
    expect(() =>
      partitionE2eLedgerRows([
        {
          ...row("POST", "post-1"),
          entityKind: "UNKNOWN",
        } as unknown as E2eLedgerRow,
      ]),
    ).toThrow("unknown entity kind");
  });
});
