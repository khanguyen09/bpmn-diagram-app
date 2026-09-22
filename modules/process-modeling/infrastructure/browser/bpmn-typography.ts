import type { BpmnTypographyPort } from "../../application/bpmn-typography";

/** Shared by visible and detached modelers so text measurement matches rendering. */
export const bpmnFontFamily = '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif';

export function bpmnTextRendererConfig() {
  return {
    defaultStyle: { fontFamily: bpmnFontFamily },
    externalStyle: { fontFamily: bpmnFontFamily },
  };
}

/** Do not leave the canvas loading forever when a font host is unavailable. */
export async function prepareBpmnFont(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      document.fonts.load('400 12px "Be Vietnam Pro"', "Quy trình phê duyệt"),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, 3000); }),
    ]);
  } catch {
    // Keep the documented system-font fallback usable offline.
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export const browserBpmnTypography: BpmnTypographyPort = {
  prepare: prepareBpmnFont,
  config: bpmnTextRendererConfig,
};
