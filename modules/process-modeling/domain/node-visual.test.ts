import { describe, expect, it } from "vitest";
import {
  isNodeIconKey,
  nodeIconCatalogue,
  supportsNodeVisual,
} from "./node-visual";

describe("node visual policy", () => {
  it("owns a bounded unique local icon catalogue", () => {
    expect(nodeIconCatalogue.length).toBe(36);
    expect(new Set(nodeIconCatalogue.map((icon) => icon.id)).size).toBe(
      nodeIconCatalogue.length,
    );
    expect(isNodeIconKey("approval")).toBe(true);
    expect(isNodeIconKey("https://example.com/icon.svg")).toBe(false);
    for (const id of ["person", "team", "document", "review", "approval", "message", "search", "data", "settings", "clock", "shield", "publish"]) {
      expect(isNodeIconKey(id)).toBe(true);
    }
    expect(isNodeIconKey("automation")).toBe(true);
  });

  it("permits visual metadata only on supported flow nodes", () => {
    expect(supportsNodeVisual("bpmn:Task")).toBe(true);
    expect(supportsNodeVisual("bpmn:UserTask")).toBe(true);
    expect(supportsNodeVisual("bpmn:ServiceTask")).toBe(true);
    expect(supportsNodeVisual("bpmn:ManualTask")).toBe(true);
    expect(supportsNodeVisual("bpmn:SequenceFlow")).toBe(false);
    expect(supportsNodeVisual("bpmn:Process")).toBe(false);
  });
});
