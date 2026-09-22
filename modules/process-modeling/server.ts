import "server-only";
import { listModelFolders, createModelFolder, renameModelFolder, deleteModelFolder, moveModelsToFolder } from "./infrastructure/prisma/prisma-model-folders";
import { createFolderSchema, renameFolderSchema, deleteFolderSchema, moveModelsSchema, folderIdSchema } from "./domain/model-folders";
import { parseProcessModelPageQuery } from "./application/process-model-library";

import {
  createProcessModel,
  preflightProcessModelVersionSeal,
  restoreProcessModelVersion,
  saveProcessModelDraft,
  sealProcessModelVersion,
} from "./application/model-lifecycle-service";
import {
  formatStrongModelEtag,
  parseStrongModelEtag,
} from "./domain/model-revision-token";
import {
  ProcessModelContractError,
  coreToCollaborationConversionRequestHash,
  modelRequestHash,
  modelVersionRequestHash,
  parseCoreToCollaborationConversionCandidate,
  parseProcessModelCandidate,
  parseProcessModelVersionRequest,
  toPersistableContent,
} from "./infrastructure/http/process-model-contract";
import { inspectBpmnXml } from "./infrastructure/bpmn-io/inspect-bpmn-xml";
import {
  canTransitionBpmnProfile,
  isCoreBpmnProfileId,
  isBpmnProfileId,
  type CoreBpmnSnapshot,
} from "./domain/core-profile";
import type { CollaborationBpmnSnapshot } from "./domain/collaboration-profile";
import {
  bpmnFamilyConversionRuleIds,
  inspectCoreToCollaborationSwimlaneConversion,
} from "./domain/bpmn-family-conversion";
import { PrismaProcessModelRepository } from "./infrastructure/prisma/prisma-process-model-repository";

export { ProcessModelContractError };
export { parseStrongModelEtag };

const repository = new PrismaProcessModelRepository();
const maxProcessModelRequestBytes = 1_100_000;

/** Public rendering reuses the same fatal XML boundary as safe draft persistence. */
export async function isSafePublicBpmnXml(xml: string, profileId: string) {
  if (!isBpmnProfileId(profileId)) return false;
  const inspection = await inspectBpmnXml(xml, profileId);
  return inspection.safeToPersist && Boolean(inspection.canonicalXml);
}

