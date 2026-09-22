import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BpmnSwimlaneConversionDialog } from "./bpmn-swimlane-conversion-dialog";

describe("BPMN in-place swimlane conversion dialog", () => {
  it("explains the same-diagram conversion without implementation jargon", () => {
    const html = renderToStaticMarkup(
      <BpmnSwimlaneConversionDialog
        open
        orientation="horizontal"
        state={{ kind: "confirming" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("hai vai trò theo hàng");
    expect(html).toContain("Không tạo sơ đồ mới");
    expect(html).toContain("lịch sử Hoàn tác");
    expect(html).toContain("Chuẩn bị và tiếp tục");
    expect(html).not.toMatch(
      /teb-(?:core|collaboration)-[\w-]+@\d+|\b(?:profile|ACK|CAS|Collaboration|FlowNode|Process|Pool|Lane|XML|DI|Model ID|Revision|Versions?|restore-version|successor-draft|commit|history|candidate|worker|idempotency)\b/iu,
    );
  });

  it("renders a truthful busy and recovery state", () => {
    const busy = renderToStaticMarkup(
      <BpmnSwimlaneConversionDialog
        open
        orientation="vertical"
        state={{ kind: "working" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    const blocked = renderToStaticMarkup(
      <BpmnSwimlaneConversionDialog
        open
        orientation="vertical"
        state={{
          kind: "blocked",
          message: "Chưa thể chuẩn bị sơ đồ. Không có thay đổi nào được áp dụng.",
          canRetry: true,
          secondaryAction: "reload",
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain('role="status"');
    expect(busy).toContain("Đang kiểm tra và chuẩn bị sơ đồ");
    expect(busy).toContain('disabled=""');
    expect(blocked).toContain('role="alert"');
    expect(blocked).toContain("Không có thay đổi nào được áp dụng");
    expect(blocked).toContain("Thử lại");
    expect(blocked).toContain("Tải lại để kiểm tra");
  });
});
