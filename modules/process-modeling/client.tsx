"use client";

import { browserBpmnTypography } from "./infrastructure/browser/bpmn-typography";
import { DiagramPreviewView } from "./ui/inline-diagram-preview";

export function InlineDiagramPreview({ modelId, versionId, title }: { modelId: string; versionId?: string; title: string }) {
  const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
  return <DiagramPreviewView sourceUrl={`/api/v1/studio/process-models/${encodeURIComponent(modelId)}/preview${query}`} title={title} versionLabel={versionId ? "Bản đã chọn" : "Theo bản đang lưu"} studioHref={`/studio/diagram/${encodeURIComponent(modelId)}`} typography={browserBpmnTypography} />;
}
