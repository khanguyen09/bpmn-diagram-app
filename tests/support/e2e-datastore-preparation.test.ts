import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { readE2eDatastoreAuthority } from "./e2e-datastore-guard";
import { prepareE2eDatastore } from "./e2e-datastore-preparation";

const authority = readE2eDatastoreAuthority({
  DATABASE_URL:
    "postgresql://app-user:app-password@localhost:5432/experience_blogs",
  E2E_DATABASE_URL:
    "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs_e2e_prepare",
  E2E_RUN_ID: "sdd44_prepare_run",
  E2E_DATASTORE_MARKER: "prepare-marker-token-with-at-least-24-characters",
});

function queryClient({
  activeMarker = false,
  ledgerCount = "0",
  ledgerExists = false,
  postCount = "0",
  processModelCount = "0",
  authSessionCount = "0",
  taxonomyTermCount = "0",
  taxonomyBulkRequestCount = "0",
  subscriberCount = "0",
  newsletterIssueCount = "0",
  verificationCount = "0",
}: {
  readonly activeMarker?: boolean;
  readonly ledgerCount?: string;
  readonly ledgerExists?: boolean;
  readonly postCount?: string;
  readonly processModelCount?: string;
  readonly authSessionCount?: string;
  readonly taxonomyTermCount?: string;
  readonly taxonomyBulkRequestCount?: string;
  readonly subscriberCount?: string;
  readonly newsletterIssueCount?: string;
  readonly verificationCount?: string;
} = {}) {
  const statements: string[] = [];
  const query = vi.fn(async (statement: string) => {
    statements.push(statement);
    if (statement.includes("SELECT EXISTS")) {
      return { rows: [{ active: activeMarker }], rowCount: 1 };
    }
    if (statement.includes("to_regclass")) {
      return {
        rows: [{ ledger: ledgerExists ? "_e2e_cleanup_ledger" : null }],
        rowCount: 1,
      };
    }
    if (statement.includes('COUNT(*)::text AS "count"')) {
      return { rows: [{ count: ledgerCount }], rowCount: 1 };
    }
    if (statement.includes('AS "postCount"')) {
      return {
        rows: [
          {
            postCount,
            processModelCount,
            authSessionCount,
            taxonomyTermCount,
            taxonomyBulkRequestCount,
            subscriberCount,
            newsletterIssueCount,
            verificationCount,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });

  return {
    client: { query } as unknown as PoolClient,
    statements,
  };
}

describe("E2E datastore preparation", () => {
  it("claims only an empty supported mutation boundary under the database lock", async () => {
    const { client, statements } = queryClient();

    await expect(prepareE2eDatastore(client, authority)).resolves.toBeUndefined();

    expect(statements).toContain("BEGIN");
    expect(statements.some((statement) => statement.includes("pg_advisory_xact_lock"))).toBe(
      true,
    );
    expect(
      statements.some((statement) =>
        statement.includes('"expires_at" > CURRENT_TIMESTAMP'),
      ),
    ).toBe(true);
    expect(
      statements.some(
        (statement) =>
          statement.includes('FROM "Post"') &&
          statement.includes('FROM "ProcessModel"') &&
          statement.includes('FROM "session"') &&
          statement.includes('FROM "TaxonomyTerm"') &&
          statement.includes('FROM "TaxonomyBulkRequest"') &&
          statement.includes('FROM "Subscriber"') &&
          statement.includes('FROM "NewsletterIssue"') &&
          statement.includes('FROM "verification"'),
      ),
    ).toBe(true);
    expect(statements).toContain("COMMIT");
  });

  it("refuses every active marker, including a repeated same-run claim", async () => {
    const { client, statements } = queryClient({ activeMarker: true });

    await expect(prepareE2eDatastore(client, authority)).rejects.toThrow(
      "an unexpired marker already owns the datastore",
    );

    expect(statements).toContain("ROLLBACK");
    expect(statements.some((statement) => statement.startsWith("INSERT INTO"))).toBe(
      false,
    );
  });

  it.each([
    ["Post", { postCount: "1" }],
    ["ProcessModel", { processModelCount: "1" }],
    ["auth session", { authSessionCount: "1" }],
    ["taxonomy term", { taxonomyTermCount: "1" }],
    ["taxonomy bulk request", { taxonomyBulkRequestCount: "1" }],
    ["subscriber", { subscriberCount: "1" }],
    ["newsletter issue", { newsletterIssueCount: "1" }],
    ["verification", { verificationCount: "1" }],
  ])("refuses a nonempty %s root", async (_label, counts) => {
    const { client, statements } = queryClient(counts);

    await expect(prepareE2eDatastore(client, authority)).rejects.toThrow(
      "supported mutation roots are not empty",
    );
    expect(statements).toContain("ROLLBACK");
  });

  it("refuses an unfinished exact cleanup ledger before root inspection", async () => {
    const { client, statements } = queryClient({
      ledgerExists: true,
      ledgerCount: "1",
    });

    await expect(prepareE2eDatastore(client, authority)).rejects.toThrow(
      "unfinished cleanup ledger exists",
    );
    expect(statements.some((statement) => statement.includes('AS "postCount"'))).toBe(
      false,
    );
  });
});
