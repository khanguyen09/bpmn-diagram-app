import type { PoolClient } from "pg";
import {
  e2eMarkerTokenHash,
  type E2eDatastoreAuthority,
} from "./e2e-datastore-guard";

const MARKER_TTL_HOURS = 8;

type MarkerStateRow = {
  readonly active: boolean;
};

type RegistryStateRow = {
  readonly ledger: string | null;
};

type CountRow = {
  readonly count: string;
};

type MutationRootCountsRow = {
  readonly authSessionCount: string;
  readonly newsletterIssueCount: string;
  readonly postCount: string;
  readonly processModelCount: string;
  readonly subscriberCount: string;
  readonly taxonomyBulkRequestCount: string;
  readonly taxonomyTermCount: string;
  readonly verificationCount: string;
};

function hasNonEmptyMutationRoot(row: MutationRootCountsRow | undefined): boolean {
  return (
    !row ||
    row.postCount !== "0" ||
    row.processModelCount !== "0" ||
    row.authSessionCount !== "0" ||
    row.taxonomyTermCount !== "0" ||
    row.taxonomyBulkRequestCount !== "0" ||
    row.subscriberCount !== "0" ||
    row.newsletterIssueCount !== "0" ||
    row.verificationCount !== "0"
  );
}

export async function prepareE2eDatastore(
  client: PoolClient,
  authority: E2eDatastoreAuthority,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('teb-e2e-datastore-marker'))`,
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_e2e_datastore_marker" (
        "id" text PRIMARY KEY,
        "database_name" text NOT NULL,
        "run_id" text NOT NULL,
        "token_hash" text NOT NULL,
        "created_at" timestamptz NOT NULL,
        "expires_at" timestamptz NOT NULL
      )
    `);

    const marker = await client.query<MarkerStateRow>(
      `SELECT EXISTS (
         SELECT 1
         FROM "_e2e_datastore_marker"
         WHERE "id" = 'disposable-e2e'
           AND "expires_at" > CURRENT_TIMESTAMP
       ) AS "active"`,
    );
    if (marker.rows[0]?.active !== false) {
      throw new Error(
        "E2E datastore preparation refused: an unexpired marker already owns the datastore.",
      );
    }

    const ledgerExists = await client.query<RegistryStateRow>(
      `SELECT to_regclass('public."_e2e_cleanup_ledger"')::text AS "ledger"`,
    );
    if (ledgerExists.rows[0]?.ledger) {
      const ledger = await client.query<CountRow>(
        `SELECT COUNT(*)::text AS "count" FROM "_e2e_cleanup_ledger"`,
      );
      if (ledger.rows[0]?.count !== "0") {
        throw new Error(
          "E2E datastore preparation refused: an unfinished cleanup ledger exists.",
        );
      }
    }

    const roots = await client.query<MutationRootCountsRow>(`
      SELECT
        (SELECT COUNT(*)::text FROM "Post") AS "postCount",
        (SELECT COUNT(*)::text FROM "ProcessModel") AS "processModelCount",
        (SELECT COUNT(*)::text FROM "session") AS "authSessionCount",
        (SELECT COUNT(*)::text FROM "TaxonomyTerm") AS "taxonomyTermCount",
        (SELECT COUNT(*)::text FROM "TaxonomyBulkRequest") AS "taxonomyBulkRequestCount",
        (SELECT COUNT(*)::text FROM "Subscriber") AS "subscriberCount",
        (SELECT COUNT(*)::text FROM "NewsletterIssue") AS "newsletterIssueCount",
        (SELECT COUNT(*)::text FROM "verification") AS "verificationCount"
    `);
    if (hasNonEmptyMutationRoot(roots.rows[0])) {
      throw new Error(
        "E2E datastore preparation refused: supported mutation roots are not empty.",
      );
    }

    await client.query(
      `INSERT INTO "_e2e_datastore_marker" (
         "id", "database_name", "run_id", "token_hash", "created_at", "expires_at"
       )
       VALUES ('disposable-e2e', current_database(), $1, $2, CURRENT_TIMESTAMP,
               CURRENT_TIMESTAMP + ($3 * INTERVAL '1 hour'))
       ON CONFLICT ("id") DO UPDATE SET
         "database_name" = EXCLUDED."database_name",
         "run_id" = EXCLUDED."run_id",
         "token_hash" = EXCLUDED."token_hash",
         "created_at" = EXCLUDED."created_at",
         "expires_at" = EXCLUDED."expires_at"`,
      [
        authority.runId,
        e2eMarkerTokenHash(authority.markerToken),
        MARKER_TTL_HOURS,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
