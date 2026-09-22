"use client";
import { useEffect, useRef, useState } from "react";
import { FolderPlus, FolderInput, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { ModalDialog } from "@/shared/ui/modal-dialog";
import type { ProcessModelFolderClient } from "../application/process-model-persistence-client";
import { folderNameSchema, type ProcessModelFolder } from "../domain/model-folders";

export interface FolderSelection { readonly id: string; readonly title: string; readonly expectedFolderRevision: number }
export function BpmnFolderTools({ client, reloadKey, filter, onFilterChange, selected, onClearSelection, onChanged }: {
  readonly client: ProcessModelFolderClient; readonly reloadKey: number; readonly filter: string;
  readonly onFilterChange: (value: string) => void; readonly selected: readonly FolderSelection[];
  readonly onClearSelection: () => void; readonly onChanged: () => void;
}) {
  const [folders, setFolders] = useState<readonly ProcessModelFolder[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [dialog, setDialog] = useState<"create" | "rename" | "remove" | "move" | null>(null);
  const [name, setName] = useState("");
  const [dialogFolder, setDialogFolder] = useState<ProcessModelFolder | null>(null);
  const [destination, setDestination] = useState("unfiled");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingCreate = useRef<{ name: string; id: string } | null>(null);
  const currentFolder = folders.find(folder => folder.id === filter);
  useEffect(() => {
    let active = true;
    void client.list().then(items => {
      if (active) { setFolders(items); setLoadError(false); }
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, reloadKey, refresh]);
  const open = (kind: NonNullable<typeof dialog>) => {
    setDialogFolder(currentFolder ?? null);
    setError(null); setName(kind === "rename" ? currentFolder?.name ?? "" : "");
    setDestination(currentFolder?.id ?? "unfiled"); setDialog(kind); pendingCreate.current = null;
  };
  const close = () => { if (!busy) setDialog(null); };
  const submit = async () => {
    if (!dialog || busy) return;
    const parsedName = folderNameSchema.safeParse(name);
    if ((dialog === "create" || dialog === "rename") && !parsedName.success) { setError("Nhập tên thư mục từ 1 đến 80 ký tự."); return; }
    setBusy(true); setError(null);
    try {
      let result;
      if (dialog === "create") {
        const normalizedName = parsedName.data!;
        if (pendingCreate.current?.name !== normalizedName) pendingCreate.current = { name: normalizedName, id: crypto.randomUUID() };
        result = await client.create(pendingCreate.current);
      } else if (dialog === "move") {
        result = await client.move({ folderId: destination === "unfiled" ? null : destination, models: selected.map(({ id, expectedFolderRevision }) => ({ id, expectedFolderRevision })) });
      } else {
        if (!dialogFolder) { setError("Thư mục đã thay đổi. Hãy đóng cửa sổ và tải lại danh sách."); return; }
        result = dialog === "rename" ? await client.rename(dialogFolder.id, { name: parsedName.data!, expectedRevision: dialogFolder.revision }) : await client.remove(dialogFolder.id, dialogFolder.revision);
      }
      if (["saved", "moved", "deleted"].includes(result.kind)) {
        setNotice(dialog === "move" ? `Đã chuyển ${selected.length} quy trình.` : dialog === "remove" ? "Đã xoá thư mục. Các quy trình được giữ trong Chưa xếp thư mục." : "Đã lưu thư mục.");
        if (dialog === "remove") onFilterChange("unfiled");
        if (dialog === "move") onClearSelection();
        setDialog(null); setRefresh(value => value + 1); onChanged();
      } else {
        setError(result.kind === "duplicate" ? "Tên thư mục đã có. Hãy chọn tên khác." : result.kind === "limit" ? "Đã đạt giới hạn 200 thư mục." : "Danh sách đã thay đổi ở nơi khác. Hãy đóng cửa sổ, tải lại và chọn lại quy trình.");
        if (result.kind === "conflict" || result.kind === "not-found") { setRefresh(value => value + 1); onChanged(); }
      }
    } catch { setError("Chưa xác nhận được thay đổi. Bạn có thể thử lại; quy trình vẫn được giữ nguyên."); }
    finally { setBusy(false); }
  };
  const title = dialog === "create" ? "Tạo thư mục" : dialog === "rename" ? "Đổi tên thư mục" : dialog === "remove" ? "Xoá thư mục" : "Chuyển quy trình vào thư mục";
  return <section className="bpmn-folder-tools" aria-label="Sắp xếp quy trình theo thư mục">
    <div className="bpmn-folder-tools__bar">
      <div className="bpmn-folder-tools__filter"><label id="bpmn-folder-filter-label">Thư mục</label><Select id="bpmn-folder-filter" labelledBy="bpmn-folder-filter-label" value={filter} disabled={loading || loadError} onValueChange={onFilterChange} options={[{ value: "all", label: "Tất cả quy trình" }, { value: "unfiled", label: "Chưa xếp thư mục" }, ...folders.map(folder => ({ value: folder.id, label: `${folder.name} (${folder.modelCount})` }))]} /></div>
      <Button variant="secondary" onClick={() => open("create")} disabled={loading || loadError}><FolderPlus size={17} strokeWidth={1.5} aria-hidden="true" />Tạo thư mục</Button>
      {currentFolder ? <><Button variant="ghost" onClick={() => open("rename")}><Pencil size={16} strokeWidth={1.5} aria-hidden="true" />Đổi tên thư mục</Button><Button variant="ghost" onClick={() => open("remove")}><Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />Xoá thư mục</Button></> : null}
    </div>
    {loadError ? <p role="alert">Chưa tải được thư mục. <Button variant="ghost" onClick={() => setRefresh(value => value + 1)}>Thử lại thư mục</Button></p> : null}
    {selected.length ? <div className="bpmn-folder-tools__selection"><span>Đã chọn {selected.length} quy trình</span><Button variant="secondary" disabled={loading || loadError} onClick={() => open("move")}><FolderInput size={17} strokeWidth={1.5} aria-hidden="true" />Chuyển vào thư mục</Button><Button variant="ghost" onClick={onClearSelection}>Bỏ chọn</Button></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <ModalDialog open={dialog !== null} onRequestClose={close} className="bpmn-folder-dialog" aria-labelledby="bpmn-folder-dialog-title" role={dialog === "remove" ? "alertdialog" : "dialog"}>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <h2 id="bpmn-folder-dialog-title">{title}</h2>
        {dialog === "create" || dialog === "rename" ? <div className="bpmn-library__field"><label htmlFor="bpmn-folder-name">Tên thư mục</label><input id="bpmn-folder-name" data-dialog-initial-focus value={name} maxLength={80} onChange={event => setName(event.target.value)} disabled={busy} placeholder="Ví dụ: Ticket Platform" /></div> : null}
        {dialog === "move" ? <><p>Chuyển {selected.length} quy trình đã chọn. Nội dung và các mốc lưu được giữ nguyên.</p><label id="bpmn-folder-destination-label">Thư mục đích</label><Select id="bpmn-folder-destination" labelledBy="bpmn-folder-destination-label" value={destination} onValueChange={setDestination} disabled={busy} options={[{ value: "unfiled", label: "Chưa xếp thư mục" }, ...folders.map(folder => ({ value: folder.id, label: folder.name }))]} /></> : null}
        {dialog === "remove" ? <p>Chỉ xoá thư mục “{dialogFolder?.name}”. Các quy trình bên trong sẽ chuyển về Chưa xếp thư mục; nội dung và lịch sử không bị xoá.</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <footer><Button type="button" variant="ghost" disabled={busy} onClick={close} data-dialog-initial-focus={dialog === "remove" ? true : undefined}>Huỷ</Button><Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : title}</Button></footer>
      </form>
    </ModalDialog>
  </section>;
}
