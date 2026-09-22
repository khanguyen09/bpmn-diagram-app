export type OwnerProfile = {
  user: { id: string; name: string; email: string; image: string | null; twoFactorEnabled: boolean };
  capabilities: { emailChange: false; passwordReset: false; avatarUpload: false };
  sessions: { items: { id: string; createdAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null; current: boolean }[]; total: number; page: number; pageSize: number; totalPages: number };
};
export type OwnerClientResult<T> = { ok: true; data: T } | { ok: false; message: string };
