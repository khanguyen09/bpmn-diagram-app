import { createHmac, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const databaseUrl = process.env.TEST_DATABASE_URL;
const disposable = Boolean(databaseUrl && new URL(databaseUrl).pathname === "/experience_blogs_e2e_sdd84_auth");
if (disposable) process.env.DATABASE_URL = databaseUrl;
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "isolated-auth-test-secret-at-least-32-characters";

type Jar = Map<string, string>;
function cookies(response: Response, jar: Jar) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (/max-age=0/i.test(raw)) jar.delete(pair.slice(0, index));
    else jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}
let requestNumber = 0;
function request(path: string, jar: Jar, body?: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000${path}`, { method: body === undefined ? "GET" : "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": `192.0.2.${++requestNumber}`, cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ") }, body: body === undefined ? undefined : JSON.stringify(body) });
}
function totp(uri: string) {
  const secret = new URL(uri).searchParams.get("secret")!;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.toUpperCase().replace(/=+$/, "")) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((chunk) => parseInt(chunk, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", bytes).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

const suite = disposable ? describe : describe.skip;
suite("SDD84 disposable PostgreSQL owner profile and authentication", () => {
  const userIds: string[] = [];
  afterAll(async () => {
    if (!disposable) return;
    const { getPrisma } = await import("@/platform/database/client");
    await getPrisma().user.deleteMany({ where: { id: { in: userIds } } });
    await getPrisma().$disconnect();
  });
  it("protects profile, changes password with session revocation, verifies TOTP and one-use recovery login", async () => {
    const { buildAuth } = await import("./infrastructure/better-auth/auth");
    const { handleAuthRequest, handleOwnerProfile } = await import("./server");
    const { getPrisma } = await import("@/platform/database/client");
    const prisma = getPrisma();
    const email = `owner-${randomUUID()}@example.invalid`;
    const password = "Original-passphrase-test-84";
    const nextPassword = "Changed-passphrase-test-84";
    const created = await buildAuth({ allowBootstrapSignUp: true }).api.signUpEmail({ body: { email, password, name: "Isolated owner" } });
    userIds.push(created.user.id);
    const auth = async (path: string, jar: Jar, body: unknown = {}) => {
      const response = await handleAuthRequest("POST", request(`/api/auth${path}`, jar, body)); cookies(response, jar); return response;
    };
    const profile = async (jar: Jar, action = "", body?: unknown, origin?: string) => {
      const response = await handleOwnerProfile(request(`/api/v1/studio/profile${action ? `/${action}` : ""}`, jar, body, origin), action); cookies(response, jar); return response;
    };
    const first: Jar = new Map(), other: Jar = new Map();
    expect((await profile(first)).status).toBe(401);
    expect((await auth("/sign-in/email", first, { email, password })).status).toBe(200);
    expect((await auth("/sign-in/email", other, { email, password })).status).toBe(200);
    const listed = await (await profile(first)).json();
    expect(listed.sessions.total).toBe(2);
    expect(listed.sessions.items.every((item: Record<string, unknown>) => !("token" in item))).toBe(true);
    const ownSession = listed.sessions.items.find((item: { current: boolean }) => item.current);
    const otherSession = listed.sessions.items.find((item: { current: boolean }) => !item.current);
    expect((await profile(first, "sessions/revoke", { sessionId: ownSession.id })).status).toBe(400);
    expect((await profile(first, "sessions/revoke", { sessionId: "not-owned" })).status).toBe(404);
    expect((await profile(first, "sessions/revoke", { sessionId: otherSession.id })).status).toBe(200);
    expect((await profile(other)).status).toBe(401);
    expect((await auth("/sign-in/email", other, { email, password })).status).toBe(200);
    expect((await profile(first, "", { name: "Name", image: null, role: "OWNER" })).status).toBe(400);
    expect((await profile(first, "", { name: "Name", image: "javascript:alert(1)" })).status).toBe(400);
    expect((await profile(first, "", { name: "Name", image: null }, "https://evil.invalid")).status).toBe(403);
    expect((await profile(first, "", { name: "Updated owner", image: "https://example.invalid/avatar.png" })).status).toBe(200);
    expect((await profile(first, "password", { currentPassword: "wrong", newPassword: nextPassword })).status).not.toBe(200);
    expect((await profile(other)).status).toBe(200);
    const changed = await profile(first, "password", { currentPassword: password, newPassword: nextPassword });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toEqual({ status: true });
    expect((await profile(first)).status).toBe(200);
    expect((await profile(other)).status).toBe(401);
    for (const path of ["/sign-up/email", "/delete-user", "/change-password", "/update-user", "/list-sessions", "/two-factor/enable"]) {
      expect((await auth(path, first, {})).status).toBe(404);
    }
    const enabled = await profile(first, "two-factor/enable", { password: nextPassword });
    expect(enabled.status).toBe(200);
    const enrollment = await enabled.json();
    expect(enrollment.backupCodes).toHaveLength(10);
    const stored = await prisma.twoFactor.findUniqueOrThrow({ where: { userId: created.user.id } });
    expect(stored.secret).not.toBe(new URL(enrollment.totpURI).searchParams.get("secret"));
    expect(stored.backupCodes).not.toContain(enrollment.backupCodes[0]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } })).twoFactorEnabled).toBe(false);
    expect((await profile(first, "two-factor/verify", { code: totp(enrollment.totpURI) })).status).toBe(400);
    expect((await auth("/two-factor/verify-totp", first, { code: totp(enrollment.totpURI) })).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } })).twoFactorEnabled).toBe(false);
    expect((await profile(first, "two-factor/verify", { code: totp(enrollment.totpURI), recoveryCodesSaved: true })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } })).twoFactorEnabled).toBe(true);
    const challenged: Jar = new Map();
    const login = await auth("/sign-in/email", challenged, { email, password: nextPassword });
    expect(await login.json()).toMatchObject({ twoFactorRedirect: true });
    expect((await profile(challenged)).status).toBe(401);
    expect((await auth("/two-factor/verify-totp", challenged, { code: "not-a-code" })).ok).toBe(false);
    expect((await auth("/two-factor/verify-totp", challenged, { code: totp(enrollment.totpURI), trustDevice: false })).status).toBe(200);
    expect((await profile(challenged)).status).toBe(200);
    const recovery: Jar = new Map();
    await auth("/sign-in/email", recovery, { email, password: nextPassword });
    const recovered = await auth("/two-factor/verify-backup-code", recovery, { code: enrollment.backupCodes[0], trustDevice: false });
    expect(recovered.status).toBe(200);
    expect(JSON.stringify(await recovered.json())).not.toContain('"token"');
    expect((await profile(recovery)).status).toBe(200);
    const replay: Jar = new Map();
    await auth("/sign-in/email", replay, { email, password: nextPassword });
    expect((await auth("/two-factor/verify-backup-code", replay, { code: enrollment.backupCodes[0] })).ok).toBe(false);
    const cancelled: Jar = new Map();
    await auth("/sign-in/email", cancelled, { email, password: nextPassword });
    const staleCookie = new Map(cancelled);
    expect((await handleAuthRequest("POST", request("/api/auth/two-factor/cancel", cancelled, {}, "https://evil.invalid"))).status).toBe(403);
    expect((await auth("/two-factor/cancel", cancelled)).status).toBe(200);
    expect((await auth("/two-factor/verify-totp", staleCookie, { code: totp(enrollment.totpURI) })).ok).toBe(false);
    expect((await profile(first, "two-factor/backup-codes", { password: "wrong" })).ok).toBe(false);
    const regenerated = await profile(first, "two-factor/backup-codes", { password: nextPassword });
    expect(regenerated.status).toBe(200);
    const freshCodes = (await regenerated.json()).backupCodes;
    expect(freshCodes).toHaveLength(10);
    const regeneratedLogin: Jar = new Map();
    await auth("/sign-in/email", regeneratedLogin, { email, password: nextPassword });
    expect((await auth("/two-factor/verify-backup-code", regeneratedLogin, { code: enrollment.backupCodes[1] })).ok).toBe(false);
    expect((await auth("/two-factor/verify-backup-code", regeneratedLogin, { code: freshCodes[0] })).status).toBe(200);
    expect((await profile(first, "sessions/revoke", { others: true })).status).toBe(200);
    expect((await profile(regeneratedLogin)).status).toBe(401);
    expect((await profile(first, "two-factor/disable", { password: "wrong" })).ok).toBe(false);
    expect((await profile(first, "two-factor/disable", { password: nextPassword })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } })).twoFactorEnabled).toBe(false);
  }, 30000);
  it("rate limits repeated native challenge attempts using PostgreSQL storage", async () => {
    const { handleAuthRequest } = await import("./server");
    const address = `2001:db8:${randomUUID().replaceAll("-", "").slice(0, 24).match(/.{4}/g)!.join(":")}`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const incoming = request("/api/auth/two-factor/verify-totp", new Map(), { code: "000000" });
      incoming.headers.set("x-forwarded-for", address);
      statuses.push((await handleAuthRequest("POST", incoming)).status);
    }
    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);
  });
});
