import { describe, expect, it } from "vitest";
import { resolveBpmnKeyboardIntent } from "./bpmn-keyboard-shortcuts";

describe("BPMN keyboard intent resolver", () => {
  it("resolves the complete bounded matrix", () => {
    expect(resolveBpmnKeyboardIntent({ key: "v" })?.intent).toBe("SELECT_MODE");
    expect(resolveBpmnKeyboardIntent({ key: "h" })?.intent).toBe("HAND_MODE");
    expect(resolveBpmnKeyboardIntent({ key: "c" })?.intent).toBe("CONNECT_MODE");
    expect(
      resolveBpmnKeyboardIntent({ key: "d", ctrlOrMeta: true })?.intent,
    ).toBe("DUPLICATE");
    expect(
      resolveBpmnKeyboardIntent({ key: "k", ctrlOrMeta: true })?.intent,
    ).toBe("OPEN_COMPONENTS");
    expect(
      resolveBpmnKeyboardIntent({ key: "ArrowRight", shift: true }),
    ).toEqual({ intent: "MOVE_RIGHT", accelerated: true });
    expect(resolveBpmnKeyboardIntent({ key: "1", shift: true })?.intent).toBe(
      "FIT_PROCESS",
    );
  });

  it.each([
    { isComposing: true },
    { isMobileViewer: true },
    { isBlocked: true },
  ])("does not resolve while the authoring context is guarded", (guard) => {
    expect(resolveBpmnKeyboardIntent({ key: "Delete", ...guard })).toBeNull();
  });

  it("keeps Cmd/Ctrl+K away from text editing and preserves other controls", () => {
    expect(
      resolveBpmnKeyboardIntent({
        key: "k",
        ctrlOrMeta: true,
        isTextEditing: true,
      }),
    ).toBeNull();
    expect(
      resolveBpmnKeyboardIntent({
        key: "k",
        ctrlOrMeta: true,
        isInteractiveControl: true,
      })?.intent,
    ).toBe("OPEN_COMPONENTS");
    expect(
      resolveBpmnKeyboardIntent({ key: "Delete", isInteractiveControl: true }),
    ).toBeNull();
  });
});
