import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { cleanupE2eRun, installE2eCleanupLedger } from "./e2e-cleanup-ledger";
import {
  readE2eDatastoreAuthority,
  withVerifiedE2eDatastore,
} from "./e2e-datastore-guard";

const hasDisposableAuthority = Boolean(
  process.env.DATABASE_URL &&
    process.env.E2E_DATABASE_URL &&
    process.env.E2E_RUN_ID &&
    process.env.E2E_DATASTORE_MARKER,
);
const suite = hasDisposableAuthority ? describe : describe.skip;

suite("disposable E2E datastore harness", () => {
  it("records, guards, and removes every exact supported mutation root", async () => {
    const authority = readE2eDatastoreAuthority();
    const postId = randomUUID();
    const processModelId = randomUUID();
    const sessionId = `e2e-session-${randomUUID()}`;

    await withVerifiedE2eDatastore(authority, async (client) => {
      await installE2eCleanupLedger(client, authority);
      const owner = await client.query<{ readonly id: string }>(
        `SELECT "id" FROM "user" WHERE "role" = 'OWNER' ORDER BY "createdAt" LIMIT 1`,
      );
      const ownerId = owner.rows[0]?.id;
      expect(ownerId).toBeTruthy();

      await client.query(
        `INSERT INTO "Post" (
           "id", "ownerId", "slug", "workingMetadata", "workingDocument",
           "workingPayloadHash", "updatedAt"
         ) VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6, CURRENT_TIMESTAMP)`,
        [
          postId,
          ownerId,
          `e2e-post-${postId}`,
          JSON.stringify({ title: "Disposable E2E post" }),
          JSON.stringify({ schemaVersion: 1, blocks: [] }),
          `e2e-payload-${postId}`,
        ],
      );
      await client.query(
        `INSERT INTO "ProcessModel" (
           "id", "ownerId", "title", "profileId", "updatedAt"
         ) VALUES ($1::uuid, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          processModelId,
          ownerId,
          `Disposable E2E model ${processModelId}`,
          "simple-flow-v1",
        ],
      );
      await client.query(
        `INSERT INTO "session" ("id", "expiresAt", "token", "userId", "updatedAt")
         VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 hour', $2, $3, CURRENT_TIMESTAMP)`,
        [sessionId, `e2e-token-${randomUUID()}`, ownerId],
      );

      const ledger = await client.query<{ readonly count: string }>(
        `SELECT COUNT(*)::text AS "count" FROM "_e2e_cleanup_ledger"`,
      );
      expect(ledger.rows[0]?.count).toBe("3");

      await client.query("BEGIN");
      await client.query(
        `DELETE FROM "_e2e_cleanup_ledger"
         WHERE "run_id" = $1 AND "entity_kind" = 'AUTH_SESSION' AND "entity_id" = $2`,
        [authority.runId, sessionId],
      );
      let refusedUnownedSessionMutation = false;
      try {
        await client.query(
          `UPDATE "session" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
          [sessionId],
        );
      } catch {
        refusedUnownedSessionMutation = true;
      }
      await client.query("ROLLBACK");
      expect(refusedUnownedSessionMutation).toBe(true);

      await cleanupE2eRun(client, authority);
    });

    const pool = new Pool({ connectionString: authority.connectionString, max: 1 });
    try {
      const closeout = await pool.query<{
        readonly ledgerCount: string;
        readonly markerCount: string;
        readonly postCount: string;
        readonly processModelCount: string;
        readonly sessionCount: string;
      }>(`
        SELECT
          (SELECT COUNT(*)::text FROM "_e2e_cleanup_ledger") AS "ledgerCount",
          (SELECT COUNT(*)::text FROM "_e2e_datastore_marker") AS "markerCount",
          (SELECT COUNT(*)::text FROM "Post") AS "postCount",
          (SELECT COUNT(*)::text FROM "ProcessModel") AS "processModelCount",
          (SELECT COUNT(*)::text FROM "session") AS "sessionCount"
      `);
      expect(closeout.rows[0]).toEqual({
        ledgerCount: "0",
        markerCount: "0",
        postCount: "0",
        processModelCount: "0",
        sessionCount: "0",
      });
    } finally {
      await pool.end();
    }
  });
});
