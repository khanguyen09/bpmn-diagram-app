import { describe, expect, it } from "vitest";
import {
  hasUnsavedNavigationSentinel,
  reduceUnsavedNavigation,
  shouldConfirmAnchorNavigation,
  withoutUnsavedNavigationSentinel,
  withUnsavedNavigationSentinel,
} from "./unsaved-navigation-policy";

describe("unsaved navigation history policy", () => {
  it("restores the sentinel before asking about browser Back", () => {
    expect(reduceUnsavedNavigation("idle", { type: "ACTIVATE" })).toEqual({
      phase: "armed",
      effects: ["PUSH_SENTINEL"],
    });
    expect(reduceUnsavedNavigation("armed", { type: "BACK" })).toEqual({
      phase: "restoring-back",
      effects: ["RESTORE_SENTINEL"],
    });
    expect(reduceUnsavedNavigation("restoring-back", { type: "BACK" })).toEqual({
      phase: "confirming-back",
      effects: ["OPEN_BACK_DIALOG"],
    });
    expect(reduceUnsavedNavigation("confirming-back", { type: "CANCEL" })).toEqual({
      phase: "armed",
      effects: ["CLOSE_DIALOG"],
    });
    expect(reduceUnsavedNavigation("confirming-back", { type: "CONFIRM" })).toEqual({
      phase: "leaving",
      effects: ["CLOSE_DIALOG", "NEUTRALIZE_AND_GO_BACK_TWO"],
    });
  });

  it("collapses the duplicate entry before a confirmed Link navigation", () => {
    expect(reduceUnsavedNavigation("armed", { type: "LINK" })).toEqual({
      phase: "confirming-link",
      effects: ["OPEN_LINK_DIALOG"],
    });
    expect(reduceUnsavedNavigation("confirming-link", { type: "CONFIRM" })).toEqual({
      phase: "releasing-link",
      effects: ["CLOSE_DIALOG", "NEUTRALIZE_AND_BACK"],
    });
    expect(reduceUnsavedNavigation("releasing-link", { type: "BACK" })).toEqual({
      phase: "idle",
      effects: ["NAVIGATE_LINK"],
    });
  });

  it("neutralizes and leaves the duplicate behind the current entry when clean", () => {
    expect(reduceUnsavedNavigation("armed", { type: "DEACTIVATE" })).toEqual({
      phase: "cleaning",
      effects: ["CLOSE_DIALOG", "NEUTRALIZE_AND_BACK"],
    });
    expect(reduceUnsavedNavigation("cleaning", { type: "BACK" })).toEqual({
      phase: "idle",
      effects: [],
    });
  });

  it("preserves unrelated Next history state while adding and removing its nonce", () => {
    const state = { __NA: true, tree: ["studio"] };
    const armed = withUnsavedNavigationSentinel(state, "guard-1");
    expect(hasUnsavedNavigationSentinel(armed, "guard-1")).toBe(true);
    expect(withoutUnsavedNavigationSentinel(armed)).toEqual(state);
  });
});

describe("unsaved anchor policy", () => {
  const base = {
    href: "https://example.test/studio/articles",
    currentHref: "https://example.test/studio/editor/post-1",
    button: 0,
    defaultPrevented: false,
    download: false,
    target: "",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };

  it("confirms same-tab navigation that leaves the current document", () => {
    expect(shouldConfirmAnchorNavigation(base)).toBe(true);
  });

  it("allows a same-document hash and non-destructive new-tab gestures", () => {
    expect(shouldConfirmAnchorNavigation({ ...base, href: `${base.currentHref}#title` }))
      .toBe(false);
    expect(shouldConfirmAnchorNavigation({ ...base, metaKey: true })).toBe(false);
    expect(shouldConfirmAnchorNavigation({ ...base, target: "_blank" })).toBe(false);
  });
});
