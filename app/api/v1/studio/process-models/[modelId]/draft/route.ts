import { NextResponse } from "next/server";
import {
  ProcessModelContractError,
  getOwnedProcessModelDraft,
  parseStrongModelEtag,
  readBoundedProcessModelBody,
  saveOwnedProcessModelDraft,
} from "@/modules/process-modeling/server";
import {
  IdentityAccessError,
  requireOwnerSession,
  requireTrustedMutationOrigin,
} from "@/modules/identity-access/server";

function failure(error: unknown) {
  if (error instanceof IdentityAccessError) {
    return NextResponse.json(
      { error: { code: error.code } },
      { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
  if (error instanceof ProcessModelContractError) {
    return NextResponse.json(
      { error: { code: error.code, ruleIds: error.ruleIds } },
      {
        status: error.code === "BPMN_LIMIT_EXCEEDED"
          ? 413
          : error.code === "BPMN_INSPECTION_FAILED"
            ? 422
            : 400,
      },
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "INVALID_MODEL" } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ modelId: string }> },
) {
  try {
    const actor = await requireOwnerSession(request.headers);
    const { modelId } = await context.params;
    const draft = await getOwnedProcessModelDraft(actor.userId, modelId);
    if (!draft) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json(draft, {
      headers: {
        ETag: `"${draft.revisionToken}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ modelId: string }> },
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
    const { modelId } = await context.params;
    const result = await saveOwnedProcessModelDraft({
      ownerId: actor.userId,
      modelId,
      expectedRevisionToken: ifMatch.slice(1, -1),
      idempotencyKey,
      candidate: await readBoundedProcessModelBody(request),
    });
    if (result.kind === "conflict") {
      return NextResponse.json(
        {
          error: { code: "REVISION_CONFLICT" },
          currentRevisionToken: result.currentRevisionToken,
        },
        { status: 409 },
      );
    }
    if (result.kind === "idempotency-mismatch") {
      return NextResponse.json(
        { error: { code: "IDEMPOTENCY_KEY_REUSED" } },
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
    return failure(error);
  }
}
