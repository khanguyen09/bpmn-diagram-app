import { describe, expect, it } from "vitest";
import {
  isAllowedBpmnSvgAttribute,
  isAllowedBpmnSvgElement,
  isAllowedBpmnSvgStyleDeclaration,
} from "./export-bpmn-diagram";

describe("BPMN browser download sanitizer policy", () => {
  it("accepts only inert SVG namespace elements used by the modeler", () => {
    expect(isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "path")).toBe(
      true,
    );
    expect(isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "marker")).toBe(
      true,
    );
    expect(isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "text")).toBe(
      true,
    );
    expect(isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "script")).toBe(
      false,
    );
    expect(
      isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "foreignObject"),
    ).toBe(false);
    expect(isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "style")).toBe(
      false,
    );
    expect(isAllowedBpmnSvgElement("http://www.w3.org/2000/svg", "animate")).toBe(
      false,
    );
    expect(isAllowedBpmnSvgElement("http://www.w3.org/1999/xhtml", "path")).toBe(
      false,
    );
  });

  it("keeps static drawing attributes and local references only", () => {
    expect(isAllowedBpmnSvgAttribute("stroke-width", "2")).toBe(true);
    expect(isAllowedBpmnSvgAttribute("transform", "translate(10 20)")).toBe(true);
    expect(isAllowedBpmnSvgAttribute("marker-end", "url(#marker-1)")).toBe(
      true,
    );
    expect(isAllowedBpmnSvgAttribute("fill", "url(#paint-1)")).toBe(true);
    expect(isAllowedBpmnSvgAttribute("href", "#shape-1")).toBe(true);

    for (const [name, value] of [
      ["onload", "alert(1)"],
      ["style", "background:url(https://example.com/x)"],
      ["href", "javascript:alert(1)"],
      ["href", "data:image/svg+xml;base64,abc"],
      ["href", "//example.com/x.svg"],
      ["marker-end", "url(https://example.com/marker.svg#m)"],
      ["fill", "url(data:image/svg+xml;base64,abc)"],
      ["font-family", "url(https://example.com/font.woff2)"],
      ["src", "https://example.com/x"],
    ] as const) {
      expect(isAllowedBpmnSvgAttribute(name, value), `${name}=${value}`).toBe(
        false,
      );
    }
  });

  it("allows only the canonical namespace declarations", () => {
    expect(
      isAllowedBpmnSvgAttribute(
        "xmlns",
        "http://www.w3.org/2000/svg",
      ),
    ).toBe(true);
    expect(
      isAllowedBpmnSvgAttribute(
        "xmlns:xlink",
        "http://www.w3.org/1999/xlink",
      ),
    ).toBe(true);
    expect(isAllowedBpmnSvgAttribute("xmlns:xlink", "javascript:alert(1)")).toBe(
      false,
    );
  });

  it("projects the presentation styles emitted by bpmn-js saveSVG", () => {
    for (const [property, value] of [
      ["fill", "#ffffff"],
      ["stroke", "#22242a"],
      ["stroke-width", "2px"],
      ["stroke-linecap", "round"],
      ["font-family", "Arial, sans-serif"],
      ["font-size", "12px"],
      ["font-weight", "normal"],
      ["marker-end", "url(#sequenceflow-end-1)"],
    ] as const) {
      expect(
        isAllowedBpmnSvgStyleDeclaration(property, value),
        `${property}: ${value}`,
      ).toBe(true);
    }
  });

  it("drops active, external and unrelated style declarations", () => {
    for (const [property, value] of [
      ["background", "url(https://example.com/tracker.png)"],
      ["fill", "url(data:image/svg+xml;base64,abc)"],
      ["marker-end", "url(//example.com/marker.svg#m)"],
      ["font-family", "url(https://example.com/font.woff2)"],
      ["animation", "spin 1s infinite"],
    ] as const) {
      expect(
        isAllowedBpmnSvgStyleDeclaration(property, value),
        `${property}: ${value}`,
      ).toBe(false);
    }
  });
});
