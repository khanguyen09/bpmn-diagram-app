import { NextResponse } from "next/server";
import {
  ProcessModelContractError,
  listOwnedProcessModelVersions,
  parseStrongModelEtag,
  readBoundedProcessModelBody,
  sealOwnedProcessModelVersion,
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
  if (
    error instanceof ProcessModelContractError &&
    error.code === "BPMN_LIMIT_EXCEEDED"
  ) {
    return NextResponse.json(
      { error: { code: "BPMN_LIMIT_EXCEEDED" } },
      { status: 413 },
    );
  }
  if (
    error instanceof ProcessModelContractError &&
    error.code === "MODEL_NOT_READY"
  ) {
    return NextResponse.json(
      { error: { code: "MODEL_NOT_READY", ruleIds: error.ruleIds } },
      { status: 422 },
    );
  }
  if (error instanceof ProcessModelContractError || error instanceof SyntaxError) {
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
    const versions = await listOwnedProcessModelVersions(actor.userId, modelId);
    if (!versions) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json(
      { versions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
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
    const result = await sealOwnedProcessModelVersion({
      ownerId: actor.userId,
      modelId,
      expectedRevisionToken: ifMatch.slice(1, -1),
      idempotencyKey,
      body: await readBoundedProcessModelBody(request),
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
    return failure(error);
  }
}
