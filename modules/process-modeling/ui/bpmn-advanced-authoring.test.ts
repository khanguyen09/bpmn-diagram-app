import { describe, expect, it } from "vitest";
import {
  complexActivationError,
  inferDataAssociationDirection,
} from "./bpmn-advanced-authoring";

describe("advanced BPMN authoring helpers", () => {
  it("infers the owned activity side for data associations", () => {
    expect(
      inferDataAssociationDirection(
        "bpmn:DataObjectReference",
        "bpmn:ServiceTask",
      ),
    ).toBe("INPUT");
    expect(
      inferDataAssociationDirection(
        "bpmn:CallActivity",
        "bpmn:DataStoreReference",
      ),
    ).toBe("OUTPUT");
    expect(inferDataAssociationDirection("bpmn:Task", "bpmn:Task")).toBeNull();
  });

  it("requires a bounded complex join activation expression", () => {
    expect(complexActivationError(" ")).toMatch(/bắt buộc/);
    expect(complexActivationError("count(incoming) >= 2")).toBeUndefined();
    expect(complexActivationError("x", 501)).toMatch(/500/);
  });
});
