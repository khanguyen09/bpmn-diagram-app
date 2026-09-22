import type { ProcessModelContent } from "../domain/model-lifecycle";
import type { BpmnInspectionResult } from "../domain/core-profile";
import {
  isBpmnProfileId,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  decodeModelRevisionToken,
  encodeModelRevisionToken,
} from "../domain/model-revision-token";
import type {
  ModelVersionWriteResult,
  ModelWriteResult,
  ProcessModelRepository,
} from "./ports/process-model-repository";

export type ModelLifecycleResult =
  | {
      readonly kind: "acknowledged" | "idempotent";
      readonly modelId: string;
      readonly revisionId: string;
      readonly revisionToken: string;
    }
  | { readonly kind: "conflict"; readonly currentRevisionToken: string }
  | { readonly kind: "idempotency-mismatch" | "not-found" };

export type ModelVersionLifecycleResult =
  | (Extract<ModelLifecycleResult, { kind: "acknowledged" | "idempotent" }> & {
      readonly versionId: string;
      readonly versionNumber: number;
    })
  | Exclude<ModelLifecycleResult, { kind: "acknowledged" | "idempotent" }>;

export type ModelSealPreflightResult =
  | { readonly kind: "ready" }
  | { readonly kind: "not-found" }
  | { readonly kind: "conflict"; readonly currentRevisionToken: string }
  | { readonly kind: "not-ready"; readonly ruleIds: readonly string[] };

function mapWrite(result: ModelWriteResult): ModelLifecycleResult {
  if (result.kind === "acknowledged" || result.kind === "idempotent") {
    return {
      kind: result.kind,
      modelId: result.draft.modelId,
      revisionId: result.draft.revisionId,
      revisionToken: encodeModelRevisionToken(result.draft.revisionNumber),
    };
  }
  if (result.kind === "conflict") {
    return {
      kind: "conflict",
      currentRevisionToken: encodeModelRevisionToken(result.currentRevisionNumber),
    };
  }
  return { kind: result.kind };
}

function mapVersion(result: ModelVersionWriteResult): ModelVersionLifecycleResult {
  if (result.kind === "acknowledged" || result.kind === "idempotent") {
    return {
      kind: result.kind,
      modelId: result.draft.modelId,
      revisionId: result.draft.revisionId,
      revisionToken: encodeModelRevisionToken(result.draft.revisionNumber),
      versionId: result.version.id,
      versionNumber: result.version.versionNumber,
    };
  }
  if (result.kind === "conflict") {
    return {
      kind: "conflict",
      currentRevisionToken: encodeModelRevisionToken(result.currentRevisionNumber),
    };
  }
  return { kind: result.kind };
}

export function createProcessModel(
  repository: ProcessModelRepository,
  input: {
    readonly ownerId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly content: ProcessModelContent;
  },
) {
  return repository.createModel(input).then(mapWrite);
}

export function saveProcessModelDraft(
  repository: ProcessModelRepository,
  input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionToken: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly source: "EDITED" | "IMPORTED";
    readonly content: ProcessModelContent;
  },
) {
  return repository.saveDraft({
    ...input,
    expectedRevisionNumber: decodeModelRevisionToken(input.expectedRevisionToken),
  }).then(mapWrite);
}

export function sealProcessModelVersion(
  repository: ProcessModelRepository,
  input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionToken: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly note: string;
  },
) {
  return repository.createVersion({
    ...input,
    expectedRevisionNumber: decodeModelRevisionToken(input.expectedRevisionToken),
    operation: "CREATE_VERSION",
  }).then(mapVersion);
}

/**
 * Re-inspects the exact acknowledged revision before sealing. The repository
 * still performs the authoritative compare-and-swap during createVersion, so a
 * concurrent save after this read cannot cause a different revision to be
 * sealed.
 */
export async function preflightProcessModelVersionSeal(
  repository: Pick<ProcessModelRepository, "getDraft">,
  inspectXml: (
    xml: string,
    profileId: BpmnProfileId,
  ) => Promise<BpmnInspectionResult>,
  input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionToken: string;
  },
  purpose: "workflow" | "illustration" = "workflow",
): Promise<ModelSealPreflightResult> {
  const expectedRevisionNumber = decodeModelRevisionToken(
    input.expectedRevisionToken,
  );
  const draft = await repository.getDraft(input.ownerId, input.modelId);
  if (!draft) return { kind: "not-found" };
  if (draft.revisionNumber !== expectedRevisionNumber) {
    return {
      kind: "conflict",
      currentRevisionToken: encodeModelRevisionToken(draft.revisionNumber),
    };
  }
  if (!isBpmnProfileId(draft.profileId)) {
    return { kind: "not-ready", ruleIds: ["BPMN-PROFILE-001"] };
  }

  const inspection = await inspectXml(draft.canonicalXml, draft.profileId);
  if (!inspection.safeToPersist || (purpose === "workflow" && !inspection.readyToSeal)) {
    return {
      kind: "not-ready",
      ruleIds: [
        ...new Set(inspection.issues.map((issue) => issue.ruleId)),
      ].slice(0, 32),
    };
  }
  return { kind: "ready" };
}

export function restoreProcessModelVersion(
  repository: ProcessModelRepository,
  input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly versionId: string;
    readonly expectedRevisionToken: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
  },
) {
  return repository.restoreVersion({
    ...input,
    expectedRevisionNumber: decodeModelRevisionToken(input.expectedRevisionToken),
    operation: "RESTORE_VERSION",
  }).then(mapWrite);
}
