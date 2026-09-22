import { describe, expect, it } from "vitest";
import { buildE2eServerEnvironment } from "./e2e-server-environment";

describe("sanitized E2E web server environment", () => {
  it("preserves only explicit app runtime values and safe process metadata", () => {
    const environment = buildE2eServerEnvironment({
      DATABASE_URL:
        "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs_e2e_server",
      BETTER_AUTH_SECRET: "test-auth-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "http://127.0.0.1:3113",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3113",
      CI: "true",
      OWNER_EMAIL: "owner@example.test",
      OWNER_PASSWORD: "must-not-reach-the-web-child",
      E2E_DATABASE_URL: "must-not-reach-the-web-child",
      E2E_DATASTORE_MARKER: "must-not-reach-the-web-child",
      E2E_RUN_ID: "must-not-reach-the-web-child",
      GITHUB_TOKEN: "must-not-reach-the-web-child",
      TEST_DATABASE_URL: "must-not-reach-the-web-child",
    });

    expect(environment).toMatchObject({
      DATABASE_URL:
        "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs_e2e_server",
      BETTER_AUTH_SECRET: "test-auth-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "http://127.0.0.1:3113",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3113",
      CI: "true",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      __NEXT_PROCESSED_ENV: "true",
    });
    expect(environment).not.toHaveProperty("OWNER_EMAIL");
    expect(environment).not.toHaveProperty("OWNER_PASSWORD");
    expect(environment).not.toHaveProperty("E2E_DATABASE_URL");
    expect(environment).not.toHaveProperty("E2E_DATASTORE_MARKER");
    expect(environment).not.toHaveProperty("E2E_RUN_ID");
    expect(environment).not.toHaveProperty("GITHUB_TOKEN");
    expect(environment).not.toHaveProperty("TEST_DATABASE_URL");
  });

  it("fails closed without every required app runtime value", () => {
    expect(() =>
      buildE2eServerEnvironment({
        DATABASE_URL:
          "postgresql://e2e-user:e2e-password@127.0.0.1:5432/experience_blogs_e2e_server",
        BETTER_AUTH_URL: "http://127.0.0.1:3113",
        BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3113",
      }),
    ).toThrow("BETTER_AUTH_SECRET is required");
  });
});
