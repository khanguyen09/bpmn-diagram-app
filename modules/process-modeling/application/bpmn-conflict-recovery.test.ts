import { describe, expect, it } from "vitest";
import { recoveryCopyInput, recoverySnapshotFingerprint, type BpmnRecoverySnapshot } from "./bpmn-conflict-recovery";

const snapshot: BpmnRecoverySnapshot = { sequence: 3, title: "Quy trình mua vé", description: "Giữ vé", purpose: "AS_IS", profileId: "teb-core-full-authoring@1", xml: "<definitions />" };

describe("conflict recovery snapshots", () => {
  it("copies all recoverable content without carrying an original model ID or revision", () => {
    expect(recoveryCopyInput(snapshot, "retry-key")).toEqual({ title: "Quy trình mua vé — bản khôi phục", description: snapshot.description, purpose: snapshot.purpose, profileId: snapshot.profileId, xml: snapshot.xml, idempotencyKey: "retry-key" });
  });
  it.each(["x".repeat(180), "🎟".repeat(90), "x".repeat(163) + "🎟".repeat(8)])("keeps a valid source title within the server's 180 UTF-16 unit limit", (title) => {
    const copy = recoveryCopyInput({ ...snapshot, title }, "key");
    expect(copy.title.length).toBeLessThanOrEqual(180);
    expect(copy.title.endsWith(" — bản khôi phục")).toBe(true);
    expect(copy.title.isWellFormed()).toBe(true);
  });
  it("invalidates preservation when any content or edit sequence changes", () => {
    const original = recoverySnapshotFingerprint(snapshot);
    for (const change of [{ sequence: 4 }, { title: "Khác" }, { description: "Mới" }, { purpose: "TO_BE" as const }, { profileId: "other" }, { xml: "<changed />" }]) {
      expect(recoverySnapshotFingerprint({ ...snapshot, ...change })).not.toBe(original);
    }
    expect(recoverySnapshotFingerprint({ ...snapshot })).toBe(original);
  });
});
