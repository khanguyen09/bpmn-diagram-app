"use client";

import Link from "next/link";
import { BpmnFolderTools, type FolderSelection } from "./bpmn-folder-tools";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  GitCommitHorizontal,
  Plus,
  Route,
  X,
  Trash2,
  UserRound,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ProcessModelSummary,
  ProcessModelPersistenceClient,
} from "../application/process-model-persistence-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { ModalDialog } from "@/shared/ui/modal-dialog";
import {
  coreBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreFullAuthoringBpmnProfile,
  supportsActivityContainers,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  collaborationBpmnProfile,
  collaborationComplexRoutingBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
  isCollaborationBpmnProfileId,
} from "../domain/collaboration-profile";

function purposeLabel(purpose: ProcessModelSummary["purpose"]) {
  return {
    AS_IS: "Hiện trạng",
    TO_BE: "Tương lai",
    REFERENCE: "Tham chiếu",
  }[purpose];
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Không rõ";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function bpmnLibraryPageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  return Array.from({ length: Math.min(5, pageCount) }, (_, index) => start + index);
}

export const bpmnFullAuthoringCreationProfiles = [
  {
    id: collaborationSwimlaneLayoutsBpmnProfile.id,
    label: "Cộng tác theo vai trò · khuyên dùng",
  },
  {
    id: coreComplexRoutingBpmnProfile.id,
    label: "Quy trình nội bộ nâng cao",
  },
  {
    id: collaborationComplexRoutingBpmnProfile.id,
    label: "Quy trình cộng tác nâng cao",
  },
] as const;

const purposeOptions = [
  { value: "AS_IS", label: "Hiện trạng" },
  { value: "TO_BE", label: "Tương lai" },
  { value: "REFERENCE", label: "Tham chiếu" },
] as const;

export const bpmnCreationProfileOptions = [
  ...bpmnFullAuthoringCreationProfiles,
  { id: coreBpmnProfile.id, label: "Nội bộ cơ bản · phiên bản cũ" },
  {
    id: collaborationBpmnProfile.id,
    label: "Cộng tác có vùng vai trò phẳng · phiên bản cũ",
  },
  {
    id: collaborationNestedBpmnProfile.id,
    label: "Cộng tác có vùng vai trò hai cấp · phiên bản cũ",
  },
].map((option) => ({ value: option.id, label: option.label }));

export function advancedAuthoringStarterXml(xml: string): string {
  if (xml.includes('id="Process_TEB_Callable"')) return xml;
  const callableProcess = [
    '  <bpmn:process id="Process_TEB_Callable" name="Quy trình tái sử dụng" isExecutable="false" />',
  ].join("\n");
  return xml.replace(
    /\s*<\/bpmn:definitions>\s*$/,
    `\n${callableProcess}\n</bpmn:definitions>`,
  );
}

export function bpmnCreationSeed(
  profileId: BpmnProfileId,
  starterXml: string,
  collaborationStarterXml?: string,
): { readonly description: string; readonly xml: string } {
  const collaboration = isCollaborationBpmnProfileId(profileId);
  const selectedStarter = collaboration
    ? (collaborationStarterXml ?? starterXml)
    : starterXml;
  return {
    description:
      profileId === collaborationSwimlaneLayoutsBpmnProfile.id
        ? "Tạo sơ đồ phân vai theo hàng hoặc cột."
        : collaboration
          ? "Tạo sơ đồ cộng tác đầy đủ."
          : "Tạo sơ đồ nội bộ đầy đủ.",
    xml: supportsActivityContainers(profileId)
      ? advancedAuthoringStarterXml(selectedStarter)
      : selectedStarter,
  };
}

function profileLabel(profileId: string) {
  return profileId === collaborationSwimlaneLayoutsBpmnProfile.id
    ? "Cộng tác theo vai trò"
    : profileId === collaborationComplexRoutingBpmnProfile.id
    ? "Cộng tác nâng cao"
    : profileId === coreComplexRoutingBpmnProfile.id
      ? "Quy trình nội bộ nâng cao"
    : profileId === collaborationFullAuthoringBpmnProfile.id
    ? "Cộng tác đầy đủ"
    : profileId === coreFullAuthoringBpmnProfile.id
      ? "Quy trình nội bộ đầy đủ"
    : profileId === collaborationNestedBpmnProfile.id
    ? "Cộng tác có phân vai hai cấp"
    : profileId === collaborationBpmnProfile.id
      ? "Cộng tác có phân vai một cấp"
    : "Quy trình nội bộ cơ bản";
}

