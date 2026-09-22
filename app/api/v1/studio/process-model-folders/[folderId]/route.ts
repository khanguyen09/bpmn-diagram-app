import { requireOwnerSession, requireTrustedMutationOrigin } from "@/modules/identity-access/server";
import { renameOwnedModelFolder, deleteOwnedModelFolder, readBoundedProcessModelBody } from "@/modules/process-modeling/server";
import { folderFailure, folderResult } from "../folder-response";
type Context = { params: Promise<{ folderId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    return folderResult(await renameOwnedModelFolder(actor.userId, (await context.params).folderId, await readBoundedProcessModelBody(request)));
  } catch (error) { return folderFailure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    return folderResult(await deleteOwnedModelFolder(actor.userId, (await context.params).folderId, await readBoundedProcessModelBody(request)));
  } catch (error) { return folderFailure(error); }
}
