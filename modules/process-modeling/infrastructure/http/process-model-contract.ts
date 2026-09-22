import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assertProcessModelMetadata,
  type ProcessModelContent,
  type ProcessModelPurpose,
} from "../../domain/model-lifecycle";
import { coreBpmnProfile, supportedBpmnProfiles, supportedCoreBpmnProfiles } from "../../domain/core-profile";
import { collaborationSwimlaneLayoutsBpmnProfile, collaborationSubprocessTimersBpmnProfile } from "../../domain/collaboration-profile";
import { collaborationConversionTarget } from "../../domain/bpmn-family-conversion";

const metadataSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(1_000).default(""),
  purpose: z.enum(["AS_IS", "TO_BE", "REFERENCE"]),
}).strict();

const candidateSchema = metadataSchema.extend({
  profileId: z
.enum(supportedBpmnProfiles.map((profile) => profile.id))
    .default(coreBpmnProfile.id),
  xml: z.string().min(1),
  source: z.enum(["EDITED", "IMPORTED"]).optional(),
}).strict();

const coreToCollaborationConversionSchema = metadataSchema.extend({
  sourceProfileId: z.enum(supportedCoreBpmnProfiles.map((profile) => profile.id)),
  profileId: z.enum([collaborationSwimlaneLayoutsBpmnProfile.id, collaborationSubprocessTimersBpmnProfile.id]),
  orientation: z.enum(["horizontal", "vertical"]),
  xml: z.string().min(1),
}).strict();

const versionSchema = z.object({
  note: z.string().max(500).default(""),
}).strict();

export class ProcessModelContractError extends Error {
  constructor(
    readonly code:
      | "INVALID_MODEL"
      | "BPMN_LIMIT_EXCEEDED"
      | "BPMN_INSPECTION_FAILED"
      | "MODEL_NOT_READY",
    readonly ruleIds: readonly string[] = [],
  ) {
    super(code);
    this.name = "ProcessModelContractError";
  }
}

export function parseProcessModelCandidate(value: unknown) {
  const result = candidateSchema.safeParse(value);
  if (!result.success) throw new ProcessModelContractError("INVALID_MODEL");
  if (new TextEncoder().encode(result.data.xml).byteLength > 1_048_576) {
    throw new ProcessModelContractError("BPMN_LIMIT_EXCEEDED");
  }
  const normalized = {
    ...result.data,
    title: result.data.title.trim(),
    description: result.data.description.trim(),
  };
  assertProcessModelMetadata(normalized);
  return normalized;
}

export function parseCoreToCollaborationConversionCandidate(value: unknown) {
  const result = coreToCollaborationConversionSchema.safeParse(value);
  if (!result.success || result.data.profileId !== collaborationConversionTarget(result.data.sourceProfileId)) throw new ProcessModelContractError("INVALID_MODEL");
  if (new TextEncoder().encode(result.data.xml).byteLength > 1_048_576) {
    throw new ProcessModelContractError("BPMN_LIMIT_EXCEEDED");
  }
  const normalized = {
    ...result.data,
    title: result.data.title.trim(),
    description: result.data.description.trim(),
  };
  assertProcessModelMetadata(normalized);
  return normalized;
}

export function parseProcessModelVersionRequest(value: unknown) {
  const result = versionSchema.safeParse(value);
  if (!result.success) throw new ProcessModelContractError("INVALID_MODEL");
  return result.data;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function modelRequestHash(input: {
  readonly title: string;
  readonly description: string;
  readonly purpose: ProcessModelPurpose;
  readonly canonicalXml: string;
  readonly profileId: string;
  readonly source?: "EDITED" | "IMPORTED";
}) {
  return sha256(canonicalJson(input));
}

export function coreToCollaborationConversionRequestHash(input: {
  readonly sourceProfileId: string;
  readonly sourceRevisionToken: string;
  readonly targetProfileId: string;
  readonly orientation: "horizontal" | "vertical";
  readonly title: string;
  readonly description: string;
  readonly purpose: ProcessModelPurpose;
  readonly canonicalXml: string;
}) {
  return sha256(canonicalJson({
    operation: "CORE_TO_COLLABORATION_SWIMLANE",
    ...input,
  }));
}

export function modelVersionRequestHash(input: {
  readonly operation: "CREATE_VERSION" | "RESTORE_VERSION";
  readonly revisionToken: string;
  readonly noteOrVersionId: string;
}) {
  return sha256(canonicalJson(input));
}

export function toPersistableContent(
  metadata: {
    readonly title: string;
    readonly description: string;
    readonly purpose: ProcessModelPurpose;
  },
  inspected: {
    readonly profileId: string;
    readonly canonicalXml: string;
  },
): ProcessModelContent {
  return {
    ...metadata,
    profileId: inspected.profileId,
    canonicalXml: inspected.canonicalXml,
    xmlChecksum: sha256(inspected.canonicalXml),
  };
}
