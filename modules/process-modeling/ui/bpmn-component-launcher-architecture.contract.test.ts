import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("SDD45 BPMN launcher and profile-facade architecture", () => {
  it("keeps component discovery independent from modeler and persistence adapters", () => {
    const launcher = source(
      "modules/process-modeling/ui/bpmn-component-launcher.tsx",
    );

    expect(launcher).not.toContain("bpmn-js/lib/Modeler");
    expect(launcher).not.toContain("process-model-persistence-client");
    expect(launcher).not.toContain("infrastructure/");
    expect(launcher).not.toContain("fetch(");
  });

  it("keeps ordered ACK orchestration in the application facade", () => {
    const facade = source(
      "modules/process-modeling/application/bpmn-profile-upgrade-intent.ts",
    );
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(facade).toContain("runBpmnProfileUpgradeIntent");
    expect(facade).toContain("persistStep");
    expect(facade).not.toContain("../ui/");
    expect(facade).not.toContain("../infrastructure/");
    expect(studio).toContain("<BpmnComponentLauncher");
    expect(studio).toContain("runBpmnProfileUpgradeIntent(intent");
    expect(studio).not.toContain("startNextBpmnProfileUpgradeStep(intent)");
  });

  it("keeps the retired component rail out of the canvas-first source", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const css = source("app/globals.css");

    expect(studio).not.toContain("bpmn-studio__palette");
    expect(studio).not.toContain("libraryCollapsed");
    expect(studio).not.toContain("nodeQuery");
    expect(studio).not.toContain("enableStructuredRoutingProfile");
    expect(css).not.toContain("bpmn-studio__palette");
    expect(css).not.toContain("is-library-collapsed");
    expect(css).not.toContain("bpmn-node-search");
    expect(css).not.toContain("bpmn-node-library");
    expect(css).not.toContain("bpmn-palette-list");
    expect(css).not.toContain("bpmn-structured-routing");
  });

  it("injects the browser download boundary instead of importing it into Studio", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const composition = source("modules/process-modeling/composition.tsx");
    const browserAdapter = source(
      "modules/process-modeling/infrastructure/browser/export-bpmn-diagram.ts",
    );

    expect(studio).not.toContain("infrastructure/browser/export-bpmn-diagram");
    expect(composition).toContain("diagramExport={browserBpmnDiagramExport}");
    expect(browserAdapter).toContain("satisfies BpmnDiagramExportPort");
  });
});

describe("SDD49 stable BPMN drag background", () => {
  it("neutralizes only the root SVG fill and keeps non-colour drop cues", () => {
    const css = source("app/globals.css");
    const overrideStart = css.indexOf(
      ".bpmn-modeler .djs-container svg.new-parent,",
    );
    const overrideEnd = css.indexOf(
      ".bpmn-modeler .djs-outline",
      overrideStart,
    );
    const rootSvgOverrides = css.slice(overrideStart, overrideEnd);

    expect(overrideStart).toBeGreaterThan(-1);
    expect(overrideEnd).toBeGreaterThan(overrideStart);
    expect(css).toContain(
      "background-image: radial-gradient(#ded8e8 0.8px, transparent 0.8px);",
    );
    expect(rootSvgOverrides).toContain("background: transparent !important;");
    expect(rootSvgOverrides).toContain("outline: 2px solid var(--accent);");
    expect(rootSvgOverrides).toContain("outline: 2px dashed var(--danger);");
    expect(rootSvgOverrides).toContain("@media (forced-colors: active)");
    expect(rootSvgOverrides).toContain("outline-color: Highlight;");
    expect(rootSvgOverrides).toContain("outline-color: CanvasText;");
    expect(rootSvgOverrides).not.toContain(".djs-shape");
    expect(rootSvgOverrides).not.toContain("--shape-drop-allowed-fill-color");
    expect(rootSvgOverrides).not.toContain("--shape-drop-not-allowed-fill-color");
  });
});
