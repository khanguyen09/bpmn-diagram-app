import { describe, expect, it } from "vitest";
import { findNonOverlappingPlacement } from "./bpmn-local-placement";

describe("findNonOverlappingPlacement", () => {
  it("keeps the preferred center when it is free", () => {
    expect(
      findNonOverlappingPlacement([], { width: 100, height: 80 }, { x: 300, y: 200 }),
    ).toEqual({ x: 300, y: 200 });
  });

  it("moves below an occupied preferred slot without moving existing geometry", () => {
    const occupied = [{ x: 250, y: 160, width: 100, height: 80 }];
    const snapshot = structuredClone(occupied);

    expect(
      findNonOverlappingPlacement(
        occupied,
        { width: 100, height: 80 },
        { x: 300, y: 200 },
      ),
    ).toEqual({ x: 300, y: 310 });
    expect(occupied).toEqual(snapshot);
  });

  it("searches a deterministic farther local slot in a dense branch", () => {
    const occupied = [
      { x: 250, y: 160, width: 100, height: 80 },
      { x: 250, y: 270, width: 100, height: 80 },
      { x: 250, y: 50, width: 100, height: 80 },
    ];

    expect(
      findNonOverlappingPlacement(
        occupied,
        { width: 100, height: 80 },
        { x: 300, y: 200 },
      ),
    ).toEqual({ x: 430, y: 200 });
  });
});
