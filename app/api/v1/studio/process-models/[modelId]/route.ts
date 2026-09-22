import { NextResponse } from "next/server";
import { archiveOwnedProcessModel, parseStrongModelEtag } from "@/modules/process-modeling/server";
import { IdentityAccessError, requireOwnerSession, requireTrustedMutationOrigin } from "@/modules/identity-access/server";

export async function DELETE(request: Request, context: { params: Promise<{ modelId: string }> }) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    let revision: number;
    try { revision = parseStrongModelEtag(request.headers.get("if-match") ?? ""); }
    catch { return NextResponse.json({ error: { code: "MISSING_SAVE_PRECONDITION" } }, { status: 428 }); }
    const { modelId } = await context.params;
    const result = await archiveOwnedProcessModel(actor.userId, modelId, revision);
    return NextResponse.json(result, {
      status: result.kind === "conflict" || result.kind === "in-use" ? 409 : result.kind === "not-found" ? 404 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof IdentityAccessError) return NextResponse.json({ error: { code: error.code } }, { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