function profileHelp(profileId: BpmnProfileId) {
  return profileId === collaborationSwimlaneLayoutsBpmnProfile.id
    ? "Phù hợp khi quy trình có nhiều vai trò hoặc phòng ban, trình bày theo hàng hay cột."
    : isCollaborationBpmnProfileId(profileId)
      ? "Phù hợp khi cần thể hiện nhiều bên tham gia và vùng vai trò."
      : "Phù hợp với quy trình nội bộ của một bên, không cần chia vùng vai trò.";
}

export function BpmnModelLibrary({
  persistence,
  starterXml,
  collaborationStarterXml,
  initialCreateIntent = null,
}: {
  readonly persistence: ProcessModelPersistenceClient;
  readonly starterXml: string;
  readonly collaborationStarterXml?: string;
  readonly initialCreateIntent?: "swimlane" | null;
}) {
  const router = useRouter();
  const [folderFilter, setFolderFilter] = useState("all");
  const [folderSelection, setFolderSelection] = useState<readonly FolderSelection[]>([]);
  const [models, setModels] = useState<readonly (ProcessModelSummary & { createdAt: string; createdByName: string })[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ProcessModelSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] =
    useState<ProcessModelSummary["purpose"]>("AS_IS");
  const [profileId, setProfileId] =
    useState<BpmnProfileId>(collaborationSwimlaneLayoutsBpmnProfile.id);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const initialCreateIntentAppliedRef = useRef(false);
  const pendingCreateRef = useRef<{
    readonly fingerprint: string;
    readonly idempotencyKey: string;
  } | null>(null);

  const reloadModels = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey(value => value + 1);
  };
  const changePage = (next: number) => {
    setLoading(true);
    setLoadError(null);
    setPage(next);
  };

  useEffect(() => {
    let active = true;
    let redirecting = false;
    void persistence
      .listModelsPage({ page, pageSize, ...(folderFilter !== "all" ? { folderId: folderFilter === "unfiled" ? null : folderFilter } : {}) })
      .then((result) => {
        if (!active) return;
        const validPage = Math.min(page, Math.max(1, Math.ceil(result.total / pageSize)));
        setTotal(result.total);
        if (validPage !== page) { redirecting = true; setPage(validPage); }
        else setModels(result.models);
      })
      .catch(() => {
        if (active) {
          setLoadError(
            "Không thể tải thư viện quy trình. Dữ liệu máy chủ không bị thay đổi.",
          );
        }
      })
      .finally(() => {
        if (active && !redirecting) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [persistence, page, reloadKey, folderFilter]);

  const deleteModel = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await persistence.archiveModel({ modelId: deleteTarget.id, expectedRevisionNumber: deleteTarget.revisionNumber });
      if (result.kind === "archived" || result.kind === "already-archived") {
        setActionNotice(`Đã xoá “${deleteTarget.title}” khỏi thư viện.`);
        setDeleteTarget(null);
        reloadModels();
      } else {
        setDeleteError(result.kind === "in-use"
          ? "Quy trình đang được dùng trong bài viết hoặc lịch xuất bản. Hãy gỡ sơ đồ khỏi bài trước khi xoá khỏi thư viện."
          : result.kind === "conflict"
            ? "Quy trình vừa có thay đổi. Hãy đóng cửa sổ và tải lại danh sách trước khi xoá."
            : "Chưa thể xoá quy trình. Dữ liệu vẫn được giữ nguyên; hãy thử lại.");
        if (result.kind === "conflict" || result.kind === "not-found") reloadModels();
      }
    } catch {
      setDeleteError("Kết nối bị gián đoạn. Hãy thử lại để xác nhận kết quả xoá.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (
      initialCreateIntent !== "swimlane" ||
      initialCreateIntentAppliedRef.current
    ) {
      return;
    }
    initialCreateIntentAppliedRef.current = true;
    setProfileId(collaborationSwimlaneLayoutsBpmnProfile.id);
    createDialogRef.current?.showModal();
  }, [initialCreateIntent]);

  const createModel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || creating) return;
    setCreating(true);
    setCreateError(null);
    const fingerprint = `${normalizedTitle}:${purpose}:${profileId}`;
    const logicalCreate =
      pendingCreateRef.current?.fingerprint === fingerprint
        ? pendingCreateRef.current
        : {
            fingerprint,
            idempotencyKey: `create-model:${crypto.randomUUID()}`,
          };
    pendingCreateRef.current = logicalCreate;
    try {
      const seed = bpmnCreationSeed(
        profileId,
        starterXml,
        collaborationStarterXml,
      );
      const opened = await persistence.createModel({
        idempotencyKey: logicalCreate.idempotencyKey,
        title: normalizedTitle,
        description: seed.description,
        purpose,
        profileId,
        xml: seed.xml,
      });
      pendingCreateRef.current = null;
      router.push(`/studio/diagram/${encodeURIComponent(opened.modelId)}`);
    } catch {
      setCreateError(
        "Chưa thể tạo quy trình. Hãy giữ tên hiện tại và thử lại; ứng dụng không tạo bản trống khi có lỗi.",
      );
    } finally {
      setCreating(false);
    }
  };

  const openCreateDialog = () => {
    setCreateError(null);
    createDialogRef.current?.showModal();
  };

  const closeCreateDialog = () => {
    if (creating) return;
    createDialogRef.current?.close();
  };

  return (
    <div className="studio-page bpmn-library">
      <ModalDialog open={deleteTarget !== null} role="alertdialog" className="bpmn-library-delete-dialog"
        aria-labelledby="bpmn-library-delete-title" aria-describedby="bpmn-library-delete-description"
        closeOnEscape={!deleting} onRequestClose={() => setDeleteTarget(null)}>
        <section>
          <header><Trash2 size={22} strokeWidth={1.5} aria-hidden="true" /><h2 id="bpmn-library-delete-title">Xoá quy trình khỏi thư viện?</h2></header>
          <strong className="bpmn-library-delete-subject">{deleteTarget?.title}</strong>
          <p id="bpmn-library-delete-description">Quy trình sẽ không còn trong danh sách để mở và chỉnh sửa. Lịch sử và bản đã xuất bản vẫn được giữ. Không thể xoá nếu bài viết còn sử dụng quy trình này.</p>
          {deleteError ? <p className="bpmn-library__error" role="alert">{deleteError}</p> : null}
          <footer>
            <Button variant="secondary" data-dialog-initial-focus disabled={deleting} onClick={() => setDeleteTarget(null)}>Huỷ</Button>
            <Button className="bpmn-library-delete-confirm" disabled={deleting} onClick={() => void deleteModel()}>{deleting ? "Đang xoá…" : "Xoá khỏi thư viện"}</Button>
          </footer>
        </section>
      </ModalDialog>
      <header className="bpmn-library__hero">
        <div className="bpmn-library__hero-copy">
          <span className="mono-label">Quy trình của bạn</span>
          <h1>Thư viện quy trình</h1>
          <p>
            Tạo quy trình mới hoặc mở lại một quy trình đang làm. Mọi thay đổi
            được lưu theo từng bản để bạn có thể tiếp tục đúng nơi đã dừng.
          </p>
        </div>
      </header>

      <section className="bpmn-library__create" aria-labelledby="create-bpmn-title">
        <div className="bpmn-library__create-heading">
          <Plus size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            <h2 id="create-bpmn-title">Tạo quy trình mới</h2>
            <p>
              Đặt tên, chọn mục đích và kiểu sơ đồ phù hợp. Bạn có thể chỉnh sửa
              chi tiết sau khi mở quy trình.
            </p>
          </span>
        </div>
        <div className="bpmn-library__create-action">
          <p>Chỉ mất một bước để bắt đầu. Bạn sẽ chọn kiểu sơ đồ trong cửa sổ tiếp theo.</p>
          <Button
            id="open-create-bpmn-dialog"
            type="button"
            onClick={openCreateDialog}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Tạo quy trình
          </Button>
        </div>
        <dialog
          ref={createDialogRef}
          className="bpmn-library__create-dialog"
          aria-labelledby="create-bpmn-dialog-title"
          aria-describedby="create-bpmn-dialog-description"
          onCancel={(event) => {
            event.preventDefault();
            closeCreateDialog();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCreateDialog();
          }}
          onClose={() => document.getElementById("open-create-bpmn-dialog")?.focus()}
        >
          <section>
            <header>
              <div>
                <span className="mono-label">Tạo quy trình mới</span>
                <h2 id="create-bpmn-dialog-title">Tạo quy trình mới</h2>
                <p id="create-bpmn-dialog-description">
                  Đặt tên, chọn mục đích và kiểu sơ đồ. Bạn có thể chỉnh sửa chi
                  tiết sau khi mở quy trình.
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Đóng cửa sổ tạo quy trình"
                disabled={creating}
                onClick={closeCreateDialog}
              >
                <X size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </header>
            <form
              aria-busy={creating}
              onSubmit={(event) => void createModel(event)}
            >
              <div className="bpmn-library__fields">
                <div className="bpmn-library__field bpmn-library__field--title">
                  <label htmlFor="bpmn-model-title">Tên quy trình</label>
                  <input
                    id="bpmn-model-title"
                    required
                    autoFocus
                    autoComplete="off"
                    maxLength={160}
                    value={title}
                    placeholder="Ví dụ: Quy trình duyệt bài viết"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="bpmn-library__field">
                  <label
                    id="bpmn-model-purpose-label"
                    htmlFor="bpmn-model-purpose"
                  >
                    Mục đích sử dụng
                  </label>
                  <Select
                    id="bpmn-model-purpose"
                    labelledBy="bpmn-model-purpose-label"
                    value={purpose}
                    options={purposeOptions}
                    onValueChange={(value) =>
                      setPurpose(value as ProcessModelSummary["purpose"])
                    }
                  />
                </div>
                <div className="bpmn-library__field bpmn-library__field--profile">
                  <label
                    id="bpmn-model-profile-label"
                    htmlFor="bpmn-model-profile"
                  >
                    Kiểu sơ đồ
                  </label>
                  <Select
                    id="bpmn-model-profile"
                    labelledBy="bpmn-model-profile-label"
                    describedBy="bpmn-profile-help bpmn-profile-scope"
                    value={profileId}
                    options={bpmnCreationProfileOptions}
                    onValueChange={(value) =>
                      setProfileId(value as BpmnProfileId)
                    }
                  />
                  <small id="bpmn-profile-help">{profileHelp(profileId)}</small>
                </div>
                <details id="bpmn-profile-scope">
                  <summary>Kiểu sơ đồ này hỗ trợ những gì?</summary>
                  <p>
                    Ứng dụng chỉ hiển thị những thành phần đã được kiểm tra cho
                    kiểu sơ đồ này. Chức năng mô phỏng việc chạy quy trình chưa
                    được hỗ trợ.
                  </p>
                </details>
                {createError ? (
                  <p className="bpmn-library__error" role="alert" aria-live="assertive">
                    {createError}
                  </p>
                ) : null}
              </div>
              <footer>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={creating}
                  onClick={closeCreateDialog}
                >
                  Huỷ
                </Button>
                <Button disabled={creating || title.trim().length === 0} type="submit">
                  <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                  {creating ? "Đang tạo…" : "Tạo và mở quy trình"}
                </Button>
              </footer>
            </form>
          </section>
        </dialog>
      </section>

      <section className="bpmn-library__collection" aria-labelledby="bpmn-models-title">
        <div className="bpmn-library__section-heading">
          <div>
            <span className="mono-label">Các quy trình đang hoạt động</span>
            <h2 id="bpmn-models-title">Các quy trình của bạn</h2>
          </div>
          {!loading && !loadError ? (
            <Badge>{total} quy trình</Badge>
          ) : null}
        </div>

        {persistence.folders ? <BpmnFolderTools client={persistence.folders} reloadKey={reloadKey} filter={folderFilter} onFilterChange={value => { setFolderFilter(value); setFolderSelection([]); changePage(1); }} selected={folderSelection} onClearSelection={() => setFolderSelection([])} onChanged={reloadModels} /> : null}
        {persistence.folders && !loading && models.length > 0 ? <label className="bpmn-folder-select-all"><input type="checkbox" aria-label="Chọn tất cả quy trình trên trang này" checked={models.every(model => folderSelection.some(selected => selected.id === model.id))} onChange={event => setFolderSelection(current => event.target.checked ? [...current, ...models.filter(model => !current.some(selected => selected.id === model.id)).map(model => ({ id: model.id, title: model.title, expectedFolderRevision: model.folderRevision ?? 0 }))].slice(0, 100) : current.filter(selected => !models.some(model => model.id === selected.id)))} />Chọn trang này · tối đa 100 quy trình</label> : null}
        {loading ? (
          <div className="bpmn-library__state" role="status">
            <span className="cms-spinner" aria-hidden="true" />
            <strong>Đang tải các quy trình đã lưu…</strong>
          </div>
        ) : loadError ? (
          <div className="bpmn-library__state is-error" role="alert">
            <strong>{loadError}</strong>
            <Button variant="secondary" onClick={reloadModels}>
              Thử lại
            </Button>
          </div>
        ) : models.length === 0 ? (
          <div className="bpmn-library__state">
            <Route size={28} strokeWidth={1.5} aria-hidden="true" />
            <strong>{folderFilter === "all" ? "Chưa có quy trình." : "Thư mục chưa có quy trình."}</strong>
            <p>{folderFilter === "all" ? "Nhấn Tạo quy trình để bắt đầu." : "Chọn Tất cả quy trình để chuyển sơ đồ vào thư mục này."}</p>
          </div>
        ) : (
          <ol
            className={`bpmn-library__grid${
              models.length === 1
                ? " is-single"
                : models.length === 2
                  ? " is-short"
                  : ""
            }`}
          >
            {models.map((model) => (
              <li key={model.id}>
                <article>
                  <header>
                    {persistence.folders ? <input type="checkbox" className="bpmn-folder-model-checkbox" aria-label={`Chọn quy trình ${model.title}`} checked={folderSelection.some(selected => selected.id === model.id)} disabled={folderSelection.length >= 100 && !folderSelection.some(selected => selected.id === model.id)} onChange={event => setFolderSelection(current => event.target.checked ? [...current, { id: model.id, title: model.title, expectedFolderRevision: model.folderRevision ?? 0 }] : current.filter(selected => selected.id !== model.id))} /> : null}
                    <span className="bpmn-library__model-icon">
                      <Route size={21} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <Badge tone="accent">
                      {purposeLabel(model.purpose)}
                    </Badge>
                  </header>
                  <div className="bpmn-library__model-summary">
                    <h3>{model.title}</h3>
                    <p className="bpmn-library__model-profile">
                      {profileLabel(model.profileId)}
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt><UserRound size={14} aria-hidden="true" />Người tạo</dt>
                      <dd className="bpmn-library__creator">{model.createdByName || "Chưa có thông tin"}</dd>
                    </div>
                    <div>
                      <dt><CalendarDays size={14} aria-hidden="true" />Ngày tạo</dt>
                      <dd><time dateTime={model.createdAt}>{formatUpdatedAt(model.createdAt)}</time></dd>
                    </div>
                    <div>
                      <dt><GitCommitHorizontal size={14} aria-hidden="true" />Mốc đã lưu</dt>
                      <dd>{model.versionCount}</dd>
                    </div>
                    <div>
                      <dt><Clock3 size={14} aria-hidden="true" />Cập nhật</dt>
                      <dd><time dateTime={model.updatedAt}>{formatUpdatedAt(model.updatedAt)}</time></dd>
                    </div>
                  </dl>
                  <Link
                    className="button button--secondary"
                    href={`/studio/diagram/${encodeURIComponent(model.id)}`}
                    aria-label={`Mở quy trình ${model.title}`}
                  >
                    Mở quy trình
                    <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                  <Button variant="ghost" className="bpmn-library__delete" aria-label={`Xoá quy trình ${model.title}`} onClick={() => { setDeleteTarget(model); setDeleteError(null); }}>
                    <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </article>
              </li>
            ))}
          </ol>
        )}
        <p role="status" className="bpmn-library__notice">{actionNotice}</p>
        {!loadError && total > 0 ? (
          <nav className="bpmn-library__pagination" aria-label="Phân trang quy trình">
            <span>Trang {page} / {pageCount} · {total} quy trình</span>
            <div>
              <Button variant="secondary" disabled={loading || page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16} aria-hidden="true" />Trang trước</Button>
              {bpmnLibraryPageWindow(page, pageCount).map(number => (
                <Button key={number} variant={number === page ? "primary" : "secondary"}
                  aria-label={`Trang ${number}`} aria-current={number === page ? "page" : undefined}
                  disabled={loading} onClick={() => { if (number !== page) changePage(number); }}>{number}</Button>
              ))}
              <Button variant="secondary" disabled={loading || page >= pageCount} onClick={() => changePage(page + 1)}>Trang sau<ChevronRight size={16} aria-hidden="true" /></Button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
