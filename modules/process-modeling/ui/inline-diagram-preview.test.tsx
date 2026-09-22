import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ effect: null as null | (() => () => void), status: [] as unknown[], refs: 0, importXml: vi.fn(), destroy: vi.fn(), zoom: vi.fn(), fetch: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useRef: () => ({ current: h.refs++ === 0 ? {} : null }),
  useState: (initial: unknown) => [initial, (value: unknown) => h.status.push(value)],
  useEffect: (effect: () => () => void) => { h.effect = effect; },
}));
vi.mock("bpmn-js/lib/NavigatedViewer", () => ({ default: class { importXML = h.importXml; destroy = h.destroy; get() { return { zoom: h.zoom }; } } }));
import { DiagramPreviewView } from "./inline-diagram-preview";
import { InlineDiagramPreview } from "../client";
const props = { sourceUrl: "/api/v1/public/articles/story/diagrams/block?snapshotId=snapshot", title: "Process", versionLabel: "Published", typography: { prepare: async () => {}, config: () => ({ defaultStyle: { fontFamily: "test" }, externalStyle: { fontFamily: "test" } }) } };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); h.refs = 0; h.status = [];
  vi.stubGlobal("window", { setTimeout, clearTimeout }); vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  h.fetch.mockResolvedValue({ ok: true, json: async () => ({ canonicalXml: "<safe-diagram/>" }) });
  h.importXml.mockResolvedValue({});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("imports returned public XML into a graphical viewer and fits its canvas", async () => {
  DiagramPreviewView(props); const cleanup = h.effect!();
  await vi.advanceTimersByTimeAsync(0);
  expect(h.fetch).toHaveBeenCalledWith(props.sourceUrl, expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  expect(h.importXml).toHaveBeenCalledWith("<safe-diagram/>");
  expect(h.zoom).toHaveBeenCalledWith("fit-viewport"); expect(h.status).toContain("ready");
  cleanup(); expect(h.destroy).toHaveBeenCalledOnce();
});
it("bounds loading and aborts a stalled public request", async () => {
  h.fetch.mockReturnValue(new Promise(() => {})); DiagramPreviewView(props); const cleanup = h.effect!();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(h.status).toContain("error"); expect(h.fetch.mock.calls[0][1].signal.aborted).toBe(true); cleanup();
});
it("shows a retryable error when the publication is withdrawn", async () => {
  h.fetch.mockResolvedValue({ ok: false }); DiagramPreviewView(props); const cleanup = h.effect!();
  await vi.advanceTimersByTimeAsync(0); expect(h.status).toContain("error"); expect(h.importXml).not.toHaveBeenCalled(); cleanup();
});
it("constructs protected model preview and navigation routes", () => {
  const view = InlineDiagramPreview({ modelId: "model", versionId: "version", title: "Process" });
  expect(view.props.sourceUrl).toBe("/api/v1/studio/process-models/model/preview?versionId=version");
  expect(view.props.studioHref).toBe("/studio/diagram/model");
});
