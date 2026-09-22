import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  class AccessError extends Error { constructor(readonly code: string) { super(code); } }
  class ContractError extends Error {}
  return { owner: vi.fn(), origin: vi.fn(), list: vi.fn(), create: vi.fn(), rename: vi.fn(), remove: vi.fn(), move: vi.fn(), AccessError, ContractError };
});
vi.mock("@/modules/identity-access/server", () => ({ IdentityAccessError: mocks.AccessError, requireOwnerSession: mocks.owner, requireTrustedMutationOrigin: mocks.origin }));
vi.mock("@/modules/process-modeling/server", () => ({ ProcessModelContractError: mocks.ContractError, listOwnedModelFolders: mocks.list, createOwnedModelFolder: mocks.create, renameOwnedModelFolder: mocks.rename, deleteOwnedModelFolder: mocks.remove, moveOwnedModelsToFolder: mocks.move, readBoundedProcessModelBody: (request: Request) => request.json() }));
import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[folderId]/route";
import { POST as MOVE } from "../process-models/folder-moves/route";
const context = { params: Promise.resolve({ folderId: "folder" }) };
const request = (method: string) => new Request("http://localhost/api/v1/studio/process-model-folders", { method, headers: { Origin: "http://localhost", "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify({ name: "Tickets", expectedRevision: 0 }) } : {}) });
const commands = [
  { name: "create", method: "POST", call: (req: Request) => POST(req), mock: mocks.create },
  { name: "rename", method: "PATCH", call: (req: Request) => PATCH(req, context), mock: mocks.rename },
  { name: "delete", method: "DELETE", call: (req: Request) => DELETE(req, context), mock: mocks.remove },
  { name: "move", method: "POST", call: (req: Request) => MOVE(req), mock: mocks.move },
];
beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ userId: "owner" }); mocks.list.mockResolvedValue([]); for (const command of commands) command.mock.mockResolvedValue({ kind: "saved" }); });
describe("owner-scoped folder API", () => {
  it("returns private owner folder list", async () => {
    const result = await GET(request("GET")); expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store"); expect(mocks.list).toHaveBeenCalledWith("owner");
  });
  it.each(commands)("$name requires origin and owner before mutation", async command => {
    const result = await command.call(request(command.method)); expect(result.status).toBe(200);
    expect(mocks.origin).toHaveBeenCalledOnce(); expect(mocks.owner).toHaveBeenCalledOnce();
    expect(command.mock.mock.calls[0][0]).toBe("owner");
  });
  it.each(commands)("$name rejects untrusted origin without writing", async command => {
    mocks.origin.mockImplementation(() => { throw new mocks.AccessError("FORBIDDEN"); });
    expect((await command.call(request(command.method))).status).toBe(403);
    expect(command.mock).not.toHaveBeenCalled(); expect(mocks.owner).not.toHaveBeenCalled();
  });
  it.each(commands)("$name rejects missing identity without writing", async command => {
    mocks.owner.mockRejectedValue(new mocks.AccessError("UNAUTHENTICATED"));
    expect((await command.call(request(command.method))).status).toBe(401); expect(command.mock).not.toHaveBeenCalled();
  });
  it.each([["not-found", 404], ["conflict", 409], ["duplicate", 409], ["limit", 409]] as const)("preserves %s response", async (kind, status) => {
    mocks.create.mockResolvedValue({ kind }); expect((await POST(request("POST"))).status).toBe(status);
  });
});
