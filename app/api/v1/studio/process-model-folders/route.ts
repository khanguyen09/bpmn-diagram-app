import { NextResponse } from "next/server";
import { requireOwnerSession, requireTrustedMutationOrigin } from "@/modules/identity-access/server";
import { listOwnedModelFolders, createOwnedModelFolder, readBoundedProcessModelBody } from "@/modules/process-modeling/server";
import { folderFailure, folderResult } from "./folder-response";
export async function GET(request: Request) {
  try {
    const actor = await requireOwnerSession(request.headers);
    return NextResponse.json({ folders: await listOwnedModelFolders(actor.userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return folderFailure(error); }
}
export async function POST(request: Request) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    return folderResult(await createOwnedModelFolder(actor.userId, await readBoundedProcessModelBody(request)));
  } catch (error) { return folderFailure(error); }
}
