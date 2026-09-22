export class BoundedJsonError extends Error {
  constructor(readonly code: "INVALID_JSON" | "BODY_LIMIT_EXCEEDED") {
    super(code);
  }
}

export async function readBoundedJson(request: Request, maxBytes = 64_000) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new BoundedJsonError("BODY_LIMIT_EXCEEDED");
  }
  if (!request.body) throw new BoundedJsonError("INVALID_JSON");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BoundedJsonError("BODY_LIMIT_EXCEEDED");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new BoundedJsonError("INVALID_JSON");
  }
}
