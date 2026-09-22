import { describe, expect, it } from "vitest";
import {
  bpmnMessageNameError,
  bpmnTimerDraftError,
  normalizeBpmnTimerDraft,
} from "./bpmn-event-properties-editor";

describe("BPMN event property drafts", () => {
  it("requires a bounded semantic message name", () => {
    expect(bpmnMessageNameError(" ")).toContain("cần");
    expect(bpmnMessageNameError("Khách hàng phản hồi")).toBeNull();
    expect(bpmnMessageNameError("x".repeat(181))).toContain("180");
  });

  it("accepts RFC 3339 dates with an explicit timezone", () => {
    expect(
      bpmnTimerDraftError({
        kind: "DATE",
        value: "2026-08-15T09:00:00+07:00",
      }),
    ).toBeNull();
    expect(
      bpmnTimerDraftError({ kind: "DATE", value: "2026-08-15T09:00:00" }),
    ).toContain("RFC 3339");
  });

  it("bounds unambiguous duration values", () => {
    expect(
      bpmnTimerDraftError({ kind: "DURATION", value: "P2DT4H30M" }),
    ).toBeNull();
    expect(
      bpmnTimerDraftError({ kind: "DURATION", value: "PT48H" }),
    ).toBeNull();
    expect(
      bpmnTimerDraftError({ kind: "DURATION", value: "PT8760H" }),
    ).toBeNull();
    expect(bpmnTimerDraftError({ kind: "DURATION", value: "PT0S" })).toContain(
      "1 giây",
    );
    expect(bpmnTimerDraftError({ kind: "DURATION", value: "P366D" })).toContain(
      "365 ngày",
    );
    expect(bpmnTimerDraftError({ kind: "DURATION", value: "P1M" })).toContain(
      "ISO 8601",
    );
  });

  it("normalizes only surrounding whitespace", () => {
    expect(
      normalizeBpmnTimerDraft({ kind: "DURATION", value: "  PT30M " }),
    ).toEqual({ kind: "DURATION", value: "PT30M" });
  });
});
