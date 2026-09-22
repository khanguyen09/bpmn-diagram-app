import { NextResponse } from "next/server";
import { IdentityAccessError, requireOwnerSession } from "@/modules/identity-access/server";
import { getOwnedProcessModelPreview } from "@/modules/process-modeling/server";

export async function GET(request: Request, context: { params: Promise<{ modelId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const actor = await requireOwnerSession(request.headers);
    const { modelId } = await context.params;
    const versionId = new URL(request.url).searchParams.get("versionId");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(modelId) || (versionId !== null && !uuid.test(versionId))) {
      return NextResponse.json({ error: "INVALID_REFERENCE" }, { status: 400, headers });
    }
    const preview = await getOwnedProcessModelPreview(actor.userId, modelId, versionId ?? undefined);
    return NextResponse.json(preview ?? { error: "NOT_FOUND" }, { status: preview ? 200 : 404, headers });
  } catch (error) {
    const status = error instanceof IdentityAccessError ? (error.code === "UNAUTHENTICATED" ? 401 : 403) : 500;
    return NextResponse.json({ error: "PREVIEW_UNAVAILABLE" }, { status, headers });
  }
}
