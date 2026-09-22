import "server-only";
export { handleOwnerProfile } from "./profile-server";

import { NextResponse } from "next/server";
import { isPublicAuthPathAllowed, stripAuthBearerTokens } from "./infrastructure/better-auth/public-auth-policy";
import { headers } from "next/headers";
import {
  requireOwner,
  requireTrustedOrigin,
} from "./application/require-owner";
import type { StudioActor } from "./domain/actor-principal";
import { getAuth } from "./infrastructure/better-auth/auth";
import { betterAuthPrincipalProvider } from "./infrastructure/better-auth/principal-provider";
import { getServerEnv } from "@/platform/config/server-env";
import { readBoundedJson } from "@/platform/http/read-bounded-json";

export type { StudioActor } from "./domain/actor-principal";
export { IdentityAccessError } from "./application/require-owner";
export {
  defaultStudioReturnTo,
  resolveStudioReturnTo,
} from "./application/studio-return-to";

export async function getStudioActor(
  requestHeaders?: Headers,
): Promise<StudioActor | null> {
  return betterAuthPrincipalProvider.getActor(requestHeaders ?? (await headers()));
}

export async function requireOwnerSession(
  requestHeaders?: Headers,
): Promise<StudioActor> {
  return requireOwner(await getStudioActor(requestHeaders));
}

export function requireTrustedMutationOrigin(requestHeaders: Headers): void {
  const env = getServerEnv();
  const trustedOrigins = [
    new URL(env.BETTER_AUTH_URL).origin,
    ...env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin),
  ];
  requireTrustedOrigin(requestHeaders.get("origin"), [...new Set(trustedOrigins)]);
}

export async function handleAuthRequest(
  method: "GET" | "POST",
  request: Request,
) {
  const path = new URL(request.url).pathname.slice("/api/auth".length);
  if (!isPublicAuthPathAllowed(path, method)) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (method === "POST") {
    try { requireTrustedMutationOrigin(request.headers); }
    catch { return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403, headers: { "Cache-Control": "no-store" } }); }
  }
  // Authenticated enrollment must pass the profile endpoint's recovery-code acknowledgement.
  if ((path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") && await getAuth().api.getSession({ headers: request.headers })) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") {
    let code: unknown;
    try { code = (await readBoundedJson(request, 2000) as { code?: unknown }).code; }
    catch { return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 }); }
    if (typeof code !== "string" || code.length > 128) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    // This product does not offer trusted-device bypass or session-free recovery-code consumption.
    request = new Request(request.url, { method: "POST", headers, body: JSON.stringify({ code, trustDevice: false, disableSession: false }) });
  }
  const response = await getAuth().handler(request);
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(stripAuthBearerTokens(await response.json())), { status: response.status, headers });
}
