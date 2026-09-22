import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { collaborationBpmnProfile } from "../domain/collaboration-profile";
import { bpmnLauncherToolDefinitions } from "./bpmn-component-launcher";
import {
  BpmnToolPresentationIcon,
  bpmnToolPresentation,
  bpmnToolPresentationRegistry,
} from "./bpmn-tool-presentation";

describe("BPMN tool presentation registry", () => {
  const collaborationDefinitions = bpmnLauncherToolDefinitions(
    collaborationBpmnProfile.id,
  );
  const stableToolIds = collaborationDefinitions.map((item) => item.id);

  it("exhaustively maps all 32 launcher tools without a fallback glyph", () => {
    const registryIds = Object.keys(bpmnToolPresentationRegistry);
    const presentationKeys = stableToolIds.map(
      (toolId) => bpmnToolPresentation(toolId).key,
    );

    expect(stableToolIds).toHaveLength(32);
    expect(registryIds.sort()).toEqual([...stableToolIds].sort());
    expect(new Set(presentationKeys).size).toBe(stableToolIds.length);
    expect(presentationKeys.every((key) => key.trim().length > 0)).toBe(true);
  });

  it("keeps visually confusable BPMN families on distinct presentation keys", () => {
    const keys = (...toolIds: typeof stableToolIds) =>
      toolIds.map((toolId) => bpmnToolPresentation(toolId).key);

    expect(new Set(keys("start-event", "end-event", "inclusive-gateway")).size)
      .toBe(3);
    expect(
      new Set(
        keys(
          "message-catch-event",
          "message-throw-event",
          "message-boundary-event",
          "message-flow",
          "receive-task",
        ),
      ).size,
    ).toBe(5);
    expect(
      new Set(
        keys(
          "horizontal-swimlane-frame",
          "vertical-swimlane-frame",
          "white-box-pool",
          "black-box-pool",
        ),
      ).size,
    ).toBe(4);
    expect(
      new Set(keys("sequence-flow", "association", "data-association")).size,
    ).toBe(3);
  });

  it("renders every glyph as decorative while exposing its stable icon key", () => {
    for (const toolId of stableToolIds) {
      const presentation = bpmnToolPresentation(toolId);
      const html = renderToStaticMarkup(
        <BpmnToolPresentationIcon toolId={toolId} />,
      );

      expect(html, toolId).toContain(
        `data-bpmn-tool-icon="${presentation.key}"`,
      );
      expect(html, toolId).toContain('aria-hidden="true"');
      expect(html, toolId).not.toContain("aria-label=");
      expect(html, toolId).not.toContain("role=\"img\"");
    }
  });
});
