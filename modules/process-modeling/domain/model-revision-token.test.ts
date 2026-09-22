import { describe, expect, it } from "vitest";
import {
  decodeModelRevisionToken,
  encodeModelRevisionToken,
  formatStrongModelEtag,
  parseStrongModelEtag,
} from "./model-revision-token";

describe("BPMN model revision tokens", () => {
  it("round-trips safe non-negative revisions", () => {
    for (const revision of [0, 1, 35, 36, 10_000]) {
      expect(decodeModelRevisionToken(encodeModelRevisionToken(revision)))
        .toBe(revision);
      expect(parseStrongModelEtag(formatStrongModelEtag(revision))).toBe(revision);
    }
  });

  it.each([
    "bpmn-revision-1",
    'W/"bpmn-revision-1"',
    '"bpmn-revision-1", "bpmn-revision-2"',
    "*",
    '""',
    '"draft-1"',
  ])("rejects weak, wildcard, multiple or malformed If-Match %s", (value) => {
    expect(() => parseStrongModelEtag(value)).toThrow();
  });
});
