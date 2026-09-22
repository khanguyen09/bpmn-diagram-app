import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuth } from "./infrastructure/better-auth/auth";
import { IdentityAccessError, requireOwner, requireTrustedOrigin } from "./application/require-owner";
import { getServerEnv } from "@/platform/config/server-env";
import { BoundedJsonError, readBoundedJson } from "@/platform/http/read-bounded-json";
import { ownerEnrollmentVerifySchema, ownerPasswordProofSchema, ownerPasswordSchema, ownerProfileSchema, ownerRevokeSchema, parseProfilePage } from "./domain/owner-profile";
import { findOwnedSessionToken, readOwnerProfile } from "./infrastructure/prisma/owner-profile-repository";

function failure(status: number, code: string, source?: Response) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const cookie of source?.headers.getSetCookie() ?? []) headers.append("set-cookie", cookie);
  const retryAfter = source?.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);
  return NextResponse.json({ error: { code } }, { status, headers });
}

async function ownerSession(headers: Headers) {
  const session = await getAuth().api.getSession({ headers });
  requireOwner(session ? { userId: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role } : null);
  return session!;
}

async function nativeMutation(request: Request, path: string, body: unknown) {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return getAuth().handler(new Request(new URL(`/api/auth${path}`, getServerEnv().BETTER_AUTH_URL), { method: "POST", headers, body: JSON.stringify(body) }));
}

function safeSuccess(response: Response, data: unknown) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return NextResponse.json(data, { headers });
}

export async function handleOwnerProfile(request: Request, action = "") {
  try {
    if (request.method !== "GET") {
      const env = getServerEnv();
      requireTrustedOrigin(request.headers.get("origin"), [new URL(env.BETTER_AUTH_URL).origin, ...env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((value) => new URL(value.trim()).origin)]);
    }
    const session = await ownerSession(request.headers);
    if (request.method === "GET" && action === "") {
      return NextResponse.json(await readOwnerProfile(session.user.id, session.session.id, parseProfilePage(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } });
    }
    if (request.method !== "POST") return failure(405, "METHOD_NOT_ALLOWED");
    const body = await readBoundedJson(request, 8000);
    let nativePath: string;
    let nativeBody: unknown;
    if (action === "") { nativePath = "/update-user"; nativeBody = ownerProfileSchema.parse(body); }
    else if (action === "password") { nativePath = "/change-password"; nativeBody = { ...ownerPasswordSchema.parse(body), revokeOtherSessions: true }; }
    else if (action === "sessions/revoke") {
      const input = ownerRevokeSchema.parse(body);
      if ("others" in input) { nativePath = "/revoke-other-sessions"; nativeBody = {}; }
      else {
        if (input.sessionId === session.session.id) return failure(400, "USE_SIGN_OUT");
        const target = await findOwnedSessionToken(session.user.id, input.sessionId);
        if (!target) return failure(404, "SESSION_NOT_FOUND");
        nativePath = "/revoke-session"; nativeBody = { token: target.token };
      }
    } else if (["two-factor/enable", "two-factor/disable", "two-factor/backup-codes"].includes(action)) {
      nativeBody = ownerPasswordProofSchema.parse(body);
      nativePath = action === "two-factor/backup-codes" ? "/two-factor/generate-backup-codes" : `/${action}`;
      if (action === "two-factor/enable" && session.user.twoFactorEnabled) return failure(409, "TWO_FACTOR_ALREADY_ENABLED");
    } else if (action === "two-factor/verify") {
      const input = ownerEnrollmentVerifySchema.parse(body);
      nativePath = "/two-factor/verify-totp"; nativeBody = { code: input.code, trustDevice: false };
    } else return failure(404, "NOT_FOUND");
    const response = await nativeMutation(request, nativePath, nativeBody);
    if (!response.ok) return failure(response.status, response.status === 429 ? "RATE_LIMITED" : "ACCOUNT_ACTION_FAILED", response);
    const result = await response.json() as Record<string, unknown>;
    if (action === "two-factor/enable") return safeSuccess(response, { totpURI: result.totpURI, backupCodes: result.backupCodes });
    if (action === "two-factor/backup-codes") return safeSuccess(response, { backupCodes: result.backupCodes });
    return safeSuccess(response, { status: true });
  } catch (error) {
    if (error instanceof IdentityAccessError) return failure(error.code === "UNAUTHENTICATED" ? 401 : 403, error.code);
    if (error instanceof ZodError || error instanceof BoundedJsonError || (error instanceof Error && error.message === "INVALID_PROFILE_QUERY")) return failure(400, "INVALID_REQUEST");
    return failure(503, "ACCOUNT_UNAVAILABLE");
  }
}
