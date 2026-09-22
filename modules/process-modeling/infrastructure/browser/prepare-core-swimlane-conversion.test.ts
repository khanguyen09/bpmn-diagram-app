import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collaborationSwimlaneLayoutsBpmnProfile } from "../../domain/collaboration-profile";
import { starterBpmnXml } from "../bpmn-io/starter-model";

const detached = vi.hoisted(() => ({
  importedXml: "",
  warnings: [] as unknown[],
  failImport: false,
  constructed: 0,
  destroyed: 0,
}));

vi.mock("bpmn-js/lib/Modeler", () => ({
  default: class DetachedModelerMock {
    constructor() {
      detached.constructed += 1;
    }

    async importXML(xml: string) {
      if (detached.failImport) throw new Error("detached import failed");
      detached.importedXml = xml;
      return { warnings: detached.warnings };
    }

    async saveXML() {
      return { xml: detached.importedXml };
    }

    destroy() {
      detached.destroyed += 1;
    }
  },
}));

import { prepareCoreSwimlaneConversion } from "./prepare-core-swimlane-conversion";

function installDocumentStub() {
  const container = {
    style: { cssText: "" },
    setAttribute: vi.fn(),
    remove: vi.fn(),
  };
  const appendChild = vi.fn();
  vi.stubGlobal("document", {
    body: { appendChild },
    createElement: vi.fn(() => container),
  });
  return { appendChild, container };
}

describe("prepareCoreSwimlaneConversion", () => {
  beforeEach(() => {
    detached.importedXml = "";
    detached.warnings = [];
    detached.failImport = false;
    detached.constructed = 0;
    detached.destroyed = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the native candidate through a detached modeler before returning the fixed target profile", async () => {
    const { appendChild, container } = installDocumentStub();

    const result = await prepareCoreSwimlaneConversion(
      starterBpmnXml,
      "horizontal",
    );

    expect(result.targetProfileId).toBe(
      collaborationSwimlaneLayoutsBpmnProfile.id,
    );
    expect(result.xml).toBe(detached.importedXml);
    expect(detached.importedXml).toContain("bpmn:collaboration");
    expect(detached.importedXml).toContain('isHorizontal="true"');
    expect(detached.constructed).toBe(1);
    expect(detached.destroyed).toBe(1);
    expect(appendChild).toHaveBeenCalledWith(container);
    expect(container.remove).toHaveBeenCalledOnce();
  });

  it("fails closed and destroys the detached modeler when import reports warnings", async () => {
    const { container } = installDocumentStub();
    detached.warnings = [{ message: "warning" }];

    await expect(
      prepareCoreSwimlaneConversion(starterBpmnXml, "vertical"),
    ).rejects.toMatchObject({
      code: "CANDIDATE_REJECTED",
    });
    expect(detached.destroyed).toBe(1);
    expect(container.remove).toHaveBeenCalledOnce();
  });

  it("fails closed outside a browser before constructing a modeler", async () => {
    await expect(
      prepareCoreSwimlaneConversion(starterBpmnXml, "horizontal"),
    ).rejects.toMatchObject({
      code: "DETACHED_MODELER_UNAVAILABLE",
    });
    expect(detached.constructed).toBe(0);
  });
});
