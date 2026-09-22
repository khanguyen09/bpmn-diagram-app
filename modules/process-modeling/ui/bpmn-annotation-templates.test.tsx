import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { appendBpmnAnnotationTemplate, bpmnAnnotationTemplates, BpmnAnnotationTemplates } from "./bpmn-annotation-templates";

describe("BPMN annotation templates", () => {
  it("preserves exact authored text and appends an editable plain-text template", () => {
    const original = "  Giữ nguyên nội dung tác giả.\n";
    expect(appendBpmnAnnotationTemplate(original, bpmnAnnotationTemplates[0])).toBe(original + "\n\n" + bpmnAnnotationTemplates[0].text);
  });
  it("uses the 2000 grapheme cap, without truncating text or splitting Vietnamese characters", () => {
    const template = { id: "test", label: "Test", text: "a", colorId: null };
    expect(appendBpmnAnnotationTemplate("a\u0301".repeat(1997), template)).not.toBeNull();
    expect(appendBpmnAnnotationTemplate("a\u0301".repeat(1998), template)).toBeNull();
    expect(appendBpmnAnnotationTemplate("hello\u0000", template)).toBeNull();
  });
  it("offers named controls and disables templates that cannot fit", () => {
    const html = renderToStaticMarkup(<BpmnAnnotationTemplates value={"a".repeat(2000)} onAppend={vi.fn()} />);
    expect(html).toContain('aria-label="Thêm mẫu chú thích"');
    expect(html.match(/disabled=""/g)).toHaveLength(5);
    expect(html).toContain("Rút gọn nội dung");
    expect(html).toContain("Quy ước màu");
  });
});
