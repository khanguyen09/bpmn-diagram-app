import { describe, expect, it } from "vitest";
import {
  IdentityAccessError,
  requireOwner,
  requireTrustedOrigin,
} from "./require-owner";

describe("owner policy", () => {
  it("fails closed without an authenticated actor", () => {
    expect(() => requireOwner(null)).toThrowError(IdentityAccessError);
  });

  it("returns the server-owned owner projection", () => {
    const actor = {
      userId: "owner-1",
      email: "owner@example.com",
      name: "Owner",
      role: "OWNER" as const,
    };
    expect(requireOwner(actor)).toBe(actor);
  });

  it("requires an exact trusted origin for cookie-authenticated mutations", () => {
    expect(() =>
      requireTrustedOrigin("https://studio.example.com", [
        "https://studio.example.com",
      ]),
    ).not.toThrow();
    expect(() =>
      requireTrustedOrigin("https://evil.example.com", [
        "https://studio.example.com",
      ]),
    ).toThrowError(IdentityAccessError);
    expect(() =>
      requireTrustedOrigin(null, ["https://studio.example.com"]),
    ).toThrowError(IdentityAccessError);
  });
});
