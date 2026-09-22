import { describe, expect, it, vi } from "vitest";
import {
  bpmnToolPreferencesStorageKey,
  emptyBpmnToolPreferences,
  loadBpmnToolPreferences,
  maxBpmnToolPreferencesSerializedLength,
  maxFavoriteBpmnTools,
  maxRecentBpmnTools,
  parseBpmnToolPreferences,
  recordRecentBpmnTool,
  saveBpmnToolPreferences,
  toggleFavoriteBpmnTool,
  type BpmnToolId,
} from "./bpmn-tool-preferences";

const known = new Set<BpmnToolId>([
  "start-event",
  "end-event",
  "task",
  "exclusive-gateway",
  "sequence-flow",
]);

describe("BPMN tool presentation preferences", () => {
  it("loads only the versioned, known and bounded device-local shape", () => {
    expect(
      parseBpmnToolPreferences(
        JSON.stringify({
          version: 1,
          recentToolIds: ["task", "task", "start-event"],
          favoriteToolIds: ["end-event"],
        }),
        known,
      ),
    ).toEqual({
      version: 1,
      recentToolIds: ["task", "start-event"],
      favoriteToolIds: ["end-event"],
    });
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 2, recentToolIds: [], favoriteToolIds: [] }),
    JSON.stringify({
      version: 1,
      recentToolIds: ["unknown-tool"],
      favoriteToolIds: [],
    }),
    JSON.stringify({
      version: 1,
      recentToolIds: Array(maxRecentBpmnTools + 1).fill("task"),
      favoriteToolIds: [],
    }),
    JSON.stringify({
      version: 1,
      recentToolIds: [],
      favoriteToolIds: Array(maxFavoriteBpmnTools + 1).fill("task"),
    }),
    "x".repeat(maxBpmnToolPreferencesSerializedLength + 1),
  ])("falls back without exposing corrupt or oversized data", (serialized) => {
    expect(parseBpmnToolPreferences(serialized, known)).toEqual(
      emptyBpmnToolPreferences,
    );
  });

  it("orders successful uses, de-duplicates them and enforces the cap", () => {
    const allKnown = new Set(
      Array.from({ length: maxRecentBpmnTools + 2 }, (_, index) =>
        `tool-${index}`,
      ),
    ) as ReadonlySet<BpmnToolId>;
    let value = emptyBpmnToolPreferences;
    for (const toolId of allKnown) {
      value = recordRecentBpmnTool(value, toolId, allKnown);
    }
    const first = value.recentToolIds[0]!;
    value = recordRecentBpmnTool(value, first, allKnown);
    expect(value.recentToolIds).toHaveLength(maxRecentBpmnTools);
    expect(value.recentToolIds[0]).toBe(first);
    expect(new Set(value.recentToolIds).size).toBe(maxRecentBpmnTools);
  });

  it("toggles favorites without accepting an unknown tool", () => {
    const favorite = toggleFavoriteBpmnTool(
      emptyBpmnToolPreferences,
      "task",
      known,
    );
    expect(favorite.favoriteToolIds).toEqual(["task"]);
    expect(toggleFavoriteBpmnTool(favorite, "task", known).favoriteToolIds).toEqual(
      [],
    );
    expect(
      toggleFavoriteBpmnTool(
        favorite,
        "unknown" as BpmnToolId,
        known,
      ),
    ).toBe(favorite);
  });

  it("fails safely when device storage is unavailable", () => {
    const getItem = vi.fn(() => {
      throw new Error("blocked");
    });
    const setItem = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(loadBpmnToolPreferences({ getItem }, known)).toEqual(
      emptyBpmnToolPreferences,
    );
    expect(saveBpmnToolPreferences({ setItem }, emptyBpmnToolPreferences)).toBe(
      false,
    );
    expect(setItem).toHaveBeenCalledWith(
      bpmnToolPreferencesStorageKey,
      JSON.stringify(emptyBpmnToolPreferences),
    );
  });
});
