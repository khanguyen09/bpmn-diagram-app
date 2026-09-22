import {
  readE2eDatastoreAuthority,
  withVerifiedE2eDatastore,
} from "../support/e2e-datastore-guard";
import { installE2eCleanupLedger } from "../support/e2e-cleanup-ledger";

export default async function globalSetup() {
  const authority = readE2eDatastoreAuthority();
  await withVerifiedE2eDatastore(authority, async (client) => {
    await installE2eCleanupLedger(client, authority);
  });
}
