import {
  bpmnDiagramDownloadMimeTypes,
  isSafeLocalSvgReference,
  maximumBpmnSvgBytes,
  maximumBpmnSvgDimension,
  parseSvgLength,
  planBpmnPngDimensions,
  type BpmnDiagramExportPort,
  type SanitizedBpmnSvg,
} from "../../application/bpmn-diagram-export";

const svgNamespace = "http://www.w3.org/2000/svg";
const allowedSvgElements = new Set([
  "circle",
  "clippath",
  "desc",
  "defs",
  "ellipse",
  "g",
  "line",
  "mask",
  "marker",
  "path",
  "polygon",
  "polyline",
  "rect",
  "svg",
  "text",
  "title",
  "tspan",
  "use",
]);
const allowedSvgAttributes = new Set([
  "aria-hidden",
  "aria-label",
  "class",
  "color",
  "cx",
  "cy",
  "d",
  "display",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "fill-rule",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "id",
  "marker-end",
  "markerheight",
  "marker-mid",
  "marker-start",
  "markerunits",
  "markerwidth",
  "opacity",
  "orient",
  "overflow",
  "points",
  "preserveaspectratio",
  "r",
  "refx",
  "refy",
  "role",
  "rx",
  "ry",
  "shape-rendering",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "transform",
  "version",
  "viewbox",
  "visibility",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
]);
const localReferenceAttributes = new Set([
  "clip-path",
  "filter",
  "href",
  "mask",
  "marker-end",
  "marker-mid",
  "marker-start",
  "xlink:href",
]);
const paintAttributes = new Set(["color", "fill", "stroke"]);
const projectableStyleAttributes = new Set([
  "clip-path",
  "color",
  "display",
  "dominant-baseline",
  "fill",
  "fill-opacity",
  "fill-rule",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "opacity",
  "shape-rendering",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "visibility",
]);
const xlinkNamespace = "http://www.w3.org/1999/xlink";
const bpmnPngRenderTimeoutMs = 15_000;

export function isAllowedBpmnSvgElement(
  namespaceUri: string | null,
  localName: string,
): boolean {
  return (
    namespaceUri === svgNamespace &&
    allowedSvgElements.has(localName.toLowerCase())
  );
}

function hasActiveUrlSyntax(value: string): boolean {
  const compact = value
    .trim()
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .replaceAll("\t", "");
  return (
    compact.startsWith("javascript:") ||
    compact.startsWith("data:") ||
    compact.startsWith("//") ||
    compact.includes("://")
  );
}

export function isAllowedBpmnSvgAttribute(
  attributeName: string,
  attributeValue: string,
): boolean {
  const name = attributeName.toLowerCase();
  const value = attributeValue.trim();
  if (name.startsWith("on")) return false;
  if (name === "xmlns") return value === svgNamespace;
  if (name === "xmlns:xlink") return value === xlinkNamespace;
  if (!allowedSvgAttributes.has(name) && !localReferenceAttributes.has(name)) {
    return false;
  }
  if (localReferenceAttributes.has(name)) {
    return isSafeLocalSvgReference(value);
  }
  const compactValue = value
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .replaceAll("\t", "");
  if (compactValue.includes("url(")) {
    return paintAttributes.has(name) && isSafeLocalSvgReference(value);
  }
  return !hasActiveUrlSyntax(value);
}

export function isAllowedBpmnSvgStyleDeclaration(
  propertyName: string,
  propertyValue: string,
): boolean {
  const name = propertyName.trim().toLowerCase();
  return (
    projectableStyleAttributes.has(name) &&
    isAllowedBpmnSvgAttribute(name, propertyValue)
  );
}

function numericViewBoxSize(value: string | null) {
  if (!value) return null;
  const values = value
    .trim()
    .split(/[\s,]+/u)
    .map(Number);
  if (
    values.length !== 4 ||
    values.some((candidate) => !Number.isFinite(candidate)) ||
    values[2]! <= 0 ||
    values[3]! <= 0
  ) {
    return null;
  }
  return { width: values[2]!, height: values[3]! };
}

