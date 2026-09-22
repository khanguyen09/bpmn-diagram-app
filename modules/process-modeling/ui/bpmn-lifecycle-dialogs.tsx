import type { RefObject } from "react";
import { AlertTriangle, Database, MoveRight, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export interface LifecycleTargetOption {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

export interface LifecycleImpactGroup {
  readonly label: string;
  readonly ids: readonly string[];
}

function ExactImpactList({
  groups,
}: {
  readonly groups: readonly LifecycleImpactGroup[];
}) {
  return (
    <div className="bpmn-lifecycle-impact">
      {groups.map((group) => (
        <section key={group.label}>
          <div>
            <strong>{group.label}</strong>
            <Badge tone={group.ids.length > 0 ? "warning" : "neutral"}>
              {group.ids.length}
            </Badge>
          </div>
          {group.ids.length > 0 ? (
            <details>
              <summary>Xem mã phần tử</summary>
              <ul>
                {group.ids.map((id) => (
                  <li key={id}>
                    <code>{id}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function BpmnReparentDialog({
  dialogRef,
  sourceLabel,
  sourceContainerLabel,
  targets,
  targetId,
  laneTargets,
  targetLaneId,
  impact,
  blockers,
  onTargetChange,
  onTargetLaneChange,
  onCancel,
  onConfirm,
  onClose,
}: {
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
  readonly sourceLabel: string;
  readonly sourceContainerLabel: string;
  readonly targets: readonly LifecycleTargetOption[];
  readonly targetId: string;
  readonly laneTargets: readonly LifecycleTargetOption[];
  readonly targetLaneId: string;
  readonly impact: readonly LifecycleImpactGroup[];
  readonly blockers: readonly string[];
  readonly onTargetChange: (id: string) => void;
  readonly onTargetLaneChange: (id: string) => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="bpmn-confirm-dialog bpmn-lifecycle-dialog"
      aria-labelledby="bpmn-reparent-title"
      aria-describedby="bpmn-reparent-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      onClose={onClose}
    >
      <header>
        <MoveRight aria-hidden="true" />
        <div>
          <h2 id="bpmn-reparent-title">Di chuyển phần tử</h2>
          <p id="bpmn-reparent-description">
            Chọn vị trí mới cho phần tử. Studio sẽ kiểm tra các liên kết trước
            khi di chuyển.
          </p>
        </div>
      </header>
      <dl>
        <div>
          <dt>Phần tử</dt>
          <dd>{sourceLabel}</dd>
        </div>
        <div>
          <dt>Vị trí hiện tại</dt>
          <dd>{sourceContainerLabel}</dd>
        </div>
      </dl>
      <label>
        <span>Vị trí mới</span>
        <select
          value={targetId}
          onChange={(event) => onTargetChange(event.target.value)}
        >
          <option value="">Chọn vị trí mới</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
        </select>
      </label>
      {laneTargets.length > 0 ? (
        <label>
          <span>Vai trò đích</span>
          <select
            value={targetLaneId}
            onChange={(event) => onTargetLaneChange(event.target.value)}
          >
            <option value="">Chọn vai trò đích</option>
            {laneTargets.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <ExactImpactList groups={impact} />
      {blockers.length > 0 ? (
        <div className="bpmn-lifecycle-blockers" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Không thể di chuyển</strong>
            <ul>
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <footer>
        <Button variant="secondary" autoFocus onClick={onCancel}>
          Huỷ
        </Button>
        <Button
          disabled={
            !targetId ||
            blockers.length > 0 ||
            (laneTargets.length > 0 && !targetLaneId)
          }
          onClick={onConfirm}
        >
          Di chuyển phần tử
        </Button>
      </footer>
    </dialog>
  );
}

export function BpmnDeleteImpactDialog({
  dialogRef,
  subjectLabel,
  groups,
  retainedRootIds,
  onCancel,
  onConfirm,
  onClose,
}: {
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
  readonly subjectLabel: string;
  readonly groups: readonly LifecycleImpactGroup[];
  readonly retainedRootIds: readonly string[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      className="bpmn-confirm-dialog bpmn-lifecycle-dialog bpmn-delete-impact-dialog"
      aria-labelledby="bpmn-delete-impact-title"
      aria-describedby="bpmn-delete-impact-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      onClose={onClose}
    >
      <header>
        <Trash2 aria-hidden="true" />
        <div>
          <h2 id="bpmn-delete-impact-title">Xoá phần tử này?</h2>
          <p id="bpmn-delete-impact-description">
            Phần tử và các nội dung liên quan dưới đây sẽ được xoá khỏi sơ đồ.
          </p>
        </div>
      </header>
      <div className="bpmn-delete-impact-body">
        <p className="bpmn-delete-subject">{subjectLabel}</p>
        <dl className="bpmn-delete-summary">
          {groups.filter((group) => group.ids.length > 0).map((group) => (
            <div key={group.label}>
              <dt>{group.label}</dt><dd>{group.ids.length}</dd>
            </div>
          ))}
        </dl>
        {groups.every((group) => group.ids.length === 0) ? (
          <p>Không có nội dung liên quan cần xoá kèm.</p>
        ) : null}
        <details className="bpmn-delete-diagnostics">
          <summary>Xem mã phần tử</summary>
          {groups.filter((group) => group.ids.length > 0).map((group) => (
            <div key={group.label}>
              <strong>{group.label}</strong>
              <ul>{group.ids.map((id) => <li key={id}><code>{id}</code></li>)}</ul>
            </div>
          ))}
        </details>
      </div>
      <section className="bpmn-lifecycle-retained">
        <strong>Dữ liệu dùng chung vẫn được giữ lại</strong>
        <p>
          Thông điệp, nhóm phân loại và kho dữ liệu dùng chung sẽ không bị xoá
          theo phần tử này.
        </p>
        {retainedRootIds.length > 0 ? (
          <details>
            <summary>Xem mã dữ liệu được giữ lại</summary>
            <code>{retainedRootIds.join(", ")}</code>
          </details>
        ) : null}
      </section>
      <footer>
        <Button variant="secondary" autoFocus onClick={onCancel}>
          Huỷ
        </Button>
        <Button className="bpmn-lifecycle-danger" onClick={onConfirm}>
          Xoá phần tử
        </Button>
      </footer>
    </dialog>
  );
}

export function BpmnDataStoreCleanupDialog({
  dialogRef,
  stores,
  onCancel,
  onConfirm,
  onClose,
}: {
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
  readonly stores: readonly {
    readonly id: string;
    readonly name: string;
    readonly referenceIds: readonly string[];
  }[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      className="bpmn-confirm-dialog bpmn-lifecycle-dialog"
      aria-labelledby="bpmn-datastore-cleanup-title"
      aria-describedby="bpmn-datastore-cleanup-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      onClose={onClose}
    >
      <header>
        <Database aria-hidden="true" />
        <div>
          <h2 id="bpmn-datastore-cleanup-title">Xoá kho dữ liệu không dùng</h2>
          <p id="bpmn-datastore-cleanup-description">
            Chỉ kho dữ liệu không còn được phần tử nào sử dụng mới có thể xoá.
          </p>
        </div>
      </header>
      <ul className="bpmn-lifecycle-store-list">
        {stores.map((store) => (
          <li key={store.id}>
            <span>
              <strong>{store.name || "Chưa đặt tên"}</strong>
              <details>
                <summary>Xem mã kho dữ liệu</summary>
                <code>{store.id}</code>
              </details>
            </span>
            <Badge tone="warning">{store.referenceIds.length} nơi dùng</Badge>
          </li>
        ))}
      </ul>
      <footer>
        <Button variant="secondary" autoFocus onClick={onCancel}>
          Huỷ
        </Button>
        <Button
          className="bpmn-lifecycle-danger"
          disabled={stores.length === 0}
          onClick={onConfirm}
        >
          Xoá kho dữ liệu
        </Button>
      </footer>
    </dialog>
  );
}
