import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function isAuthOrigin(value: string, production: boolean): boolean {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && (!production || loopback)))
      && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv {
  const env = serverEnvSchema.parse(input);
  const production = input.NODE_ENV === "production";
  const origins = env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((value) => value.trim());
  if (!isAuthOrigin(env.BETTER_AUTH_URL, production)
    || origins.some((origin) => !isAuthOrigin(origin, production))) {
    throw new Error("Authentication URLs must be complete origins; production requires HTTPS except on loopback.");
  }
  const baseOrigin = new URL(env.BETTER_AUTH_URL).origin;
  const normalized = [...new Set(origins.map((origin) => new URL(origin).origin))];
  if (!normalized.includes(baseOrigin)) {
    throw new Error("Authentication base origin must be included in trusted origins.");
  }
  return { ...env, BETTER_AUTH_URL: baseOrigin, BETTER_AUTH_TRUSTED_ORIGINS: normalized.join(",") };
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function resetServerEnvForTests() {
  cached = undefined;
}
