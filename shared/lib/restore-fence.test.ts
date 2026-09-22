import { describe, expect, it, vi } from "vitest";
import { awaitRestoreResponse, createRestoreFence, type RestoreSnapshot } from "./restore-fence";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const original: RestoreSnapshot = { resourceId: "draft", sequence: 4, versionToken: "v4" };

describe("delayed restore replacement fence", () => {
  it("releases a hung request without applying its eventual late response", async () => {
    vi.useFakeTimers();
    try {
      const gate = createRestoreFence();
      const operation = gate.begin(original)!;
      const response = deferred<string>();
      const install = vi.fn();
      const completion = awaitRestoreResponse(response.promise).then(install).finally(operation.finish);
      const rejected = expect(completion).rejects.toThrow("RESTORE_RESPONSE_TIMEOUT");
      await vi.advanceTimersByTimeAsync(20_000);
      await rejected;
      expect(gate.pending).toBe(false);
      response.resolve("late server draft");
      await Promise.resolve();
      expect(install).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it.each(["acknowledged", "ambiguous-recovery"])("preserves later edits after %s", async (outcome) => {
    const gate = createRestoreFence();
    const operation = gate.begin(original)!;
    const mutation = deferred<string>();
    const recovery = deferred<string>();
    let current = original;
    let document = "local before restore";
    const install = vi.fn((value: string) => { document = value; });
    const completion = (async () => {
      try {
        let restored: string;
        try { restored = await mutation.promise; }
        catch { restored = await recovery.promise; }
        if (operation.canReplace(current)) install(restored);
      } finally { operation.finish(); }
    })();
    expect(gate.begin(original)).toBeNull();
    document = "new local edits";
    current = { ...original, sequence: 5 };
    if (outcome === "acknowledged") mutation.resolve("server restored draft");
    else { mutation.reject(new Error("response lost")); recovery.resolve("server restored draft"); }
    await completion;
    expect(document).toBe("new local edits");
    expect(install).not.toHaveBeenCalled();
    expect(gate.pending).toBe(false);
  });

  it("permits an unchanged acknowledgement but never reuses a completed operation", async () => {
    const gate = createRestoreFence();
    const operation = gate.begin(original)!;
    const response = deferred<void>();
    const reload = vi.fn();
    const completion = response.promise.then(() => {
      if (operation.canReplace(original)) reload();
    }).finally(operation.finish);
    response.resolve();
    await completion;
    expect(reload).toHaveBeenCalledOnce();
    expect(operation.canReplace(original)).toBe(false);
    const successor = gate.begin(original)!;
    operation.finish();
    expect(gate.pending).toBe(true);
    successor.finish();
  });

  it("keeps the original edit fence across an ambiguous retry and releases after failure", async () => {
    const gate = createRestoreFence();
    const first = gate.begin(original)!;
    const response = deferred<void>();
    const completion = response.promise.finally(first.finish);
    response.reject(new Error("connection lost"));
    await expect(completion).rejects.toThrow("connection lost");
    expect(gate.pending).toBe(false);
    const retry = gate.begin(original)!;
    expect(retry.canReplace({ ...original, sequence: 5 })).toBe(false);
    expect(retry.canReplace({ ...original, versionToken: "v5" })).toBe(false);
    expect(retry.canReplace({ ...original, resourceId: "other" })).toBe(false);
    retry.finish();
  });
});
