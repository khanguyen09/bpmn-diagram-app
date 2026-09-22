import type {
  ProcessModelCommandOperation,
  ProcessModelContent,
  ProcessModelRevisionSource,
} from "../../domain/model-lifecycle";
import type { ProcessModelArchiveResult, ProcessModelPageQuery } from "../process-model-library";

export interface ProcessModelDraftProjection extends ProcessModelContent {
  readonly modelId: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly updatedAt: Date;
}

export interface ProcessModelListItem {
  readonly id: string;
  readonly title: string;
  readonly purpose: ProcessModelContent["purpose"];
  readonly profileId: string;
  readonly revisionNumber: number;
  readonly versionCount: number;
  readonly updatedAt: Date;
}

export interface ProcessModelVersionProjection {
  readonly id: string;
  readonly modelId: string;
  readonly revisionId: string;
  readonly versionNumber: number;
  readonly note: string;
  readonly profileId: string;
  readonly xmlChecksum: string;
  readonly createdAt: Date;
}

export type ModelWriteResult =
  | { readonly kind: "acknowledged" | "idempotent"; readonly draft: ProcessModelDraftProjection }
  | { readonly kind: "conflict"; readonly currentRevisionNumber: number }
  | { readonly kind: "idempotency-mismatch" | "not-found" };

export type ModelVersionWriteResult =
  | {
      readonly kind: "acknowledged" | "idempotent";
      readonly draft: ProcessModelDraftProjection;
      readonly version: ProcessModelVersionProjection;
    }
  | { readonly kind: "conflict"; readonly currentRevisionNumber: number }
  | { readonly kind: "idempotency-mismatch" | "not-found" };

export interface ProcessModelRepository {
  listModelsPage(ownerId: string, query: ProcessModelPageQuery): Promise<{
    readonly models: readonly (ProcessModelListItem & { readonly createdAt: Date; readonly createdByName: string })[];
    readonly total: number; readonly page: number; readonly pageSize: number;
  }>;
  archiveModel(input: { readonly ownerId: string; readonly modelId: string; readonly expectedRevisionNumber: number }): Promise<ProcessModelArchiveResult>;
  listModels(ownerId: string): Promise<readonly ProcessModelListItem[]>;
  getDraft(ownerId: string, modelId: string): Promise<ProcessModelDraftProjection | null>;
  listVersions(ownerId: string, modelId: string): Promise<readonly ProcessModelVersionProjection[]>;
  createModel(input: {
    readonly ownerId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly content: ProcessModelContent;
  }): Promise<ModelWriteResult>;
  saveDraft(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionNumber: number;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly source: Extract<ProcessModelRevisionSource, "EDITED" | "IMPORTED">;
    readonly content: ProcessModelContent;
  }): Promise<ModelWriteResult>;
  createVersion(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly expectedRevisionNumber: number;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly note: string;
    readonly operation: Extract<ProcessModelCommandOperation, "CREATE_VERSION">;
  }): Promise<ModelVersionWriteResult>;
  restoreVersion(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly versionId: string;
    readonly expectedRevisionNumber: number;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly operation: Extract<ProcessModelCommandOperation, "RESTORE_VERSION">;
  }): Promise<ModelWriteResult>;
}
