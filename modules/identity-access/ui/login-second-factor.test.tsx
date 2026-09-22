import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, signIn: vi.fn(), verify: vi.fn(), cancel: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => { const index = h.cursor++; if (!(index in h.states)) h.states[index] = initial; return [h.states[index], (value: unknown) => { h.states[index] = value; }]; } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: h.replace, refresh: h.refresh }) }));
vi.mock("../client", () => ({ signInOwner: h.signIn, verifyOwnerSecondFactor: h.verify, cancelOwnerSecondFactor: h.cancel }));
import { LoginExperience } from "./login-experience";
function tree() { h.cursor = 0; return LoginExperience({ returnTo: "/studio/profile" }); }
function find(node: ReactNode, predicate: (e: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  return predicate(node) ? node : find(node.props.children as ReactNode, predicate);
}
async function submit() { await (find(tree(), (e) => e.type === "form")!.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {}, currentTarget: { reset() {} } }); }
beforeEach(() => { vi.clearAllMocks(); h.states = []; h.cursor = 0; vi.stubGlobal("FormData", class { get(key: string) { return key === "email" ? "fixture@example.invalid" : "fixture-password"; } }); });
afterEach(() => vi.unstubAllGlobals());
it("AC84-04 does not redirect after password when second factor is pending", async () => {
  h.signIn.mockResolvedValue({ ok: true, secondFactorRequired: true }); await submit();
  expect(h.replace).not.toHaveBeenCalled(); expect(h.states[2]).toBe("totp");
  expect(find(tree(), (e) => e.props.id === "login-second-factor")).toBeDefined();
});
it("redirects only after successful second-factor verification", async () => {
  h.states = [false, null, "totp", "123456"]; h.verify.mockResolvedValue({ ok: true, data: { status: true } }); await submit();
  expect(h.verify).toHaveBeenCalledWith({ code: "123456", method: "totp" }); expect(h.replace).toHaveBeenCalledWith("/studio/profile"); expect(h.states[3]).toBe("");
});
it("failed recovery challenge clears its code and stays unauthenticated", async () => {
  h.states = [false, null, "backup", "fixture-backup"]; h.verify.mockResolvedValue({ ok: false, message: "Mã chưa hợp lệ." }); await submit();
  expect(h.verify).toHaveBeenCalledWith({ code: "fixture-backup", method: "backup" }); expect(h.replace).not.toHaveBeenCalled(); expect(h.states[3]).toBe(""); expect(h.states[1]).toBe("Mã chưa hợp lệ.");
});
it("returns to credentials only after server acknowledges challenge cancellation", async () => {
  h.states = [false, null, "totp", "123456"];
  let resolve: (result: unknown) => void = () => {};
  h.cancel.mockReturnValue(new Promise((done) => { resolve = done; }));
  (find(tree(), (e) => e.props.children === "Quay lại đăng nhập")!.props.onClick as () => void)();
  expect(h.states[2]).toBe("totp"); expect(h.states[0]).toBe(true); expect(h.replace).not.toHaveBeenCalled();
  resolve({ ok: true, data: { status: true } }); await Promise.resolve();
  expect(h.states[2]).toBeNull(); expect(h.states[3]).toBe(""); expect(h.replace).not.toHaveBeenCalled();
});
it("keeps the challenge visible when cancellation fails", async () => {
  h.states = [false, null, "backup", "fixture"];
  h.cancel.mockResolvedValue({ ok: false, message: "Chưa huỷ được." });
  (find(tree(), (e) => e.props.children === "Quay lại đăng nhập")!.props.onClick as () => void)();
  await Promise.resolve(); expect(h.states[2]).toBe("backup"); expect(h.states[1]).toBe("Chưa huỷ được."); expect(h.replace).not.toHaveBeenCalled();
});
