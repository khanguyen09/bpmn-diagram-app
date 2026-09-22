import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockProcessModelContractError extends Error {
    constructor(
      readonly code:
        | "INVALID_MODEL"
        | "BPMN_LIMIT_EXCEEDED"
        | "BPMN_INSPECTION_FAILED"
        | "MODEL_NOT_READY",
      readonly ruleIds: readonly string[] = [],
    ) {
      super(code);
    }
  }
  class MockIdentityAccessError extends Error {
    constructor(readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
      super(code);
    }
  }
  return {
    MockProcessModelContractError,
    MockIdentityAccessError,
    getDraft: vi.fn(),
    parseStrongEtag: vi.fn(),
    readBody: vi.fn(),
    saveDraft: vi.fn(),
    requireOwner: vi.fn(),
    requireOrigin: vi.fn(),
  };
});

vi.mock("@/modules/process-modeling/server", () => ({
  ProcessModelContractError: mocks.MockProcessModelContractError,
  getOwnedProcessModelDraft: mocks.getDraft,
  parseStrongModelEtag: mocks.parseStrongEtag,
  readBoundedProcessModelBody: mocks.readBody,
  saveOwnedProcessModelDraft: mocks.saveDraft,
}));

vi.mock("@/modules/identity-access/server", () => ({
  IdentityAccessError: mocks.MockIdentityAccessError,
  requireOwnerSession: mocks.requireOwner,
  requireTrustedMutationOrigin: mocks.requireOrigin,
}));

const candidate = {
  title: "Editorial review",
  description: "",
  purpose: "AS_IS",
  profileId: "teb-core-conditional@1",
  xml: "<candidate />",
  source: "EDITED",
};

function request() {
  return new Request(
    "http://localhost/api/v1/studio/process-models/model-1/draft",
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "if-match": '"bpmn-revision-1"',
        "idempotency-key": "save-command-1",
        origin: "http://localhost",
      },
      body: JSON.stringify(candidate),
    },
  );
}

describe("process model draft API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({ userId: "owner-1" });
    mocks.readBody.mockResolvedValue(candidate);
  });

  it("returns the original revision and ETag for an exact idempotent replay", async () => {
    const acknowledgement = {
      kind: "idempotent",
      modelId: "model-1",
      revisionId: "revision-2",
      revisionToken: "bpmn-revision-2",
      inspection: {
        safeToPersist: true,
        readyToSeal: true,
        ruleIds: [],
      },
    };
    mocks.saveDraft.mockResolvedValue(acknowledgement);
    const { PATCH } = await import("./route");
    const response = await PATCH(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"bpmn-revision-2"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(acknowledgement);
    expect(mocks.saveDraft).toHaveBeenCalledWith({
      ownerId: "owner-1",
      modelId: "model-1",
      expectedRevisionToken: "bpmn-revision-1",
      idempotencyKey: "save-command-1",
      candidate,
    });
  });

  it("maps a reused key with another command identity to a sanitized conflict", async () => {
    mocks.saveDraft.mockResolvedValue({ kind: "idempotency-mismatch" });
    const { PATCH } = await import("./route");
    const response = await PATCH(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  });

  it("maps a stale new command to the authoritative current revision", async () => {
    mocks.saveDraft.mockResolvedValue({
      kind: "conflict",
      currentRevisionToken: "bpmn-revision-3",
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "REVISION_CONFLICT" },
      currentRevisionToken: "bpmn-revision-3",
    });
  });

  it("returns only the bounded profile rule IDs when inspection fails", async () => {
    mocks.saveDraft.mockRejectedValue(
      new mocks.MockProcessModelContractError("BPMN_INSPECTION_FAILED", [
        "BPMN-PROFILE-005",
      ]),
    );
    const { PATCH } = await import("./route");
    const response = await PATCH(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "BPMN_INSPECTION_FAILED",
        ruleIds: ["BPMN-PROFILE-005"],
      },
    });
  });
});
