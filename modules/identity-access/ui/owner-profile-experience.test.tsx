import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, effects: [] as (() => unknown)[], get: vi.fn(), verify: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const index = h.cursor++; if (!(index in h.states)) h.states[index] = initial; return [h.states[index], (value: unknown) => { h.states[index] = typeof value === "function" ? value(h.states[index]) : value; }]; },
  useEffect: (effect: () => unknown) => { h.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../client", () => ({ getOwnerProfile: h.get, verifyOwnerTwoFactor: h.verify, updateOwnerProfile: vi.fn(), changeOwnerPassword: vi.fn(), revokeOwnerSession: vi.fn(), enableOwnerTwoFactor: vi.fn(), disableOwnerTwoFactor: vi.fn(), regenerateOwnerBackupCodes: vi.fn(), signOutOwner: vi.fn() }));
import { OwnerProfileExperience, sessionDeviceLabel } from "./owner-profile-experience";
const profile = { user: { id: "fixture", name: "Owner", email: "owner@example.invalid", image: null, twoFactorEnabled: false }, capabilities: { emailChange: false, passwordReset: false, avatarUpload: false }, sessions: { items: [{ id: "safe-id", createdAt: "2026-09-05T00:00:00Z", expiresAt: "2026-09-12T00:00:00Z", ipAddress: null, userAgent: "Mozilla/5.0 (Macintosh) Chrome/123.0.0.0", current: true }], total: 1, page: 1, pageSize: 20, totalPages: 1 } };
function tree() { h.cursor = 0; return OwnerProfileExperience(); }
function find(node: ReactNode, predicate: (e: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  return predicate(node) ? node : find(node.props.children as ReactNode, predicate);
}
beforeEach(() => { vi.clearAllMocks(); h.states = [profile, 1, 0, false, null, false]; h.cursor = 0; h.effects = []; });
it("shows honest account capabilities, friendly sessions and no delete action", () => {
  const html = renderToStaticMarkup(tree());
  expect(html).toContain("Chrome · macOS"); expect(html).not.toContain("Mozilla/5.0"); expect(html).toContain("Phiên hiện tại");
  expect(html).toContain("dịch vụ gửi email xác minh chưa được cấu hình"); expect(html).not.toContain("Xoá tài khoản");
  expect(sessionDeviceLabel(null)).toBe("Thiết bị không xác định");
});
it("hides sensitive stale panels after failed profile access", () => {
  h.states[4] = "Phiên đăng nhập đã hết hạn."; const html = renderToStaticMarkup(tree());
  expect(html).toContain("Tải lại tài khoản"); expect(html).not.toContain('id="security"'); expect(html).not.toContain("safe-id");
});
it("clamps the last session page after revocation", async () => {
  h.states[1] = 3; h.get.mockResolvedValue({ ok: true, data: profile }); tree(); h.effects[0](); await Promise.resolve();
  expect(h.states[1]).toBe(1);
});
it("requires saved recovery codes before enrollment verification and clears secrets on close", async () => {
  const node = find(tree(), (e) => typeof e.type === "function" && e.type.name === "TwoFactorPanel")!;
  const renderPanel = () => { h.cursor = 0; return (node.type as (props: Record<string, unknown>) => ReactNode)({ ...node.props, onSaved: vi.fn() }); };
  h.states = ["enable", { totpURI: "otpauth://totp/test?secret=FIXTURE", backupCodes: ["fixture-code"] }, null, "", "123456", false, false, null, null];
  const submit = async () => { const panel = renderPanel(); await (find(panel, (e) => e.type === "form")!.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} }); };
  await submit(); expect(h.verify).not.toHaveBeenCalled();
  h.states[5] = true; h.verify.mockResolvedValue({ ok: true, data: { status: true } }); await submit(); expect(h.verify).toHaveBeenCalledWith("123456");
  const dialog = find(renderPanel(), (e) => typeof e.props.onRequestClose === "function")!;
  (dialog.props.onRequestClose as () => void)(); expect(h.states.slice(0, 6)).toEqual([null, null, null, "", "", false]);
});
