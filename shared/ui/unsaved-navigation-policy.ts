export type UnsavedNavigationPhase =
  | "idle"
  | "armed"
  | "restoring-back"
  | "confirming-back"
  | "confirming-link"
  | "releasing-link"
  | "cleaning"
  | "leaving";

export type UnsavedNavigationEvent =
  | { readonly type: "ACTIVATE" }
  | { readonly type: "DEACTIVATE" }
  | { readonly type: "LINK" }
  | { readonly type: "BACK" }
  | { readonly type: "CANCEL" }
  | { readonly type: "CONFIRM" }
  | { readonly type: "RELEASE" }
  | { readonly type: "UNMOUNT" };

export type UnsavedNavigationEffect =
  | "PUSH_SENTINEL"
  | "RESTORE_SENTINEL"
  | "OPEN_LINK_DIALOG"
  | "OPEN_BACK_DIALOG"
  | "CLOSE_DIALOG"
  | "NEUTRALIZE_AND_BACK"
  | "NEUTRALIZE_AND_GO_BACK_TWO"
  | "NAVIGATE_LINK"
  | "NEUTRALIZE";

export type UnsavedNavigationTransition = {
  readonly phase: UnsavedNavigationPhase;
  readonly effects: readonly UnsavedNavigationEffect[];
};

const unchanged = (phase: UnsavedNavigationPhase): UnsavedNavigationTransition => ({
  phase,
  effects: [],
});

export function reduceUnsavedNavigation(
  phase: UnsavedNavigationPhase,
  event: UnsavedNavigationEvent,
): UnsavedNavigationTransition {
  if (event.type === "UNMOUNT") {
    return phase === "idle"
      ? unchanged("idle")
      : { phase: "idle", effects: ["NEUTRALIZE"] };
  }

  if (event.type === "ACTIVATE" && phase === "idle") {
    return { phase: "armed", effects: ["PUSH_SENTINEL"] };
  }

  if (event.type === "DEACTIVATE" && phase !== "idle" && phase !== "leaving") {
    return {
      phase: "cleaning",
      effects: ["CLOSE_DIALOG", "NEUTRALIZE_AND_BACK"],
    };
  }

  if (event.type === "RELEASE" && phase === "armed") {
    return { phase: "cleaning", effects: ["NEUTRALIZE_AND_BACK"] };
  }

  if (event.type === "LINK") {
    if (phase === "armed") {
      return { phase: "confirming-link", effects: ["OPEN_LINK_DIALOG"] };
    }
    if (phase === "cleaning") {
      return { phase: "releasing-link", effects: [] };
    }
  }

  if (event.type === "BACK") {
    if (phase === "armed") {
      return { phase: "restoring-back", effects: ["RESTORE_SENTINEL"] };
    }
    if (phase === "restoring-back") {
      return { phase: "confirming-back", effects: ["OPEN_BACK_DIALOG"] };
    }
    if (phase === "releasing-link") {
      return { phase: "idle", effects: ["NAVIGATE_LINK"] };
    }
    if (phase === "cleaning") {
      return unchanged("idle");
    }
  }

  if (event.type === "CANCEL") {
    if (phase === "confirming-link" || phase === "confirming-back") {
      return { phase: "armed", effects: ["CLOSE_DIALOG"] };
    }
  }

  if (event.type === "CONFIRM") {
    if (phase === "confirming-link") {
      return {
        phase: "releasing-link",
        effects: ["CLOSE_DIALOG", "NEUTRALIZE_AND_BACK"],
      };
    }
    if (phase === "confirming-back") {
      return {
        phase: "leaving",
        effects: ["CLOSE_DIALOG", "NEUTRALIZE_AND_GO_BACK_TWO"],
      };
    }
  }

  return unchanged(phase);
}

export type AnchorNavigationInput = {
  readonly href: string;
  readonly currentHref: string;
  readonly button: number;
  readonly defaultPrevented: boolean;
  readonly download: boolean;
  readonly target: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
};

export function shouldConfirmAnchorNavigation(input: AnchorNavigationInput) {
  if (
    input.defaultPrevented ||
    input.button !== 0 ||
    input.download ||
    (input.target && input.target !== "_self") ||
    input.altKey ||
    input.ctrlKey ||
    input.metaKey ||
    input.shiftKey
  ) {
    return false;
  }

  try {
    const current = new URL(input.currentHref);
    const target = new URL(input.href, current);
    return !(
      target.origin === current.origin &&
      target.pathname === current.pathname &&
      target.search === current.search &&
      target.hash !== current.hash
    );
  } catch {
    return true;
  }
}

const sentinelKey = "__tebUnsavedNavigation";

export function withUnsavedNavigationSentinel(
  state: unknown,
  token: string,
): Record<string, unknown> {
  const base = state && typeof state === "object"
    ? state as Record<string, unknown>
    : {};
  return { ...base, [sentinelKey]: token };
}

export function withoutUnsavedNavigationSentinel(state: unknown) {
  if (!state || typeof state !== "object") return {};
  const next = { ...state as Record<string, unknown> };
  delete next[sentinelKey];
  return next;
}

export function hasUnsavedNavigationSentinel(state: unknown, token: string) {
  return Boolean(
    state &&
    typeof state === "object" &&
    (state as Record<string, unknown>)[sentinelKey] === token,
  );
}
