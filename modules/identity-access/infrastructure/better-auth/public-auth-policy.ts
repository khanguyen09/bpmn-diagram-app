const publicAuthPaths = new Set(["/sign-in/email", "/sign-out", "/get-session", "/two-factor/verify-totp", "/two-factor/verify-backup-code", "/two-factor/cancel"]);
export function isPublicAuthPathAllowed(path: string, method: string) {
  return publicAuthPaths.has(path) && (path === "/get-session" ? method === "GET" : method === "POST");
}

export function stripAuthBearerTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAuthBearerTokens);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["token", "accessToken", "refreshToken", "idToken"].includes(key)).map(([key, nested]) => [key, stripAuthBearerTokens(nested)]));
}
