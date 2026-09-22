import type { PoolClient } from "pg";
import type { E2eDatastoreAuthority } from "./e2e-datastore-guard";

export const E2E_LEDGER_ENTITY_KINDS = [
  "POST",
  "PROCESS_MODEL",
  "AUTH_SESSION",
] as const;

export type E2eLedgerEntityKind = (typeof E2E_LEDGER_ENTITY_KINDS)[number];

export type E2eLedgerRow = {
  readonly runId: string;
  readonly entityKind: E2eLedgerEntityKind;
  readonly entityId: string;
  readonly ownerId: string;
  readonly identityLabel: string;
};

export type E2eLedgerPartition = {
  readonly posts: readonly E2eLedgerRow[];
  readonly processModels: readonly E2eLedgerRow[];
  readonly authSessions: readonly E2eLedgerRow[];
};

type OwnedEntityRow = {
  readonly id: string;
  readonly ownerId: string;
};

type ProcessModelIdentityRow = OwnedEntityRow & {
  readonly title: string;
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function expectZeroCount(row: { readonly count: string } | undefined, label: string) {
  if (!row || row.count !== "0") {
    throw new Error(`E2E cleanup refused: ${label} has an external reference.`);
  }
}

function assertOwnedRows(
  expected: readonly E2eLedgerRow[],
  actual: readonly OwnedEntityRow[],
  label: string,
) {
  const expectedOwners = new Map(
    expected.map((row) => [row.entityId, row.ownerId]),
  );
  for (const row of actual) {
    if (expectedOwners.get(row.id) !== row.ownerId) {
      throw new Error(`E2E cleanup refused: ${label} ownership does not match.`);
    }
  }
}

export function partitionE2eLedgerRows(
  rows: readonly E2eLedgerRow[],
): E2eLedgerPartition {
  const unexpected = rows.find(
    (row) => !E2E_LEDGER_ENTITY_KINDS.includes(row.entityKind),
  );
  if (unexpected) {
    throw new Error("E2E cleanup refused: the ledger contains an unknown entity kind.");
  }
  return {
    posts: rows.filter((row) => row.entityKind === "POST"),
    processModels: rows.filter((row) => row.entityKind === "PROCESS_MODEL"),
    authSessions: rows.filter((row) => row.entityKind === "AUTH_SESSION"),
  };
}

export async function installE2eCleanupLedger(
  client: PoolClient,
  authority: E2eDatastoreAuthority,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_e2e_cleanup_ledger" (
        "run_id" text NOT NULL,
        "entity_kind" text NOT NULL,
        "entity_id" text NOT NULL,
        "owner_id" text NOT NULL,
        "identity_label" text NOT NULL,
        "recorded_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("run_id", "entity_kind", "entity_id"),
        CHECK ("entity_kind" IN ('POST', 'PROCESS_MODEL', 'AUTH_SESSION'))
      )
    `);
    const existing = await client.query<{ readonly count: string }>(
      `SELECT COUNT(*)::text AS "count" FROM "_e2e_cleanup_ledger"`,
    );
    if (existing.rows[0]?.count !== "0") {
      throw new Error(
        "E2E cleanup ledger installation refused: unfinished identities exist.",
      );
    }

    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_current_run_id"()
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE approved_run_id text;
      BEGIN
        SELECT "run_id" INTO approved_run_id
        FROM "_e2e_datastore_marker"
        WHERE "id" = 'disposable-e2e'
          AND "database_name" = current_database()
          AND "expires_at" > CURRENT_TIMESTAMP;
        IF approved_run_id IS NULL THEN
          RAISE EXCEPTION 'E2E datastore marker is missing or expired';
        END IF;
        RETURN approved_run_id;
      END;
      $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_record_post"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO "_e2e_cleanup_ledger" (
          "run_id", "entity_kind", "entity_id", "owner_id", "identity_label"
        ) VALUES (
          "_e2e_current_run_id"(), 'POST', NEW."id"::text,
          NEW."ownerId", NEW."slug"
        );
        RETURN NEW;
      END;
      $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_guard_post_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE target_id text;
      BEGIN
        target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id"::text ELSE NEW."id"::text END;
        IF NOT EXISTS (
          SELECT 1 FROM "_e2e_cleanup_ledger"
          WHERE "run_id" = "_e2e_current_run_id"()
            AND "entity_kind" = 'POST'
            AND "entity_id" = target_id
        ) THEN
          RAISE EXCEPTION 'E2E mutation refused for an unowned Post identity';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_record_process_model"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO "_e2e_cleanup_ledger" (
          "run_id", "entity_kind", "entity_id", "owner_id", "identity_label"
        ) VALUES (
          "_e2e_current_run_id"(), 'PROCESS_MODEL', NEW."id"::text,
          NEW."ownerId", NEW."title"
        );
        RETURN NEW;
      END;
      $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_guard_process_model_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE target_id text;
      BEGIN
        target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id"::text ELSE NEW."id"::text END;
        IF NOT EXISTS (
          SELECT 1 FROM "_e2e_cleanup_ledger"
          WHERE "run_id" = "_e2e_current_run_id"()
            AND "entity_kind" = 'PROCESS_MODEL'
            AND "entity_id" = target_id
        ) THEN
          RAISE EXCEPTION 'E2E mutation refused for an unowned ProcessModel identity';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_record_auth_session"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        INSERT INTO "_e2e_cleanup_ledger" (
          "run_id", "entity_kind", "entity_id", "owner_id", "identity_label"
        ) VALUES (
          "_e2e_current_run_id"(), 'AUTH_SESSION', NEW."id",
          NEW."userId", 'owner-session'
        );
        RETURN NEW;
      END;
      $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "_e2e_guard_auth_session_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE target_id text;
      BEGIN
        target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
        IF NOT EXISTS (
          SELECT 1 FROM "_e2e_cleanup_ledger"
          WHERE "run_id" = "_e2e_current_run_id"()
            AND "entity_kind" = 'AUTH_SESSION'
            AND "entity_id" = target_id
        ) THEN
          RAISE EXCEPTION 'E2E mutation refused for an unowned auth session identity';
        END IF;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END;
      $$
    `);

    await client.query(`DROP TRIGGER IF EXISTS "_e2e_post_insert" ON "Post"`);
    await client.query(`
      CREATE TRIGGER "_e2e_post_insert"
      AFTER INSERT ON "Post"
      FOR EACH ROW EXECUTE FUNCTION "_e2e_record_post"()
    `);
    await client.query(`DROP TRIGGER IF EXISTS "_e2e_post_mutation" ON "Post"`);
    await client.query(`
      CREATE TRIGGER "_e2e_post_mutation"
      BEFORE UPDATE OR DELETE ON "Post"
      FOR EACH ROW EXECUTE FUNCTION "_e2e_guard_post_mutation"()
    `);
    await client.query(
      `DROP TRIGGER IF EXISTS "_e2e_process_model_insert" ON "ProcessModel"`,
    );
    await client.query(`
      CREATE TRIGGER "_e2e_process_model_insert"
      AFTER INSERT ON "ProcessModel"
      FOR EACH ROW EXECUTE FUNCTION "_e2e_record_process_model"()
    `);
    await client.query(
      `DROP TRIGGER IF EXISTS "_e2e_process_model_mutation" ON "ProcessModel"`,
    );
    await client.query(`
      CREATE TRIGGER "_e2e_process_model_mutation"
      BEFORE UPDATE OR DELETE ON "ProcessModel"
      FOR EACH ROW EXECUTE FUNCTION "_e2e_guard_process_model_mutation"()
    `);
    await client.query(
      `DROP TRIGGER IF EXISTS "_e2e_auth_session_insert" ON "session"`,
    );
    await client.query(`
      CREATE TRIGGER "_e2e_auth_session_insert"
      AFTER INSERT ON "session"
      FOR EACH ROW EXECUTE FUNCTION "_e2e_record_auth_session"()
    `);
    await client.query(
      `DROP TRIGGER IF EXISTS "_e2e_auth_session_mutation" ON "session"`,
    );
    await client.query(`
      CREATE TRIGGER "_e2e_auth_session_mutation"
      BEFORE UPDATE OR DELETE ON "session"
      FOR EACH ROW EXECUTE FUNCTION "_e2e_guard_auth_session_mutation"()
    `);

    const marker = await client.query<{ readonly runId: string }>(
      `SELECT "run_id" AS "runId"
       FROM "_e2e_datastore_marker"
       WHERE "id" = 'disposable-e2e'`,
    );
    if (marker.rows[0]?.runId !== authority.runId) {
      throw new Error(
        "E2E cleanup ledger installation refused: marker identity changed.",
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function deletePosts(
  client: PoolClient,
  rows: readonly E2eLedgerRow[],
): Promise<void> {
  const ids = unique(rows.map((row) => row.entityId));
  if (ids.length === 0) return;

  const existing = await client.query<OwnedEntityRow>(
    `SELECT "id"::text AS "id", "ownerId" AS "ownerId"
     FROM "Post"
     WHERE "id" = ANY($1::uuid[])
     FOR UPDATE`,
    [ids],
  );
  assertOwnedRows(rows, existing.rows, "Post");

  const newsletterReferences = await client.query<{ readonly count: string }>(
    `SELECT COUNT(*)::text AS "count"
     FROM "NewsletterIssueSnapshot" issue_snapshot
     JOIN "PublishedArticleSnapshot" snapshot
       ON snapshot."id" = issue_snapshot."snapshotId"
     WHERE snapshot."postId" = ANY($1::uuid[])`,
    [ids],
  );
  expectZeroCount(newsletterReferences.rows[0], "PublishedArticleSnapshot");

  await client.query(
    `UPDATE "Publication" SET "activeSnapshotId" = NULL
     WHERE "postId" = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(
    `UPDATE "Post" SET "currentRevisionId" = NULL
     WHERE "id" = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(
    `DELETE FROM "PublishedBpmnEmbed"
     WHERE "snapshotId" IN (
       SELECT "id" FROM "PublishedArticleSnapshot"
       WHERE "postId" = ANY($1::uuid[])
     )`,
    [ids],
  );
  await client.query(`DELETE FROM "PublishRequest" WHERE "postId" = ANY($1::uuid[])`, [ids]);
  await client.query(
    `DELETE FROM "PublishedArticleSnapshot" WHERE "postId" = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(
    `DELETE FROM "PublicationScheduleRequest"
     WHERE "scheduleId" IN (
       SELECT "id" FROM "PublicationSchedule"
       WHERE "postId" = ANY($1::uuid[])
     )`,
    [ids],
  );
  await client.query(
    `DELETE FROM "PublicationSchedule" WHERE "postId" = ANY($1::uuid[])`,
    [ids],
  );
  for (const table of [
    "ArticleLifecycleRequest",
    "ArticleLifecycleEvent",
    "ArticleSlugClaim",
    "PostTagAssignment",
    "DraftSaveRequest",
    "PostCreateRequest",
    "Publication",
  ]) {
    await client.query(`DELETE FROM "${table}" WHERE "postId" = ANY($1::uuid[])`, [
      ids,
    ]);
  }
  await client.query(`DELETE FROM "PostRevision" WHERE "postId" = ANY($1::uuid[])`, [ids]);
  await client.query(`DELETE FROM "Post" WHERE "id" = ANY($1::uuid[])`, [ids]);
}

async function deleteProcessModels(
  client: PoolClient,
  rows: readonly E2eLedgerRow[],
): Promise<void> {
  const ids = unique(rows.map((row) => row.entityId));
  if (ids.length === 0) return;

  const existing = await client.query<OwnedEntityRow>(
    `SELECT "id"::text AS "id", "ownerId" AS "ownerId"
     FROM "ProcessModel"
     WHERE "id" = ANY($1::uuid[])
     FOR UPDATE`,
    [ids],
  );
  assertOwnedRows(rows, existing.rows, "ProcessModel");

  const publicReferences = await client.query<{ readonly count: string }>(
    `SELECT COUNT(*)::text AS "count"
     FROM "PublishedBpmnEmbed"
     WHERE "processModelId" = ANY($1::uuid[])`,
    [ids],
  );
  expectZeroCount(publicReferences.rows[0], "ProcessModel");

  await client.query(
    `UPDATE "ProcessModel" SET "currentRevisionId" = NULL
     WHERE "id" = ANY($1::uuid[])`,
    [ids],
  );
  for (const table of [
    "ProcessModelCommandReceipt",
    "ProcessModelCreateRequest",
    "ProcessModelVersion",
    "ProcessModelRevision",
  ]) {
    await client.query(
      `DELETE FROM "${table}" WHERE "processModelId" = ANY($1::uuid[])`,
      [ids],
    );
  }
  await client.query(`DELETE FROM "ProcessModel" WHERE "id" = ANY($1::uuid[])`, [
    ids,
  ]);
}

async function deleteAuthSessions(
  client: PoolClient,
  rows: readonly E2eLedgerRow[],
): Promise<void> {
  const ids = unique(rows.map((row) => row.entityId));
  if (ids.length === 0) return;
  const existing = await client.query<OwnedEntityRow>(
    `SELECT "id", "userId" AS "ownerId"
     FROM "session"
     WHERE "id" = ANY($1::text[])
     FOR UPDATE`,
    [ids],
  );
  assertOwnedRows(rows, existing.rows, "auth session");
  await client.query(`DELETE FROM "session" WHERE "id" = ANY($1::text[])`, [ids]);
}

async function readLedgerRows(
  client: PoolClient,
  runId: string,
): Promise<readonly E2eLedgerRow[]> {
  const ledger = await client.query<E2eLedgerRow>(
    `SELECT "run_id" AS "runId",
            "entity_kind" AS "entityKind",
            "entity_id" AS "entityId",
            "owner_id" AS "ownerId",
            "identity_label" AS "identityLabel"
     FROM "_e2e_cleanup_ledger"
     WHERE "run_id" = $1
     ORDER BY "recorded_at", "entity_kind", "entity_id"
     FOR UPDATE`,
    [runId],
  );
  return ledger.rows;
}

export async function cleanupE2eRun(
  client: PoolClient,
  authority: E2eDatastoreAuthority,
): Promise<void> {
  await client.query("BEGIN");
  try {
    const rows = await readLedgerRows(client, authority.runId);
    const partition = partitionE2eLedgerRows(rows);
    await deletePosts(client, partition.posts);
    await deleteProcessModels(client, partition.processModels);
    await deleteAuthSessions(client, partition.authSessions);
    await client.query(`DELETE FROM "_e2e_cleanup_ledger" WHERE "run_id" = $1`, [
      authority.runId,
    ]);
    const remaining = await client.query<{ readonly count: string }>(
      `SELECT COUNT(*)::text AS "count"
       FROM "_e2e_cleanup_ledger"`,
    );
    if (remaining.rows[0]?.count !== "0") {
      throw new Error("E2E cleanup failed: exact ledger rows remain.");
    }
    const removedMarker = await client.query(
      `DELETE FROM "_e2e_datastore_marker"
       WHERE "id" = 'disposable-e2e' AND "run_id" = $1`,
      [authority.runId],
    );
    if (removedMarker.rowCount !== 1) {
      throw new Error("E2E cleanup failed: the exact marker was not removed.");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function cleanupExactProcessModelIds(
  client: PoolClient,
  authority: E2eDatastoreAuthority,
  modelIds: readonly string[],
  expectedTitlePrefix?: string,
): Promise<void> {
  const ids = unique(modelIds);
  if (ids.length === 0) return;

  await client.query("BEGIN");
  try {
    const ledger = await client.query<E2eLedgerRow>(
      `SELECT "run_id" AS "runId",
              "entity_kind" AS "entityKind",
              "entity_id" AS "entityId",
              "owner_id" AS "ownerId",
              "identity_label" AS "identityLabel"
       FROM "_e2e_cleanup_ledger"
       WHERE "run_id" = $1
         AND "entity_kind" = 'PROCESS_MODEL'
         AND "entity_id" = ANY($2::text[])
       FOR UPDATE`,
      [authority.runId, ids],
    );
    if (ledger.rows.length !== ids.length) {
      throw new Error(
        "E2E cleanup refused: one or more ProcessModel IDs are not in the exact run ledger.",
      );
    }
    const models = await client.query<ProcessModelIdentityRow>(
      `SELECT "id"::text AS "id", "ownerId" AS "ownerId", "title"
       FROM "ProcessModel"
       WHERE "id" = ANY($1::uuid[])
       FOR UPDATE`,
      [ids],
    );
    if (
      models.rows.length !== ids.length ||
      (expectedTitlePrefix &&
        models.rows.some((row) => !row.title.startsWith(expectedTitlePrefix)))
    ) {
      throw new Error(
        "E2E cleanup refused: exact ProcessModel identity evidence does not match.",
      );
    }
    await deleteProcessModels(client, ledger.rows);
    await client.query(
      `DELETE FROM "_e2e_cleanup_ledger"
       WHERE "run_id" = $1
         AND "entity_kind" = 'PROCESS_MODEL'
         AND "entity_id" = ANY($2::text[])`,
      [authority.runId, ids],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
