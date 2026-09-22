import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const target = new URL(testUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  const disposable = /^\/experience_blogs_e2e_[a-z0-9_]+$/.test(target.pathname);
  const ciService = process.env.CI === "true" && target.pathname === "/experience_blogs" && target.username === "experience";
  if (!loopback || (!disposable && !ciService)) throw new Error("Folder integration requires an explicitly disposable local/CI database");
  process.env.DATABASE_URL = testUrl;
}
const suite = testUrl ? describe : describe.skip;
suite("PostgreSQL folder ownership and content preservation", () => {
  const ownerId = `sdd87-folders-${randomUUID()}`;
  const otherId = `sdd87-folders-${randomUUID()}`;
  const modelIds: string[] = [];
  const folderIds: string[] = [];
  const content = { title: "Ticket Platform", description: "", purpose: "AS_IS" as const, profileId: "teb-core-starter@1", canonicalXml: "<preserved />", xmlChecksum: "a".repeat(64) };
  async function db() { return (await import("@/platform/database")).getPrisma(); }
  async function repository() { return new (await import("./prisma-process-model-repository")).PrismaProcessModelRepository(); }
  async function folders() { return import("./prisma-model-folders"); }
  async function createModel() {
    const result = await (await repository()).createModel({ ownerId, idempotencyKey: randomUUID(), requestHash: randomUUID(), content });
    if (result.kind !== "acknowledged" && result.kind !== "idempotent") throw new Error("Fixture create failed");
    modelIds.push(result.draft.modelId); return result.draft.modelId;
  }
  async function createFolder(name: string, owner = ownerId) {
    const id = randomUUID(); folderIds.push(id);
    expect(await (await folders()).createModelFolder(owner, { id, name })).toEqual({ kind: "saved" }); return id;
  }
  beforeAll(async () => { await (await db()).user.createMany({ data: [ownerId, otherId].map(id => ({ id, email: `${id}@example.invalid`, name: "Folder test", role: "OWNER", emailVerified: true })) }); });
  afterAll(async () => {
    const client = await db();
    await client.processModelCommandReceipt.deleteMany({ where: { processModelId: { in: modelIds } } });
    await client.processModelCreateRequest.deleteMany({ where: { processModelId: { in: modelIds } } });
    await client.processModel.updateMany({ where: { id: { in: modelIds }, ownerId }, data: { currentRevisionId: null, folderId: null } });
    await client.processModelVersion.deleteMany({ where: { processModelId: { in: modelIds } } });
    await client.processModelRevision.deleteMany({ where: { processModelId: { in: modelIds } } });
    await client.processModel.deleteMany({ where: { id: { in: modelIds }, ownerId } });
    await client.processModelFolder.deleteMany({ where: { id: { in: folderIds }, ownerId: { in: [ownerId, otherId] } } });
    await client.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await client.$disconnect();
  });
  it("isolates folders and atomically moves without changing content revisions or timestamps", async () => {
    const api = await folders(); const client = await db();
    const folderId = await createFolder("Ticket Platform"); const foreignId = await createFolder("Private", otherId);
    const ids = [await createModel(), await createModel()];
    const before = await client.processModel.findMany({ where: { id: { in: ids } }, include: { revisions: true, versions: true } });
    expect((await api.listModelFolders(ownerId)).some(folder => folder.id === foreignId)).toBe(false);
    expect(await api.moveModelsToFolder(otherId, { folderId: foreignId, models: ids.map(id => ({ id, expectedFolderRevision: 0 })) })).toEqual({ kind: "not-found" });
    expect(await api.moveModelsToFolder(ownerId, { folderId: foreignId, models: ids.map(id => ({ id, expectedFolderRevision: 0 })) })).toEqual({ kind: "not-found" });
    expect(await api.moveModelsToFolder(ownerId, { folderId, models: ids.map(id => ({ id, expectedFolderRevision: 0 })) })).toEqual({ kind: "moved" });
    expect((await (await repository()).listModelsPage(ownerId, { page: 1, pageSize: 1, folderId })).total).toBe(2);
    const moved = await client.processModel.findMany({ where: { id: { in: ids } }, include: { revisions: true, versions: true } });
    for (const row of moved) expect({ ...row, folderId: null, folderRevision: 0 }).toEqual(before.find(item => item.id === row.id));
    expect(await api.renameModelFolder(ownerId, folderId, { name: "Tickets", expectedRevision: 0 })).toEqual({ kind: "saved" });
    expect(await api.deleteModelFolder(ownerId, folderId, 0)).toEqual({ kind: "conflict" });
    expect(await api.deleteModelFolder(ownerId, folderId, 1)).toEqual({ kind: "deleted" });
    const after = await client.processModel.findMany({ where: { id: { in: ids } }, include: { revisions: true, versions: true } });
    for (const row of after) expect({ ...row, folderRevision: 0 }).toEqual(before.find(item => item.id === row.id));
  });
  it("rejects stale batches entirely and serializes concurrent folder deletion/move", async () => {
    const api = await folders(); const client = await db();
    const a = await createFolder("A"); const b = await createFolder("B");
    const first = await createModel(); const second = await createModel();
    await api.moveModelsToFolder(ownerId, { folderId: a, models: [{ id: first, expectedFolderRevision: 0 }] });
    expect(await api.moveModelsToFolder(ownerId, { folderId: b, models: [{ id: first, expectedFolderRevision: 0 }, { id: second, expectedFolderRevision: 0 }] })).toEqual({ kind: "conflict" });
    expect((await client.processModel.findUniqueOrThrow({ where: { id: second } })).folderId).toBeNull();
    const outcomes = await Promise.all([api.deleteModelFolder(ownerId, a, 0), api.moveModelsToFolder(ownerId, { folderId: a, models: [{ id: second, expectedFolderRevision: 0 }] })]);
    expect(outcomes[0].kind).toBe("deleted");
    expect(["moved", "not-found"]).toContain(outcomes[1].kind);
    expect(await client.processModel.count({ where: { id: { in: [first, second] }, folderId: null } })).toBe(2);
    expect(await api.renameModelFolder(otherId, b, { name: "Stolen", expectedRevision: 0 })).toEqual({ kind: "not-found" });
  });
  it("does not hold the author FK row while waiting for an in-progress model save", async () => {
    const client = await db(); const api = await folders();
    const { Prisma } = await import("@/platform/database/generated/prisma/client");
    const modelId = await createModel(); const folderId = await createFolder("During save");
    let signalModelLocked!: () => void; let releaseAuthorInsert!: () => void;
    const modelLocked = new Promise<void>(resolve => { signalModelLocked = resolve; });
    const authorInsert = new Promise<void>(resolve => { releaseAuthorInsert = resolve; });
    const saving = client.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ProcessModel" WHERE "id" = ${modelId}::uuid FOR UPDATE`);
      signalModelLocked();
      await authorInsert;
      // This is the content-save lock order: model first, then revision author FK.
      return tx.processModelRevision.create({ data: { ...content, processModelId: modelId, revisionNumber: 2, baseRevisionNumber: 1, source: "EDITED", authorId: ownerId } });
    }, { timeout: 10_000 });
    await modelLocked;
    const moving = api.moveModelsToFolder(ownerId, { folderId, models: [{ id: modelId, expectedFolderRevision: 0 }] });
    try {
      await expect.poll(async () => {
        const rows = await client.$queryRaw<{ waiting: bigint }[]>(Prisma.sql`SELECT count(*) AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%folderRevision%'`);
        return Number(rows[0].waiting);
      }, { timeout: 2_000 }).toBeGreaterThan(0);
    } catch (error) {
      releaseAuthorInsert();
      await Promise.allSettled([saving, moving]);
      throw error;
    } finally { releaseAuthorInsert(); }
    const [revision, moved] = await Promise.all([saving, moving]);
    expect(revision.authorId).toBe(ownerId); expect(moved.kind).toBe("moved");
    expect((await client.processModel.findUniqueOrThrow({ where: { id: modelId } })).folderId).toBe(folderId);
  });

});
