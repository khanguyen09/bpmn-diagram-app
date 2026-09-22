import { describe, expect, it } from "vitest";
import { documentUsesProcessModel, parseProcessModelPageQuery } from "./process-model-library";

describe("SDD59 library bounds and exact references", () => {
  it("uses bounded pagination", () => {
    expect(parseProcessModelPageQuery()).toEqual({ page: 1, pageSize: 9 });
    expect(parseProcessModelPageQuery("2", "36")).toEqual({ page: 2, pageSize: 36 });
  });
  it.each([0, -1, "1.2", " 1", "2x", Infinity, null, "99999999999"])("rejects invalid page %s", (value) => {
    expect(() => parseProcessModelPageQuery(value)).toThrow();
  });
  it("rejects oversized pages", () => expect(() => parseProcessModelPageQuery(1, 37)).toThrow());
  it("matches only canonical BPMN blocks with exact model identity", () => {
    expect(documentUsesProcessModel({ blocks: [{ type: "bpmn-embed", payload: { processModelId: "model" } }] }, "model")).toBe(true);
    for (const document of [null, { blocks: [{ type: "paragraph", payload: { processModelId: "model" } }] }, { blocks: [{ type: "bpmn-embed", payload: { processModelId: "model-other" } }] }, { text: "model" }]) {
      expect(documentUsesProcessModel(document, "model")).toBe(false);
    }
  });
});
