import { z } from "zod";
import type { ProcessModelFolderClient } from "../../application/process-model-persistence-client";
import { folderIdSchema, folderNameSchema } from "../../domain/model-folders";
const folderList = z.object({ folders: z.array(z.object({ id: folderIdSchema, name: folderNameSchema, revision: z.number().int().nonnegative(), modelCount: z.number().int().nonnegative() })).max(200) });
const mutation = z.object({ kind: z.enum(["saved", "deleted", "moved", "not-found", "conflict", "duplicate", "limit"]) });
async function mutate(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (![200, 404, 409].includes(response.status)) throw new Error("Unable to update folders");
  return mutation.parse(await response.json());
}
const base = "/api/v1/studio/process-model-folders";
export const httpModelFolders: ProcessModelFolderClient = {
  async list() {
    const response = await fetch(base, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load folders");
    return folderList.parse(await response.json()).folders;
  },
  create: input => mutate(base, "POST", input),
  rename: (id, input) => mutate(`${base}/${encodeURIComponent(id)}`, "PATCH", input),
  remove: (id, expectedRevision) => mutate(`${base}/${encodeURIComponent(id)}`, "DELETE", { expectedRevision }),
  move: input => mutate("/api/v1/studio/process-models/folder-moves", "POST", input),
};
