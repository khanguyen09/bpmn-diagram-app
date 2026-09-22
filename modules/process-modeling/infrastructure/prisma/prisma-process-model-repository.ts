import type {
  ModelVersionWriteResult,
  ModelWriteResult,
  ProcessModelDraftProjection,
  ProcessModelRepository,
  ProcessModelVersionProjection,
} from "../../application/ports/process-model-repository";
import type { ProcessModelContent } from "../../domain/model-lifecycle";
import { getPrisma } from "@/platform/database";
import { Prisma } from "@/platform/database/generated/prisma/client";
import { documentUsesProcessModel, parseProcessModelPageQuery, type ProcessModelArchiveResult, type ProcessModelPageQuery } from "../../application/process-model-library";

type RevisionRow = {
  id: string;
  processModelId: string;
  revisionNumber: number;
  title: string;
  description: string;
  purpose: ProcessModelContent["purpose"];
  profileId: string;
  canonicalXml: string;
  xmlChecksum: string;
  createdAt: Date;
};

type VersionRow = {
  id: string;
  processModelId: string;
  revisionId: string;
  versionNumber: number;
  note: string;
  profileId: string;
  xmlChecksum: string;
  createdAt: Date;
};

function toDraft(revision: RevisionRow): ProcessModelDraftProjection {
  return {
    modelId: revision.processModelId,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    title: revision.title,
    description: revision.description,
    purpose: revision.purpose,
    profileId: revision.profileId,
    canonicalXml: revision.canonicalXml,
    xmlChecksum: revision.xmlChecksum,
    updatedAt: revision.createdAt,
  };
}

function toVersion(version: VersionRow): ProcessModelVersionProjection {
  return {
    id: version.id,
    modelId: version.processModelId,
    revisionId: version.revisionId,
    versionNumber: version.versionNumber,
    note: version.note,
    profileId: version.profileId,
    xmlChecksum: version.xmlChecksum,
    createdAt: version.createdAt,
  };
}

function sameReceipt(
  receipt: {
    operation: string;
    requestHash: string;
    expectedRevisionNumber: number;
  },
  operation: string,
  requestHash: string,
  expectedRevisionNumber: number,
) {
  return (
    receipt.operation === operation &&
    receipt.requestHash === requestHash &&
    receipt.expectedRevisionNumber === expectedRevisionNumber
  );
}

