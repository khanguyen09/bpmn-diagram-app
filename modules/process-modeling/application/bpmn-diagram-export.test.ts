import { describe, expect, it } from "vitest";
import {
  isSafeLocalSvgReference,
  maximumBpmnPngDimension,
  maximumBpmnPngPixels,
  parseSvgLength,
  planBpmnPngDimensions,
  safeBpmnDiagramFilename,
} from "./bpmn-diagram-export";

describe("BPMN diagram download policy", () => {
  it("normalizes the title and selected extension", () => {
    expect(safeBpmnDiagramFilename("Quy trình duyệt bài", "bpmn")).toBe(
      "quy-trinh-duyet-bai.bpmn",
    );
    expect(safeBpmnDiagramFilename("Quy trình duyệt bài", "svg")).toBe(
      "quy-trinh-duyet-bai.svg",
    );
    expect(safeBpmnDiagramFilename("***", "png")).toBe("so-do.png");
  });

  it("accepts numeric SVG lengths but rejects units that could change layout", () => {
    expect(parseSvgLength("1200")).toBe(1200);
    expect(parseSvgLength("640px")).toBe(640);
    expect(parseSvgLength("100%")).toBeNull();
    expect(parseSvgLength("1e9")).toBeNull();
  });

  it("caps PNG dimensions and total pixels", () => {
    const dimensions = planBpmnPngDimensions(50_000, 20_000);
    expect(dimensions.width).toBeLessThanOrEqual(maximumBpmnPngDimension);
    expect(dimensions.height).toBeLessThanOrEqual(maximumBpmnPngDimension);
    expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(
      maximumBpmnPngPixels,
    );
    expect(() => planBpmnPngDimensions(0, 100)).toThrow();
    expect(() => planBpmnPngDimensions(Number.MAX_VALUE, Number.MAX_VALUE)).toThrow();
    const extremeRatio = planBpmnPngDimensions(1e12, 1);
    expect(Number.isInteger(extremeRatio.width)).toBe(true);
    expect(Number.isInteger(extremeRatio.height)).toBe(true);
    expect(extremeRatio.width).toBeGreaterThanOrEqual(1);
    expect(extremeRatio.height).toBeGreaterThanOrEqual(1);
  });

  it("allows only local SVG references", () => {
    expect(isSafeLocalSvgReference("#marker-1")).toBe(true);
    expect(isSafeLocalSvgReference("url(#marker-1)")).toBe(true);
    expect(isSafeLocalSvgReference("url('#marker-1')")).toBe(true);
    expect(isSafeLocalSvgReference("https://example.com/image.svg")).toBe(false);
    expect(isSafeLocalSvgReference("//example.com/image.svg")).toBe(false);
    expect(isSafeLocalSvgReference("data:image/svg+xml;base64,abc")).toBe(false);
    expect(isSafeLocalSvgReference("javascript:alert(1)")).toBe(false);
  });
});
