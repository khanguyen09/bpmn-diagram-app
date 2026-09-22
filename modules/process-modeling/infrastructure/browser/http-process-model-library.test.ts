import { afterEach, describe, expect, it, vi } from "vitest";
import { httpProcessModelPersistence as client } from "./http-process-model-persistence";

afterEach(() => vi.unstubAllGlobals());
const model = { id: "model-1", title: "Diagram", purpose: "AS_IS", profileId: "teb-core-starter@1", revisionNumber: 12, versionCount: 0, updatedAt: "2026-09-05T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z", createdByName: "Author" };
function response(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch); return fetch;
}

describe("SDD59 library HTTP contracts", () => {
  it("loads a bounded page with actual creator and date", async () => {
    const fetch = response({ models: [model], total: 1, page: 1, pageSize: 9 });
    expect(await client.listModelsPage({ page: 1, pageSize: 9 })).toEqual({ models: [{ ...model, folderId: null, folderRevision: 0 }], total: 1, page: 1, pageSize: 9 });
    expect(fetch).toHaveBeenCalledWith("/api/v1/studio/process-models?page=1&pageSize=9", { cache: "no-store" });
  });
  it.each([
    { models: [model, model], total: 2, page: 1, pageSize: 9 },
    { models: [{ ...model, createdAt: "invalid" }], total: 1, page: 1, pageSize: 9 },
    { models: [{ ...model, createdByName: null }], total: 1, page: 1, pageSize: 9 },
    { models: [model], total: 0, page: 1, pageSize: 9 },
    { models: [model], total: 1, page: 5, pageSize: 9 },
  ])("rejects malformed page metadata", async (body) => {
    response(body); await expect(client.listModelsPage({ page: 1, pageSize: 9 })).rejects.toThrow();
  });
  it("uses the existing base36 strong revision token when archiving", async () => {
    const fetch = response({ kind: "archived" });
    expect(await client.archiveModel({ modelId: "model-1", expectedRevisionNumber: 12 })).toEqual({ kind: "archived" });
    expect(fetch).toHaveBeenCalledWith("/api/v1/studio/process-models/model-1", { method: "DELETE", headers: { "If-Match": '"bpmn-revision-c"' } });
  });
  it.each([
    [200, { kind: "already-archived" }, { kind: "already-archived" }],
    [409, { kind: "in-use" }, { kind: "in-use" }],
    [409, { kind: "conflict", currentRevisionNumber: 13 }, { kind: "conflict", currentRevisionNumber: 13 }],
    [404, { kind: "not-found" }, { kind: "not-found" }],
    [401, {}, { kind: "unauthenticated" }],
    [403, {}, { kind: "unauthenticated" }],
    [500, {}, { kind: "unavailable" }],
    [200, {}, { kind: "unavailable" }],
  ] as const)("maps archive status %s without optimistic success", async (status, body, expected) => {
    response(body, status);
    expect(await client.archiveModel({ modelId: "model-1", expectedRevisionNumber: 12 })).toEqual(expected);
  });
});


it("sends folder filter and validates organization revision", async () => {
  const folderId = "10000000-0000-4000-8000-000000000001";
  const fetch = response({ models: [{ ...model, folderId, folderRevision: 3 }], total: 1, page: 1, pageSize: 9 });
  expect((await client.listModelsPage({ page: 1, pageSize: 9, folderId })).models[0]).toMatchObject({ folderId, folderRevision: 3 });
  expect(fetch.mock.calls[0][0]).toContain(`folderId=${folderId}`);
  response({ models: [{ ...model, folderId: "invalid" }], total: 1, page: 1, pageSize: 9 });
  await expect(client.listModelsPage({ page: 1, pageSize: 9 })).rejects.toThrow("Invalid folder membership");
});
