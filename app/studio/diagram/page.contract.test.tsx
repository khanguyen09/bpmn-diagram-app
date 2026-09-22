import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const experiences = vi.hoisted(() => ({
  library: vi.fn(() => <main data-testid="bpmn-model-library">Library</main>),
  studio: vi.fn(() => <main data-testid="bpmn-studio">Studio</main>),
}));

vi.mock("@/modules/process-modeling", () => ({
  BpmnModelLibraryExperience: experiences.library,
  BpmnStudioExperience: experiences.studio,
}));

import DiagramPage from "./page";

describe("/studio/diagram contract", () => {
  it("renders the read-only model-library experience instead of implicitly opening a studio", async () => {
    const html = renderToStaticMarkup(await DiagramPage({}));

    expect(html).toContain('data-testid="bpmn-model-library"');
    expect(html).not.toContain('data-testid="bpmn-studio"');
    expect(experiences.library).toHaveBeenCalledOnce();
    expect(experiences.library).toHaveBeenCalledWith({
      initialCreateIntent: null,
    }, undefined);
    expect(experiences.studio).not.toHaveBeenCalled();
  });

  it("forwards only the explicit swimlane create intent", async () => {
    renderToStaticMarkup(await DiagramPage({
      searchParams: Promise.resolve({ create: "swimlane" }),
    }));
    expect(experiences.library).toHaveBeenLastCalledWith({
      initialCreateIntent: "swimlane",
    }, undefined);

    renderToStaticMarkup(await DiagramPage({
      searchParams: Promise.resolve({ create: "unknown" }),
    }));
    expect(experiences.library).toHaveBeenLastCalledWith({
      initialCreateIntent: null,
    }, undefined);
  });
});
