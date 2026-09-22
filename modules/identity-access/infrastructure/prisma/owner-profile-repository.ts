import { getPrisma } from "@/platform/database/client";
import { ownerImageSchema } from "../../domain/owner-profile";

export async function readOwnerProfile(userId: string, currentSessionId: string, page: number) {
  const prisma = getPrisma();
  const where = { userId, expiresAt: { gt: new Date() } };
  const [user, total, sessions] = await prisma.$transaction([
    prisma.user.findFirstOrThrow({ where: { id: userId, role: "OWNER" }, select: { id: true, name: true, email: true, image: true, twoFactorEnabled: true } }),
    prisma.session.count({ where }),
    prisma.session.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20,
      select: { id: true, createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
  ], { isolationLevel: "RepeatableRead" });
  return {
    user: { ...user, image: ownerImageSchema.safeParse(user.image).success ? user.image : null },
    capabilities: { emailChange: false as const, passwordReset: false as const, avatarUpload: false as const },
    sessions: { items: sessions.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), current: row.id === currentSessionId })), total, page, pageSize: 20, totalPages: Math.ceil(total / 20) },
  };
}

export async function findOwnedSessionToken(userId: string, sessionId: string) {
  return getPrisma().session.findFirst({ where: { id: sessionId, userId }, select: { token: true } });
}
