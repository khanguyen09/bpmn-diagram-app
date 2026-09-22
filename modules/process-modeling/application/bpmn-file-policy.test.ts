import { describe, expect, it } from "vitest";
import {
  bpmnFileIsWithinLimit,
  maxBpmnImportBytes,
} from "./bpmn-file-policy";

describe("BPMN file preflight", () => {
  it("rejects oversized files before content materialization", () => {
    expect(bpmnFileIsWithinLimit(maxBpmnImportBytes)).toBe(true);
    expect(bpmnFileIsWithinLimit(maxBpmnImportBytes + 1)).toBe(false);
    expect(bpmnFileIsWithinLimit(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});