export async function readBoundedProcessModelBody(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > maxProcessModelRequestBytes
  ) {
    throw new ProcessModelContractError("BPMN_LIMIT_EXCEEDED");
  }
  if (!request.body) throw new ProcessModelContractError("INVALID_MODEL");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maxProcessModelRequestBytes) {
      await reader.cancel();
      throw new ProcessModelContractError("BPMN_LIMIT_EXCEEDED");
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function inspectCandidate(value: unknown) {
  const candidate = parseProcessModelCandidate(value);
  const inspection = await inspectBpmnXml(candidate.xml, candidate.profileId);
  if (!inspection.safeToPersist || !inspection.canonicalXml) {
    throw new ProcessModelContractError(
      "BPMN_INSPECTION_FAILED",
      [...new Set(inspection.issues.map((issue) => issue.ruleId))],
    );
  }
  const content = toPersistableContent(candidate, {
    profileId: inspection.profileId,
    canonicalXml: inspection.canonicalXml,
  });
  return {
    candidate,
    content,
    inspection: inspectionSummary(inspection),
    requestHash: modelRequestHash({
      ...content,
      source: candidate.source ?? "EDITED",
    }),
  };
}

function inspectionSummary(
  inspection: Awaited<ReturnType<typeof inspectBpmnXml>>,
) {
  return {
    safeToPersist: inspection.safeToPersist,
    readyToSeal: inspection.readyToSeal,
    ruleIds: [
      ...new Set(inspection.issues.map((issue) => issue.ruleId)),
    ].slice(0, 32),
  } as const;
}

export async function listOwnedProcessModels(ownerId: string) {
  return repository.listModels(ownerId);
}

export async function listOwnedProcessModelsPage(ownerId: string, page: unknown, pageSize: unknown, folderId?: unknown) {
  let query;
  try { query = parseProcessModelPageQuery(page, pageSize, folderId); }
  catch { throw new ProcessModelContractError("INVALID_MODEL"); }
  return repository.listModelsPage(ownerId, query);
}

export function archiveOwnedProcessModel(ownerId: string, modelId: string, expectedRevisionNumber: number) {
  if (!Number.isSafeInteger(expectedRevisionNumber) || expectedRevisionNumber < 0) throw new ProcessModelContractError("INVALID_MODEL");
  return repository.archiveModel({ ownerId, modelId, expectedRevisionNumber });
}

export async function getOwnedProcessModelDraft(ownerId: string, modelId: string) {
  const draft = await repository.getDraft(ownerId, modelId);
  if (!draft) return null;
  const inspection = isBpmnProfileId(draft.profileId)
    ? await inspectBpmnXml(draft.canonicalXml, draft.profileId)
    : null;
  return {
    ...draft,
    revisionToken: formatStrongModelEtag(draft.revisionNumber).slice(1, -1),
    inspection: inspection
      ? inspectionSummary(inspection)
      : {
          safeToPersist: false,
          readyToSeal: false,
          ruleIds: ["BPMN-PROFILE-001"],
        },
  };
}

export async function createOwnedProcessModel(input: {
  readonly ownerId: string;
  readonly idempotencyKey: string;
  readonly candidate: unknown;
}) {
  const inspected = await inspectCandidate(input.candidate);
  const result = await createProcessModel(repository, {
    ownerId: input.ownerId,
    idempotencyKey: input.idempotencyKey,
    requestHash: inspected.requestHash,
    content: inspected.content,
  });
  return result.kind === "acknowledged" || result.kind === "idempotent"
    ? { ...result, inspection: inspected.inspection }
    : result;
}

export async function saveOwnedProcessModelDraft(input: {
  readonly ownerId: string;
  readonly modelId: string;
  readonly expectedRevisionToken: string;
  readonly idempotencyKey: string;
  readonly candidate: unknown;
}) {
  const inspected = await inspectCandidate(input.candidate);
  const current = await repository.getDraft(input.ownerId, input.modelId);
  const currentRevisionToken = current
    ? formatStrongModelEtag(current.revisionNumber).slice(1, -1)
    : null;
  if (
    current &&
    currentRevisionToken === input.expectedRevisionToken &&
    (!isBpmnProfileId(current.profileId) ||
      !canTransitionBpmnProfile(
        current.profileId,
        inspected.candidate.profileId,
      ))
  ) {
    throw new ProcessModelContractError("BPMN_INSPECTION_FAILED", [
      "BPMN-PROFILE-005",
    ]);
  }
  const result = await saveProcessModelDraft(repository, {
    ownerId: input.ownerId,
    modelId: input.modelId,
    expectedRevisionToken: input.expectedRevisionToken,
    idempotencyKey: input.idempotencyKey,
    requestHash: inspected.requestHash,
    source: inspected.candidate.source ?? "EDITED",
    content: inspected.content,
  });
  return result.kind === "acknowledged" || result.kind === "idempotent"
    ? { ...result, inspection: inspected.inspection }
    : result;
}

export async function convertOwnedCoreProcessModelToCollaboration(input: {
  readonly ownerId: string;
  readonly modelId: string;
  readonly expectedRevisionToken: string;
  readonly idempotencyKey: string;
  readonly candidate: unknown;
}) {
  const candidate = parseCoreToCollaborationConversionCandidate(input.candidate);
  const targetInspection = await inspectBpmnXml(
    candidate.xml,
    candidate.profileId,
  );
  if (
    !targetInspection.safeToPersist ||
    !targetInspection.canonicalXml ||
    !targetInspection.snapshot
  ) {
    throw new ProcessModelContractError(
      "BPMN_INSPECTION_FAILED",
      [...new Set(targetInspection.issues.map((issue) => issue.ruleId))],
    );
  }

  const content = toPersistableContent(candidate, {
    profileId: targetInspection.profileId,
    canonicalXml: targetInspection.canonicalXml,
  });
  const requestHash = coreToCollaborationConversionRequestHash({
    sourceProfileId: candidate.sourceProfileId,
    sourceRevisionToken: input.expectedRevisionToken,
    targetProfileId: candidate.profileId,
    orientation: candidate.orientation,
    title: content.title,
    description: content.description,
    purpose: content.purpose,
    canonicalXml: content.canonicalXml,
  });
  const current = await repository.getDraft(input.ownerId, input.modelId);

  if (current) {
    const currentRevisionToken = formatStrongModelEtag(
      current.revisionNumber,
    ).slice(1, -1);
    if (currentRevisionToken === input.expectedRevisionToken) {
      if (
        !isCoreBpmnProfileId(current.profileId) ||
        current.profileId !== candidate.sourceProfileId
      ) {
        throw new ProcessModelContractError("BPMN_INSPECTION_FAILED", [
          bpmnFamilyConversionRuleIds.profile,
        ]);
      }
      if (
        current.title !== content.title ||
        current.description !== content.description ||
        current.purpose !== content.purpose
      ) {
        throw new ProcessModelContractError("BPMN_INSPECTION_FAILED", [
          bpmnFamilyConversionRuleIds.metadata,
        ]);
      }

      const sourceInspection = await inspectBpmnXml(
        current.canonicalXml,
        current.profileId,
      );
      if (!sourceInspection.safeToPersist || !sourceInspection.snapshot) {
        throw new ProcessModelContractError(
          "BPMN_INSPECTION_FAILED",
          [...new Set(sourceInspection.issues.map((issue) => issue.ruleId))],
        );
      }
      const conversion = inspectCoreToCollaborationSwimlaneConversion({
        sourceProfileId: current.profileId,
        targetProfileId: candidate.profileId,
        orientation: candidate.orientation,
        sourceSnapshot: sourceInspection.snapshot as CoreBpmnSnapshot,
        candidateSnapshot:
          targetInspection.snapshot as CollaborationBpmnSnapshot,
      });
      if (!conversion.accepted) {
        throw new ProcessModelContractError(
          "BPMN_INSPECTION_FAILED",
          conversion.ruleIds,
        );
      }
    }
  }

  // A stale retry still reaches the repository so an existing receipt can be
  // returned idempotently. With no matching receipt the repository's CAS guard
  // returns conflict and performs no write.
  const result = await saveProcessModelDraft(repository, {
    ownerId: input.ownerId,
    modelId: input.modelId,
    expectedRevisionToken: input.expectedRevisionToken,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    source: "EDITED",
    content,
  });
  return result.kind === "acknowledged" || result.kind === "idempotent"
    ? {
        ...result,
        profileId: candidate.profileId,
        canonicalXml: content.canonicalXml,
        inspection: inspectionSummary(targetInspection),
      }
    : result;
}

export async function listOwnedProcessModelVersions(
  ownerId: string,
  modelId: string,
) {
  if (!(await repository.getDraft(ownerId, modelId))) return null;
  return repository.listVersions(ownerId, modelId);
}

export async function getOwnedProcessModelPreview(ownerId: string, modelId: string, versionId?: string) {
  return repository.getPreview(ownerId, modelId, versionId);
}

export async function sealOwnedProcessModelVersion(input: {
  readonly ownerId: string;
  readonly modelId: string;
  readonly expectedRevisionToken: string;
  readonly idempotencyKey: string;
  readonly body: unknown;
}, purpose: "workflow" | "illustration" = "workflow") {
  const { note } = parseProcessModelVersionRequest(input.body);
  const preflight = await preflightProcessModelVersionSeal(
    repository,
    inspectBpmnXml,
    input,
    purpose,
  );
  if (preflight.kind === "not-ready") {
    throw new ProcessModelContractError(
      "MODEL_NOT_READY",
      preflight.ruleIds,
    );
  }
  // Preserve repository idempotency semantics for retries whose revision has
  // since moved. With no prior receipt this remains a no-write conflict/not-found.
  return sealProcessModelVersion(repository, {
    ownerId: input.ownerId,
    modelId: input.modelId,
    expectedRevisionToken: input.expectedRevisionToken,
    idempotencyKey: input.idempotencyKey,
    note,
    requestHash: modelVersionRequestHash({
      operation: "CREATE_VERSION",
      revisionToken: input.expectedRevisionToken,
      noteOrVersionId: note,
    }),
  });
}

export async function restoreOwnedProcessModelVersion(input: {
  readonly ownerId: string;
  readonly modelId: string;
  readonly versionId: string;
  readonly expectedRevisionToken: string;
  readonly idempotencyKey: string;
}) {
  return restoreProcessModelVersion(repository, {
    ...input,
    requestHash: modelVersionRequestHash({
      operation: "RESTORE_VERSION",
      revisionToken: input.expectedRevisionToken,
      noteOrVersionId: input.versionId,
    }),
  });
}

export async function listOwnedModelFolders(ownerId: string) { return listModelFolders(ownerId); }
export async function createOwnedModelFolder(ownerId: string, body: unknown) {
  const input = createFolderSchema.safeParse(body);
  if (!input.success) throw new ProcessModelContractError("INVALID_MODEL");
  return createModelFolder(ownerId, input.data);
}
export async function renameOwnedModelFolder(ownerId: string, id: string, body: unknown) {
  const input = renameFolderSchema.safeParse(body);
  if (!folderIdSchema.safeParse(id).success || !input.success) throw new ProcessModelContractError("INVALID_MODEL");
  return renameModelFolder(ownerId, id, input.data);
}
export async function deleteOwnedModelFolder(ownerId: string, id: string, body: unknown) {
  const input = deleteFolderSchema.safeParse(body);
  if (!folderIdSchema.safeParse(id).success || !input.success) throw new ProcessModelContractError("INVALID_MODEL");
  return deleteModelFolder(ownerId, id, input.data.expectedRevision);
}
export async function moveOwnedModelsToFolder(ownerId: string, body: unknown) {
  const input = moveModelsSchema.safeParse(body);
  if (!input.success) throw new ProcessModelContractError("INVALID_MODEL");
  return moveModelsToFolder(ownerId, input.data);
}
