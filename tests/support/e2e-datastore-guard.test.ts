import { describe, expect, it, vi } from "vitest";
import {
  e2eMarkerTokenHash,
  readE2eDatastoreAuthority,
  type E2eQueryClient,
  verifyE2eDatastoreMarker,
} from "./e2e-datastore-guard";

const markerToken = "test-marker-token-with-at-least-24-characters";
const connectionString =
  "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs_e2e_guard";
const applicationConnectionString =
  "postgresql://app-user:app-password@localhost:5432/experience_blogs";

function environment(
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> {
  return {
    DATABASE_URL: applicationConnectionString,
    E2E_DATABASE_URL: connectionString,
    E2E_RUN_ID: "sdd44_guard_run",
    E2E_DATASTORE_MARKER: markerToken,
    ...overrides,
  };
}

function queryClient({
  databaseName = "experience_blogs_e2e_guard",
  connectionDatabase = "experience_blogs_e2e_guard",
  connectionHost = "127.0.0.1",
  connectionPort = 5432,
  markerExpired = false,
  marker = {
    databaseName: "experience_blogs_e2e_guard",
    runId: "sdd44_guard_run",
    tokenHash: e2eMarkerTokenHash(markerToken),
  },
}: {
  readonly databaseName?: string;
  readonly connectionDatabase?: string;
  readonly connectionHost?: string;
  readonly connectionPort?: number;
  readonly markerExpired?: boolean;
  readonly marker?:
    | {
        readonly databaseName: string;
        readonly runId: string;
        readonly tokenHash: string;
      }
    | null;
} = {}): E2eQueryClient {
  return {
    database: connectionDatabase,
    host: connectionHost,
    port: connectionPort,
    query: vi.fn(async (statement: string) => {
      if (statement.includes("current_database")) {
        return {
          rows: [{ databaseName }],
          rowCount: 1,
        };
      }
      expect(statement).toContain('"expires_at" > CURRENT_TIMESTAMP');
      const availableMarker = markerExpired ? null : marker;
      return {
        rows: availableMarker ? [availableMarker] : [],
        rowCount: availableMarker ? 1 : 0,
      };
    }),
  } as unknown as E2eQueryClient;
}

describe("disposable E2E datastore guard", () => {
  it("accepts only an explicit local disposable database authority", () => {
    const authority = readE2eDatastoreAuthority(environment());

    expect(authority.databaseName).toBe("experience_blogs_e2e_guard");
    expect(authority.host).toBe("127.0.0.1");
    expect(authority.port).toBe(5432);
    expect(authority.runId).toBe("sdd44_guard_run");
  });

  it("accepts the dedicated CI disposable database identity", () => {
    const authority = readE2eDatastoreAuthority(
      environment({
        E2E_DATABASE_URL:
          "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs_e2e_ci_run",
      }),
    );

    expect(authority.databaseName).toBe("experience_blogs_e2e_ci_run");
  });

  it.each([
    ["missing URL", { E2E_DATABASE_URL: undefined }],
    ["missing application authority", { DATABASE_URL: undefined }],
    [
      "generic application database",
      {
        E2E_DATABASE_URL:
          "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs",
      },
    ],
    [
      "remote database",
      {
        E2E_DATABASE_URL:
          "postgresql://e2e-user:e2e-password@database.example:5432/experience_blogs_e2e_guard",
      },
    ],
    ["remote application server", { PLAYWRIGHT_BASE_URL: "https://example.test" }],
    ["missing run identity", { E2E_RUN_ID: undefined }],
    ["short marker", { E2E_DATASTORE_MARKER: "too-short" }],
    [
      "raw-equal application and E2E target",
      { DATABASE_URL: connectionString },
    ],
    [
      "loopback-alias application and E2E target",
      {
        DATABASE_URL:
          "postgresql://different-user:different-password@localhost:5432/experience_blogs_e2e_guard",
      },
    ],
    [
      "effective application target hidden by pg host and port overrides",
      {
        DATABASE_URL:
          "postgresql://app-user:app-password@database.invalid:6543/experience_blogs_e2e_guard?host=localhost&port=5432",
      },
    ],
    [
      "same database name behind a local PostgreSQL socket",
      {
        DATABASE_URL:
          "postgresql://app-user:app-password@localhost/experience_blogs_e2e_guard?host=%2Fvar%2Frun%2Fpostgresql",
      },
    ],
    [
      "E2E query override",
      { E2E_DATABASE_URL: `${connectionString}?host=127.0.0.1` },
    ],
    ["E2E URL fragment", { E2E_DATABASE_URL: `${connectionString}#override` }],
  ])("refuses %s before Playwright can start", (_label, overrides) => {
    expect(() => readE2eDatastoreAuthority(environment(overrides))).toThrow(
      "E2E datastore guard refused mutation",
    );
  });

  it("verifies the connected database and exact unexpired marker", async () => {
    const authority = readE2eDatastoreAuthority(environment());

    await expect(
      verifyE2eDatastoreMarker(queryClient(), authority),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["connected database mismatch", queryClient({ databaseName: "other" })],
    ["missing marker", queryClient({ marker: null })],
    [
      "marker run mismatch",
      queryClient({
        marker: {
          databaseName: "experience_blogs_e2e_guard",
          runId: "different_run",
          tokenHash: e2eMarkerTokenHash(markerToken),
        },
      }),
    ],
    [
      "marker token mismatch",
      queryClient({
        marker: {
          databaseName: "experience_blogs_e2e_guard",
          runId: "sdd44_guard_run",
          tokenHash: e2eMarkerTokenHash("a-different-marker-token-value"),
        },
      }),
    ],
    ["expired marker", queryClient({ markerExpired: true })],
  ])("refuses %s without exposing connection material", async (_label, client) => {
    const authority = readE2eDatastoreAuthority(environment());
    let message = "";
    try {
      await verifyE2eDatastoreMarker(client, authority);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("E2E datastore guard refused mutation");
    expect(message).not.toContain(connectionString);
    expect(message).not.toContain("e2e-password");
    expect(message).not.toContain(markerToken);
  });
});
