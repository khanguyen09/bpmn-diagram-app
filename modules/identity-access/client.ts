"use client";

import type { OwnerClientResult, OwnerProfile } from "./profile-contract";
export type { OwnerClientResult, OwnerProfile } from "./profile-contract";

async function requestOwner<T>(path: string, body?: unknown): Promise<OwnerClientResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(path, { method: body === undefined ? "GET" : "POST", signal: controller.signal, credentials: "same-origin", cache: "no-store", headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) return { ok: false, message: response.status === 429 ? "Có quá nhiều yêu cầu. Vui lòng đợi rồi thử lại." : response.status === 401 ? "Phiên đăng nhập hoặc thông tin xác thực chưa hợp lệ." : "Chưa thể hoàn tất. Hãy kiểm tra thông tin và thử lại." };
    return { ok: true, data: await response.json() as T };
  } catch { return { ok: false, message: "Không thể kết nối. Chưa xác nhận được kết quả; hãy kiểm tra lại trước khi thử lại." }; }
  finally { clearTimeout(timer); }
}

export async function signInOwner(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; secondFactorRequired: boolean } | { ok: false; message: string }> {
  const result = await requestOwner<{ twoFactorRedirect?: boolean }>("/api/auth/sign-in/email", input);
  if (!result.ok) return result;
  return { ok: true, secondFactorRequired: result.data.twoFactorRedirect === true };
}

export async function signOutOwner(): Promise<void> {
  const result = await requestOwner("/api/auth/sign-out", {});
  if (!result.ok) throw new Error(result.message);
}

export const getOwnerProfile = (page = 1) => requestOwner<OwnerProfile>(`/api/v1/studio/profile?page=${page}`);
export const updateOwnerProfile = (input: { name: string; image: string | null }) => requestOwner<{ status: true }>("/api/v1/studio/profile", input);
export const changeOwnerPassword = (input: { currentPassword: string; newPassword: string }) => requestOwner<{ status: true }>("/api/v1/studio/profile/password", input);
export const revokeOwnerSession = (input: { sessionId: string } | { others: true }) => requestOwner<{ status: true }>("/api/v1/studio/profile/sessions/revoke", input);
export const enableOwnerTwoFactor = (password: string) => requestOwner<{ totpURI: string; backupCodes: string[] }>("/api/v1/studio/profile/two-factor/enable", { password });
export const verifyOwnerTwoFactor = (code: string) => requestOwner<{ status: true }>("/api/v1/studio/profile/two-factor/verify", { code, recoveryCodesSaved: true });
export const disableOwnerTwoFactor = (password: string) => requestOwner<{ status: true }>("/api/v1/studio/profile/two-factor/disable", { password });
export const regenerateOwnerBackupCodes = (password: string) => requestOwner<{ backupCodes: string[] }>("/api/v1/studio/profile/two-factor/backup-codes", { password });
export const verifyOwnerSecondFactor = (input: { code: string; method: "totp" | "backup" }) => requestOwner<{ status: true }>(`/api/auth/two-factor/${input.method === "totp" ? "verify-totp" : "verify-backup-code"}`, { code: input.code, trustDevice: false });
export const cancelOwnerSecondFactor = () => requestOwner<{ status: true }>("/api/auth/two-factor/cancel", {});