function sanitizeAttribute(element: Element, attribute: Attr) {
  if (!isAllowedBpmnSvgAttribute(attribute.name, attribute.value)) {
    element.removeAttributeNode(attribute);
  }
}

function projectSafeStyleDeclarations(element: Element) {
  if (!element.hasAttribute("style")) return;
  const declaration = (element as SVGElement).style;
  const projected: [string, string][] = [];
  for (let index = 0; index < declaration.length; index += 1) {
    const property = declaration.item(index).trim().toLowerCase();
    const value = declaration.getPropertyValue(property).trim();
    if (
      declaration.getPropertyPriority(property) === "" &&
      isAllowedBpmnSvgStyleDeclaration(property, value)
    ) {
      projected.push([property, value]);
    }
  }
  element.removeAttribute("style");
  for (const [property, value] of projected) {
    element.setAttribute(property, value);
  }
}

export function sanitizeBpmnSvg(svg: string): SanitizedBpmnSvg {
  if (!svg || new TextEncoder().encode(svg).byteLength > maximumBpmnSvgBytes) {
    throw new Error("Ảnh sơ đồ vượt giới hạn an toàn.");
  }
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) {
    throw new Error("Không thể đọc ảnh sơ đồ.");
  }
  const root = parsed.documentElement;
  if (root.localName.toLowerCase() !== "svg" || root.namespaceURI !== svgNamespace) {
    throw new Error("Nội dung tải xuống không phải ảnh SVG.");
  }

  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!isAllowedBpmnSvgElement(element.namespaceURI, element.localName)) {
      element.remove();
      continue;
    }
    projectSafeStyleDeclarations(element);
    for (const attribute of Array.from(element.attributes)) {
      sanitizeAttribute(element, attribute);
    }
  }

  const viewBox = numericViewBoxSize(root.getAttribute("viewBox"));
  const width = parseSvgLength(root.getAttribute("width")) ?? viewBox?.width;
  const height = parseSvgLength(root.getAttribute("height")) ?? viewBox?.height;
  if (!width || !height) throw new Error("Ảnh sơ đồ không có kích thước hợp lệ.");
  if (width > maximumBpmnSvgDimension || height > maximumBpmnSvgDimension) {
    throw new Error("Ảnh sơ đồ vượt giới hạn kích thước an toàn.");
  }
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  return {
    svg: new XMLSerializer().serializeToString(root),
    width,
    height,
  };
}

export async function renderBpmnSvgAsPng(
  sanitized: SanitizedBpmnSvg,
): Promise<Blob> {
  const dimensions = planBpmnPngDimensions(
    sanitized.width,
    sanitized.height,
  );
  const sourceUrl = URL.createObjectURL(
    new Blob([sanitized.svg], { type: bpmnDiagramDownloadMimeTypes.svg }),
  );
  const image = new Image();
  try {
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        image.onload = null;
        image.onerror = null;
        reject(new Error("Thiết bị mất quá nhiều thời gian để dựng ảnh."));
      }, bpmnPngRenderTimeoutMs);
      image.onload = () => {
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve();
      };
      image.onerror = () => {
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        reject(new Error("Không thể dựng ảnh sơ đồ."));
      };
      image.src = sourceUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Thiết bị không hỗ trợ tạo ảnh.");
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Thiết bị mất quá nhiều thời gian để tạo tệp ảnh.")),
        bpmnPngRenderTimeoutMs,
      );
      canvas.toBlob(
        (candidate) => {
          window.clearTimeout(timeout);
          if (candidate) resolve(candidate);
          else reject(new Error("Không thể tạo tệp ảnh."));
        },
        bpmnDiagramDownloadMimeTypes.png,
      );
    });
    return blob;
  } finally {
    image.onload = null;
    image.onerror = null;
    URL.revokeObjectURL(sourceUrl);
  }
}

export function downloadBpmnBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Safari may resolve the download after the click task completes.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export const browserBpmnDiagramExport = {
  sanitizeSvg: sanitizeBpmnSvg,
  renderPng: renderBpmnSvgAsPng,
  downloadBlob: downloadBpmnBlob,
} satisfies BpmnDiagramExportPort;
