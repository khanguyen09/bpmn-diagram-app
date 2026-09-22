import { describe, expect, it } from "vitest";
import {
  defaultStudioReturnTo,
  resolveStudioReturnTo,
} from "./studio-return-to";

describe("Studio return-to policy", () => {
  it.each([
    "/studio/diagram",
    "/studio/profile",
    "/studio/diagram/b6f0d914-5f64-43f6-8ee5-0b7a872496dd",
    "/studio/diagram?query=domain%20design",
  ])("keeps an allowed local Studio destination: %s", (returnTo) => {
    expect(resolveStudioReturnTo(returnTo)).toBe(returnTo);
  });

  it.each([
    "/studio/articles",
    "/studio/editor/new",
    "/studio/diagram/process-1",
    undefined,
    null,
    "",
    ["/studio/editor"],
    "/studio",
    "/",
    "https://evil.example/studio/diagram",
    "//evil.example/studio/diagram",
    "/studio/login",
    "/studio/login?returnTo=/studio/editor",
    "/studio/login/callback",
    "/studio/../public",
    "/studio/%2e%2e/public",
    "/studio/%252e%252e/public",
    "/studio/%6cogin",
    "/studio/%256cogin",
    "/studio\\..\\public",
    "/studio/%5c%5cevil.example",
    "/studio/%255c%255cevil.example",
    "/studio/diagram\u0000",
    "/studio/diagram\u0085",
    "/studio/diagram%0aLocation:%20https://evil.example",
    "/studio/diagram%C2%85",
    "/studio/diagram%250d%250aLocation:%20https://evil.example",
    "/studio/diagram%",
  ])("falls back for an unsafe destination: %j", (returnTo) => {
    expect(resolveStudioReturnTo(returnTo)).toBe(defaultStudioReturnTo);
  });
});
