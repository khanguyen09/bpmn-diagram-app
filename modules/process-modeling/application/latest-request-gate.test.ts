import { describe, expect, it } from "vitest";
import { LatestRequestGate } from "./latest-request-gate";

describe("LatestRequestGate", () => {
  it("rejects a slower result after a newer inspection starts", () => {
    const gate = new LatestRequestGate();
    const older = gate.next();
    const newer = gate.next();

    expect(gate.isLatest(older)).toBe(false);
    expect(gate.isLatest(newer)).toBe(true);
  });

  it("invalidates in-flight projection when import starts", () => {
    const gate = new LatestRequestGate();
    const projection = gate.next();
    gate.invalidate();

    expect(gate.isLatest(projection)).toBe(false);
  });
});
