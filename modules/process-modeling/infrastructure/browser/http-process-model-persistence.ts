import { httpModelFolders } from "./http-model-folders";
import { folderIdSchema } from "../../domain/model-folders";
import { collaborationConversionTarget } from "../../domain/bpmn-family-conversion";
import type {
  OpenedProcessModel,
  ProcessModelConversionResponse,
  ProcessModelPersistenceClient,
  ProcessModelSaveResponse,
  ProcessModelSummary,
  ProcessModelVersionSummary,
} from "../../application/process-model-persistence-client";
import { isBpmnProfileId } from "../../domain/core-profile";
import { decodeModelRevisionToken, formatStrongModelEtag } from "../../domain/model-revision-token";
import { parseProcessModelPageQuery } from "../../application/process-model-library";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPurpose(value: unknown): value is OpenedProcessModel["purpose"] {
  return value === "AS_IS" || value === "TO_BE" || value === "REFERENCE";
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function isRevisionToken(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    decodeModelRevisionToken(value);
    return true;
  } catch {
    return false;
  }
}

function parseModelSummary(value: unknown): ProcessModelSummary {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.title) ||
    !isPurpose(value.purpose) ||
    !isBpmnProfileId(value.profileId) ||
    !isNonNegativeInteger(value.revisionNumber) ||
    !isNonNegativeInteger(value.versionCount) ||
    !isIsoTimestamp(value.updatedAt)
  ) {
    throw new Error("Invalid process model summary.");
  }
  return {
    id: value.id,
    title: value.title,
    purpose: value.purpose,
    profileId: value.profileId,
    revisionNumber: value.revisionNumber,
    versionCount: value.versionCount,
    updatedAt: value.updatedAt,
  };
}

function parseOpenedModel(
  modelId: string,
  value: unknown,
): OpenedProcessModel {
  if (
    !isNonEmptyString(modelId) ||
    !isRecord(value) ||
    !isNonEmptyString(value.title) ||
    typeof value.description !== "string" ||
    !isPurpose(value.purpose) ||
    !isBpmnProfileId(value.profileId) ||
    !isNonEmptyString(value.canonicalXml) ||
    !isRevisionToken(value.revisionToken)
  ) {
    throw new Error("Invalid process model draft.");
  }
  return {
    modelId,
    title: value.title,
    description: value.description,
    purpose: value.purpose,
    profileId: value.profileId,
    xml: value.canonicalXml,
    revisionToken: value.revisionToken,
  };
}

function parseVersionSummary(value: unknown): ProcessModelVersionSummary {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !Number.isSafeInteger(value.versionNumber) ||
    Number(value.versionNumber) < 1 ||
    typeof value.note !== "string" ||
    !isBpmnProfileId(value.profileId) ||
    typeof value.xmlChecksum !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.xmlChecksum) ||
    !isIsoTimestamp(value.createdAt)
  ) {
    throw new Error("Invalid process model version item.");
  }
  return {
    id: value.id,
    versionNumber: value.versionNumber as number,
    note: value.note,
    profileId: value.profileId,
    xmlChecksum: value.xmlChecksum,
    createdAt: value.createdAt,
  };
}

