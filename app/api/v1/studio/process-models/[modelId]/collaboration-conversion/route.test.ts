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
    convert: vi.fn(),
    parseStrongEtag: vi.fn(),
    readBody: vi.fn(),
    requireOwner: vi.fn(),
    requireOrigin: vi.fn(),
  };
});

vi.mock("@/modules/process-modeling/server", () => ({
  ProcessModelContractError: mocks.MockProcessModelContractError,
  convertOwnedCoreProcessModelToCollaboration: mocks.convert,
  parseStrongModelEtag: mocks.parseStrongEtag,
  readBoundedProcessModelBody: mocks.readBody,
}));

vi.mock("@/modules/identity-access/server", () => ({
  IdentityAccessError: mocks.MockIdentityAccessError,
  requireOwnerSession: mocks.requireOwner,
  requireTrustedMutationOrigin: mocks.requireOrigin,
}));

const candidate = {
  sourceProfileId: "teb-core-starter@1",
  profileId: "teb-collaboration-swimlane-layouts@1",
  orientation: "horizontal",
  title: "Editorial review",
  description: "",
  purpose: "AS_IS",
  xml: "<candidate />",
};

function request(headers: Record<string, string> = {}) {
  return new Request(
    "http://localhost/api/v1/studio/process-models/model-1/collaboration-conversion",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "if-match": '"bpmn-revision-4"',
        "idempotency-key": "convert-model:model-1:command-1",
        origin: "http://localhost",
        ...headers,
      },
      body: JSON.stringify(candidate),
    },
  );
}

describe("Core to Collaboration conversion API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseStrongEtag.mockReset();
    mocks.convert.mockReset();
    mocks.readBody.mockReset();
    mocks.requireOwner.mockReset();
    mocks.requireOrigin.mockReset();
    mocks.requireOwner.mockResolvedValue({ userId: "owner-1" });
    mocks.readBody.mockResolvedValue(candidate);
  });

  it.each([
    ["acknowledged", 201],
    ["idempotent", 200],
  ] as const)(
    "returns the canonical %s acknowledgement only after the dedicated use case",
    async (kind, status) => {
      mocks.convert.mockResolvedValue({
        kind,
        revisionToken: "bpmn-revision-5",
        profileId: "teb-collaboration-swimlane-layouts@1",
        canonicalXml: "<server-canonical />",
        inspection: {
          safeToPersist: true,
          readyToSeal: false,
          ruleIds: [],
        },
      });
      const { POST } = await import("./route");
      const response = await POST(request(), {
        params: Promise.resolve({ modelId: "model-1" }),
      });

      expect(response.status).toBe(status);
      expect(response.headers.get("etag")).toBe('"bpmn-revision-5"');
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        kind,
        revisionToken: "bpmn-revision-5",
        profileId: "teb-collaboration-swimlane-layouts@1",
        canonicalXml: "<server-canonical />",
      });
      expect(mocks.requireOrigin).toHaveBeenCalledOnce();
      expect(mocks.requireOwner).toHaveBeenCalledOnce();
      expect(mocks.convert).toHaveBeenCalledWith({
        ownerId: "owner-1",
        modelId: "model-1",
        expectedRevisionToken: "bpmn-revision-4",
        idempotencyKey: "convert-model:model-1:command-1",
        candidate,
      });
    },
  );

  it("requires both a strong revision precondition and an idempotency key", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ "idempotency-key": "" }), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(428);
    expect(await response.json()).toEqual({
      error: { code: "MISSING_SAVE_PRECONDITION" },
    });
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it("fails closed when the revision precondition is not a strong model ETag", async () => {
    mocks.parseStrongEtag.mockImplementation(() => {
      throw new Error("weak or malformed ETag");
    });
    const { POST } = await import("./route");
    const response = await POST(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(428);
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it("maps authoritative CAS conflict without returning candidate XML", async () => {
    mocks.convert.mockResolvedValue({
      kind: "conflict",
      currentRevisionToken: "bpmn-revision-6",
    });
    const { POST } = await import("./route");
    const response = await POST(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "REVISION_CONFLICT" },
      currentRevisionToken: "bpmn-revision-6",
    });
  });

  it("returns only sanitized structural rule IDs when preservation fails", async () => {
    mocks.convert.mockRejectedValue(
      new mocks.MockProcessModelContractError("BPMN_INSPECTION_FAILED", [
        "BPMN-CONVERT-004",
        "BPMN-CONVERT-005",
      ]),
    );
    const { POST } = await import("./route");
    const response = await POST(request(), {
      params: Promise.resolve({ modelId: "model-1" }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "BPMN_INSPECTION_FAILED",
        ruleIds: ["BPMN-CONVERT-004", "BPMN-CONVERT-005"],
      },
    });
  });
});
