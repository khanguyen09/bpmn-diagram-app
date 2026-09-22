import { defineConfig, devices } from "@playwright/test";
import { readE2eDatastoreAuthority } from "./tests/support/e2e-datastore-guard";

const authority = readE2eDatastoreAuthority();
const baseURL = "http://127.0.0.1:3113";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/._*",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 300_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-performance" }],
  ],
  outputDir: "test-results/performance",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
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
      name: "auth-setup",
      testMatch: /e2e\/auth\.setup\.ts/,
      use: {
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "bpmn-performance-chromium",
      testMatch: /performance\/bpmn\/workspace\.performance\.pw\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: "playwright/.auth/owner.json",
      },
      dependencies: ["auth-setup"],
    },
  ],
});
