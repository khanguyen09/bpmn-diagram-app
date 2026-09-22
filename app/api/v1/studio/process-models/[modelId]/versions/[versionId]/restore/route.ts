import { NextResponse } from "next/server";
import {
  parseStrongModelEtag,
  restoreOwnedProcessModelVersion,
} from "@/modules/process-modeling/server";
import {
  IdentityAccessError,
  requireOwnerSession,
  requireTrustedMutationOrigin,
} from "@/modules/identity-access/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ modelId: string; versionId: string }> },
) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    const ifMatch = request.headers.get("if-match");
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!ifMatch || !idempotencyKey || idempotencyKey.length > 160) {
      return NextResponse.json(
        { error: { code: "MISSING_SAVE_PRECONDITION" } },
        { status: 428 },
      );
    }
    try {
      parseStrongModelEtag(ifMatch);
    } catch {
      return NextResponse.json(
        { error: { code: "MISSING_SAVE_PRECONDITION" } },
        { status: 428 },
      );
    }
    const { modelId, versionId } = await context.params;
    const result = await restoreOwnedProcessModelVersion({
      ownerId: actor.userId,
      modelId,
      versionId,
      expectedRevisionToken: ifMatch.slice(1, -1),
      idempotencyKey,
    });
    if (result.kind === "conflict" || result.kind === "idempotency-mismatch") {
      return NextResponse.json(
        {
          error: {
            code: result.kind === "conflict"
              ? "REVISION_CONFLICT"
              : "IDEMPOTENCY_KEY_REUSED",
          },
        },
        { status: 409 },
      );
    }
    if (result.kind === "not-found") {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    if (result.kind !== "acknowledged" && result.kind !== "idempotent") {
      return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
    }
    return NextResponse.json(result, {
      status: result.kind === "acknowledged" ? 201 : 200,
      headers: {
        ETag: `"${result.revisionToken}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof IdentityAccessError) {
      return NextResponse.json(
        { error: { code: error.code } },
        { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
