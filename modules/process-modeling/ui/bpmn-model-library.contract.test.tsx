import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import type { ProcessModelPersistenceClient } from "../application/process-model-persistence-client";
import {
  advancedAuthoringStarterXml,
  bpmnCreationProfileOptions,
  bpmnCreationSeed,
  BpmnModelLibrary,
} from "./bpmn-model-library";
import { collaborationSwimlaneLayoutsBpmnProfile } from "../domain/collaboration-profile";

const persistence = {
  listModels: vi.fn(async () => []),
  createModel: vi.fn(),
} as unknown as ProcessModelPersistenceClient;

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("BpmnModelLibrary explicit-identity contract", () => {
  it("renders explicit creation and a non-mutating loading state", () => {
    const html = renderToStaticMarkup(
      <BpmnModelLibrary
        persistence={persistence}
        starterXml="<definitions />"
      />,
    );

    expect(html).toContain("Thư viện quy trình");
    expect(html).toContain("Tạo quy trình mới");
    expect(html).toContain("Tạo quy trình");
    expect(html).toContain("Tạo và mở quy trình");
    expect(html).toContain("Cộng tác theo vai trò · khuyên dùng");
    expect(html).not.toContain("Quy trình nội bộ nâng cao");
    expect(html).not.toContain("Quy trình cộng tác nâng cao");
    expect(html).toContain("Chức năng mô phỏng việc chạy quy trình chưa được hỗ trợ");
    expect(html).not.toContain("workflow engine");
    expect(html).not.toContain("Full BPMN 2.0");
    expect(html).toContain("Đang tải các quy trình đã lưu");
    expect(html).not.toContain("Dữ liệu được kiểm tra ở máy chủ");
    expect(html).toContain('for="bpmn-model-title"');
    expect(html).toContain('id="bpmn-model-title"');
    expect(html).toContain('for="bpmn-model-purpose"');
    expect(html).toContain('id="bpmn-model-purpose"');
    expect(html).toContain('for="bpmn-model-profile"');
    expect(html).toContain('id="bpmn-model-profile"');
    expect(html).toContain(
      'aria-describedby="bpmn-profile-help bpmn-profile-scope"',
    );
    expect(html).toContain("Kiểu sơ đồ này hỗ trợ những gì?");
    expect(html).toContain("disabled");
    expect(html).toContain("<dialog");
    expect(html).not.toContain("<dialog open");
    expect(html).toContain('aria-labelledby="create-bpmn-dialog-title"');
    expect(html).toContain('aria-describedby="create-bpmn-dialog-description"');
    expect(html).toContain('aria-label="Đóng cửa sổ tạo quy trình"');
    expect(persistence.listModels).not.toHaveBeenCalled();
    expect(persistence.createModel).not.toHaveBeenCalled();
  });

  it("keeps every explicit creation profile available to the opened Select", () => {
    expect(bpmnCreationProfileOptions.map(({ label }) => label)).toEqual([
      "Cộng tác theo vai trò · khuyên dùng",
      "Quy trình nội bộ nâng cao",
      "Quy trình cộng tác nâng cao",
      "Nội bộ cơ bản · phiên bản cũ",
      "Cộng tác có vùng vai trò phẳng · phiên bản cũ",
      "Cộng tác có vùng vai trò hai cấp · phiên bản cũ",
    ]);
  });

  it("reuses shared controls and preserves responsive accessibility contracts", () => {
    const library = source("modules/process-modeling/ui/bpmn-model-library.tsx");
    const styles = source("app/globals.css");

    expect(library).toContain('import { Badge } from "@/shared/ui/badge"');
    expect(library).toContain('import { Select } from "@/shared/ui/select"');
    expect(library).toContain('role="alert" aria-live="assertive"');
    expect(library).toContain("createDialogRef.current?.showModal()");
    expect(library).toContain('initialCreateIntent !== "swimlane"');
    expect(library).toContain(
      "setProfileId(collaborationSwimlaneLayoutsBpmnProfile.id)",
    );
    expect(library).toContain("initialCreateIntentAppliedRef.current = true");
    expect(library).toContain("if (creating) return");
    expect(library).toContain('document.getElementById("open-create-bpmn-dialog")?.focus()');
    expect(library).toContain("models.length === 1");
    expect(styles).toContain(".bpmn-library__grid.is-single");
    expect(styles).toContain(".bpmn-library__grid.is-short");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".bpmn-library__create-dialog::backdrop");
    expect(styles).toContain("position: fixed");
    expect(styles).toContain(".select__listbox");
  });

  it("keeps library and editor identity explicit in source-level navigation contracts", () => {
    const library = source("modules/process-modeling/ui/bpmn-model-library.tsx");
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const client = source(
      "modules/process-modeling/infrastructure/browser/http-process-model-persistence.ts",
    );

    expect(library).toMatch(/\.listModelsPage\(\{\s*page,\s*pageSize,/);
    expect(library).toContain('folderId: folderFilter === "unfiled" ? null : folderFilter');
    expect(library).toContain("await persistence.createModel({");
    expect(library).toContain(
      "href={`/studio/diagram/${encodeURIComponent(model.id)}`}",
    );
    expect(library).toContain(
      "router.push(`/studio/diagram/${encodeURIComponent(opened.modelId)}`)",
    );
    expect(studio).toContain('href="/studio/diagram"');
    expect(studio).toContain('aria-label="Quay lại thư viện quy trình"');
    expect(studio).toContain("persistence.openModel(modelId)");


    expect(`${library}\n${studio}\n${client}`).not.toMatch(
      /models\s*\[\s*0\s*\]|openOrCreate/,
    );
    expect(library).not.toContain('className="bpmn-library__model-id"');
    expect(library).not.toContain("Mã sơ đồ");
    expect(library).not.toMatch(/<dd>r\{model\.revisionNumber\}<\/dd>/u);
  });

  it("derives an advanced starter with a callable root process without mutating predecessor fixtures", () => {
    const frozen = `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="Owner" isExecutable="false" /></bpmn:definitions>`;
    const advanced = advancedAuthoringStarterXml(frozen);

    expect(frozen).not.toContain("Process_TEB_Callable");
    expect(advanced).toContain(
      '<bpmn:process id="Process_TEB_Callable" name="Quy trình tái sử dụng" isExecutable="false" />',
    );
    expect(advanced).not.toContain("bpmndi:BPMNPlane");
  });

  it("builds the exact swimlane successor creation seed", () => {
    const seed = bpmnCreationSeed(
      collaborationSwimlaneLayoutsBpmnProfile.id,
      "<core />",
      '<bpmn:definitions id="Collaboration"></bpmn:definitions>',
    );

    expect(seed.description).toContain("phân vai theo hàng hoặc cột");
    expect(seed.xml).toContain('id="Collaboration"');
    expect(seed.xml).toContain("Process_TEB_Callable");
    expect(seed.xml).not.toContain("<core />");
  });

  it("uses the exact Complex Gateway execution disclosure", () => {
    expect(source("modules/process-modeling/ui/bpmn-studio.tsx")).toContain(
      "Ứng dụng\n                            chỉ lưu mô tả này, không tự chạy",
    );
  });
});
