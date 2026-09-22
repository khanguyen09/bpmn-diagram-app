import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  BpmnDataStoreCleanupDialog,
  BpmnDeleteImpactDialog,
  BpmnReparentDialog,
} from "./bpmn-lifecycle-dialogs";

const noop = vi.fn();

const lifecycleImplementationJargon =
  /teb-(?:core|collaboration)-[\w-]+@\d+|stable ID|exact hierarchy|references?|commit|Definitions roots?|cascade|FlowNode|exact target|unknown owner|zero supported reference|\b(?:refs?|container|profile|ACK|CAS|Process|Pool|Lane|XML|Model ID|Revision|Versions?|restore-version|successor-draft|history|candidate|worker)\b/iu;

function withoutDiagnosticDetails(html: string) {
  return html.replace(/<details[\s\S]*?<\/details>/gi, "").replace(/<[^>]*>/g, " ");
}

function footerMarkup(html: string) {
  return html.slice(html.indexOf("<footer>"));
}

describe("BPMN lifecycle dialogs", () => {
  it("uses plain reparent copy while keeping diagnostic IDs collapsed", () => {
    const html = renderToStaticMarkup(
      <BpmnReparentDialog
        dialogRef={createRef<HTMLDialogElement>()}
        sourceLabel="Duyệt bài viết"
        sourceContainerLabel="Quy trình biên tập"
        targets={[
          {
            id: "Sub_1",
            label: "Chuẩn bị nội dung",
            detail: "Sub_1",
          },
        ]}
        targetId="Sub_1"
        laneTargets={[]}
        targetLaneId=""
        impact={[{ label: "Phần tử liên quan", ids: ["Task_1"] }]}
        blockers={["Luồng kết nối sẽ vượt khỏi vị trí mới."]}
        onTargetChange={noop}
        onTargetLaneChange={noop}
        onCancel={noop}
        onConfirm={noop}
        onClose={noop}
      />,
    );
    const primaryCopy = withoutDiagnosticDetails(html);
    const footer = footerMarkup(html);

    expect(html).toContain("Di chuyển phần tử");
    expect(html).toContain("Vị trí hiện tại");
    expect(html).toContain("Vị trí mới");
    expect(html).toContain("<summary>Xem mã phần tử</summary>");
    expect(html).toMatch(/<details>[\s\S]*?<code>Task_1<\/code>[\s\S]*?<\/details>/);
    expect(primaryCopy).not.toContain("Task_1");
    expect(primaryCopy.match(lifecycleImplementationJargon)?.[0] ?? null).toBeNull();
    expect(footer.indexOf(">Huỷ<")).toBeLessThan(
      footer.indexOf(">Di chuyển phần tử<"),
    );
    expect(html).toContain("autofocus");
  });

  it("announces destructive delete impact in plain language and hides IDs in details", () => {
    const html = renderToStaticMarkup(
      <BpmnDeleteImpactDialog
        dialogRef={createRef<HTMLDialogElement>()}
        subjectLabel="Nhóm duyệt bài"
        groups={[
          { label: "Nội dung bên trong", ids: ["Task_1", "Task_2"] },
        ]}
        retainedRootIds={["DataStore_1"]}
        onCancel={noop}
        onConfirm={noop}
        onClose={noop}
      />,
    );
    const primaryCopy = withoutDiagnosticDetails(html);
    const footer = footerMarkup(html);

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Xoá phần tử này?");
    expect(html).toContain("Dữ liệu dùng chung vẫn được giữ lại");
    expect(html).toContain("<summary>Xem mã dữ liệu được giữ lại</summary>");
    expect(html).toMatch(
      /<details>[\s\S]*?<code>DataStore_1<\/code>[\s\S]*?<\/details>/,
    );
    expect(primaryCopy).not.toMatch(/Task_1|Task_2|DataStore_1/);
    expect(primaryCopy).not.toMatch(lifecycleImplementationJargon);
    expect(footer.indexOf(">Huỷ<")).toBeLessThan(
      footer.indexOf(">Xoá phần tử<"),
    );
    expect(html).toContain("autofocus");
  });

  it("omits zero-impact rows and escapes the named subject", () => {
    const html = renderToStaticMarkup(<BpmnDeleteImpactDialog
      dialogRef={createRef<HTMLDialogElement>()} subjectLabel={'<script>name</script>'}
      groups={[{ label: "Không liên quan", ids: [] }]} retainedRootIds={[]}
      onCancel={noop} onConfirm={noop} onClose={noop} />);
    expect(html).toContain("bpmn-delete-impact-dialog");
    expect(html).not.toContain("Không liên quan");
    expect(html).toContain("Không có nội dung liên quan cần xoá kèm.");
    expect(html).toContain("&lt;script&gt;name&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("keeps DataStore cleanup plain while exposing IDs only on request", () => {
    const html = renderToStaticMarkup(
      <BpmnDataStoreCleanupDialog
        dialogRef={createRef<HTMLDialogElement>()}
        stores={[
          {
            id: "DataStore_A",
            name: "Kho",
            referenceIds: [],
          },
        ]}
        onCancel={noop}
        onConfirm={noop}
        onClose={noop}
      />,
    );
    const primaryCopy = withoutDiagnosticDetails(html);
    const footer = footerMarkup(html);

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Xoá kho dữ liệu không dùng");
    expect(html).toContain("0 nơi dùng");
    expect(html).toContain("<summary>Xem mã kho dữ liệu</summary>");
    expect(html).toMatch(
      /<details>[\s\S]*?<code>DataStore_A<\/code>[\s\S]*?<\/details>/,
    );
    expect(primaryCopy).not.toContain("DataStore_A");
    expect(primaryCopy).not.toMatch(lifecycleImplementationJargon);
    expect(footer.indexOf(">Huỷ<")).toBeLessThan(
      footer.indexOf(">Xoá kho dữ liệu<"),
    );
    expect(html).toContain("autofocus");
  });
});
