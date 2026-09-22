import { afterEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  processModelCommandReceipt: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/platform/database", () => ({
  getPrisma: () => prisma,
}));

import { PrismaProcessModelRepository } from "./prisma-process-model-repository";

const content = {
  title: "Editorial review",
  description: "",
  purpose: "AS_IS" as const,
  profileId: "teb-core-starter@1",
  canonicalXml: "<canonical />",
  xmlChecksum: "a".repeat(64),
};

const revision = {
  id: "revision-2",
  processModelId: "model-1",
  revisionNumber: 2,
  ...content,
  createdAt: new Date("2026-09-05T02:00:00.000Z"),
};

function receipt(operation: string) {
  return {
    operation,
    requestHash: "same-request",
    expectedRevisionNumber: 1,
    revision,
    resultVersion: null,
  };
}

afterEach(() => {
  prisma.processModelCommandReceipt.findFirst.mockReset();
  prisma.$transaction.mockReset();
});

describe("Prisma process-model command receipt identity", () => {
  it("rejects a draft key reused with the same body but another precondition", async () => {
    prisma.processModelCommandReceipt.findFirst.mockResolvedValue(
      receipt("SAVE_DRAFT"),
    );
    const repository = new PrismaProcessModelRepository();

    await expect(repository.saveDraft({
      ownerId: "owner-1",
      modelId: "model-1",
      expectedRevisionNumber: 2,
      idempotencyKey: "command-1",
      requestHash: "same-request",
      source: "EDITED",
      content,
    })).resolves.toEqual({ kind: "idempotency-mismatch" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a milestone key reused with the same body but another precondition", async () => {
    prisma.processModelCommandReceipt.findFirst.mockResolvedValue(
      receipt("CREATE_VERSION"),
    );
    const repository = new PrismaProcessModelRepository();

    await expect(repository.createVersion({
      ownerId: "owner-1",
      modelId: "model-1",
      expectedRevisionNumber: 2,
      idempotencyKey: "command-1",
      requestHash: "same-request",
      note: "Release candidate",
      operation: "CREATE_VERSION",
    })).resolves.toEqual({ kind: "idempotency-mismatch" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a restore key reused with the same body but another precondition", async () => {
    prisma.processModelCommandReceipt.findFirst.mockResolvedValue(
      receipt("RESTORE_VERSION"),
    );
    const repository = new PrismaProcessModelRepository();

    await expect(repository.restoreVersion({
      ownerId: "owner-1",
      modelId: "model-1",
      versionId: "version-1",
      expectedRevisionNumber: 2,
      idempotencyKey: "command-1",
      requestHash: "same-request",
      operation: "RESTORE_VERSION",
    })).resolves.toEqual({ kind: "idempotency-mismatch" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("turns a cross-operation receipt race into an idempotency mismatch", async () => {
    prisma.processModelCommandReceipt.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(receipt("CREATE_VERSION"));
    prisma.$transaction.mockRejectedValueOnce(new Error("Unique constraint"));
    const repository = new PrismaProcessModelRepository();

    await expect(repository.saveDraft({
      ownerId: "owner-1",
      modelId: "model-1",
      expectedRevisionNumber: 1,
      idempotencyKey: "command-1",
      requestHash: "same-request",
      source: "EDITED",
      content,
    })).resolves.toEqual({ kind: "idempotency-mismatch" });
    expect(prisma.processModelCommandReceipt.findFirst).toHaveBeenCalledTimes(2);
  });
});
