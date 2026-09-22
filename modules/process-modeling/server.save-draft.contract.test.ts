import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ModelWriteResult,
  ProcessModelDraftProjection,
} from "./application/ports/process-model-repository";
import {
  coreCatchingEventsBpmnProfile,
  coreConditionalBpmnProfile,
} from "./domain/core-profile";
import { starterBpmnXml } from "./infrastructure/bpmn-io/starter-model";

const repository = vi.hoisted(() => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock(
  "./infrastructure/prisma/prisma-process-model-repository",
  () => ({
    PrismaProcessModelRepository: class {
      readonly getDraft = repository.getDraft;
      readonly saveDraft = repository.saveDraft;
    },
  }),
);

import { saveOwnedProcessModelDraft } from "./server";

const currentDraft: ProcessModelDraftProjection = {
  modelId: "model-1",
  revisionId: "revision-3",
  revisionNumber: 3,
  title: "Editorial review",
  description: "",
  purpose: "AS_IS",
  profileId: coreCatchingEventsBpmnProfile.id,
  canonicalXml: starterBpmnXml,
  xmlChecksum: "c".repeat(64),
  updatedAt: new Date("2026-09-05T03:00:00.000Z"),
};

const acknowledgedDraft: ProcessModelDraftProjection = {
  ...currentDraft,
  revisionId: "revision-2",
  revisionNumber: 2,
  profileId: coreConditionalBpmnProfile.id,
  xmlChecksum: "b".repeat(64),
  updatedAt: new Date("2026-09-05T02:00:00.000Z"),
};

const conditionalCandidate = {
  title: "Editorial review",
  description: "",
  purpose: "AS_IS" as const,
  profileId: coreConditionalBpmnProfile.id,
  xml: starterBpmnXml,
  source: "EDITED" as const,
};

function saveInput(overrides: Partial<{
  expectedRevisionToken: string;
  idempotencyKey: string;
  candidate: typeof conditionalCandidate;
}> = {}) {
  return {
    ownerId: "owner-1",
    modelId: currentDraft.modelId,
    expectedRevisionToken: "bpmn-revision-1",
    idempotencyKey: "save-command-1",
    candidate: conditionalCandidate,
    ...overrides,
  };
}

afterEach(() => {
  repository.getDraft.mockReset();
  repository.saveDraft.mockReset();
});

describe("saveOwnedProcessModelDraft idempotency boundary", () => {
  it("returns the original acknowledgement for an exact retry after a later profile revision", async () => {
    repository.getDraft.mockResolvedValue(currentDraft);
    repository.saveDraft.mockResolvedValue({
      kind: "idempotent",
      draft: acknowledgedDraft,
    } satisfies ModelWriteResult);

    await expect(saveOwnedProcessModelDraft(saveInput())).resolves.toMatchObject({
      kind: "idempotent",
      modelId: currentDraft.modelId,
      revisionId: acknowledgedDraft.revisionId,
      revisionToken: "bpmn-revision-2",
    });
    expect(repository.saveDraft).toHaveBeenCalledOnce();
    expect(repository.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevisionNumber: 1,
      idempotencyKey: "save-command-1",
      content: expect.objectContaining({
        profileId: coreConditionalBpmnProfile.id,
      }),
    }));
  });

  it("returns an idempotency mismatch for a changed payload using the stale key", async () => {
    repository.getDraft.mockResolvedValue(currentDraft);
    repository.saveDraft.mockResolvedValue({
      kind: "idempotency-mismatch",
    } satisfies ModelWriteResult);

    await expect(saveOwnedProcessModelDraft(saveInput({
      candidate: {
        ...conditionalCandidate,
        title: "Changed editorial review",
      },
    }))).resolves.toEqual({ kind: "idempotency-mismatch" });
    expect(repository.saveDraft).toHaveBeenCalledOnce();
  });

  it("returns an idempotency mismatch when the same candidate and key use another precondition", async () => {
    repository.getDraft.mockResolvedValue(currentDraft);
    repository.saveDraft.mockResolvedValue({
      kind: "idempotency-mismatch",
    } satisfies ModelWriteResult);

    await expect(saveOwnedProcessModelDraft(saveInput({
      expectedRevisionToken: "bpmn-revision-2",
    }))).resolves.toEqual({ kind: "idempotency-mismatch" });
    expect(repository.saveDraft).toHaveBeenCalledOnce();
    expect(repository.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevisionNumber: 2,
      idempotencyKey: "save-command-1",
    }));
  });

  it("returns a revision conflict for a new stale key without widening the profile graph", async () => {
    repository.getDraft.mockResolvedValue(currentDraft);
    repository.saveDraft.mockResolvedValue({
      kind: "conflict",
      currentRevisionNumber: 3,
    } satisfies ModelWriteResult);

    await expect(saveOwnedProcessModelDraft(saveInput({
      idempotencyKey: "save-command-new",
    }))).resolves.toEqual({
      kind: "conflict",
      currentRevisionToken: "bpmn-revision-3",
    });
    expect(repository.saveDraft).toHaveBeenCalledOnce();
  });

  it("rejects a backward profile transition addressed to the current revision", async () => {
    repository.getDraft.mockResolvedValue(currentDraft);

    await expect(saveOwnedProcessModelDraft(saveInput({
      expectedRevisionToken: "bpmn-revision-3",
      idempotencyKey: "save-command-current",
    }))).rejects.toMatchObject({
      code: "BPMN_INSPECTION_FAILED",
      ruleIds: ["BPMN-PROFILE-005"],
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });
});
