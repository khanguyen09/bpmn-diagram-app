import { NextResponse } from "next/server";
import {
  ProcessModelContractError,
  createOwnedProcessModel,
  listOwnedProcessModels,
  listOwnedProcessModelsPage,
  readBoundedProcessModelBody,
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
    const status = error.code === "BPMN_LIMIT_EXCEEDED"
      ? 413
      : error.code === "BPMN_INSPECTION_FAILED"
        ? 422
        : 400;
    return NextResponse.json(
      { error: { code: error.code, ruleIds: error.ruleIds } },
      { status },
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "INVALID_MODEL" } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const actor = await requireOwnerSession(request.headers);
    const query = new URL(request.url).searchParams;
    if (query.has("page") || query.has("pageSize") || query.has("folderId")) {
      return NextResponse.json(await listOwnedProcessModelsPage(actor.userId, query.get("page") ?? 1, query.get("pageSize") ?? 9, query.get("folderId") ?? undefined), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    return NextResponse.json(
      { models: await listOwnedProcessModels(actor.userId) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutationOrigin(request.headers);
    const actor = await requireOwnerSession(request.headers);
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.length > 160) {
      return NextResponse.json(
        { error: { code: "MISSING_SAVE_PRECONDITION" } },
        { status: 428 },
      );
    }
    const result = await createOwnedProcessModel({
      ownerId: actor.userId,
      idempotencyKey,
      candidate: await readBoundedProcessModelBody(request),
    });
    if (result.kind === "idempotency-mismatch") {
      return NextResponse.json(
        { error: { code: "IDEMPOTENCY_KEY_REUSED" } },
        { status: 409 },
      );
    }
    if (result.kind === "acknowledged" || result.kind === "idempotent") {
      return NextResponse.json(result, {
        status: result.kind === "acknowledged" ? 201 : 200,
        headers: {
          ETag: `"${result.revisionToken}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  } catch (error) {
    return failure(error);
  }
}
