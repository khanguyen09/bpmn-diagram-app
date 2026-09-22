import {
  readE2eDatastoreAuthority,
  withVerifiedE2eDatastore,
} from "../../support/e2e-datastore-guard";
import { cleanupExactProcessModelIds } from "../../support/e2e-cleanup-ledger";

export async function cleanupExactProcessModels(
  modelIds: readonly string[],
  titlePrefix: string,
) {
  const uniqueIds = [...new Set(modelIds)];
  if (uniqueIds.length === 0) return;
  const authority = readE2eDatastoreAuthority();
  await withVerifiedE2eDatastore(authority, async (client) => {
    await cleanupExactProcessModelIds(
      client,
      authority,
      uniqueIds,
      titlePrefix,
    );
  });
}
