import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BpmnDiagramExportPort } from "../application/bpmn-diagram-export";
import type { ProcessModelPersistenceClient } from "../application/process-model-persistence-client";
import { BpmnStudio } from "./bpmn-studio";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function cssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`),
  );
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1]!;
}

function nativeDialogCount(sourceText: string) {
  return sourceText.match(/<dialog\b/g)?.length ?? 0;
}

function noticeLiteralCopy(sourceText: string) {
  const noticeCalls = Array.from(
    sourceText.matchAll(/setNotice\(([\s\S]*?)\);/gu),
    (match) => match[1] ?? "",
  );
  return noticeCalls
    .flatMap((call) =>
      (call.match(/`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/gs) ?? [])
        .map((literal) => literal.slice(1, -1))
        .map((literal) => literal.replace(/\$\{[\s\S]*?\}/gu, "")),
    )
    .join("\n");
}

describe("BPMN Studio lifecycle and responsive balance contract", () => {
  it("includes the mobile outline in the initial server markup", () => {
    const neverCalled = async () => {
      throw new Error("Effects must not run during server rendering.");
    };
    const html = renderToStaticMarkup(
      createElement(BpmnStudio, {
        modelId: "model-ssr",
        initialXml: "<definitions />",
        inspectXml: neverCalled,
        preflightXml: neverCalled,
        prepareSwimlaneConversion: neverCalled,
        persistence: {} as ProcessModelPersistenceClient,
        diagramExport: {} as BpmnDiagramExportPort,
        typography: { prepare: neverCalled, config: () => ({ defaultStyle: {fontFamily:"test"}, externalStyle: {fontFamily:"test"} }) },
      }),
    );

    expect(html).toContain('aria-label="Danh sách bước trên màn hình nhỏ"');
    expect(html).toContain("Đang tải danh sách bước…");
  });

  it("wires approved planners and separate lifecycle dialogs", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    expect(studio).toContain("planFlowNodeReparentCommand");
    expect(studio).toContain("planSubProcessDeleteCommand");
    expect(studio).toContain("planDataStoreCleanupCommand");
    expect(studio).toContain("<BpmnReparentDialog");
    expect(studio).toContain("<BpmnDeleteImpactDialog");
    expect(studio).toContain("<BpmnDataStoreCleanupDialog");
    expect(studio).not.toContain("deleteSelected(true)");
  });

  it("keeps canvas-first breakpoints, one-row tabs and accessibility modes", () => {
    const css = source("app/globals.css");
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    expect(css).toContain("@media (min-width: 1360px)");
    expect(css).toContain(
      "grid-template-columns: minmax(0, 1fr) 320px",
    );
    expect(css).toContain("@media (max-width: 1179px)");
    expect(css).not.toContain(".bpmn-studio__palette");
    expect(css).not.toContain("is-library-collapsed");
    expect(css).not.toContain(".bpmn-node-search");
    expect(css).not.toContain(".bpmn-node-library");
    expect(css).not.toContain(".bpmn-palette-list");
    expect(css).not.toContain(".bpmn-structured-routing");
    expect(studio).not.toContain("bpmn-studio__palette");
    expect(studio).not.toContain("libraryCollapsed");
    expect(css).toMatch(
      /\.bpmn-studio__actions \{[\s\S]*flex-wrap: wrap;[\s\S]*overflow-x: visible;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1023px\) and \(min-width: 768px\)[\s\S]*\.bpmn-library__hero \{[\s\S]*grid-template-columns: 1fr;/,
    );
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(studio).toContain(
      '<h1 className="sr-only">Trình thiết kế quy trình — {modelTitle}</h1>',
    );
    expect(studio).toContain('role="group"');
    expect(studio).toContain('aria-label="Điều khiển thu phóng"');
    expect(css).toMatch(
      /\.bpmn-studio__tabs--primary \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
    );
    expect(css).toMatch(
      /\.bpmn-studio__subtabs button \{[\s\S]*min-height: 44px;/,
    );
    expect(css).toMatch(
      /\.bpmn-studio__inspector-header \{[\s\S]*position: sticky;/,
    );
    expect(css).toMatch(
      /\.bpmn-studio__tabs button \{[\s\S]*font-size: 12px;/,
    );
    expect(css).toMatch(
      /\.bpmn-studio__subtabs button \{[\s\S]*font-size: 12px;/,
    );
    expect(css).not.toMatch(
      /\.bpmn-lifecycle-destructive\s*\{[^}]*display:\s*none/s,
    );
    expect(studio).toContain('setInspectorView("structure")');
    expect(studio).toContain("bpmn-version-history__readonly");
    expect(studio).toContain(
      'className="bpmn-mobile-outline-shell bpmn-outline"',
    );
    expect(studio).toContain(
      'aria-label="Danh sách bước trên màn hình nhỏ"',
    );
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.bpmn-mobile-outline-shell \{[\s\S]*display: block;/,
    );
  });

  it("centers all seven native BPMN dialogs with viewport gutters and leaves the launcher non-modal", () => {
    const css = source("app/globals.css");
    const library = source("modules/process-modeling/ui/bpmn-model-library.tsx");
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const lifecycle = source(
      "modules/process-modeling/ui/bpmn-lifecycle-dialogs.tsx",
    );
    const launcher = source(
      "modules/process-modeling/ui/bpmn-component-launcher.tsx",
    );
    const createDialogRule = cssRule(css, ".bpmn-library__create-dialog");
    const confirmDialogRule = cssRule(css, ".bpmn-confirm-dialog");

    expect(
      nativeDialogCount(library) +
        nativeDialogCount(studio) +
        nativeDialogCount(lifecycle),
    ).toBe(7);
    expect(launcher).not.toContain("<dialog");
    expect(launcher).toContain('role="dialog"');
    expect(launcher).toContain('aria-modal="false"');

    for (const rule of [createDialogRule, confirmDialogRule]) {
      expect(rule).toMatch(/position:\s*fixed;/);
      expect(rule).toMatch(/inset:\s*0;/);
      expect(rule).toMatch(/margin:\s*auto;/);
      expect(rule).toMatch(
        /max-height:[^;]*calc\(100dvh - 32px\)[^;]*;/,
      );
    }

    expect(createDialogRule).toMatch(
      /(?:width|max-width):[^;]*calc\(100(?:vw|%) - 32px\)[^;]*;/,
    );
    expect(confirmDialogRule).toMatch(
      /(?:width|max-width):[^;]*calc\(100vw - 32px\)[^;]*;/,
    );
    expect(confirmDialogRule).toMatch(/overflow(?:-y)?:\s*auto;/);
  });

  it("keeps lifecycle entry points and cleanup confirmation in plain Vietnamese", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(studio).toContain("Di chuyển phần tử");
    expect(studio).toContain("Xoá thông điệp không dùng");
    expect(studio).toContain("Xoá kho dữ liệu không dùng");
    expect(studio).toContain('role="alertdialog"');
    expect(studio).toContain("Xoá thông điệp không còn sử dụng");
    expect(studio).toContain("Xem mã thông điệp");
    expect(studio).toContain(
      'selected.businessObject?.name || "vai trò đang chọn"',
    );
    expect(studio).not.toMatch(
      /Dọn Message không dùng|Dọn DataStore không dùng|Di chuyển container/,
    );
  });

  it("keeps live notices free of implementation vocabulary and raw identifiers", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const primaryNoticeCopy = noticeLiteralCopy(studio);
    const noticeCallSource = Array.from(
      studio.matchAll(/setNotice\(([\s\S]*?)\);/gu),
      (match) => match[0],
    ).join("\n");

    expect(primaryNoticeCopy).not.toMatch(
      /teb-(?:core|collaboration)-[\w-]+@\d+|\b(?:Studio|Registry|cleanup|reference|profile|Pool|Lane|FlowNode|Process|ACK|CAS|XML|Model ID|Revision|Versions?|restore-version|successor-draft|commit|history|candidate|worker)\b/iu,
    );
    expect(primaryNoticeCopy).not.toMatch(/\bDI\b/u);
    expect(noticeCallSource).not.toMatch(
      /\$\{\s*(?:selected|element|source|target)!?\.id\s*\}/iu,
    );
    expect(noticeCallSource).not.toMatch(
      /\|\|\s*(?:selected|element|source|target)!?\.id\b/iu,
    );
  });

  it("keeps long diagnostics contained and user-facing role details readable", () => {
    const css = source("app/globals.css");
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(css).toMatch(
      /\.bpmn-validation-inspector__technical-details code\s*\{[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;[^}]*word-break: break-word;/s,
    );
    expect(css).toMatch(
      /\.bpmn-validation-inspector__technical-details > ul\s*\{[^}]*max-height:[^;]+;[^}]*overflow-y: auto;/s,
    );
    expect(css).toMatch(
      /\.bpmn-validation-inspector \.bpmn-validation-inspector__occurrences\s*\{[^}]*max-height:[^;]+;[^}]*overflow-y: auto;/s,
    );
    expect(css).toMatch(
      /\.bpmn-role-inspector > div:not\(\.bpmn-inspector-technical-details\) > strong,[\s\S]*font-size: 12px;/,
    );
    expect(css).toContain(".bpmn-model-metadata .select__listbox");
    expect(studio).toContain('labelledBy="bpmn-model-purpose-label"');
    expect(studio).not.toContain(
      '<select\n                    value={modelPurpose}',
    );
  });

  it("keeps launcher, inspector and lifecycle guidance at a readable size", () => {
    const css = source("app/globals.css");
    const readableSelectors = [
      ".bpmn-component-launcher__empty small",
      ".bpmn-validation-inspector__eyebrow",
      ".bpmn-validation-inspector__group-detail > p",
      ".bpmn-studio__inspector .bpmn-inspector-field > small",
      ".bpmn-lifecycle-dialog > label",
      ".bpmn-picker__modes small",
      ".published-bpmn-card dt",
    ];

    for (const selector of readableSelectors) {
      expect(cssRule(css, selector)).toMatch(/font-size:\s*12px;/);
    }
    expect(css).toMatch(
      /\.bpmn-studio__status\s*\{[^}]*font-size:\s*12px;/s,
    );
  });

  it("opens the version composer before an explicit create action", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(studio).toContain("const openVersionComposer = () =>");
    expect(studio).toContain('setInspectorView("versions")');
    expect(studio).toContain("versionNoteRef.current?.focus()");
    expect(studio).toMatch(
      /aria-controls=\{[\s\S]*?"bpmn-inspector-versions-panel"/,
    );
    expect(studio).toContain("Lưu thành mốc");
    expect(studio).toContain("Xác nhận lưu mốc");
    expect(studio).toMatch(/ref=\{versionNoteRef\}[\s\S]*value=\{versionNote\}/);
  });
});
