import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ pathname: "/studio/diagram" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
import { isBpmnFocusWorkspacePath, SiteShell } from "./site-shell";

describe("Standalone Studio navigation", () => {
  it("exposes the library and account with no dead CMS destinations", () => {
    state.pathname = "/studio/diagram";
    const html = renderToStaticMarkup(<SiteShell studio><p>Library</p></SiteShell>);
    expect(html).toContain('href="/studio/diagram"');
    expect(html).toContain('href="/studio/profile"');
    expect(html).not.toMatch(/href="\/(articles|subscriptions|studio\/(articles|editor|taxonomy|newsletters|subscribers))/);
    expect(html).toContain('aria-current="page"');
  });
  it("retains the full focused canvas only on valid diagram routes", () => {
    state.pathname = "/studio/diagram/b6f0d914-5f64-43f6-8ee5-0b7a872496dd";
    const html = renderToStaticMarkup(<SiteShell studio><p>Canvas</p></SiteShell>);
    expect(html).toContain("main-content--focus");
    expect(html).not.toContain('id="primary-navigation"');
    expect(isBpmnFocusWorkspacePath("/studio/diagram/new")).toBe(false);
    expect(isBpmnFocusWorkspacePath("/studio/diagram")).toBe(false);
  });
});
