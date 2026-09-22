import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./server-env";

const valid = {
  NODE_ENV: "production" as const,
  DATABASE_URL: "postgresql://fixture:fixture@localhost/fixture",
  BETTER_AUTH_SECRET: "test-only-not-a-production-secret-123456",
  BETTER_AUTH_URL: "https://blogs.mindtheoperation.com",
  BETTER_AUTH_TRUSTED_ORIGINS: " https://blogs.mindtheoperation.com/ ",
};

describe("authentication deployment origins", () => {
  it("normalizes trusted origins for exact mutation checks", () => {
    expect(parseServerEnv(valid).BETTER_AUTH_TRUSTED_ORIGINS).toBe(valid.BETTER_AUTH_URL);
  });
  it.each(["http://blogs.mindtheoperation.com", "https://example.com/studio", "https://user:password@example.com", "https://example.com?x=1", "https://example.com#x", "*"])("rejects unsafe production origin %s", (origin) => {
    expect(() => parseServerEnv({ ...valid, BETTER_AUTH_URL: origin, BETTER_AUTH_TRUSTED_ORIGINS: origin })).toThrow();
  });
  it("requires its own base origin and rejects empty list entries", () => {
    expect(() => parseServerEnv({ ...valid, BETTER_AUTH_TRUSTED_ORIGINS: "https://other.example.com" })).toThrow();
    expect(() => parseServerEnv({ ...valid, BETTER_AUTH_TRUSTED_ORIGINS: `${valid.BETTER_AUTH_URL},` })).toThrow();
  });
  it("supports HTTP loopback for isolated production-mode browser tests", () => {
    expect(parseServerEnv({ ...valid, BETTER_AUTH_URL: "http://127.0.0.1:3113", BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3113" }).BETTER_AUTH_URL).toBe("http://127.0.0.1:3113");
  });
});