export class PrismaProcessModelRepository implements ProcessModelRepository {
  async listModelsPage(ownerId: string, input: ProcessModelPageQuery) {
    const query = parseProcessModelPageQuery(input.page, input.pageSize, input.folderId);
    return getPrisma().$transaction(async (tx) => {
      const where = { ownerId, archivedAt: null, ...(query.folderId !== undefined ? { folderId: query.folderId } : {}) };
      const total = await tx.processModel.count({ where });
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
      const rows = await tx.processModel.findMany({
        where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * query.pageSize, take: query.pageSize,
        select: {
          id: true, title: true, purpose: true, profileId: true, folderId: true, folderRevision: true,
          currentRevisionNumber: true, latestVersionNumber: true, updatedAt: true, createdAt: true,
          owner: { select: { name: true } },
          revisions: { orderBy: { revisionNumber: "asc" }, take: 1, select: { author: { select: { name: true } } } },
        },
      });
      return { total, page, pageSize: query.pageSize, models: rows.map((row) => ({
        id: row.id, title: row.title, purpose: row.purpose, profileId: row.profileId, folderId: row.folderId, folderRevision: row.folderRevision,
        revisionNumber: row.currentRevisionNumber, versionCount: row.latestVersionNumber,
        updatedAt: row.updatedAt, createdAt: row.createdAt,
        createdByName: row.revisions[0]?.author.name.trim() || row.owner.name.trim() || "Tác giả",
      })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async archiveModel(input: { ownerId: string; modelId: string; expectedRevisionNumber: number }): Promise<ProcessModelArchiveResult> {
    return getPrisma().$transaction(async (tx) => {
      // Match publishing's lock order: articles before process models. Existing
      // article edits cannot attach a reference between the check and archive.
      const posts = await tx.$queryRaw<{ workingDocument: unknown }[]>(Prisma.sql`
        SELECT "workingDocument" FROM "Post" WHERE "ownerId" = ${input.ownerId} ORDER BY "id" FOR SHARE
      `);
      const models = await tx.$queryRaw<{ archivedAt: Date | null; currentRevisionNumber: number }[]>(Prisma.sql`
        SELECT "archivedAt", "currentRevisionNumber" FROM "ProcessModel"
        WHERE "id"::text = ${input.modelId} AND "ownerId" = ${input.ownerId} FOR UPDATE
      `);
      const model = models[0];
      if (!model) return { kind: "not-found" };
      if (model.archivedAt) return { kind: "already-archived" };
      if (model.currentRevisionNumber !== input.expectedRevisionNumber) {
        return { kind: "conflict", currentRevisionNumber: model.currentRevisionNumber };
      }
      const schedules = await tx.publicationSchedule.findMany({
        where: { ownerId: input.ownerId, state: { in: ["PENDING", "CLAIMED"] } },
        select: { revision: { select: { document: true } } },
      });
      if (posts.some((post) => documentUsesProcessModel(post.workingDocument, input.modelId)) ||
        schedules.some((schedule) => documentUsesProcessModel(schedule.revision.document, input.modelId))) {
        return { kind: "in-use" };
      }
      const result = await tx.processModel.updateMany({
        where: { id: input.modelId, ownerId: input.ownerId, archivedAt: null, currentRevisionNumber: input.expectedRevisionNumber },
        data: { archivedAt: new Date() },
      });
      if (result.count !== 1) throw new Error("Archive compare-and-swap failed");
      return { kind: "archived" };
    });
  }

  async listModels(ownerId: string) {
    const rows = await getPrisma().processModel.findMany({
      where: { ownerId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        purpose: true,
        profileId: true,
        currentRevisionNumber: true,
        latestVersionNumber: true,
        updatedAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      purpose: row.purpose,
      profileId: row.profileId,
      revisionNumber: row.currentRevisionNumber,
      versionCount: row.latestVersionNumber,
      updatedAt: row.updatedAt,
    }));
  }

  async getDraft(ownerId: string, modelId: string) {
    const model = await getPrisma().processModel.findFirst({
      where: { id: modelId, ownerId, archivedAt: null },
      include: { currentRevision: true },
    });
    return model?.currentRevision ? toDraft(model.currentRevision) : null;
  }

  async listVersions(ownerId: string, modelId: string) {
    const rows = await getPrisma().processModelVersion.findMany({
      where: { processModelId: modelId, processModel: { ownerId, archivedAt: null } },
      orderBy: { versionNumber: "desc" },
    });
    return rows.map(toVersion);
  }

  async getPreview(ownerId: string, modelId: string, versionId?: string) {
    if (!versionId) {
      const draft = await this.getDraft(ownerId, modelId);
      return draft ? { canonicalXml: draft.canonicalXml } : null;
    }
    const version = await getPrisma().processModelVersion.findFirst({
      where: { id: versionId, processModelId: modelId, processModel: { ownerId, archivedAt: null } },
      select: { revision: { select: { canonicalXml: true } } },
    });
    return version?.revision ?? null;
  }

  async createModel(input: {
    readonly ownerId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly content: ProcessModelContent;
  }): Promise<ModelWriteResult> {
    const prior = await getPrisma().processModelCreateRequest.findUnique({
      where: {
        ownerId_idempotencyKey: {
          ownerId: input.ownerId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { processModel: { include: { currentRevision: true } } },
    });
    if (prior) {
      if (prior.requestHash !== input.requestHash) {
        return { kind: "idempotency-mismatch" };
      }
      if (!prior.processModel.currentRevision) return { kind: "not-found" };
      return { kind: "idempotent", draft: toDraft(prior.processModel.currentRevision) };
    }

    try {
      return await getPrisma().$transaction(async (tx) => {
        const model = await tx.processModel.create({
          data: {
            ownerId: input.ownerId,
            title: input.content.title,
            description: input.content.description,
            purpose: input.content.purpose,
            profileId: input.content.profileId,
          },
        });
        const revision = await tx.processModelRevision.create({
          data: {
            processModelId: model.id,
            revisionNumber: 1,
            baseRevisionNumber: 0,
            title: input.content.title,
            description: input.content.description,
            purpose: input.content.purpose,
            profileId: input.content.profileId,
            canonicalXml: input.content.canonicalXml,
            xmlChecksum: input.content.xmlChecksum,
            source: "CREATED",
            authorId: input.ownerId,
          },
        });
        await tx.processModel.update({
          where: { id: model.id },
          data: { currentRevisionNumber: 1, currentRevisionId: revision.id },
        });
        await tx.processModelCreateRequest.create({
          data: {
            ownerId: input.ownerId,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            processModelId: model.id,
          },
        });
        return { kind: "acknowledged", draft: toDraft(revision) } as const;
      });
    } catch (error) {
      const concurrent = await getPrisma().processModelCreateRequest.findUnique({
        where: {
          ownerId_idempotencyKey: {
            ownerId: input.ownerId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { processModel: { include: { currentRevision: true } } },
      });
      if (!concurrent) throw error;
      if (concurrent.requestHash !== input.requestHash) {
        return { kind: "idempotency-mismatch" };
      }
      if (!concurrent.processModel.currentRevision) return { kind: "not-found" };
      return {
        kind: "idempotent",
        draft: toDraft(concurrent.processModel.currentRevision),
      };
    }
  }

  private async priorCommand(
    ownerId: string,
    modelId: string,
    idempotencyKey: string,
    operation: string,
    requestHash: string,
    expectedRevisionNumber: number,
  ): Promise<ModelWriteResult | ModelVersionWriteResult | null> {
    const receipt = await getPrisma().processModelCommandReceipt.findFirst({
      where: {
        processModelId: modelId,
        idempotencyKey,
        processModel: { ownerId, archivedAt: null },
      },
      include: { revision: true, resultVersion: true },
    });
    if (!receipt) return null;
    if (!sameReceipt(
      receipt,
      operation,
      requestHash,
      expectedRevisionNumber,
    )) {
      return { kind: "idempotency-mismatch" };
    }
    const draft = toDraft(receipt.revision);
    return receipt.resultVersion
      ? { kind: "idempotent", draft, version: toVersion(receipt.resultVersion) }
      : { kind: "idempotent", draft };
  }

  async saveDraft(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionNumber: number;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly source: "EDITED" | "IMPORTED";
    readonly content: ProcessModelContent;
  }): Promise<ModelWriteResult> {
    const prior = await this.priorCommand(
      input.ownerId,
      input.modelId,
      input.idempotencyKey,
      "SAVE_DRAFT",
      input.requestHash,
      input.expectedRevisionNumber,
    );
    if (prior) return prior as ModelWriteResult;

    let result: ModelWriteResult;
    try {
      result = await getPrisma().$transaction(async (tx) => {
        const model = await tx.processModel.findFirst({
          where: { id: input.modelId, ownerId: input.ownerId, archivedAt: null },
          select: { currentRevisionNumber: true },
        });
        if (!model) return { kind: "not-found" } as const;
        if (model.currentRevisionNumber !== input.expectedRevisionNumber) {
          return {
            kind: "conflict",
            currentRevisionNumber: model.currentRevisionNumber,
          } as const;
        }
        const nextRevision = input.expectedRevisionNumber + 1;
        const won = await tx.processModel.updateMany({
          where: {
            id: input.modelId,
            ownerId: input.ownerId,
            archivedAt: null,
            currentRevisionNumber: input.expectedRevisionNumber,
          },
          data: {
            currentRevisionNumber: nextRevision,
            title: input.content.title,
            description: input.content.description,
            purpose: input.content.purpose,
            profileId: input.content.profileId,
          },
        });
        if (won.count !== 1) {
          const current = await tx.processModel.findUnique({
            where: { id: input.modelId },
            select: { currentRevisionNumber: true },
          });
          return {
            kind: "conflict",
            currentRevisionNumber:
              current?.currentRevisionNumber ?? input.expectedRevisionNumber,
          } as const;
        }
        const revision = await tx.processModelRevision.create({
          data: {
            processModelId: input.modelId,
            revisionNumber: nextRevision,
            baseRevisionNumber: input.expectedRevisionNumber,
            title: input.content.title,
            description: input.content.description,
            purpose: input.content.purpose,
            profileId: input.content.profileId,
            canonicalXml: input.content.canonicalXml,
            xmlChecksum: input.content.xmlChecksum,
            source: input.source,
            authorId: input.ownerId,
          },
        });
        await tx.processModel.update({
          where: { id: input.modelId },
          data: { currentRevisionId: revision.id },
        });
        await tx.processModelCommandReceipt.create({
          data: {
            processModelId: input.modelId,
            idempotencyKey: input.idempotencyKey,
            operation: "SAVE_DRAFT",
            requestHash: input.requestHash,
            expectedRevisionNumber: input.expectedRevisionNumber,
            acknowledgedRevisionNumber: nextRevision,
            revisionId: revision.id,
          },
        });
        return { kind: "acknowledged", draft: toDraft(revision) } as const;
      });
    } catch (error) {
      const concurrent = await this.priorCommand(
        input.ownerId,
        input.modelId,
        input.idempotencyKey,
        "SAVE_DRAFT",
        input.requestHash,
        input.expectedRevisionNumber,
      );
      if (concurrent) return concurrent as ModelWriteResult;
      throw error;
    }
    if (result.kind !== "conflict") return result;
    const concurrent = await this.priorCommand(
      input.ownerId,
      input.modelId,
      input.idempotencyKey,
      "SAVE_DRAFT",
      input.requestHash,
      input.expectedRevisionNumber,
    );
    return (concurrent as ModelWriteResult | null) ?? result;
  }

  async createVersion(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionNumber: number;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly note: string;
    readonly operation: "CREATE_VERSION";
  }): Promise<ModelVersionWriteResult> {
    const prior = await this.priorCommand(
      input.ownerId,
      input.modelId,
      input.idempotencyKey,
      input.operation,
      input.requestHash,
      input.expectedRevisionNumber,
    );
    if (prior) return prior as ModelVersionWriteResult;

    let result: ModelVersionWriteResult;
    try {
      result = await getPrisma().$transaction(async (tx) => {
      const model = await tx.processModel.findFirst({
        where: { id: input.modelId, ownerId: input.ownerId, archivedAt: null },
        include: { currentRevision: true },
      });
      if (!model?.currentRevision) return { kind: "not-found" } as const;
      if (model.currentRevisionNumber !== input.expectedRevisionNumber) {
        return {
          kind: "conflict",
          currentRevisionNumber: model.currentRevisionNumber,
        } as const;
      }
      const nextVersion = model.latestVersionNumber + 1;
      const won = await tx.processModel.updateMany({
        where: {
          id: model.id,
          ownerId: input.ownerId,
          archivedAt: null,
          currentRevisionNumber: input.expectedRevisionNumber,
          latestVersionNumber: model.latestVersionNumber,
        },
        data: { latestVersionNumber: nextVersion },
      });
      if (won.count !== 1) {
        return {
          kind: "conflict",
          currentRevisionNumber: model.currentRevisionNumber,
        } as const;
      }
      const version = await tx.processModelVersion.create({
        data: {
          processModelId: model.id,
          revisionId: model.currentRevision.id,
          versionNumber: nextVersion,
          note: input.note,
          profileId: model.currentRevision.profileId,
          xmlChecksum: model.currentRevision.xmlChecksum,
          createdBy: input.ownerId,
        },
      });
      await tx.processModelCommandReceipt.create({
        data: {
          processModelId: model.id,
          idempotencyKey: input.idempotencyKey,
          operation: input.operation,
          requestHash: input.requestHash,
          expectedRevisionNumber: input.expectedRevisionNumber,
          acknowledgedRevisionNumber: input.expectedRevisionNumber,
          revisionId: model.currentRevision.id,
          resultVersionId: version.id,
        },
      });
      return {
        kind: "acknowledged",
        draft: toDraft(model.currentRevision),
        version: toVersion(version),
      } as const;
      });
    } catch (error) {
      const concurrent = await this.priorCommand(
        input.ownerId,
        input.modelId,
        input.idempotencyKey,
        input.operation,
        input.requestHash,
        input.expectedRevisionNumber,
      );
      if (concurrent) return concurrent as ModelVersionWriteResult;
      throw error;
    }
    if (result.kind !== "conflict") return result;
    const concurrent = await this.priorCommand(
      input.ownerId,
      input.modelId,
      input.idempotencyKey,
      input.operation,
      input.requestHash,
      input.expectedRevisionNumber,
    );
    return (concurrent as ModelVersionWriteResult | null) ?? result;
  }

  async restoreVersion(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly versionId: string;
    readonly expectedRevisionNumber: number;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly operation: "RESTORE_VERSION";
  }): Promise<ModelWriteResult> {
    const prior = await this.priorCommand(
      input.ownerId,
      input.modelId,
      input.idempotencyKey,
      input.operation,
      input.requestHash,
      input.expectedRevisionNumber,
    );
    if (prior) return prior as ModelVersionWriteResult;

    let result: ModelWriteResult;
    try {
      result = await getPrisma().$transaction(async (tx) => {
      const source = await tx.processModelVersion.findFirst({
        where: {
          id: input.versionId,
          processModelId: input.modelId,
          processModel: { ownerId: input.ownerId, archivedAt: null },
        },
        include: { revision: true },
      });
      if (!source) return { kind: "not-found" } as const;
      const model = await tx.processModel.findFirst({
        where: { id: input.modelId, ownerId: input.ownerId, archivedAt: null },
      });
      if (!model) return { kind: "not-found" } as const;
      if (model.currentRevisionNumber !== input.expectedRevisionNumber) {
        return {
          kind: "conflict",
          currentRevisionNumber: model.currentRevisionNumber,
        } as const;
      }
      const nextRevision = input.expectedRevisionNumber + 1;
      const won = await tx.processModel.updateMany({
        where: {
          id: model.id,
          ownerId: input.ownerId,
          archivedAt: null,
          currentRevisionNumber: input.expectedRevisionNumber,
        },
        data: {
          currentRevisionNumber: nextRevision,
          title: source.revision.title,
          description: source.revision.description,
          purpose: source.revision.purpose,
          profileId: source.revision.profileId,
        },
      });
      if (won.count !== 1) {
        return {
          kind: "conflict",
          currentRevisionNumber: model.currentRevisionNumber,
        } as const;
      }
      const revision = await tx.processModelRevision.create({
        data: {
          processModelId: model.id,
          revisionNumber: nextRevision,
          baseRevisionNumber: input.expectedRevisionNumber,
          title: source.revision.title,
          description: source.revision.description,
          purpose: source.revision.purpose,
          profileId: source.revision.profileId,
          canonicalXml: source.revision.canonicalXml,
          xmlChecksum: source.revision.xmlChecksum,
          source: "RESTORED",
          authorId: input.ownerId,
        },
      });
      await tx.processModel.update({
        where: { id: model.id },
        data: { currentRevisionId: revision.id },
      });
      await tx.processModelCommandReceipt.create({
        data: {
          processModelId: model.id,
          idempotencyKey: input.idempotencyKey,
          operation: input.operation,
          requestHash: input.requestHash,
          expectedRevisionNumber: input.expectedRevisionNumber,
          acknowledgedRevisionNumber: nextRevision,
          revisionId: revision.id,
        },
      });
      return {
        kind: "acknowledged",
        draft: toDraft(revision),
      } as const;
      });
    } catch (error) {
      const concurrent = await this.priorCommand(
        input.ownerId,
        input.modelId,
        input.idempotencyKey,
        input.operation,
        input.requestHash,
        input.expectedRevisionNumber,
      );
      if (concurrent) return concurrent as ModelWriteResult;
      throw error;
    }
    if (result.kind !== "conflict") return result;
    const concurrent = await this.priorCommand(
      input.ownerId,
      input.modelId,
      input.idempotencyKey,
      input.operation,
      input.requestHash,
      input.expectedRevisionNumber,
    );
    return (concurrent as ModelWriteResult | null) ?? result;
  }
}
