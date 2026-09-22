import { safeBpmnFilename } from "./safe-bpmn-filename";

export type BpmnDiagramDownloadFormat = "bpmn" | "svg" | "png";

export const bpmnDiagramDownloadMimeTypes = {
  bpmn: "application/xml",
  svg: "image/svg+xml",
  png: "image/png",
} as const satisfies Readonly<Record<BpmnDiagramDownloadFormat, string>>;

export const maximumBpmnSvgBytes = 8 * 1024 * 1024;
export const maximumBpmnSvgDimension = 1_000_000;
export const maximumBpmnPngDimension = 8_192;
export const maximumBpmnPngPixels = 16_000_000;

export interface BpmnPngDimensions {
  readonly width: number;
  readonly height: number;
}

export interface SanitizedBpmnSvg {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

export interface BpmnDiagramExportPort {
  readonly sanitizeSvg: (svg: string) => SanitizedBpmnSvg;
  readonly renderPng: (sanitized: SanitizedBpmnSvg) => Promise<Blob>;
  readonly downloadBlob: (blob: Blob, filename: string) => void;
}

export function safeBpmnDiagramFilename(
  title: string,
  format: BpmnDiagramDownloadFormat,
): string {
  const base = safeBpmnFilename(title).replace(/\.bpmn$/u, "");
  return `${base}.${format}`;
}

export function parseSvgLength(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/iu.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function planBpmnPngDimensions(
  sourceWidth: number,
  sourceHeight: number,
  requestedScale = 2,
): BpmnPngDimensions {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error("Kích thước sơ đồ không hợp lệ.");
  }
  const scale = Number.isFinite(requestedScale)
    ? Math.min(Math.max(requestedScale, 1), 2)
    : 1;
  const boundedScale = Math.min(
    scale,
    maximumBpmnPngDimension / sourceWidth,
    maximumBpmnPngDimension / sourceHeight,
    Math.sqrt(maximumBpmnPngPixels / sourceWidth / sourceHeight),
  );
  if (!Number.isFinite(boundedScale) || boundedScale <= 0) {
    throw new Error("Kích thước sơ đồ vượt giới hạn an toàn.");
  }
  const scaledWidth = sourceWidth * boundedScale;
  const scaledHeight = sourceHeight * boundedScale;
  if (
    !Number.isFinite(scaledWidth) ||
    !Number.isFinite(scaledHeight) ||
    scaledWidth <= 0 ||
    scaledHeight <= 0
  ) {
    throw new Error("Kích thước sơ đồ vượt giới hạn an toàn.");
  }
  const width = Math.max(1, Math.floor(scaledWidth));
  const height = Math.max(1, Math.floor(scaledHeight));
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width > maximumBpmnPngDimension ||
    height > maximumBpmnPngDimension ||
    width * height > maximumBpmnPngPixels
  ) {
    throw new Error("Ảnh vượt giới hạn an toàn.");
  }
  return { width, height };
}

export function isSafeLocalSvgReference(value: string): boolean {
  let normalized = value.trim();
  if (normalized.toLowerCase().startsWith("url(") && normalized.endsWith(")")) {
    normalized = normalized.slice(4, -1).trim();
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1);
    }
  }
  if (!normalized.startsWith("#") || normalized.length < 2) return false;
  const identifier = normalized.slice(1);
  const first = identifier[0]!;
  const startsSafely =
    (first >= "A" && first <= "Z") ||
    (first >= "a" && first <= "z") ||
    first === "_";
  if (!startsSafely) return false;
  for (const character of identifier.slice(1)) {
    const safe =
      (character >= "A" && character <= "Z") ||
      (character >= "a" && character <= "z") ||
      (character >= "0" && character <= "9") ||
      "_:.-".includes(character);
    if (!safe) return false;
  }
  return true;
}
