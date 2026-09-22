"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenedProcessModel, ProcessModelPersistenceClient } from "../application/process-model-persistence-client";
import { Button } from "@/shared/ui/button";
import { ModalDialog } from "@/shared/ui/modal-dialog";
import { recoveryCopyInput, recoverySnapshotFingerprint, type BpmnRecoverySnapshot } from "../application/bpmn-conflict-recovery";

export function BpmnConflictDialog({ open, modelId, persistence, capture, isCurrent, download, onClose, onOpenServer }: {
  readonly open: boolean;
  readonly modelId: string;
  readonly persistence: ProcessModelPersistenceClient;
  readonly capture: () => Promise<BpmnRecoverySnapshot>;
  readonly isCurrent: (snapshot: BpmnRecoverySnapshot) => boolean;
  readonly download: (xml: string, title: string) => void;
  readonly onClose: () => void;
  readonly onOpenServer: () => void;
}) {
  const [server, setServer] = useState<OpenedProcessModel | null>(null);
  const [local, setLocal] = useState<BpmnRecoverySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Đang đọc hai bản để đối chiếu…");
  const [preserved, setPreserved] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);
  const pending = useRef<ReturnType<typeof recoveryCopyInput> | null>(null);
  const busyRef = useRef(false);
  const captureRef = useRef(capture);
  useEffect(() => { captureRef.current = capture; }, [capture]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([persistence.openModel(modelId), captureRef.current()]).then(([remote, current]) => {
      if (cancelled) return;
      setServer(remote);
      setLocal(current);
      setNotice("Tự động lưu đã tạm dừng. Giữ một bản sao trước khi mở bản máy chủ.");
    }).catch(() => {
      if (!cancelled) setNotice("Chưa đọc được bản máy chủ. Bạn vẫn có thể tải bản đang sửa hoặc thử mở lại hộp thoại.");
    });
    return () => { cancelled = true; };
  }, [open, modelId, persistence]);

  const preserve = async (asCopy: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const current = await capture();
      setLocal(current);
      if (!asCopy) {
        download(current.xml, `${current.title} — bản khôi phục`);
        setPreserved(recoverySnapshotFingerprint(current));
        setNotice("Đã tạo tệp tải xuống của bản đang sửa. Hãy giữ tệp này để nhập lại khi cần.");
        return;
      }
      // An uncertain create is retried with its exact original key and payload.
      pending.current ??= recoveryCopyInput(current, `recover-model:${crypto.randomUUID()}`);
      const command = pending.current;
      const copy = await persistence.createModel(command);
      pending.current = null;
      setCopyId(copy.modelId);
      if (command.xml === current.xml && command.description === current.description && command.purpose === current.purpose && command.profileId === current.profileId && command.title === recoveryCopyInput(current, "").title && isCurrent(current)) {
        setPreserved(recoverySnapshotFingerprint(current));
        setNotice("Đã lưu bản đang sửa thành sơ đồ riêng. Bây giờ có thể mở bản máy chủ.");
      } else {
        setNotice("Đã xác nhận bản sao trước đó. Có chỉnh sửa mới hơn; hãy giữ thêm bản hiện tại trước khi mở bản máy chủ.");
      }
    } catch {
      setNotice(asCopy ? "Chưa xác nhận được bản sao. Bản đang sửa vẫn được giữ; thử lại sẽ dùng cùng yêu cầu để tránh tạo trùng." : "Chưa tải được bản đang sửa. Hãy thử lại; sơ đồ vẫn được giữ.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const canOpen = Boolean(server && local && preserved === recoverySnapshotFingerprint(local) && isCurrent(local));
  return <ModalDialog open={open} onRequestClose={onClose} closeOnEscape={!busy} className="bpmn-leave-dialog bpmn-conflict-dialog" aria-labelledby="bpmn-conflict-title" aria-describedby="bpmn-conflict-description">
    <section>
      <h2 id="bpmn-conflict-title">Giữ cả hai bản chỉnh sửa</h2>
      <p id="bpmn-conflict-description">Máy chủ có bản mới hơn. Đối chiếu và giữ bản đang sửa để tiếp tục mà không ghi đè công việc ở tab khác.</p>
      {local && server ? <dl className="bpmn-conflict-comparison">
        <div><dt>Bản đang sửa</dt><dd>{local.title}</dd><dd>{new TextEncoder().encode(local.xml).length.toLocaleString("vi-VN")} byte</dd></div>
        <div><dt>Bản máy chủ</dt><dd>{server.title}</dd><dd>{new TextEncoder().encode(server.xml).length.toLocaleString("vi-VN")} byte</dd></div>
        <div><dt>Đối chiếu</dt><dd>{local.xml === server.xml ? "Nội dung tệp giống nhau." : "Nội dung hoặc bố cục tệp khác nhau."} {local.title === server.title ? "Tên giống nhau." : "Tên khác nhau."} {local.description !== server.description ? "Mô tả khác nhau." : ""} {local.profileId !== server.profileId ? "Khả năng BPMN khác nhau." : ""}</dd></div>
      </dl> : null}
      <p role="status">{notice}</p>
      {copyId ? <p>Bản sao đã lưu: <a href={`/studio/diagram/${encodeURIComponent(copyId)}`} target="_blank" rel="noopener noreferrer">Mở sơ đồ khôi phục trong tab mới</a></p> : null}
      <footer>
        <Button data-dialog-initial-focus variant="secondary" disabled={busy} onClick={onClose}>Ở lại</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void preserve(false)}>Tải bản đang sửa</Button>
        <Button variant="ghost" disabled={busy || !server} onClick={() => { if (server) download(server.xml, `${server.title} — bản máy chủ`); }}>Tải bản máy chủ</Button>
        <Button disabled={busy} onClick={() => void preserve(true)}>{busy ? "Đang giữ bản…" : "Lưu thành sơ đồ riêng"}</Button>
        <Button variant="secondary" disabled={busy || !canOpen} onClick={() => { if (local && isCurrent(local)) onOpenServer(); }}>Mở bản máy chủ</Button>
      </footer>
    </section>
  </ModalDialog>;
}
