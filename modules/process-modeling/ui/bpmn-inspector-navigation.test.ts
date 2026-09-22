import { describe, expect, it } from "vitest";
import {
  inspectorPrimaryViewProjection,
  inspectorViewForPrimary,
  inspectorViews,
  nextInspectorPrimaryView,
  nextInspectorView,
  primaryInspectorViewFor,
  secondaryInspectorViewsFor,
} from "./bpmn-inspector-navigation";

describe("BPMN inspector roving tabs", () => {
  it("wraps in both directions", () => {
    expect(nextInspectorView("versions", "ArrowRight")).toBe("properties");
    expect(nextInspectorView("properties", "ArrowLeft")).toBe("versions");
  });

  it("supports Home and End", () => {
    expect(nextInspectorView("navigation", "Home")).toBe("properties");
    expect(nextInspectorView("properties", "End")).toBe("versions");
  });
});

describe("BPMN inspector primary navigation projection", () => {
  it("covers each existing logical view exactly once", () => {
    const projectedViews = inspectorPrimaryViewProjection.flatMap(
      (primary) => [...primary.logicalViews],
    );

    expect(projectedViews).toHaveLength(inspectorViews.length);
    expect(new Set(projectedViews)).toEqual(new Set(inspectorViews));
  });

  it("maps five logical views into three stable primary views", () => {
    expect(primaryInspectorViewFor("properties")).toBe("edit");
    expect(primaryInspectorViewFor("model")).toBe("diagram");
    expect(primaryInspectorViewFor("structure")).toBe("diagram");
    expect(primaryInspectorViewFor("versions")).toBe("diagram");
    expect(primaryInspectorViewFor("navigation")).toBe("check");
  });

  it("uses compatible defaults and preserves a current child view", () => {
    expect(inspectorViewForPrimary("edit")).toBe("properties");
    expect(inspectorViewForPrimary("diagram")).toBe("model");
    expect(inspectorViewForPrimary("check")).toBe("navigation");
    expect(inspectorViewForPrimary("diagram", "structure")).toBe("structure");
    expect(inspectorViewForPrimary("diagram", "navigation")).toBe("model");
  });

  it("provides plain-language secondary choices for the diagram view", () => {
    expect(secondaryInspectorViewsFor("diagram")).toEqual([
      { view: "model", label: "Thông tin chung" },
      { view: "structure", label: "Danh sách bước" },
      { view: "versions", label: "Bản lưu" },
    ]);
    expect(secondaryInspectorViewsFor("edit")).toEqual([]);
    expect(secondaryInspectorViewsFor("check")).toEqual([]);
  });

  it("supports roving keyboard navigation across the compact primary views", () => {
    expect(nextInspectorPrimaryView("check", "ArrowRight")).toBe("edit");
    expect(nextInspectorPrimaryView("edit", "ArrowLeft")).toBe("check");
    expect(nextInspectorPrimaryView("diagram", "Home")).toBe("edit");
    expect(nextInspectorPrimaryView("edit", "End")).toBe("check");
  });
});
