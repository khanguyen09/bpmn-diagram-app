import { NextResponse } from "next/server";
import { IdentityAccessError } from "@/modules/identity-access/server";
import { ProcessModelContractError } from "@/modules/process-modeling/server";
export function folderResult(result: { readonly kind: string }) {
  return NextResponse.json(result, { status: result.kind === "not-found" ? 404 : ["conflict", "duplicate", "limit"].includes(result.kind) ? 409 : 200, headers: { "Cache-Control": "private, no-store" } });
}
export function folderFailure(error: unknown) {
  if (error instanceof IdentityAccessError) return NextResponse.json({ error: { code: error.code } }, { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
  if (error instanceof ProcessModelContractError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_MODEL" } }, { status: 400 });
  return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
}
