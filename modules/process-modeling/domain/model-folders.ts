import { z } from "zod";

export const folderIdSchema = z.uuid();
export const folderNameSchema = z.string().transform(value => value.normalize("NFC").trim().replace(/\s+/gu, " ")).pipe(
  z.string().min(1).max(80).refine(value => !/[\u0000-\u001f\u007f]/u.test(value)),
);
export const createFolderSchema = z.object({ id: folderIdSchema, name: folderNameSchema }).strict();
export const renameFolderSchema = z.object({ name: folderNameSchema, expectedRevision: z.number().int().nonnegative() }).strict();
export const deleteFolderSchema = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
export const moveModelsSchema = z.object({
  folderId: folderIdSchema.nullable(),
  models: z.array(z.object({ id: z.uuid(), expectedFolderRevision: z.number().int().nonnegative() }).strict()).min(1).max(100)
    .refine(models => new Set(models.map(model => model.id)).size === models.length),
}).strict();
export interface ProcessModelFolder { readonly id: string; readonly name: string; readonly revision: number; readonly modelCount: number }
export type FolderMutationResult = { readonly kind: "saved" | "deleted" | "moved" | "not-found" | "conflict" | "duplicate" | "limit" };
export type FolderMove = z.infer<typeof moveModelsSchema>;
export function normalizedFolderName(name: string) { return name.toLocaleLowerCase("vi"); }
