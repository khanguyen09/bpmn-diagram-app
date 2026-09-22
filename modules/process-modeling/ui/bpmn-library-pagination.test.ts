import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bpmnLibraryPageWindow } from "./bpmn-model-library";

describe("BPMN library page window", () => {
  it("stretches cards and reveals the corner action for hover, keyboard and touch", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.bpmn-library__grid article\s*\{[^}]*height: 100%;/s);
    expect(css).toContain("article:is(:hover, :focus-within) .bpmn-library__delete");
    expect(css).toMatch(/\.bpmn-library__grid header\s*\{\s*padding-right: 0;/);
    expect(css).toMatch(/article:is\(:hover, :focus-within\) header\s*\{\s*padding-right: 52px;/);
    expect(css).toContain("@media (hover: none), (pointer: coarse)");
    expect(css).toMatch(/\.bpmn-library__grid \.bpmn-library__delete\s*\{[^}]*position: absolute;[^}]*width: 44px;[^}]*height: 44px;[^}]*opacity: 0;/s);
  });
  it("keeps short libraries and first/last pages in range", () => {
    expect(bpmnLibraryPageWindow(1, 1)).toEqual([1]);
    expect(bpmnLibraryPageWindow(2, 2)).toEqual([1, 2]);
    expect(bpmnLibraryPageWindow(1, 12)).toEqual([1, 2, 3, 4, 5]);
    expect(bpmnLibraryPageWindow(7, 12)).toEqual([5, 6, 7, 8, 9]);
    expect(bpmnLibraryPageWindow(12, 12)).toEqual([8, 9, 10, 11, 12]);
  });
});
