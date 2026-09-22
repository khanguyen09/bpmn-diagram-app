"use client";

import { useId, useState } from "react";
import { Search, X } from "lucide-react";
import { nodeIconCatalogue, type NodeIconKey } from "../domain/node-visual";
import { nodeIconComponents } from "./bpmn-node-icons";

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

export function filterNodeIcons(query: string) {
  const terms = searchable(query.trim()).split(/\s+/).filter(Boolean);
  return nodeIconCatalogue.filter((item) => {
    const text = searchable(`${item.label} ${item.id}`);
    return terms.every((term) => text.includes(term));
  });
}

export function BpmnNodeIconPicker({ value, onChange }: {
  readonly value: NodeIconKey | null;
  readonly onChange: (value: NodeIconKey | null) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const icons = filterNodeIcons(query);
  const selected = nodeIconCatalogue.find((item) => item.id === value);
  return (
    <fieldset className="bpmn-node-icon-picker">
      <legend className="sr-only">Biểu tượng minh hoạ</legend>
      <label className="bpmn-node-icon-search" htmlFor={searchId}>
        <span className="sr-only">Tìm biểu tượng</span>
        <Search size={16} strokeWidth={1.5} aria-hidden="true" />
        <input id={searchId} type="search" value={query}
          placeholder="Tìm biểu tượng…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="bpmn-node-icon-current">
        <span>Đang dùng: <strong>{selected?.label ?? "Không dùng"}</strong></span>
        <button type="button" onClick={() => onChange(null)} disabled={!value}
          aria-label="Bỏ biểu tượng"><X size={14} aria-hidden="true" />Bỏ</button>
      </div>
      <small role="status">{icons.length} biểu tượng</small>
      <div className="bpmn-node-icon-grid">
        {icons.map((item) => {
          const Icon = nodeIconComponents[item.id];
          return <button key={item.id} type="button" title={item.label}
            aria-label={`Chọn biểu tượng ${item.label}`} aria-pressed={value === item.id}
            className={value === item.id ? "is-selected" : undefined}
            onClick={() => onChange(item.id)}>
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>{item.label}</span>
          </button>;
        })}
      </div>
      {icons.length === 0 ? <div className="bpmn-node-icon-empty">
        <p>Không tìm thấy biểu tượng phù hợp.</p>
        <button type="button" onClick={() => setQuery("")}>Xoá tìm kiếm</button>
      </div> : null}
      <small>Chỉ thay đổi hình minh hoạ, không thay đổi cách hoạt động của bước.</small>
    </fieldset>
  );
}
