import { unlink } from "node:fs/promises";
import {
  readE2eDatastoreAuthority,
  withVerifiedE2eDatastore,
} from "../support/e2e-datastore-guard";
import { cleanupE2eRun } from "../support/e2e-cleanup-ledger";
import { E2E_OWNER_AUTH_STATE_PATH } from "../support/e2e-auth-state";

async function removeOwnerAuthState(): Promise<void> {
  try {
    await unlink(E2E_OWNER_AUTH_STATE_PATH);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw new Error("E2E teardown could not remove the exact auth state file.");
  }
}

export default async function globalTeardown() {
  try {
    const authority = readE2eDatastoreAuthority();
    await withVerifiedE2eDatastore(authority, async (client) => {
      await cleanupE2eRun(client, authority);
    });
  } finally {
    await removeOwnerAuthState();
  }
}
