"use client";
import "./inline-diagram-preview.css";

import { useEffect, useRef, useState } from "react";
import type Viewer from "bpmn-js/lib/NavigatedViewer";
import type { BpmnTypographyPort } from "../application/bpmn-typography";
import { Button } from "@/shared/ui/button";
import { tebModdleDescriptor } from "../application/teb-moddle-contract";

export function DiagramPreviewView({ sourceUrl, title, versionLabel, studioHref, typography }: { sourceUrl: string; title: string; versionLabel: string; studioHref?: string; typography: BpmnTypographyPort }) {
  const container = useRef<HTMLDivElement>(null);
  const activeViewer = useRef<Viewer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    let viewer: Viewer | undefined;
    let observer: ResizeObserver | undefined;
    const timeout = window.setTimeout(() => { controller.abort(); viewer?.destroy(); viewer = undefined; observer?.disconnect(); setStatus("error"); }, 20_000);
    const run = async () => {
      setStatus("loading");
      try {
        const response = await fetch(sourceUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Preview unavailable");
        const body = await response.json();
        if (typeof body.canonicalXml !== "string" || !body.canonicalXml || body.canonicalXml.length > 2_000_000) throw new Error("Invalid preview");
        const { default: BpmnViewer } = await import("bpmn-js/lib/NavigatedViewer");
        await typography.prepare();
        if (controller.signal.aborted || !container.current) return;
        viewer = new BpmnViewer({ container: container.current, textRenderer: typography.config(), moddleExtensions: { teb: tebModdleDescriptor } });
        activeViewer.current = viewer;
        await viewer.importXML(body.canonicalXml);
        if (controller.signal.aborted) return;
        const fit = () => viewer?.get<{ zoom: (value: string) => void }>("canvas").zoom("fit-viewport");
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(container.current);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) { viewer?.destroy(); viewer = undefined; setStatus("error"); }
      } finally { window.clearTimeout(timeout); }
    };
    void run();
    return () => { window.clearTimeout(timeout); controller.abort(); observer?.disconnect(); viewer?.destroy(); activeViewer.current = null; };
  }, [sourceUrl, typography, attempt]);
  return <figure className="inline-diagram-preview">
    <figcaption><strong>{title}</strong><span>{versionLabel}</span></figcaption>
    <div ref={container} className="inline-diagram-canvas" role="img" aria-label={`Sơ đồ: ${title}`} aria-busy={status === "loading"} />
    {status === "ready" && <div className="inline-diagram-controls" role="group" aria-label="Điều chỉnh sơ đồ">
      <Button variant="secondary" onClick={() => { const canvas = activeViewer.current?.get<{ zoom(value?: number | string): number }>("canvas"); if (canvas) canvas.zoom(Math.min(4, canvas.zoom() * 1.25)); }}>Phóng to</Button>
      <Button variant="secondary" onClick={() => { const canvas = activeViewer.current?.get<{ zoom(value?: number | string): number }>("canvas"); if (canvas) canvas.zoom(Math.max(0.1, canvas.zoom() / 1.25)); }}>Thu nhỏ</Button>
      <Button variant="secondary" onClick={() => activeViewer.current?.get<{ zoom(value: string): void }>("canvas").zoom("fit-viewport")}>Vừa khung</Button>
    </div>}
    {status === "loading" && <p role="status">Đang tải sơ đồ…</p>}
    {status === "error" && <div role="status"><p>Chưa tải được sơ đồ. Nội dung đã gắn vẫn được giữ nguyên.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
    {studioHref && <a href={studioHref} target="_blank" rel="noopener noreferrer">Mở sơ đồ trong tab mới</a>}
  </figure>;
}
