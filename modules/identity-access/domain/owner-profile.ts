import { z } from "zod";

export const ownerImageSchema = z.string().max(2048).url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}).nullable();
export const ownerProfileSchema = z.object({ name: z.string().trim().min(1).max(120), image: ownerImageSchema }).strict();
export const ownerPasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }).strict();
export const ownerPasswordProofSchema = z.object({ password: z.string().min(1).max(128) }).strict();
export const ownerEnrollmentVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/), recoveryCodesSaved: z.literal(true) }).strict();
export const ownerRevokeSchema = z.union([
  z.object({ sessionId: z.string().min(1).max(160) }).strict(),
  z.object({ others: z.literal(true) }).strict(),
]);

export function parseProfilePage(params: URLSearchParams) {
  const raw = params.get("page") ?? "1";
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > 10000) throw new Error("INVALID_PROFILE_QUERY");
  return Number(raw);
}
