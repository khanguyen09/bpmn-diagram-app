import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BpmnDownloadDialog } from "./bpmn-download-dialog";

describe("BPMN download dialog", () => {
  it("offers three named, centered and non-mutating download choices", () => {
    const html = renderToStaticMarkup(
      <BpmnDownloadDialog
        open
        busy={false}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(html).toContain("bpmn-confirm-dialog bpmn-download-dialog");
    expect(html).toContain("Chọn định dạng tải xuống");
    expect(html).toContain("không thay đổi bản nháp");
    expect(html).toContain("Tệp quy trình");
    expect(html).toContain("Ảnh vector");
    expect(html).toContain("Ảnh thông thường");
    expect(html).toContain('data-dialog-initial-focus="true"');
    expect(html).not.toMatch(
      /teb-(?:core|collaboration)-[\w-]+@\d+|\b(?:profile|ACK|CAS|FlowNode|Process|Pool|Lane|XML|DI|Model ID|Revision|Versions?|restore-version|successor-draft|commit|history|candidate|worker)\b/iu,
    );
  });
});
