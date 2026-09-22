import { createHash, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const DISPOSABLE_DATABASE_PATTERN =
  /^experience_blogs_e2e_[a-z0-9][a-z0-9_]{2,62}$/;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type E2eDatastoreAuthority = {
  readonly connectionString: string;
  readonly databaseName: string;
  readonly host: string;
  readonly port: number;
  readonly runId: string;
  readonly markerToken: string;
};

export type E2eQueryClient = Pick<PoolClient, "query"> & {
  readonly database?: string;
  readonly host?: string;
  readonly port?: number;
};

type DatabaseIdentityRow = {
  readonly databaseName: string;
};

type MarkerRow = {
  readonly databaseName: string;
  readonly runId: string;
  readonly tokenHash: string;
};

type PostgreSqlTarget = {
  readonly databaseName: string;
  readonly host: string;
  readonly port: number;
};

function fail(reason: string): never {
  throw new Error(`E2E datastore guard refused mutation: ${reason}`);
}

function parsePort(value: string): number {
  const port = value === "" ? 5432 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    fail("the PostgreSQL port is invalid");
  }
  return port;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function normalizeHost(value: string): string {
  const normalized = value
    .toLocaleLowerCase("en-US")
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
  return LOOPBACK_HOSTS.has(normalized) ? "loopback" : normalized;
}

function parsePostgreSqlUrl(connectionString: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    fail(`${label} is not a valid PostgreSQL URL`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    fail(`${label} must use PostgreSQL`);
  }
  return url;
}

function decodeDatabaseName(url: URL, label: string): string {
  try {
    const databaseName = decodeURI(url.pathname.slice(1));
    if (!databaseName) fail(`${label} must include a database name`);
    return databaseName;
  } catch {
    fail(`${label} has an invalid database name`);
  }
}

function lastQueryValue(url: URL, key: string): string | undefined {
  let value: string | undefined;
  for (const [candidateKey, candidateValue] of url.searchParams) {
    if (candidateKey === key) value = candidateValue;
  }
  return value;
}

function readApplicationTarget(connectionString: string): PostgreSqlTarget {
  const url = parsePostgreSqlUrl(connectionString, "DATABASE_URL");
  if (url.hash) fail("DATABASE_URL must not contain a URL fragment");

  // node-postgres gives query-string host/port values precedence over URL
  // authority. Mirror that narrow behavior so aliases cannot hide one target.
  const queryHost = lastQueryValue(url, "host");
  const queryPort = lastQueryValue(url, "port");
  const host = queryHost || url.hostname;
  if (!host) fail("DATABASE_URL must include a PostgreSQL host");

  return {
    databaseName: decodeDatabaseName(url, "DATABASE_URL"),
    host,
    port: parsePort(queryPort || url.port),
  };
}

function isSameTarget(left: PostgreSqlTarget, right: PostgreSqlTarget): boolean {
  return (
    normalizeHost(left.host) === normalizeHost(right.host) &&
    left.port === right.port &&
    left.databaseName === right.databaseName
  );
}

export function e2eMarkerTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readE2eDatastoreAuthority(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): E2eDatastoreAuthority {
  if (environment.PLAYWRIGHT_BASE_URL) {
    fail("remote or reused application servers are not permitted");
  }

  const connectionString = environment.E2E_DATABASE_URL;
  if (!connectionString) {
    fail("E2E_DATABASE_URL is required");
  }
  const applicationConnectionString = environment.DATABASE_URL;
  if (!applicationConnectionString) {
    fail("DATABASE_URL is required as the separate application authority");
  }

  const url = parsePostgreSqlUrl(connectionString, "E2E_DATABASE_URL");
  if (url.search || url.hash) {
    fail("E2E_DATABASE_URL must not contain query or fragment overrides");
  }
  if (!url.username || !url.hostname) {
    fail("E2E_DATABASE_URL must include an explicit user and host");
  }

  const host = url.hostname.toLocaleLowerCase("en-US");
  if (normalizeHost(host) !== "loopback") {
    fail("only a loopback PostgreSQL host is allowed");
  }

  const databaseName = decodeDatabaseName(url, "E2E_DATABASE_URL");
  if (
    databaseName.length > 63 ||
    !DISPOSABLE_DATABASE_PATTERN.test(databaseName)
  ) {
    fail("the database name is not an explicit disposable E2E identity");
  }

  const runId = environment.E2E_RUN_ID;
  if (!runId || !RUN_ID_PATTERN.test(runId)) {
    fail("E2E_RUN_ID is missing or malformed");
  }

  const markerToken = environment.E2E_DATASTORE_MARKER;
  if (!markerToken || markerToken.length < 24 || markerToken.length > 512) {
    fail("E2E_DATASTORE_MARKER is missing or malformed");
  }

  const target = {
    databaseName,
    host,
    port: parsePort(url.port),
  };
  const applicationTarget = readApplicationTarget(applicationConnectionString);
  if (
    target.databaseName === applicationTarget.databaseName ||
    isSameTarget(target, applicationTarget)
  ) {
    fail("the E2E datastore must be separate from the application datastore");
  }

  return {
    connectionString,
    ...target,
    runId,
    markerToken,
  };
}

export async function verifyConnectedE2eTarget(
  client: E2eQueryClient,
  authority: E2eDatastoreAuthority,
): Promise<void> {
  const identity = await client.query<DatabaseIdentityRow>(
    `SELECT current_database() AS "databaseName"`,
  );
  const row = identity.rows[0];
  if (
    !row ||
    row.databaseName !== authority.databaseName ||
    client.database !== authority.databaseName ||
    !client.host ||
    normalizeHost(client.host) !== normalizeHost(authority.host) ||
    client.port !== authority.port
  ) {
    fail("the connected PostgreSQL identity does not match the approved target");
  }
}

export async function verifyE2eDatastoreMarker(
  client: E2eQueryClient,
  authority: E2eDatastoreAuthority,
): Promise<void> {
  await verifyConnectedE2eTarget(client, authority);

  let marker;
  try {
    marker = await client.query<MarkerRow>(
      `SELECT "database_name" AS "databaseName",
              "run_id" AS "runId",
              "token_hash" AS "tokenHash"
       FROM "_e2e_datastore_marker"
       WHERE "id" = 'disposable-e2e'
         AND "expires_at" > CURRENT_TIMESTAMP`,
    );
  } catch {
    fail("the disposable marker cannot be verified");
  }

  const row = marker.rows[0];
  if (
    !row ||
    row.databaseName !== authority.databaseName ||
    row.runId !== authority.runId ||
    !safeEqual(row.tokenHash, e2eMarkerTokenHash(authority.markerToken))
  ) {
    fail("the disposable marker does not authorize this run");
  }
}

export async function withVerifiedE2eDatastore<T>(
  authority: E2eDatastoreAuthority,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: authority.connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await verifyE2eDatastoreMarker(client, authority);
    return await operation(client);
  } finally {
    client.release();
    await pool.end();
  }
}
