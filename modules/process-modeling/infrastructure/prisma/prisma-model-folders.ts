import { getPrisma } from "@/platform/database";
import { Prisma } from "@/platform/database/generated/prisma/client";
import { normalizedFolderName, type FolderMutationResult, type FolderMove } from "../../domain/model-folders";

// Organization changes are independent of immutable BPMN content revisions.
// A per-owner lock orders folder deletion and movement consistently.
async function withOwnerLock(ownerId: string, operation: (tx: Prisma.TransactionClient) => Promise<FolderMutationResult>): Promise<FolderMutationResult> {
  return getPrisma().$transaction(async tx => {
    // An advisory mutex avoids locking the user FK target while waiting on a
    // model row: content saves lock models before inserting author references.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`process-model-folders:${ownerId}`}, 0))::text`);
    const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) return { kind: "not-found" };
    return operation(tx);
  });
}
export async function listModelFolders(ownerId: string) {
  const rows = await getPrisma().processModelFolder.findMany({ where: { ownerId }, orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, revision: true, _count: { select: { models: { where: { archivedAt: null } } } } },
  });
  return rows.map(({ _count, ...folder }) => ({ ...folder, modelCount: _count.models }));
}
export function createModelFolder(ownerId: string, input: { id: string; name: string }) {
  return withOwnerLock(ownerId, async tx => {
    const existing = await tx.processModelFolder.findUnique({ where: { id: input.id } });
    if (existing) return { kind: existing.ownerId === ownerId && existing.name === input.name ? "saved" : "conflict" };
    const normalizedName = normalizedFolderName(input.name);
    if (await tx.processModelFolder.findUnique({ where: { ownerId_normalizedName: { ownerId, normalizedName } } })) return { kind: "duplicate" };
    if (await tx.processModelFolder.count({ where: { ownerId } }) >= 200) return { kind: "limit" };
    await tx.processModelFolder.create({ data: { ...input, ownerId, normalizedName } });
    return { kind: "saved" };
  });
}
export function renameModelFolder(ownerId: string, id: string, input: { name: string; expectedRevision: number }) {
  return withOwnerLock(ownerId, async tx => {
    const current = await tx.processModelFolder.findFirst({ where: { id, ownerId } });
    if (!current) return { kind: "not-found" };
    if (current.name === input.name) return { kind: "saved" };
    if (current.revision !== input.expectedRevision) return { kind: "conflict" };
    const normalizedName = normalizedFolderName(input.name);
    if (await tx.processModelFolder.findFirst({ where: { ownerId, normalizedName, id: { not: id } } })) return { kind: "duplicate" };
    await tx.processModelFolder.update({ where: { id }, data: { name: input.name, normalizedName, revision: { increment: 1 } } });
    return { kind: "saved" };
  });
}
export function deleteModelFolder(ownerId: string, id: string, expectedRevision: number) {
  return withOwnerLock(ownerId, async tx => {
    const current = await tx.processModelFolder.findFirst({ where: { id, ownerId } });
    if (!current) return { kind: "not-found" };
    if (current.revision !== expectedRevision) return { kind: "conflict" };
    await tx.$executeRaw(Prisma.sql`UPDATE "ProcessModel" SET "folderId" = NULL, "folderRevision" = "folderRevision" + 1 WHERE "ownerId" = ${ownerId} AND "folderId" = ${id}::uuid`);
    await tx.processModelFolder.delete({ where: { id } });
    return { kind: "deleted" };
  });
}
export function moveModelsToFolder(ownerId: string, input: FolderMove) {
  return withOwnerLock(ownerId, async tx => {
    if (input.folderId && !await tx.processModelFolder.findFirst({ where: { id: input.folderId, ownerId } })) return { kind: "not-found" };
    const ids = input.models.map(model => model.id).sort();
    const rows = await tx.$queryRaw<{ id: string; folderId: string | null; folderRevision: number }[]>(Prisma.sql`SELECT "id", "folderId", "folderRevision" FROM "ProcessModel" WHERE "ownerId" = ${ownerId} AND "archivedAt" IS NULL AND "id"::text IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
    if (rows.length !== ids.length) return { kind: "not-found" };
    if (rows.some(row => row.folderId !== input.folderId && row.folderRevision !== input.models.find(model => model.id === row.id)!.expectedFolderRevision)) return { kind: "conflict" };
    const changed = rows.filter(row => row.folderId !== input.folderId).map(row => row.id);
    if (changed.length) await tx.$executeRaw(Prisma.sql`UPDATE "ProcessModel" SET "folderId" = ${input.folderId}::uuid, "folderRevision" = "folderRevision" + 1 WHERE "ownerId" = ${ownerId} AND "id"::text IN (${Prisma.join(changed)})`);
    return { kind: "moved" };
  });
}
