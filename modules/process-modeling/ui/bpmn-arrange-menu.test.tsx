import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BpmnArrangeMenu } from "./bpmn-arrange-menu";

describe("BPMN arrange menu", () => {
  it("names the multi-selection and exposes only bounded native actions", () => {
    const html = renderToStaticMarkup(
      <BpmnArrangeMenu
        selectionCount={3}
        canAlign
        canDistribute
        onArrange={vi.fn()}
      />,
    );
    expect(html).toContain("Sắp xếp 3 thành phần đang chọn");
    expect(html).toContain("Căn trái");
    expect(html).toContain("Căn giữa trái–phải");
    expect(html).toContain("Căn giữa trên–dưới");
    expect(html).toContain("Căn dưới");
    expect(html).toContain("Giãn đều theo chiều ngang");
    expect(html).toContain("Giãn đều theo chiều dọc");
    expect(html).not.toContain("minimap");
  });

  it("disables distribution for a two-shape selection", () => {
    const html = renderToStaticMarkup(
      <BpmnArrangeMenu
        selectionCount={2}
        canAlign
        canDistribute={false}
        onArrange={vi.fn()}
      />,
    );
    expect(html).toMatch(/disabled=""[^>]*>Giãn đều theo chiều ngang/u);
  });

  it("explains the disabled state without opening an empty menu", () => {
    const html = renderToStaticMarkup(
      <BpmnArrangeMenu
        selectionCount={1}
        canAlign={false}
        canDistribute={false}
        onArrange={vi.fn()}
      />,
    );

    expect(html).toContain("aria-disabled=\"true\"");
    expect(html).toContain(
      "title=\"Chọn ít nhất 2 thành phần phù hợp để sắp xếp\"",
    );
  });
});
