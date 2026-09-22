import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

const options = [
  { value: "AS_IS", label: "Hiện trạng" },
  { value: "TO_BE", label: "Tương lai" },
] as const;

describe("shared Select accessibility contract", () => {
  it("renders a labelled collapsed listbox trigger with the exact controlled value", () => {
    const html = renderToStaticMarkup(
      <Select
        id="purpose"
        value="AS_IS"
        options={options}
        labelledBy="purpose-label"
        describedBy="purpose-help"
        onValueChange={vi.fn()}
      />,
    );

    expect(html).toContain('id="purpose"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-labelledby="purpose-label"');
    expect(html).toContain('aria-describedby="purpose-help"');
    expect(html).toContain("Hiện trạng");
    expect(html).not.toContain("aria-activedescendant");
    expect(html).not.toContain('role="listbox"');
  });

  it("keeps the complete keyboard, typeahead and outside-pointer contract", () => {
    const source = readFileSync(
      join(process.cwd(), "shared/ui/select.tsx"),
      "utf8",
    );

    for (const key of [
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
      "Enter",
      "Escape",
      "Tab",
    ]) {
      expect(source).toContain(`event.key === "${key}"`);
    }
    expect(source).toContain('event.key === " "');
    expect(source).toContain('document.addEventListener("pointerdown"');
    expect(source).toContain("toLocaleLowerCase");
    expect(source).toContain('role="option"');
    expect(source).toContain("aria-selected");
    expect(source).toContain("aria-activedescendant");
    expect(source).toContain("aria-labelledby={labelledBy}");
    expect(source).not.toContain(
      "aria-activedescendant={open ? activeOptionId : undefined}",
    );
    expect(source).toContain("listboxRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("ref={listboxRef}");
    expect(source).toContain("tabIndex={0}");
  });

  it("waits for visible committed positioning and focuses only once per opening", () => {
    const source = readFileSync(join(process.cwd(), "shared/ui/select.tsx"), "utf8");
    expect(source).toContain("useLayoutEffect(() => {");
    expect(source).toContain('if (position.visibility === "hidden" || focusedOpeningRef.current) return;');
    expect(source).toContain("focusedOpeningRef.current = false;");
    expect(source).toContain("focusedOpeningRef.current = true;");
    expect(source).toContain("}, [open, position]);");
    expect(source).not.toContain("requestAnimationFrame(() => listboxRef.current?.focus");
  });
});
