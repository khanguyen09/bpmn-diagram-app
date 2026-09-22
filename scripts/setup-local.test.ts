import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "dotenv";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
const project = path.resolve(import.meta.dirname, "..");

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "bpmn-setup-test-"));
  directories.push(directory);
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(path.join(project, "scripts/setup-local.mjs"), path.join(directory, "scripts/setup-local.mjs"));
  copyFileSync(path.join(project, ".env.example"), path.join(directory, ".env.example"));
  symlinkSync(path.join(project, "node_modules"), path.join(directory, "node_modules"), "junction");
  return directory;
}

function run(directory: string, args: string[] = [], nodeEnv: "development" | "production" | "test" = "development") {
  const result = spawnSync(process.execPath, [path.join(directory, "scripts/setup-local.mjs"), ...args], {
    cwd: directory,
    env: { PATH: process.env.PATH, NODE_ENV: nodeEnv },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

function configured(overrides: Record<string, string> = {}) {
  const directory = fixture();
  expect(run(directory).status).toBe(0);
  const envPath = path.join(directory, ".env");
  const env = { ...parse(readFileSync(envPath)), ...overrides };
  writeFileSync(envPath, Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n"));
  return { directory, env };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("local setup CLI", () => {
  it("generates distinct private credentials without printing them and never overwrites existing configuration", () => {
    const directory = fixture();
    const result = run(directory);
    expect(result.status).toBe(0);
    const envPath = path.join(directory, ".env");
    const original = readFileSync(envPath, "utf8");
    const env = parse(original);
    expect(env.BETTER_AUTH_SECRET).toHaveLength(64);
    expect(env.OWNER_PASSWORD).toHaveLength(32);
    expect(result.output).not.toContain(env.BETTER_AUTH_SECRET);
    expect(result.output).not.toContain(env.OWNER_PASSWORD);
    if (process.platform !== "win32") expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(run(directory).status).toBe(0);
    expect(readFileSync(envPath, "utf8")).toBe(original);
    expect(run(directory, ["--check"]).status).toBe(0);
    const other = configured();
    expect(other.env.BETTER_AUTH_SECRET).not.toBe(env.BETTER_AUTH_SECRET);
    expect(other.env.OWNER_PASSWORD).not.toBe(env.OWNER_PASSWORD);
  });

  it("check reports a missing configuration without creating it", () => {
    const directory = fixture();
    const result = run(directory, ["--check"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("pnpm setup:local");
    expect(() => readFileSync(path.join(directory, ".env"))).toThrow();
  });

  it.each([
    ["OWNER_EMAIL", "invalid-email-sentinel", "valid email"],
    ["OWNER_NAME", "x".repeat(121), "1–120"],
    ["DATABASE_URL", "postgresql://[invalid-host", "valid postgresql"],
    ["BETTER_AUTH_TRUSTED_ORIGINS", "http://127.0.0.1:3000", "must be included"],
    ["BETTER_AUTH_URL", "http://localhost:3000,http://127.0.0.1:3000", "complete HTTP(S) origins"],
    ["BETTER_AUTH_TRUSTED_ORIGINS", "http://localhost:3000/private", "complete HTTP(S) origins"],
    ["OWNER_PASSWORD", "private-password-sentinel".repeat(6), "12–128"],
  ])("rejects invalid %s without printing configuration values", (key, value, message) => {
    const { directory, env } = configured({ [key]: value });
    const original = readFileSync(path.join(directory, ".env"), "utf8");
    const result = run(directory, ["--check"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain(message);
    expect(result.output).not.toContain(env.BETTER_AUTH_SECRET);
    expect(result.output).not.toContain(env.OWNER_PASSWORD);
    expect(readFileSync(path.join(directory, ".env"), "utf8")).toBe(original);
  });

  it("accepts normalized trusted origins and applies production HTTPS rules with the loopback exception", () => {
    const secure = configured({ BETTER_AUTH_URL: "https://studio.example.com", BETTER_AUTH_TRUSTED_ORIGINS: "https://other.example.com, https://studio.example.com:443/" });
    expect(run(secure.directory, ["--check"], "production").status).toBe(0);
    const insecure = configured({ BETTER_AUTH_URL: "http://studio.example.com", BETTER_AUTH_TRUSTED_ORIGINS: "http://studio.example.com" });
    expect(run(insecure.directory, ["--check"]).status).toBe(0);
    const result = run(insecure.directory, ["--check"], "production");
    expect(result.status).toBe(1);
    expect(result.output).toContain("Production requires HTTPS");
    const local = configured();
    expect(run(local.directory, ["--check"], "production").status).toBe(0);
  });
});
