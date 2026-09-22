import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bpmnElementColorPalette } from "../domain/full-authoring";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function cssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`),
  );
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1]!;
}

function cssHexToken(css: string, token: string) {
  const match = css.match(
    new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(#[0-9a-f]{6})`, "i"),
  );
  if (!match) throw new Error(`Missing six-digit CSS color token ${token}`);
  return match[1]!;
}

function cssHexProperty(rule: string, property: string) {
  const match = rule.match(
    new RegExp(
      `${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(#[0-9a-f]{6})`,
      "i",
    ),
  );
  if (!match) throw new Error(`Missing six-digit CSS color ${property}`);
  return match[1]!;
}

function cssAtRuleBodies(css: string, atRule: string) {
  const bodies: string[] = [];
  let searchFrom = 0;

  while (searchFrom < css.length) {
    const headerIndex = css.indexOf(atRule, searchFrom);
    if (headerIndex < 0) break;
    const openBrace = css.indexOf("{", headerIndex + atRule.length);
    if (openBrace < 0) break;

    let depth = 1;
    let cursor = openBrace + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1;
      if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) throw new Error(`Unclosed CSS at-rule ${atRule}`);

    bodies.push(css.slice(openBrace + 1, cursor - 1));
    searchFrom = cursor;
  }

  return bodies;
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => channel(Number.parseInt(value, 16)));
  if (!channels || channels.length !== 3) throw new Error(`Invalid hex ${hex}`);
  return (
    0.2126 * channels[0]! +
    0.7152 * channels[1]! +
    0.0722 * channels[2]!
  );
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("BPMN visual accessibility contract", () => {
  it("keeps the shared focus indicator above non-text contrast minimum", () => {
    const css = source("app/globals.css");
    const focus = cssHexToken(css, "--focus");
    const surface = cssHexToken(css, "--surface");

    expect(contrastRatio(focus, surface)).toBeGreaterThanOrEqual(3);
  });

  it("keeps every persisted BPMN boundary distinct from its fill", () => {
    for (const color of bpmnElementColorPalette) {
      expect(contrastRatio(color.stroke, color.fill), color.id)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every launcher family glyph distinct from its tone fill", () => {
    const css = source("app/globals.css");
    const groupIds = [
      "connections",
      "events",
      "activities",
      "gateways",
      "data-artifacts",
      "collaboration",
    ];

    for (const groupId of groupIds) {
      const groupRule = cssRule(css, `[data-bpmn-tool-group="${groupId}"]`);
      const fill = cssHexProperty(groupRule, "--bpmn-tool-tone-fill");
      const ink = cssHexProperty(groupRule, "--bpmn-tool-tone-ink");

      expect(contrastRatio(ink, fill), groupId).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps launcher, icon and color controls at least 44 by 44 CSS pixels", () => {
    const css = source("app/globals.css");
    const launcherTile = cssRule(css, ".bpmn-component-tile__button");
    const nodeIcon = cssRule(css, ".bpmn-node-icon-grid > button");
    const colorRadio = cssRule(
      css,
      '.bpmn-element-color-picker [role="radio"]',
    );

    expect(launcherTile).toMatch(/min-width:\s*44px;/);
    expect(launcherTile).toMatch(/min-height:\s*(?:4[4-9]|[5-9]\d)px;/);
    expect(nodeIcon).toMatch(/min-width:\s*(?:4[4-9]|[5-9]\d)px;/);
    expect(nodeIcon).toMatch(/min-height:\s*(?:4[4-9]|[5-9]\d)px;/);
    expect(colorRadio).toMatch(/min-height:\s*(?:4[4-9]|[5-9]\d)px;/);
  });

  it("keeps the hidden icon legend constrained and search layout stronger than generic form labels", () => {
    const css = source("app/globals.css");
    expect(css).not.toContain(".bpmn-node-icon-picker legend");
    expect(cssRule(css, ".sr-only")).toMatch(/width:\s*1px;/);
    const search = cssRule(css, ".bpmn-inspector-form .bpmn-node-icon-search");
    expect(search).toMatch(/display:\s*flex;/);
    expect(search).toMatch(/min-width:\s*0;/);
  });

  it("wires one roving color tab stop with Arrow, Home and End navigation", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(studio).toContain("nextBpmnElementColorIndex(");
    expect(studio).toContain("checked || isFallbackTabStop ? 0 : -1");
    expect(studio).toContain("data-bpmn-color-id={color.id}");
    expect(studio).toContain("event.currentTarget.closest(");
    expect(studio).toContain("applyElementColor(nextColor.id)");
    expect(studio).toContain("nextButton?.focus()");
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ]) {
      expect(studio).toContain(`"${key}"`);
    }
  });

  it("preserves visible focus and selected state in forced-colors mode", () => {
    const css = source("app/globals.css");
    const forcedColors = cssAtRuleBodies(
      css,
      "@media (forced-colors: active)",
    ).join("\n");
    const nodePickerFocus = cssRule(
      css,
      ".bpmn-node-icon-picker button:focus-visible",
    );
    const forcedNodePickerState = cssRule(
      forcedColors,
      '.bpmn-node-icon-picker button[aria-pressed="true"],\n  .bpmn-node-icon-picker button:focus-visible',
    );
    const forcedColorState = cssRule(
      forcedColors,
      '.bpmn-element-color-picker [role="radio"].is-selected,\n  .bpmn-element-color-picker [role="radio"]:focus-visible',
    );

    expect(forcedColors.length).toBeGreaterThan(0);
    expect(nodePickerFocus).not.toMatch(/outline:\s*none;/);
    expect(nodePickerFocus).toMatch(/outline:\s*3px solid var\(--focus\);/);
    expect(forcedNodePickerState).toMatch(
      /outline:\s*3px solid Highlight;/,
    );
    expect(forcedNodePickerState).toContain("forced-color-adjust: none;");
    expect(forcedColorState).toMatch(/outline:\s*3px solid Highlight;/);
    expect(forcedColorState).toContain("forced-color-adjust: none;");
    const forcedInspectorState = cssRule(
      forcedColors,
      '.bpmn-outline button[aria-current="true"],\n  .bpmn-studio__tabs button[aria-selected="true"],\n  .bpmn-studio__subtabs button[aria-selected="true"]',
    );
    for (const state of [forcedNodePickerState, forcedColorState, forcedInspectorState]) {
      expect(state).toContain("background: Canvas;");
      expect(state).toContain("color: CanvasText;");
    }
    expect(forcedInspectorState).toContain("text-decoration: underline;");
    expect(forcedInspectorState).toContain("font-weight: 700;");
  });
});
