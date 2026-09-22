export type BpmnKeyboardIntent =
  | "OPEN_COMPONENTS"
  | "SELECT_MODE"
  | "HAND_MODE"
  | "CONNECT_MODE"
  | "DELETE"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "COPY"
  | "PASTE"
  | "DUPLICATE"
  | "UNDO"
  | "REDO"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  | "ZOOM_RESET"
  | "FIT_PROCESS"
  | "FIT_SELECTION"
  | "CANCEL";

export interface BpmnKeyboardContext {
  readonly key: string;
  readonly ctrlOrMeta?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly isComposing?: boolean;
  readonly isTextEditing?: boolean;
  readonly isInteractiveControl?: boolean;
  readonly isMobileViewer?: boolean;
  readonly isBlocked?: boolean;
}

export interface ResolvedBpmnKeyboardIntent {
  readonly intent: BpmnKeyboardIntent;
  readonly accelerated?: boolean;
}

export function resolveBpmnKeyboardIntent(
  context: BpmnKeyboardContext,
): ResolvedBpmnKeyboardIntent | null {
  if (
    context.isComposing ||
    context.isMobileViewer ||
    context.isBlocked ||
    context.alt
  ) {
    return null;
  }

  const key = context.key.toLowerCase();
  if (context.ctrlOrMeta) {
    if (key === "k" && !context.isTextEditing) {
      return { intent: "OPEN_COMPONENTS" };
    }
    if (context.isTextEditing || context.isInteractiveControl) return null;
    if (key === "c") return { intent: "COPY" };
    if (key === "v") return { intent: "PASTE" };
    if (key === "d") return { intent: "DUPLICATE" };
    if (key === "z") return { intent: context.shift ? "REDO" : "UNDO" };
    if (key === "y") return { intent: "REDO" };
    if (key === "+" || key === "=") return { intent: "ZOOM_IN" };
    if (key === "-") return { intent: "ZOOM_OUT" };
    if (key === "0") return { intent: "ZOOM_RESET" };
    return null;
  }

  if (context.isTextEditing || context.isInteractiveControl) return null;

  if (context.shift && key === "1") return { intent: "FIT_PROCESS" };
  if (context.shift && key === "2") return { intent: "FIT_SELECTION" };
  if (key === "v") return { intent: "SELECT_MODE" };
  if (key === "h") return { intent: "HAND_MODE" };
  if (key === "c") return { intent: "CONNECT_MODE" };
  if (key === "delete" || key === "backspace") return { intent: "DELETE" };
  if (key === "escape") return { intent: "CANCEL" };
  if (key === "arrowleft") {
    return { intent: "MOVE_LEFT", accelerated: context.shift };
  }
  if (key === "arrowright") {
    return { intent: "MOVE_RIGHT", accelerated: context.shift };
  }
  if (key === "arrowup") {
    return { intent: "MOVE_UP", accelerated: context.shift };
  }
  if (key === "arrowdown") {
    return { intent: "MOVE_DOWN", accelerated: context.shift };
  }
  return null;
}
