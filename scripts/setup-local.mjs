import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { z } from "zod";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const templatePath = fileURLToPath(new URL("../.env.example", import.meta.url));
const check = process.argv.includes("--check");
if (!existsSync(envPath)) {
  if (check) {
    console.error("Missing .env. Run pnpm setup:local first.");
    process.exit(1);
  }
  const text = readFileSync(templatePath, "utf8")
    .replace("replace-with-at-least-32-random-characters", randomBytes(32).toString("hex"))
    .replace("replace-with-a-long-random-password", randomBytes(24).toString("base64url"));
  writeFileSync(envPath, text, { flag: "wx", mode: 0o600 });
  console.log("Created .env with unique local credentials. Open .env to view or change OWNER_EMAIL and OWNER_PASSWORD before provisioning. No database was modified.");
} else if (!check) {
  console.log("Kept existing .env unchanged. Run pnpm setup:check to validate it.");
}
if (check) {
  const env = parse(readFileSync(envPath));
  const errors = [];
  for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_TRUSTED_ORIGINS", "OWNER_EMAIL", "OWNER_NAME"])
    if (!env[key]) errors.push(`${key} is required`);
  if (!z.string().url().startsWith("postgresql://").safeParse(env.DATABASE_URL).success) errors.push("DATABASE_URL must be a valid postgresql:// URL");
  if (!z.string().email().safeParse(env.OWNER_EMAIL).success) errors.push("OWNER_EMAIL must be a valid email address");
  if (!z.string().min(1).max(120).safeParse(env.OWNER_NAME).success) errors.push("OWNER_NAME must contain 1–120 characters");
  if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32 || env.BETTER_AUTH_SECRET?.startsWith("replace-")) errors.push("Set a random BETTER_AUTH_SECRET of at least 32 characters");
  if ((env.OWNER_PASSWORD?.length ?? 0) < 12 || (env.OWNER_PASSWORD?.length ?? 0) > 128 || env.OWNER_PASSWORD?.startsWith("replace-")) errors.push("Set OWNER_PASSWORD to 12–128 characters");
  const origins = new Map();
  const production = (process.env.NODE_ENV ?? env.NODE_ENV) === "production";
  for (const key of ["BETTER_AUTH_URL", "BETTER_AUTH_TRUSTED_ORIGINS"]) {
    const values = key === "BETTER_AUTH_URL" ? [env[key] ?? ""] : (env[key] ?? "").split(",");
    const normalized = [];
    for (const value of values) {
      try {
        const url = new URL(value.trim());
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
        const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if (production && url.protocol !== "https:" && !loopback) throw new Error();
        normalized.push(url.origin);
      } catch { errors.push(`${key} must contain complete HTTP(S) origins`); }
    }
    origins.set(key, normalized);
  }
  const base = origins.get("BETTER_AUTH_URL")[0];
  if (base && !origins.get("BETTER_AUTH_TRUSTED_ORIGINS").includes(base)) errors.push("BETTER_AUTH_URL must be included in BETTER_AUTH_TRUSTED_ORIGINS");
  if (production && errors.some((error) => error.includes("HTTP(S) origins"))) errors.push("Production requires HTTPS origins except on loopback");
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("Local configuration is valid. Credential values were not printed.");
}
