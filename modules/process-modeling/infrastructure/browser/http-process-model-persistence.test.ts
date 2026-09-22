import { afterEach, describe, expect, it, vi } from "vitest";
import { starterBpmnXml } from "../bpmn-io/starter-model";
import { httpProcessModelPersistence } from "./http-process-model-persistence";

const saveInput = {
  idempotencyKey: "save-model:logical-command-1",
  modelId: "model-1",
  revisionToken: "bpmn-revision-1",
  title: "Editorial review",
  description: "",
  purpose: "AS_IS" as const,
  xml: starterBpmnXml,
  source: "EDITED" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP process model persistence", () => {
  it("retains bounded save rejection codes and rule IDs, never arbitrary error text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "BPMN_INSPECTION_FAILED", message: "private server details", ruleIds: [
        "BPMN-PAR-002", "BPMN-PAR-002", "<script>alert(1)</script>", null, 123, "BPMN-PROFILE-005",
      ] },
    }), { status: 422 })));
    await expect(httpProcessModelPersistence.save(saveInput)).resolves.toEqual({
      kind: "rejected", code: "BPMN_INSPECTION_FAILED", ruleIds: ["BPMN-PAR-002", "BPMN-PROFILE-005"],
    });
  });

  it.each([null, [], { error: null }, { error: { code: "UNTRUSTED_SECRET", ruleIds: "BPMN-PAR-002" } }])(
    "fails safely for malformed rejection response %j", async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 400 })));
      await expect(httpProcessModelPersistence.save(saveInput)).resolves.toEqual({ kind: "rejected" });
    },
  );

  it("caps rejection diagnostics at 32 distinct bounded identifiers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "BPMN_INSPECTION_FAILED", ruleIds: Array.from({ length: 160 }, (_, index) => `BPMN-TEST-${String(index).padStart(3, "0")}`) },
    }), { status: 422 })));
    const result = await httpProcessModelPersistence.save(saveInput);
    expect(result.kind === "rejected" && result.ruleIds?.length).toBe(32);
  });

  it.each([[401, "unauthenticated"], [403, "unauthenticated"], [500, "unavailable"]] as const)(
    "keeps status %s behavior unchanged", async (status, kind) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "BPMN_INSPECTION_FAILED", ruleIds: ["BPMN-PAR-002"] } }), { status })));
      await expect(httpProcessModelPersistence.save(saveInput)).resolves.toEqual({ kind });
    },
  );

  it("lists models without opening or creating from list order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        models: [
          {
            id: "model-2",
            title: "Second model",
            purpose: "TO_BE",
            profileId: "teb-core-starter@1",
            revisionNumber: 3,
            versionCount: 1,
            updatedAt: "2026-07-30T04:00:00.000Z",
          },
          {
            id: "model-1",
            title: "First model",
            purpose: "AS_IS",
            profileId: "teb-core-starter@1",
            revisionNumber: 2,
            versionCount: 0,
            updatedAt: "2026-07-30T03:00:00.000Z",
          },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpProcessModelPersistence.listModels()).resolves.toEqual([
      expect.objectContaining({ id: "model-2", revisionNumber: 3 }),
      expect.objectContaining({ id: "model-1", revisionNumber: 2 }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/studio/process-models",
      { cache: "no-store" },
    );
  });

  it.each([
    {},
    { models: "not-an-array" },
    {
      models: [{
        id: "model-1",
        title: "Broken",
        purpose: "UNKNOWN",
        profileId: "teb-core-starter@1",
        revisionNumber: 1,
        versionCount: 0,
        updatedAt: "2026-07-30T03:00:00.000Z",
      }],
    },
    {
      models: [{
        id: "model-1",
        title: "Broken timestamp",
        purpose: "AS_IS",
        profileId: "teb-core-starter@1",
        revisionNumber: 1,
        versionCount: 0,
        updatedAt: "July 30, 2026",
      }],
    },
    {
      models: [
        {
          id: "model-1",
          title: "Duplicate",
          purpose: "AS_IS",
          profileId: "teb-core-starter@1",
          revisionNumber: 1,
          versionCount: 0,
          updatedAt: "2026-07-30T03:00:00.000Z",
        },
        {
          id: "model-1",
          title: "Duplicate again",
          purpose: "AS_IS",
          profileId: "teb-core-starter@1",
          revisionNumber: 1,
          versionCount: 0,
          updatedAt: "2026-07-30T03:00:00.000Z",
        },
      ],
    },
  ])("fails closed for an invalid model-list DTO: %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    await expect(httpProcessModelPersistence.listModels()).rejects.toThrow();
  });

  it("creates with the caller-owned key, then opens only the returned model identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        kind: "acknowledged",
        modelId: "model-created",
        revisionToken: "bpmn-revision-1",
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        title: "Explicit model",
        description: "A bounded Core model",
        purpose: "REFERENCE",
        profileId: "teb-core-starter@1",
        canonicalXml: starterBpmnXml,
        revisionToken: "bpmn-revision-1",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpProcessModelPersistence.createModel({
      idempotencyKey: "create-model:logical-command-1",
      title: "Explicit model",
      description: "A bounded Core model",
      purpose: "REFERENCE",
      xml: starterBpmnXml,
    })).resolves.toEqual(expect.objectContaining({
      modelId: "model-created",
      title: "Explicit model",
      purpose: "REFERENCE",
    }));

    const createInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(createInit.headers).get("Idempotency-Key")).toBe(
      "create-model:logical-command-1",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/v1/studio/process-models/model-created/draft",
    );
  });

  it("opens only the requested encoded model and rejects a malformed draft DTO", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        title: "Wrong shape",
        description: "",
        purpose: "AS_IS",
        profileId: "teb-core-starter@1",
        canonicalXml: starterBpmnXml,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      httpProcessModelPersistence.openModel("model/exact"),
    ).rejects.toThrow("Invalid process model draft.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/studio/process-models/model%2Fexact/draft",
      { cache: "no-store" },
    );
  });

  it("keeps model-scoped save keys and routes isolated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        kind: "acknowledged",
        revisionToken: "bpmn-revision-2",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await httpProcessModelPersistence.save(saveInput);
    await httpProcessModelPersistence.save({
      ...saveInput,
      modelId: "model-2",
      idempotencyKey: "save-model:model-2-command-1",
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/studio/process-models/model-1/draft",
      "/api/v1/studio/process-models/model-2/draft",
    ]);
    expect(fetchMock.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      return new Headers(init.headers).get("Idempotency-Key");
    })).toEqual([
      "save-model:logical-command-1",
      "save-model:model-2-command-1",
    ]);
  });

  it("forwards the same caller-owned idempotency key when a logical save is retried", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        kind: "idempotent",
        revisionToken: "bpmn-revision-2",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpProcessModelPersistence.save(saveInput)).rejects.toThrow();
    await expect(httpProcessModelPersistence.save(saveInput)).resolves.toEqual({
      kind: "idempotent",
      revisionToken: "bpmn-revision-2",
    });
    expect(fetchMock.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      return new Headers(init.headers).get("Idempotency-Key");
    })).toEqual([
      "save-model:logical-command-1",
      "save-model:logical-command-1",
    ]);
  });

  it("fails closed when a successful response has an invalid acknowledgement shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    await expect(httpProcessModelPersistence.save(saveInput)).resolves.toEqual({
      kind: "unavailable",
    });
  });
});
