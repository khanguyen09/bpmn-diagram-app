import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { bpmnFontFamily, bpmnTextRendererConfig, prepareBpmnFont } from "./bpmn-typography";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("SDD57 diagram typography", () => {
  it("uses Be Vietnam Pro for internal and external text without changing font sizes", () => {
    const config = bpmnTextRendererConfig();
    expect(config.defaultStyle.fontFamily).toBe(bpmnFontFamily);
    expect(config.externalStyle.fontFamily).toBe(bpmnFontFamily);
    expect(config.defaultStyle).not.toHaveProperty("fontSize");
    config.defaultStyle.fontFamily = "changed";
    expect(bpmnTextRendererConfig().defaultStyle.fontFamily).toBe(bpmnFontFamily);
  });
  it("preloads Vietnamese glyphs before measuring labels", async () => {
    const load = vi.fn().mockResolvedValue([]);
    vi.stubGlobal("document", { fonts: { load } });
    await prepareBpmnFont();
    expect(load).toHaveBeenCalledWith('400 12px "Be Vietnam Pro"', "Quy trình phê duyệt");
  });
  it("keeps offline or unsupported font loading non-blocking", async () => {
    await expect(prepareBpmnFont()).resolves.toBeUndefined();
    vi.stubGlobal("document", { fonts: { load: vi.fn().mockRejectedValue(new Error("offline")) } });
    await expect(prepareBpmnFont()).resolves.toBeUndefined();
  });
  it("bounds an unresponsive font host", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { fonts: { load: () => new Promise(() => {}) } });
    const pending = prepareBpmnFont();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBeUndefined();
  });
  it("configures every visible and detached modeler", () => {
    for (const path of ["./preflight-bpmn-render.ts", "./prepare-core-swimlane-conversion.ts"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("textRenderer: bpmnTextRendererConfig()");
      expect(source).toContain("await prepareBpmnFont()");
    }
    const studio = readFileSync(new URL("../../ui/bpmn-studio.tsx", import.meta.url), "utf8");
    expect(studio).toContain("textRenderer: typography.config()");
    expect(studio).toContain("await typography.prepare()");
    expect(readFileSync(new URL("../../composition.tsx", import.meta.url), "utf8")).toContain("typography={browserBpmnTypography}");
  });
});
