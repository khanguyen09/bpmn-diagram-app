import { afterEach, describe, expect, it, vi } from "vitest";
import { coreBpmnProfile } from "../../domain/core-profile";
import { httpProcessModelPersistence } from "./http-process-model-persistence";

const conversionInput = {
  idempotencyKey: "convert-model:model-1:command-1",
  modelId: "model/1",
  revisionToken: "bpmn-revision-4",
  sourceProfileId: coreBpmnProfile.id,
  orientation: "horizontal" as const,
  title: "Editorial review",
  description: "Current workflow",
  purpose: "AS_IS" as const,
  xml: "<canonical-candidate />",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP Core to Collaboration conversion", () => {
  it("posts the explicit conversion intent and returns the canonical acknowledgement", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      kind: "acknowledged",
      revisionToken: "bpmn-revision-5",
      profileId: "teb-collaboration-swimlane-layouts@1",
      canonicalXml: "<server-canonical />",
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      httpProcessModelPersistence.convertCoreToCollaboration(conversionInput),
    ).resolves.toEqual({
      kind: "acknowledged",
      revisionToken: "bpmn-revision-5",
      profileId: "teb-collaboration-swimlane-layouts@1",
      canonicalXml: "<server-canonical />",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "/api/v1/studio/process-models/model%2F1/collaboration-conversion",
    );
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("If-Match")).toBe('"bpmn-revision-4"');
    expect(headers.get("Idempotency-Key")).toBe(
      "convert-model:model-1:command-1",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      sourceProfileId: coreBpmnProfile.id,
      orientation: "horizontal",
      title: "Editorial review",
      description: "Current workflow",
      purpose: "AS_IS",
      profileId: "teb-collaboration-swimlane-layouts@1",
      xml: "<canonical-candidate />",
    });
  });

  it("maps an authoritative CAS conflict without treating it as acknowledgement", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "REVISION_CONFLICT" },
      currentRevisionToken: "bpmn-revision-6",
    }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })));

    await expect(
      httpProcessModelPersistence.convertCoreToCollaboration(conversionInput),
    ).resolves.toEqual({
      kind: "conflict",
      currentRevisionToken: "bpmn-revision-6",
    });
  });

  it.each([
    {},
    {
      kind: "acknowledged",
      revisionToken: "bpmn-revision-5",
      profileId: "teb-core-starter@1",
      canonicalXml: "<server-canonical />",
    },
    {
      kind: "acknowledged",
      revisionToken: "not-a-token",
      profileId: "teb-collaboration-swimlane-layouts@1",
      canonicalXml: "<server-canonical />",
    },
  ])("fails closed for malformed successful DTO %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify(body),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    await expect(
      httpProcessModelPersistence.convertCoreToCollaboration(conversionInput),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("does not send a request without a logical idempotency key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      httpProcessModelPersistence.convertCoreToCollaboration({
        ...conversionInput,
        idempotencyKey: "",
      }),
    ).resolves.toEqual({ kind: "rejected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


it("sends and verifies capability-preserving target for subprocess timers", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: "acknowledged", revisionToken: "bpmn-revision-5", profileId: "teb-collaboration-subprocess-timers@1", canonicalXml: "<server-canonical />" }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await httpProcessModelPersistence.convertCoreToCollaboration({ ...conversionInput, sourceProfileId: "teb-core-subprocess-timers@1" });
  expect(result).toMatchObject({kind: "acknowledged", profileId: "teb-collaboration-subprocess-timers@1"});
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).profileId).toBe("teb-collaboration-subprocess-timers@1");
});
