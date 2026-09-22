import { beforeEach, describe, expect, it, vi } from "vitest";

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

const sealOwnedProcessModelVersion = vi.fn();

vi.mock("@/modules/process-modeling/server", () => ({
  ProcessModelContractError: MockProcessModelContractError,
  listOwnedProcessModelVersions: vi.fn(),
  parseStrongModelEtag: vi.fn(),
  readBoundedProcessModelBody: vi.fn().mockResolvedValue({ note: "Release" }),
  sealOwnedProcessModelVersion,
}));

vi.mock("@/modules/identity-access/server", () => ({
  IdentityAccessError: class MockIdentityAccessError extends Error {},
  requireOwnerSession: vi.fn().mockResolvedValue({ userId: "owner-1" }),
  requireTrustedMutationOrigin: vi.fn(),
}));

describe("process model version API", () => {
  beforeEach(() => {
    sealOwnedProcessModelVersion.mockReset();
  });

  it("returns a sanitized 422 when the exact revision is not ready", async () => {
    sealOwnedProcessModelVersion.mockRejectedValue(
      new MockProcessModelContractError("MODEL_NOT_READY", [
        "BPMN-CONNECT-001",
        "BPMN-NAME-001",
      ]),
    );
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/studio/process-models/model-1/versions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "seal-1",
          "if-match": '"bpmn-revision-2"',
          origin: "http://localhost",
        },
        body: JSON.stringify({ note: "Release" }),
      }),
      { params: Promise.resolve({ modelId: "model-1" }) },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "MODEL_NOT_READY",
        ruleIds: ["BPMN-CONNECT-001", "BPMN-NAME-001"],
      },
    });
  });
});
