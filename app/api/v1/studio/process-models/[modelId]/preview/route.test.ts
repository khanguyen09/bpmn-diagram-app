import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), preview: vi.fn() }));
vi.mock("@/modules/identity-access/server", () => ({ requireOwnerSession: mocks.owner, IdentityAccessError: class extends Error {} }));
vi.mock("@/modules/process-modeling/server", () => ({ getOwnedProcessModelPreview: mocks.preview }));
import { GET } from "./route";
const modelId = "30061788-3450-4b55-9d91-34f782bb8d28";
const versionId = "95392b9c-8ff6-42d3-a271-9f6eb2b55fa9";
const context = { params: Promise.resolve({ modelId }) };
beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ userId: "owner" }); });
it("reads current draft with authenticated owner and no cache", async () => {
  mocks.preview.mockResolvedValue({ canonicalXml: "<diagram />" });
  const response = await GET(new Request("http://localhost/preview"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.preview).toHaveBeenCalledWith("owner", modelId, undefined);
});
it("passes exact pinned version; missing version never falls back", async () => {
  mocks.preview.mockResolvedValue(null);
  const response = await GET(new Request(`http://localhost/preview?versionId=${versionId}`), context);
  expect(response.status).toBe(404);
  expect(mocks.preview).toHaveBeenCalledExactlyOnceWith("owner", modelId, versionId);
});
it("rejects malformed or empty pin", async () => {
  expect((await GET(new Request("http://localhost/preview?versionId="), context)).status).toBe(400);
  expect(mocks.preview).not.toHaveBeenCalled();
});
it("does not query diagrams when session check fails", async () => {
  mocks.owner.mockRejectedValue(new Error("denied"));
  await GET(new Request("http://localhost/preview"), context);
  expect(mocks.preview).not.toHaveBeenCalled();
});
