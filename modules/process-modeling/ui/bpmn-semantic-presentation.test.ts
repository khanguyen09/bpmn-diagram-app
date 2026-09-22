import { describe, expect, it } from "vitest";
import {
  bpmnColorModes,
  bpmnSemanticCategory,
  bpmnSemanticLegend,
  bpmnSemanticMarker,
  isBpmnColorMode,
} from "./bpmn-semantic-presentation";

describe("BPMN semantic presentation", () => {
  it("maps BPMN types to stable visual categories", () => {
    expect(bpmnSemanticCategory("bpmn:TimerEvent")).toBe("event");
    expect(bpmnSemanticCategory("bpmn:IntermediateCatchEvent")).toBe("event");
    expect(bpmnSemanticCategory("bpmn:ReceiveTask")).toBe("activity");
    expect(bpmnSemanticCategory("bpmn:EventBasedGateway")).toBe("gateway");
    expect(bpmnSemanticCategory("bpmn:Participant")).toBe("container");
    expect(bpmnSemanticCategory("bpmn:MessageFlow")).toBe("message-flow");
    expect(bpmnSemanticCategory("bpmn:SequenceFlow")).toBe("sequence-flow");
    expect(bpmnSemanticCategory("bpmn:DataObjectReference")).toBeNull();
  });

  it("accepts only the three presentation modes", () => {
    expect(isBpmnColorMode("CLASSIC")).toBe(true);
    expect(isBpmnColorMode("SEMANTIC")).toBe(true);
    expect(isBpmnColorMode("HIGH_CONTRAST")).toBe(true);
    expect(isBpmnColorMode("dark")).toBe(false);
  });

  it("keeps stable mode IDs behind plain-language labels", () => {
    expect(bpmnColorModes.map((mode) => mode.id)).toEqual([
      "CLASSIC",
      "SEMANTIC",
      "HIGH_CONTRAST",
    ]);
    expect(bpmnColorModes.map((mode) => mode.label)).toEqual([
      "Nét tiêu chuẩn",
      "Màu theo nhóm",
      "Tương phản cao",
    ]);
    expect(bpmnSemanticLegend.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Điểm quyết định",
        "Bên tham gia / vai trò",
        "Trao đổi thông điệp",
        "Luồng công việc",
      ]),
    );
  });

  it("creates presentation-only marker names", () => {
    expect(bpmnSemanticMarker("message-flow")).toBe(
      "teb-semantic-message-flow",
    );
  });
});
