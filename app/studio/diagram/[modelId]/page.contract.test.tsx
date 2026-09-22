import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
const experiences = vi.hoisted(() => ({
  studio: vi.fn(({ modelId }: { modelId: string }) => (
    <main data-model-id={modelId}>Exact model</main>
  )),
}));

vi.mock("next/navigation", () => ({
  notFound: navigation.notFound,
}));
vi.mock("@/modules/process-modeling", () => ({
  BpmnStudioExperience: experiences.studio,
}));

import ProcessModelPage from "./page";

describe("/studio/diagram/[modelId] contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the exact valid model identity to the Studio experience", async () => {
    const modelId = "f3b41f9c-1675-4e2d-9f1c-5a52ccca9dc9";
    const html = renderToStaticMarkup(await ProcessModelPage({
      params: Promise.resolve({ modelId }),
    }));

    expect(html).toContain(`data-model-id="${modelId}"`);
    expect(experiences.studio).toHaveBeenCalledWith(
      expect.objectContaining({ modelId }),
      undefined,
    );
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "model-1",
    "../another-model",
    "f3b41f9c-1675-0e2d-9f1c-5a52ccca9dc9",
  ])("rejects a malformed model identity before rendering: %j", async (modelId) => {
    await expect(ProcessModelPage({
      params: Promise.resolve({ modelId }),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(experiences.studio).not.toHaveBeenCalled();
  });
});