async function jsonOrEmpty(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function mapFailure(
  response: Response,
  body: Record<string, unknown>,
): Exclude<ProcessModelSaveResponse, { kind: "acknowledged" | "idempotent" }> {
  const error = body.error as { code?: string } | undefined;
  if (response.status === 401 || response.status === 403) {
    return { kind: "unauthenticated" };
  }
  if (response.status === 409 && error?.code === "REVISION_CONFLICT") {
    return {
      kind: "conflict",
      currentRevisionToken:
        typeof body.currentRevisionToken === "string"
          ? body.currentRevisionToken
          : "",
    };
  }
  if (response.status === 400 || response.status === 413 || response.status === 422) {
    const rejected = isRecord(body.error) ? body.error : {};
    const code = rejected.code === "INVALID_MODEL" || rejected.code === "BPMN_LIMIT_EXCEEDED" ||
      rejected.code === "BPMN_INSPECTION_FAILED" || rejected.code === "MODEL_NOT_READY"
      ? rejected.code : undefined;
    const ruleIds = Array.isArray(rejected.ruleIds)
      ? [...new Set(rejected.ruleIds.slice(0, 128).filter((value): value is string =>
          typeof value === "string" && /^BPMN-[A-Z][A-Z0-9-]{0,40}-[0-9]{3}$/.test(value),
        ))].slice(0, 32)
      : [];
    return { kind: "rejected", ...(code ? { code } : {}), ...(ruleIds.length ? { ruleIds } : {}) };
  }
  return { kind: "unavailable" };
}

async function loadDraft(modelId: string) {
  if (!isNonEmptyString(modelId)) {
    throw new Error("A process model ID is required.");
  }
  const response = await fetch(
    `/api/v1/studio/process-models/${encodeURIComponent(modelId)}/draft`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Unable to load the process model.");
  return parseOpenedModel(modelId, await response.json());
}

export const httpProcessModelPersistence: ProcessModelPersistenceClient = {
  folders: httpModelFolders,
  async listModelsPage(input) {
    const query = parseProcessModelPageQuery(input.page, input.pageSize, input.folderId);
    const response = await fetch(`/api/v1/studio/process-models?page=${query.page}&pageSize=${query.pageSize}${query.folderId !== undefined ? `&folderId=${query.folderId ?? "unfiled"}` : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to list process models");
    const body = await jsonOrEmpty(response);
    if (!Array.isArray(body.models) || !isNonNegativeInteger(body.total) ||
      !isNonNegativeInteger(body.page) || Number(body.page) < 1 || body.pageSize !== query.pageSize ||
      body.models.length > query.pageSize) throw new Error("Invalid process model page");
    const models = body.models.map((value: unknown) => {
      const summary = parseModelSummary(value);
      if (!isRecord(value) || !isIsoTimestamp(value.createdAt) || !isNonEmptyString(value.createdByName) || value.createdByName.length > 500) throw new Error("Invalid process model creator");
      if (value.folderId !== undefined && value.folderId !== null && !folderIdSchema.safeParse(value.folderId).success) throw new Error("Invalid folder membership");
      if (value.folderRevision !== undefined && !isNonNegativeInteger(value.folderRevision)) throw new Error("Invalid folder revision");
      return { ...summary, createdAt: value.createdAt, createdByName: value.createdByName, folderId: typeof value.folderId === "string" ? value.folderId : null, folderRevision: Number(value.folderRevision ?? 0) };
    });
    if (new Set(models.map((model) => model.id)).size !== models.length || models.length > Number(body.total) ||
      Number(body.page) > Math.max(1, Math.ceil(Number(body.total) / query.pageSize))) throw new Error("Invalid process model page");
    return { models, total: Number(body.total), page: Number(body.page), pageSize: query.pageSize };
  },
  async archiveModel(input) {
    if (!isNonEmptyString(input.modelId) || !isNonNegativeInteger(input.expectedRevisionNumber)) throw new Error("Invalid archive request");
    const response = await fetch(`/api/v1/studio/process-models/${encodeURIComponent(input.modelId)}`, {
      method: "DELETE", headers: { "If-Match": formatStrongModelEtag(input.expectedRevisionNumber) },
    });
    const body = await jsonOrEmpty(response);
    if (response.status === 401 || response.status === 403) return { kind: "unauthenticated" };
    if (response.status === 404 && body.kind === "not-found") return { kind: "not-found" };
    if (response.status === 409 && body.kind === "in-use") return { kind: "in-use" };
    if (response.status === 409 && body.kind === "conflict" && isNonNegativeInteger(body.currentRevisionNumber)) return { kind: "conflict", currentRevisionNumber: Number(body.currentRevisionNumber) };
    if (response.ok && (body.kind === "archived" || body.kind === "already-archived")) return { kind: body.kind };
    return { kind: "unavailable" };
  },
  async listModels() {
    const response = await fetch("/api/v1/studio/process-models", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to list process models.");
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.models)) {
      throw new Error("Invalid process model listing.");
    }
    const models = body.models.map(parseModelSummary);
    if (new Set(models.map((model) => model.id)).size !== models.length) {
      throw new Error("Duplicate process model identity.");
    }
    return models;
  },

  async createModel(input) {
    if (!isNonEmptyString(input.idempotencyKey)) {
      throw new Error("A create-model idempotency key is required.");
    }
    const response = await fetch("/api/v1/studio/process-models", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        purpose: input.purpose,
        profileId: input.profileId,
        xml: input.xml,
      }),
    });
    const created = await jsonOrEmpty(response);
    if (
      !response.ok ||
      !isNonEmptyString(created.modelId) ||
      (created.kind !== "acknowledged" && created.kind !== "idempotent") ||
      !isNonEmptyString(created.revisionToken)
    ) {
      throw new Error("Unable to create the process model.");
    }
    return loadDraft(created.modelId);
  },

  openModel(modelId) {
    return loadDraft(modelId);
  },

  async save(input) {
    const response = await fetch(
      `/api/v1/studio/process-models/${encodeURIComponent(input.modelId)}/draft`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${input.revisionToken}"`,
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          purpose: input.purpose,
          profileId: input.profileId ?? "teb-core-starter@1",
          xml: input.xml,
          source: input.source,
        }),
      },
    );
    const body = await jsonOrEmpty(response);
    if (!response.ok) return mapFailure(response, body);
    if (typeof body.revisionToken !== "string" || body.revisionToken.length === 0) {
      return { kind: "unavailable" };
    }
    return {
      kind: body.kind === "idempotent" ? "idempotent" : "acknowledged",
      revisionToken: String(body.revisionToken),
    };
  },

  async convertCoreToCollaboration(input) {
    const targetProfileId = collaborationConversionTarget(input.sourceProfileId);
    if (!isNonEmptyString(input.idempotencyKey)) {
      return { kind: "rejected" };
    }
    const response = await fetch(
      `/api/v1/studio/process-models/${encodeURIComponent(input.modelId)}/collaboration-conversion`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${input.revisionToken}"`,
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          sourceProfileId: input.sourceProfileId,
          orientation: input.orientation,
          title: input.title,
          description: input.description,
          purpose: input.purpose,
          profileId: targetProfileId,
          xml: input.xml,
        }),
      },
    );
    const body = await jsonOrEmpty(response);
    if (!response.ok) return mapFailure(response, body);
    if (
      (body.kind !== "acknowledged" && body.kind !== "idempotent") ||
      !isRevisionToken(body.revisionToken) ||
      body.profileId !== targetProfileId ||
      !isNonEmptyString(body.canonicalXml)
    ) {
      return { kind: "unavailable" };
    }
    return {
      kind: body.kind,
      revisionToken: body.revisionToken,
      profileId: targetProfileId,
      canonicalXml: body.canonicalXml,
    } satisfies ProcessModelConversionResponse;
  },

  async createVersion(input) {
    const response = await fetch(
      `/api/v1/studio/process-models/${encodeURIComponent(input.modelId)}/versions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${input.revisionToken}"`,
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({ note: input.note }),
      },
    );
    const body = await jsonOrEmpty(response);
    if (!response.ok) return mapFailure(response, body);
    if (
      typeof body.revisionToken !== "string" ||
      body.revisionToken.length === 0 ||
      typeof body.versionNumber !== "number" ||
      !Number.isSafeInteger(body.versionNumber) ||
      body.versionNumber < 1
    ) {
      return { kind: "unavailable" };
    }
    return {
      kind: body.kind === "idempotent" ? "idempotent" : "acknowledged",
      revisionToken: String(body.revisionToken),
      versionNumber: Number(body.versionNumber),
    };
  },

  async listVersions(modelId) {
    if (!isNonEmptyString(modelId)) {
      throw new Error("A process model ID is required.");
    }
    const response = await fetch(
      `/api/v1/studio/process-models/${encodeURIComponent(modelId)}/versions`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("Unable to load process model versions.");
    const body = await response.json() as { versions?: unknown };
    if (!Array.isArray(body.versions)) {
      throw new Error("Invalid process model version response.");
    }
    return body.versions.map(parseVersionSummary);
  },

  async restoreVersion(input) {
    const response = await fetch(
      `/api/v1/studio/process-models/${encodeURIComponent(input.modelId)}/versions/${encodeURIComponent(input.versionId)}/restore`,
      {
        method: "POST",
        headers: {
          "If-Match": `"${input.revisionToken}"`,
          "Idempotency-Key": input.idempotencyKey,
        },
      },
    );
    const body = await jsonOrEmpty(response);
    if (!response.ok) return mapFailure(response, body);
    if (typeof body.revisionToken !== "string" || body.revisionToken.length === 0) {
      return { kind: "unavailable" };
    }
    return {
      kind: body.kind === "idempotent" ? "idempotent" : "acknowledged",
      revisionToken: body.revisionToken,
    };
  },
};
