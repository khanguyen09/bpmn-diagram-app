import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
const suite = testUrl ? describe : describe.skip;

suite("SDD59 PostgreSQL library lifecycle", () => {
  const ownerId = `sdd59-${randomUUID()}`;
  const otherId = `sdd59-${randomUUID()}`;
  const modelIds: string[] = [];
  const postIds: string[] = [];
  const content = { title: "SDD59 test", description: "", purpose: "AS_IS" as const, profileId: "teb-core-starter@1", canonicalXml: "<test />", xmlChecksum: "a".repeat(64) };
  async function repository() {
    const { PrismaProcessModelRepository } = await import("./prisma-process-model-repository");
    return new PrismaProcessModelRepository();
  }
  async function create() {
    const result = await (await repository()).createModel({ ownerId, idempotencyKey: randomUUID(), requestHash: randomUUID(), content });
    if (result.kind !== "acknowledged" && result.kind !== "idempotent") throw new Error("Create failed");
    modelIds.push(result.draft.modelId);
    return result.draft;
  }
  beforeAll(async () => {
    const { getPrisma } = await import("@/platform/database");
    await getPrisma().user.createMany({ data: [ownerId, otherId].map((id) => ({ id, name: "Library creator", email: `${id}@example.invalid`, role: "OWNER", emailVerified: true })) });
  });
  afterAll(async () => {
    const { getPrisma } = await import("@/platform/database");
    const db = getPrisma();
    await db.publicationSchedule.deleteMany({ where: { postId: { in: postIds }, ownerId } });
    await db.postRevision.deleteMany({ where: { postId: { in: postIds }, authorId: ownerId } });
    await db.post.deleteMany({ where: { id: { in: postIds }, ownerId } });
    await db.processModelCommandReceipt.deleteMany({ where: { processModelId: { in: modelIds } } });
    await db.processModelCreateRequest.deleteMany({ where: { processModelId: { in: modelIds } } });
    await db.processModel.updateMany({ where: { id: { in: modelIds }, ownerId }, data: { currentRevisionId: null } });
    await db.processModelVersion.deleteMany({ where: { processModelId: { in: modelIds } } });
    await db.processModelRevision.deleteMany({ where: { processModelId: { in: modelIds } } });
    await db.processModel.deleteMany({ where: { id: { in: modelIds }, ownerId } });
    await db.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await db.$disconnect();
  });
  it("paginates stably, supplies real creation provenance, and excludes another owner", async () => {
    await create(); await create(); await create();
    const repo = await repository();
    const first = await repo.listModelsPage(ownerId, { page: 1, pageSize: 2 });
    const second = await repo.listModelsPage(ownerId, { page: 2, pageSize: 2 });
    expect(first.total).toBe(3); expect(first.models).toHaveLength(2); expect(second.models).toHaveLength(1);
    expect(new Set([...first.models, ...second.models].map((model) => model.id)).size).toBe(3);
    expect(first.models[0].createdByName).toBe("Library creator");
    expect(first.models[0].createdAt).toBeInstanceOf(Date);
    expect((await repo.listModelsPage(otherId, { page: 1, pageSize: 9 })).total).toBe(0);
  });
  it("archives via owner CAS, is idempotent, keeps revision data and hides draft/list", async () => {
    const draft = await create(); const repo = await repository();
    expect((await repo.archiveModel({ ownerId: otherId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("not-found");
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 0 })).kind).toBe("conflict");
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("archived");
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("already-archived");
    expect(await repo.getDraft(ownerId, draft.modelId)).toBeNull();
    expect((await repo.listModels(ownerId)).some((model) => model.id === draft.modelId)).toBe(false);
    const { getPrisma } = await import("@/platform/database");
    expect(await getPrisma().processModelRevision.count({ where: { processModelId: draft.modelId } })).toBe(1);
    expect((await repo.listModelsPage(ownerId, { page: 99, pageSize: 9 })).page).toBe(1);
  });
  it("blocks a canonical article attachment but not text mentioning the identifier", async () => {
    const draft = await create(); const repo = await repository();
    const { getPrisma } = await import("@/platform/database");
    const post = await getPrisma().post.create({ data: { ownerId, slug: randomUUID(), workingMetadata: {}, workingDocument: { blocks: [{ type: "bpmn-embed", payload: { processModelId: draft.modelId } }] }, workingPayloadHash: "test" } });
    postIds.push(post.id);
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("in-use");
    await getPrisma().post.update({ where: { id: post.id }, data: { workingDocument: { blocks: [{ type: "paragraph", payload: { text: draft.modelId } }] } } });
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("archived");
  });
  it("serializes a concurrent save and archive without losing an acknowledged revision", async () => {
    const draft = await create(); const repo = await repository();
    const [save, archive] = await Promise.all([
      repo.saveDraft({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1, idempotencyKey: randomUUID(), requestHash: randomUUID(), source: "EDITED", content: { ...content, title: "Saved change" } }),
      repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 }),
    ]);
    if (save.kind === "acknowledged") expect(archive.kind).toBe("conflict");
    else { expect(archive.kind).toBe("archived"); expect(["conflict", "not-found"]).toContain(save.kind); }
  });
  it("blocks a pending schedule's older revision even if the current article removed the reference", async () => {
    const draft = await create(); const repo = await repository();
    const { getPrisma } = await import("@/platform/database");
    const db = getPrisma();
    const post = await db.post.create({ data: { ownerId, slug: randomUUID(), workingMetadata: {}, workingDocument: { blocks: [] }, workingPayloadHash: "test" } });
    postIds.push(post.id);
    const revision = await db.postRevision.create({ data: {
      postId: post.id, version: 1, baseVersion: 0, schemaVersion: 1, metadata: {},
      document: { blocks: [{ type: "bpmn-embed", payload: { processModelId: draft.modelId } }] },
      payloadHash: "test", authorId: ownerId,
    } });
    await db.publicationSchedule.create({ data: {
      ownerId, postId: post.id, postRevisionId: revision.id,
      expectedDraftVersion: 1, expectedTaxonomyVersion: 0, expectedLifecycleVersion: 0,
      expectedPublicationGeneration: 0, expectedPins: [], dueAt: new Date("2030-01-01T00:00:00Z"), timeZone: "UTC",
    } });
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("in-use");
    await db.publicationSchedule.updateMany({ where: { postId: post.id, ownerId }, data: { state: "CANCELLED" } });
    expect((await repo.archiveModel({ ownerId, modelId: draft.modelId, expectedRevisionNumber: 1 })).kind).toBe("archived");
  });
});
