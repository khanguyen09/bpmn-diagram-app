import { defineConfig, devices } from "@playwright/test";
import { readE2eDatastoreAuthority } from "./tests/support/e2e-datastore-guard";

const authority = readE2eDatastoreAuthority();
const baseURL = "http://127.0.0.1:3113";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/._*",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    // A hidden or stale control should fail locally, not consume a whole journey.
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec tsx scripts/start-e2e-server.ts",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: authority.connectionString,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_TRUSTED_ORIGINS: baseURL,
    },
  },
  projects: [
    {
      name: "auth-no-js",
      testMatch: /auth-native-fallback\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        javaScriptEnabled: false,
      },
    },
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        storageState: "playwright/.auth/owner.json",
      },
      dependencies: ["auth-no-js", "auth-setup"],
      testIgnore: [
        "**/._*",
        /auth-native-fallback\.spec\.ts/,
        /mobile\.spec\.ts/,
      ],
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        storageState: "playwright/.auth/owner.json",
      },
      dependencies: ["auth-setup"],
      testMatch: /mobile\.spec\.ts/,
      testIgnore: ["**/._*", /auth-native-fallback\.spec\.ts/],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 900 },
        storageState: "playwright/.auth/owner.json",
      },
      dependencies: ["auth-setup"],
      testIgnore: [
        "**/._*",
        /auth-native-fallback\.spec\.ts/,
        /mobile\.spec\.ts/,
      ],
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 900 },
        storageState: "playwright/.auth/owner.json",
      },
      dependencies: ["auth-setup"],
      testIgnore: [
        "**/._*",
        /auth-native-fallback\.spec\.ts/,
        /mobile\.spec\.ts/,
      ],
    },
  ],
});
