import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });

test("native login fallback posts credentials without placing them in a URL", async ({
  context,
  page,
}) => {
  const emailSentinel = "native-fallback@example.invalid";
  const passwordSentinel = "native-fallback-password-sentinel";
  const signInRequests: string[] = [];

  page.on("request", (candidate) => {
    if (new URL(candidate.url()).pathname === "/api/auth/sign-in/email") {
      signInRequests.push(candidate.url());
    }
  });

  await page.goto("/studio/login?returnTo=%2Fstudio%2Farticles");
  await page.getByLabel("Email").fill(emailSentinel);
  await page.getByLabel("Mật khẩu").fill(passwordSentinel);

  const [request] = await Promise.all([
    page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return url.pathname === "/studio/login" && candidate.method() !== "GET";
    }),
    page.getByRole("button", { name: "Đăng nhập" }).click(),
  ]);

  expect(request.method()).toBe("POST");
  expect(request.headers()["content-type"]).toContain(
    "application/x-www-form-urlencoded",
  );

  const response = await request.response();
  expect(response?.status()).toBeGreaterThanOrEqual(200);
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { name: "Đăng nhập BPMN Studio" }),
  ).toBeVisible();
  expect(signInRequests).toEqual([]);
  expect(
    (await context.cookies()).filter((cookie) =>
      cookie.name.toLocaleLowerCase().includes("session"),
    ),
  ).toEqual([]);

  for (const rawUrl of [request.url(), page.url()]) {
    const url = new URL(rawUrl);
    expect(url.searchParams.has("email")).toBe(false);
    expect(url.searchParams.has("password")).toBe(false);
    expect(decodeURIComponent(url.href)).not.toContain(emailSentinel);
    expect(decodeURIComponent(url.href)).not.toContain(passwordSentinel);
  }
});
