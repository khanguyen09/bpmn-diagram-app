import type { ProcessModelFolder, FolderMutationResult, FolderMove } from "../domain/model-folders";
import type { BpmnProfileId } from "../domain/core-profile";

export interface OpenedProcessModel {
  readonly modelId: string;
  readonly title: string;
  readonly description: string;
  readonly purpose: "AS_IS" | "TO_BE" | "REFERENCE";
  readonly profileId: string;
  readonly xml: string;
  readonly revisionToken: string;
}

export interface ProcessModelSummary {
  readonly folderId?: string | null;
  readonly folderRevision?: number;
  readonly id: string;
  readonly title: string;
  readonly purpose: OpenedProcessModel["purpose"];
  readonly profileId: string;
  readonly revisionNumber: number;
  readonly versionCount: number;
  readonly updatedAt: string;
}

export interface ProcessModelVersionSummary {
  readonly id: string;
  readonly versionNumber: number;
  readonly note: string;
  readonly profileId: string;
  readonly xmlChecksum: string;
  readonly createdAt: string;
}

export interface ProcessModelLibraryPage {
  readonly models: readonly (ProcessModelSummary & { readonly createdAt: string; readonly createdByName: string })[];
  readonly total: number; readonly page: number; readonly pageSize: number;
}
export type ProcessModelArchiveResponse =
  | { readonly kind: "archived" | "already-archived" | "not-found" | "in-use" | "unauthenticated" | "unavailable" }
  | { readonly kind: "conflict"; readonly currentRevisionNumber: number };

export type ProcessModelSaveResponse =
  | {
      readonly kind: "acknowledged" | "idempotent";
      readonly revisionToken: string;
    }
  | {
      readonly kind: "conflict";
      readonly currentRevisionToken: string;
    }
  | {
      readonly kind: "unauthenticated" | "unavailable";
    }
  | {
      readonly kind: "rejected";
      readonly code?: "INVALID_MODEL" | "BPMN_LIMIT_EXCEEDED" | "BPMN_INSPECTION_FAILED" | "MODEL_NOT_READY";
      readonly ruleIds?: readonly string[];
    };

export type ProcessModelConversionResponse =
  | {
      readonly kind: "acknowledged" | "idempotent";
      readonly revisionToken: string;
      readonly profileId: BpmnProfileId;
      readonly canonicalXml: string;
    }
  | Exclude<
      ProcessModelSaveResponse,
      { kind: "acknowledged" | "idempotent" }
    >;

export interface ProcessModelFolderClient {
  list(): Promise<readonly ProcessModelFolder[]>;
  create(input: { readonly id: string; readonly name: string }): Promise<FolderMutationResult>;
  rename(id: string, input: { readonly name: string; readonly expectedRevision: number }): Promise<FolderMutationResult>;
  remove(id: string, expectedRevision: number): Promise<FolderMutationResult>;
  move(input: FolderMove): Promise<FolderMutationResult>;
}
export interface ProcessModelPersistenceClient {
  readonly folders?: ProcessModelFolderClient;
  listModelsPage(input: { readonly page: number; readonly pageSize: number; readonly folderId?: string | null }): Promise<ProcessModelLibraryPage>;
  archiveModel(input: { readonly modelId: string; readonly expectedRevisionNumber: number }): Promise<ProcessModelArchiveResponse>;
  listModels(): Promise<readonly ProcessModelSummary[]>;
  createModel(input: {
    readonly idempotencyKey: string;
    readonly title: string;
    readonly description: string;
    readonly purpose: OpenedProcessModel["purpose"];
    readonly profileId?: string;
    readonly xml: string;
  }): Promise<OpenedProcessModel>;
  openModel(modelId: string): Promise<OpenedProcessModel>;
  save(input: {
    readonly idempotencyKey: string;
    readonly modelId: string;
    readonly revisionToken: string;
    readonly title: string;
    readonly description: string;
    readonly purpose: "AS_IS" | "TO_BE" | "REFERENCE";
    readonly profileId?: string;
    readonly xml: string;
    readonly source: "EDITED" | "IMPORTED";
  }): Promise<ProcessModelSaveResponse>;
  convertCoreToCollaboration(input: {
    readonly idempotencyKey: string;
    readonly modelId: string;
    readonly revisionToken: string;
    readonly sourceProfileId: BpmnProfileId;
    readonly orientation: "horizontal" | "vertical";
    readonly title: string;
    readonly description: string;
    readonly purpose: "AS_IS" | "TO_BE" | "REFERENCE";
    readonly xml: string;
  }): Promise<ProcessModelConversionResponse>;
  createVersion(input: {
    readonly idempotencyKey: string;
    readonly modelId: string;
    readonly revisionToken: string;
    readonly note: string;
  }): Promise<
    | {
        readonly kind: "acknowledged" | "idempotent";
        readonly revisionToken: string;
        readonly versionNumber: number;
      }
    | Exclude<ProcessModelSaveResponse, { kind: "acknowledged" | "idempotent" }>
  >;
  listVersions(modelId: string): Promise<readonly ProcessModelVersionSummary[]>;
  restoreVersion(input: {
    readonly idempotencyKey: string;
    readonly modelId: string;
    readonly versionId: string;
    readonly revisionToken: string;
  }): Promise<ProcessModelSaveResponse>;
}
