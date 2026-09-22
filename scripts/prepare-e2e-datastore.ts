import { Pool } from "pg";
import {
  readE2eDatastoreAuthority,
  verifyConnectedE2eTarget,
} from "../tests/support/e2e-datastore-guard";
import { prepareE2eDatastore } from "../tests/support/e2e-datastore-preparation";

async function main() {
  const authority = readE2eDatastoreAuthority();
  const pool = new Pool({ connectionString: authority.connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await verifyConnectedE2eTarget(client, authority);
      await prepareE2eDatastore(client, authority);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const candidate = error instanceof Error ? error.message : "";
  const message =
    candidate.startsWith("E2E datastore guard refused mutation:") ||
    candidate.startsWith("E2E datastore preparation refused:")
      ? candidate
      : "E2E datastore preparation failed without a safe diagnostic.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
