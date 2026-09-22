import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  class AccessError extends Error { constructor(readonly code: string) { super(code); } }
  return { archive: vi.fn(), owner: vi.fn(), origin: vi.fn(), AccessError };
});
vi.mock("@/modules/process-modeling/server", async () => {
  const tokens = await import("@/modules/process-modeling/domain/model-revision-token");
  return { archiveOwnedProcessModel: mocks.archive, parseStrongModelEtag: tokens.parseStrongModelEtag };
});
vi.mock("@/modules/identity-access/server", () => ({ IdentityAccessError: mocks.AccessError, requireOwnerSession: mocks.owner, requireTrustedMutationOrigin: mocks.origin }));
import { DELETE } from "./route";

describe("SDD59 archive API", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ userId: "owner" }); mocks.archive.mockResolvedValue({ kind: "archived" }); });
  function request(etag = '"bpmn-revision-c"') { return new Request("http://localhost/api/v1/studio/process-models/model", { method: "DELETE", headers: { "if-match": etag, origin: "http://localhost" } }); }
  it("requires owner, trusted origin and exact revision", async () => {
    const result = await DELETE(request(), { params: Promise.resolve({ modelId: "model" }) });
    expect(result.status).toBe(200);
    expect(mocks.archive).toHaveBeenCalledWith("owner", "model", 12);
    expect(mocks.owner).toHaveBeenCalled(); expect(mocks.origin).toHaveBeenCalled();
  });
  it.each(["", "*", "12", 'W/"bpmn-revision-c"'])("rejects unsafe precondition %s", async (etag) => {
    expect((await DELETE(request(etag), { params: Promise.resolve({ modelId: "model" }) })).status).toBe(428);
    expect(mocks.archive).not.toHaveBeenCalled();
  });
  it.each(["UNAUTHENTICATED", "FORBIDDEN"])("does not archive unauthorized requests", async (code) => {
    mocks.owner.mockRejectedValue(new mocks.AccessError(code));
    expect((await DELETE(request(), { params: Promise.resolve({ modelId: "model" }) })).status).toBe(code === "UNAUTHENTICATED" ? 401 : 403);
    expect(mocks.archive).not.toHaveBeenCalled();
  });
  it.each([["in-use", 409], ["conflict", 409], ["not-found", 404], ["already-archived", 200]] as const)("maps %s safely", async (kind, status) => {
    mocks.archive.mockResolvedValue({ kind });
    expect((await DELETE(request(), { params: Promise.resolve({ modelId: "model" }) })).status).toBe(status);
  });
});
