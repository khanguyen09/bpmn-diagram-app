import { describe, expect, it } from "vitest";
import { bpmnElementColorPalette as canonicalBpmnElementColorPalette } from "../domain/full-authoring";
import {
  bpmnElementColorPalette,
  bpmnElementColorSelection,
  bpmnElementUsesStrokeOnly,
  nextBpmnElementColorIndex,
  supportsBpmnElementColor,
} from "./bpmn-element-colors";

describe("BPMN element color presentation contract", () => {
  it("keeps a bounded canonical accessible palette", () => {
    expect(bpmnElementColorPalette).toHaveLength(6);
    for (const color of bpmnElementColorPalette) {
      expect(color.label.length).toBeGreaterThan(0);
      expect(color.fill).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.stroke).toMatch(/^#[0-9A-F]{6}$/);
      expect(bpmnElementColorSelection(color.fill, color.stroke)).toBe(
        color.id,
      );
    }
  });

  it("derives UI labels from the exact persisted XML allowlist", () => {
    expect(
      bpmnElementColorPalette.map(({ id, fill, stroke }) => ({
        id,
        fill,
        stroke,
      })),
    ).toEqual(canonicalBpmnElementColorPalette);
    expect(new Set(bpmnElementColorPalette.map((color) => color.label)).size)
      .toBe(bpmnElementColorPalette.length);
  });

  it("moves predictably through the two-column radio grid", () => {
    const count = bpmnElementColorPalette.length;

    expect(nextBpmnElementColorIndex(0, count, "ArrowRight")).toBe(1);
    expect(nextBpmnElementColorIndex(1, count, "ArrowDown")).toBe(3);
    expect(nextBpmnElementColorIndex(3, count, "ArrowUp")).toBe(1);
    expect(nextBpmnElementColorIndex(0, count, "ArrowLeft")).toBe(count - 1);
    expect(nextBpmnElementColorIndex(count - 1, count, "ArrowRight")).toBe(0);
    expect(nextBpmnElementColorIndex(4, count, "Home")).toBe(0);
    expect(nextBpmnElementColorIndex(1, count, "End")).toBe(count - 1);
    expect(nextBpmnElementColorIndex(0, 0, "ArrowRight")).toBe(-1);
  });

  it("limits fill for connectors and Group while excluding semantic roots", () => {
    expect(bpmnElementUsesStrokeOnly("bpmn:Association")).toBe(true);
    expect(bpmnElementUsesStrokeOnly("bpmn:Group")).toBe(true);
    expect(bpmnElementUsesStrokeOnly("bpmn:Task")).toBe(false);
    expect(supportsBpmnElementColor("bpmn:Process")).toBe(false);
    expect(supportsBpmnElementColor("bpmn:TextAnnotation")).toBe(true);
  });
});
