import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { E2E_OWNER_AUTH_STATE_PATH } from "../support/e2e-auth-state";

setup("authenticate OWNER through the real login flow", async ({ page }) => {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD are required for E2E.");
  }

  await page.goto("/studio/login?returnTo=%2Fstudio%2Fdiagram");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/studio\/diagram$/);
  await expect(page.getByRole("heading", { name: "Thư viện quy trình" })).toBeVisible();

  await mkdir("playwright/.auth", { recursive: true });
  await page.context().storageState({ path: E2E_OWNER_AUTH_STATE_PATH });
});
