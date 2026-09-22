"use client";

import { Download, FileCode2, Image as ImageIcon, Shapes, X } from "lucide-react";
import type { BpmnDiagramDownloadFormat } from "../application/bpmn-diagram-export";
import { Button } from "@/shared/ui/button";
import { ModalDialog } from "@/shared/ui/modal-dialog";

const downloadOptions = [
  {
    format: "bpmn",
    label: "Tệp quy trình",
    extension: ".bpmn",
    description: "Dùng để mở và tiếp tục chỉnh sửa trong công cụ tương thích.",
    icon: FileCode2,
  },
  {
    format: "svg",
    label: "Ảnh vector",
    extension: ".svg",
    description: "Phù hợp khi cần ảnh sắc nét ở nhiều kích thước.",
    icon: Shapes,
  },
  {
    format: "png",
    label: "Ảnh thông thường",
    extension: ".png",
    description: "Phù hợp để chèn nhanh vào bài viết hoặc tài liệu.",
    icon: ImageIcon,
  },
] as const satisfies readonly {
  readonly format: BpmnDiagramDownloadFormat;
  readonly label: string;
  readonly extension: string;
  readonly description: string;
  readonly icon: typeof Download;
}[];

export function BpmnDownloadDialog({
  open,
  busy,
  onClose,
  onDownload,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onDownload: (format: BpmnDiagramDownloadFormat) => void;
}) {
  return (
    <ModalDialog
      open={open}
      onRequestClose={onClose}
      closeOnEscape={!busy}
      className="bpmn-confirm-dialog bpmn-download-dialog"
      aria-labelledby="bpmn-download-dialog-title"
      aria-describedby="bpmn-download-dialog-description"
    >
      <header>
        <div>
          <h2 id="bpmn-download-dialog-title">Chọn định dạng tải xuống</h2>
          <p id="bpmn-download-dialog-description">
            Sơ đồ sẽ được kiểm tra trước khi tải. Thao tác này không thay đổi
            bản nháp.
          </p>
        </div>
        <Button
          variant="ghost"
          aria-label="Đóng lựa chọn tải xuống"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </header>
      <p>Sơ đồ nhiều bước có thể khó đọc khi thu nhỏ trong tài liệu. Chọn ảnh vector để phóng to vẫn rõ chữ; kiểm tra kích thước hiển thị trước khi chia sẻ.</p>
      <div className="bpmn-download-dialog__options" role="group" aria-label="Định dạng tệp">
        {downloadOptions.map((option, index) => {
          const Icon = option.icon;
          return (
            <button
              key={option.format}
              type="button"
              data-dialog-initial-focus={index === 0 ? "true" : undefined}
              disabled={busy}
              onClick={() => onDownload(option.format)}
            >
              <span className="bpmn-download-dialog__icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <b>{option.extension}</b>
            </button>
          );
        })}
      </div>
      <footer>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Huỷ
        </Button>
        {busy ? <span role="status">Đang chuẩn bị tệp an toàn…</span> : null}
      </footer>
    </ModalDialog>
  );
}
