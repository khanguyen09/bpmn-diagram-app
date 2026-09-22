import { folderIdSchema } from "../domain/model-folders";
export interface ProcessModelPageQuery { readonly page: number; readonly pageSize: number; readonly folderId?: string | null }

export function parseProcessModelPageQuery(page: unknown = 1, pageSize: unknown = 9, folderId?: unknown): ProcessModelPageQuery {
  const parse = (value: unknown, maximum: number) => {
    if ((typeof value !== "string" && typeof value !== "number") ||
      !/^[1-9][0-9]*$/.test(String(value))) throw new Error("Invalid library page");
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result > maximum) throw new Error("Invalid library page");
    return result;
  };
  const folder = folderId === undefined || folderId === "all" ? undefined : folderId === null || folderId === "unfiled" ? null : folderIdSchema.parse(folderId);
  return { page: parse(page, 100_000), pageSize: parse(pageSize, 36), ...(folder !== undefined ? { folderId: folder } : {}) };
}

/** Exact canonical block identity, never a text/JSON substring match. */
export function documentUsesProcessModel(document: unknown, modelId: string): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const blocks = (document as Record<string, unknown>).blocks;
  if (!Array.isArray(blocks)) return false;
  return blocks.some((block: unknown) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return false;
    const value = block as Record<string, unknown>;
    if (value.type !== "bpmn-embed" || !value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) return false;
    return (value.payload as Record<string, unknown>).processModelId === modelId;
  });
}

export type ProcessModelArchiveResult =
  | { readonly kind: "archived" | "already-archived" | "not-found" | "in-use" }
  | { readonly kind: "conflict"; readonly currentRevisionNumber: number };
