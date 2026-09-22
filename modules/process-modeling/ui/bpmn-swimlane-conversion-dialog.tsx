"use client";

import { useEffect, useId, useRef } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, UsersRound } from "lucide-react";
import { Button } from "@/shared/ui/button";

export type SwimlaneOrientation = "horizontal" | "vertical";

export type BpmnSwimlaneConversionDialogState =
  | { readonly kind: "confirming" }
  | { readonly kind: "working" }
  | {
      readonly kind: "blocked";
      readonly message: string;
      readonly canRetry: boolean;
      readonly secondaryAction: "close" | "reload";
    };

export function BpmnSwimlaneConversionDialog({
  open,
  orientation,
  state,
  onCancel,
  onConfirm,
  onRetry,
  onClosed,
}: {
  readonly open: boolean;
  readonly orientation: SwimlaneOrientation;
  readonly state: BpmnSwimlaneConversionDialogState;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onRetry: () => void;
  readonly onClosed?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const busy = state.kind === "working";
  const horizontal = orientation === "horizontal";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => cancelRef.current?.focus());
      return;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="bpmn-confirm-dialog bpmn-swimlane-conversion-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={onClosed}
    >
      <span className="mono-label">Thêm khu vực vai trò</span>
      <h2 id={titleId}>
        {horizontal
          ? "Chia quy trình thành hai vai trò theo hàng?"
          : "Chia quy trình thành hai vai trò theo cột?"}
      </h2>
      <p id={descriptionId}>
        Studio sẽ giữ lại các bước, đường nối và vị trí hiện có rồi thêm hai khu
        vực vai trò ngay trong sơ đồ này. Không tạo sơ đồ mới.
      </p>
      <div className="bpmn-swimlane-conversion-dialog__summary">
        <UsersRound size={20} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <strong>{horizontal ? "Vai trò trên và dưới" : "Vai trò trái và phải"}</strong>
          <small>
            Các phiên bản đã chốt không thay đổi. Sau khi hoàn tất, lịch sử Hoàn
            tác trước bước này sẽ bắt đầu lại.
          </small>
        </span>
      </div>
      {state.kind === "working" ? (
        <p
          className="bpmn-swimlane-conversion-dialog__status"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
          Đang kiểm tra và chuẩn bị sơ đồ…
        </p>
      ) : state.kind === "blocked" ? (
        <p
          className="bpmn-swimlane-conversion-dialog__error"
          role="alert"
        >
          <AlertCircle size={18} aria-hidden="true" />
          <span>{state.message}</span>
        </p>
      ) : (
        <p className="bpmn-swimlane-conversion-dialog__assurance">
          <CheckCircle2 size={18} aria-hidden="true" />
          Nếu không thể giữ nguyên an toàn, Studio sẽ dừng trước khi áp dụng.
        </p>
      )}
      <div>
        <button
          ref={cancelRef}
          type="button"
          className="button button--ghost"
          disabled={busy}
          onClick={onCancel}
        >
          {state.kind === "blocked"
            ? state.secondaryAction === "reload"
              ? "Tải lại để kiểm tra"
              : "Đóng"
            : "Huỷ"}
        </button>
        {state.kind === "blocked" && state.canRetry ? (
          <Button onClick={onRetry}>Thử lại</Button>
        ) : state.kind !== "blocked" ? (
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? "Đang chuẩn bị…" : "Chuẩn bị và tiếp tục"}
          </Button>
        ) : null}
      </div>
    </dialog>
  );
}
