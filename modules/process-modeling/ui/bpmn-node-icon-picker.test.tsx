import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { nodeIconCatalogue } from "../domain/node-visual";
import { BpmnNodeIconPicker, filterNodeIcons } from "./bpmn-node-icon-picker";
import { nodeIconComponents } from "./bpmn-node-icons";

describe("illustrative icon picker", () => {
  it("renders every local icon with a named pressed-state control", () => {
    const html = renderToStaticMarkup(<BpmnNodeIconPicker value="automation" onChange={() => {}} />);
    expect(Object.keys(nodeIconComponents).sort()).toEqual(nodeIconCatalogue.map((item) => item.id).sort());
    expect(html.match(/aria-pressed=/g)).toHaveLength(36);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain("Chọn biểu tượng Tự động");
    expect(html).toContain("Tìm biểu tượng");
    expect(html).toContain('class="bpmn-node-icon-grid"');
    expect(html).toContain('role="status"');
  });
  it("searches Vietnamese labels without accents and supports empty results", () => {
    expect(filterNodeIcons("  HOA DON ").map((item) => item.id)).toEqual(["receipt"]);
    expect(filterNodeIcons("tu dong").map((item) => item.id)).toEqual(["automation"]);
    expect(filterNodeIcons("not-a-real-icon")).toEqual([]);
    expect(filterNodeIcons("")).toHaveLength(36);
  });
  it("shows an explicit no-icon state with a disabled remove action", () => {
    const html = renderToStaticMarkup(<BpmnNodeIconPicker value={null} onChange={() => {}} />);
    expect(html).toContain("Không dùng");
    expect(html).toMatch(/disabled="" aria-label="Bỏ biểu tượng"/);
    expect(html).not.toContain('aria-pressed="true"');
  });
});
