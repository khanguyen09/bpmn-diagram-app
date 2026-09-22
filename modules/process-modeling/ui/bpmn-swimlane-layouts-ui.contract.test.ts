import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bpmnToolPresentation } from "./bpmn-tool-presentation";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("BPMN Studio oriented swimlane aggregate contract", () => {
  const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
  const launcher = source("modules/process-modeling/ui/bpmn-component-launcher.tsx");
  const css = source("app/globals.css");

  it("creates Participant plus two native Lanes behind one aggregate command", () => {
    expect(studio).toContain(
      'commandStack.register("teb.collaboration.createSwimlaneFrame"',
    );
    expect(studio).toContain("createParticipantShape({");
    expect(studio).toContain("isHorizontal: horizontal");
    expect(studio).toContain("modeling.splitLane(created, 2)");
    expect(studio).toContain(
      '"teb.collaboration.createSwimlaneFrame",\n          context',
    );
  });

  it("keeps aggregate cards click/keyboard-only and labels both axes", () => {
    expect(studio).toContain('recipe.kind === "swimlane-frame"');
    expect(launcher).toContain('"swimlane-frame"');
    expect(studio).toContain("Thêm vai trò phía trên");
    expect(studio).toContain("Thêm vai trò phía dưới");
    expect(studio).toContain("Thêm vai trò bên trái");
    expect(studio).toContain("Thêm vai trò bên phải");
    expect(launcher).toContain('event.key !== "Enter" && event.key !== " "');
  });

  it("renders distinct registry icons without relying on color for orientation", () => {
    expect(bpmnToolPresentation("horizontal-swimlane-frame")).toMatchObject({
      key: "swimlane-horizontal",
      className: "bpmn-icon-lane-divide-two",
      variant: "horizontal-lanes",
    });
    expect(bpmnToolPresentation("vertical-swimlane-frame")).toMatchObject({
      key: "swimlane-vertical",
      className: "bpmn-icon-lane-divide-two",
      variant: "vertical-lanes",
    });
    expect(studio).toContain("<BpmnToolPresentationIcon");
    expect(launcher).toContain("toolId={item.id}");
    expect(css).toContain(
      "span.bpmn-tool-presentation-icon.is-vertical-lanes",
    );
    expect(css).toContain("transform: rotate(90deg)");
  });
});
