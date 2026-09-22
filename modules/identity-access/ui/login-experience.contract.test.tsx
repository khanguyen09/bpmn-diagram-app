import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { LoginExperience } from "./login-experience";

describe("LoginExperience native fallback contract", () => {
  it("fails closed through an explicit POST when JavaScript is unavailable", () => {
    const html = renderToStaticMarkup(<LoginExperience />);

    expect(html).toContain('action="/studio/login"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain('method="get"');
  });
});
