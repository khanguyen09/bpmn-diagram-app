import { describe, expect, it } from "vitest";

import { BoundedJsonError, readBoundedJson } from "./read-bounded-json";

describe("readBoundedJson", () => {
  it("parses a valid JSON body within the byte budget", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ title: "Café" }),
    });

    await expect(readBoundedJson(request, 64)).resolves.toEqual({ title: "Café" });
  });

  it("rejects an oversized streamed body even without content-length", async () => {
    const encoder = new TextEncoder();
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"value":"'));
          controller.enqueue(encoder.encode("x".repeat(32)));
          controller.enqueue(encoder.encode('"}'));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);

    await expect(readBoundedJson(request, 16)).rejects.toEqual(
      expect.objectContaining<Partial<BoundedJsonError>>({
        code: "BODY_LIMIT_EXCEEDED",
      }),
    );
  });

  it("rejects malformed JSON and invalid UTF-8", async () => {
    const malformed = new Request("http://localhost/test", {
      method: "POST",
      body: '{"value":',
    });
    const invalidUtf8 = new Request("http://localhost/test", {
      method: "POST",
      body: new Uint8Array([0xc3, 0x28]),
    });

    await expect(readBoundedJson(malformed)).rejects.toEqual(
      expect.objectContaining<Partial<BoundedJsonError>>({ code: "INVALID_JSON" }),
    );
    await expect(readBoundedJson(invalidUtf8)).rejects.toEqual(
      expect.objectContaining<Partial<BoundedJsonError>>({ code: "INVALID_JSON" }),
    );
  });
});
