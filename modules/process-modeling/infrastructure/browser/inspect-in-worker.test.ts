import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coreBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreEventRoutingBpmnProfile,
} from "../../domain/core-profile";
import { inspectBpmnXmlInWorker } from "./inspect-in-worker";

class FakeWorker {
  static latest: FakeWorker | undefined;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn();

  constructor() {
    FakeWorker.latest = this;
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeWorker.latest = undefined;
});

describe("BPMN inspection worker client", () => {
  it("terminates a worker that exceeds its deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
    });

    const pending = inspectBpmnXmlInWorker("<xml />", 25);
    const rejection = expect(pending).rejects.toThrow(
      "BPMN inspection timed out.",
    );
    await vi.advanceTimersByTimeAsync(26);
    await rejection;
    expect(FakeWorker.latest?.terminate).toHaveBeenCalledOnce();
  });

  it("terminates after returning a sanitized inspection result", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
    });

    const pending = inspectBpmnXmlInWorker("<xml />");
    FakeWorker.latest?.onmessage?.(
      new MessageEvent("message", {
        data: {
          accepted: false,
          profileId: coreBpmnProfile.id,
          issues: [],
          outline: [],
        },
      }),
    );

    await expect(pending).resolves.toMatchObject({ accepted: false });
    expect(FakeWorker.latest?.terminate).toHaveBeenCalledOnce();
  });

  it("passes the immutable Event Routing discriminator to the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
    });

    const pending = inspectBpmnXmlInWorker(
      "<xml />",
      coreEventRoutingBpmnProfile.id,
    );

    expect(FakeWorker.latest?.postMessage).toHaveBeenCalledWith({
      xml: "<xml />",
      profileId: coreEventRoutingBpmnProfile.id,
    });
    FakeWorker.latest?.onmessage?.(
      new MessageEvent("message", {
        data: {
          accepted: false,
          safeToPersist: false,
          readyToSeal: false,
          profileId: coreEventRoutingBpmnProfile.id,
          issues: [],
          outline: [],
        },
      }),
    );
    await pending;
  });

  it("passes the immutable Boundary Events discriminator to the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const pending = inspectBpmnXmlInWorker(
      "<xml />",
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(FakeWorker.latest?.postMessage).toHaveBeenCalledWith({
      xml: "<xml />",
      profileId: coreBoundaryEventsBpmnProfile.id,
    });
    FakeWorker.latest?.onmessage?.(
      new MessageEvent("message", {
        data: {
          accepted: false,
          safeToPersist: false,
          readyToSeal: false,
          profileId: coreBoundaryEventsBpmnProfile.id,
          issues: [],
          outline: [],
          messageRegistry: [],
        },
      }),
    );
    await pending;
  });
});
