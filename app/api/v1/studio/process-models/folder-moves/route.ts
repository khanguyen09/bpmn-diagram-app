import { requireOwnerSession, requireTrustedMutationOrigin } from "@/modules/identity-access/server";
import { moveOwnedModelsToFolder, readBoundedProcessModelBody } from "@/modules/process-modeling/server";
import { folderFailure, folderResult } from "../../process-model-folders/folder-response";
export async function POST(request: Request) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    return folderResult(await moveOwnedModelsToFolder(actor.userId, await readBoundedProcessModelBody(request)));
  } catch (error) { return folderFailure(error); }
}
