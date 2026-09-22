import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collaborationBpmnProfile } from "../domain/collaboration-profile";
import { bpmnLauncherToolDefinitions } from "./bpmn-component-launcher";
import {
  buildPlainConnectionPresentation,
  buildPlainReferenceOptions,
  compactBpmnSelectionText,
  getBpmnInspectorCapability,
  reconcileBpmnArtifactDraft,
  resolveBpmnSemanticElement,
  shouldActivateInspectorEdit,
  supportsEditableBpmnName,
} from "./bpmn-inspector-capabilities";

type InspectorFamily = ReturnType<
  typeof getBpmnInspectorCapability
>["family"];

const expectedRuntimeCapabilities = {
  "bpmn:StartEvent": ["event", true, false],
  "bpmn:EndEvent": ["event", true, false],
  "bpmn:IntermediateCatchEvent": ["event", true, false],
  "bpmn:IntermediateThrowEvent": ["event", true, false],
  "bpmn:BoundaryEvent": ["event", true, false],
  "bpmn:Task": ["flow-node", true, false],
  "bpmn:ReceiveTask": ["flow-node", true, false],
  "bpmn:UserTask": ["flow-node", true, false],
  "bpmn:ServiceTask": ["flow-node", true, false],
  "bpmn:ManualTask": ["flow-node", true, false],
  "bpmn:ExclusiveGateway": ["routing", true, false],
  "bpmn:ParallelGateway": ["routing", true, false],
  "bpmn:InclusiveGateway": ["routing", true, false],
  "bpmn:EventBasedGateway": ["routing", true, false],
  "bpmn:ComplexGateway": ["routing", true, false],
  "bpmn:SubProcess": ["container", true, false],
  "bpmn:CallActivity": ["container", true, false],
  "bpmn:DataObjectReference": ["data", true, false],
  "bpmn:DataStoreReference": ["data", true, false],
  "bpmn:TextAnnotation": ["artifact", false, false],
  "bpmn:Group": ["artifact", false, false],
  "bpmn:Participant": ["collaboration", true, false],
  "bpmn:Lane": ["collaboration", true, false],
  "bpmn:SequenceFlow": ["connection", true, false],
  "bpmn:MessageFlow": ["connection", true, true],
  "bpmn:Association": ["connection", false, true],
  "bpmn:DataAssociation": ["connection", false, true],
  "bpmn:DataInputAssociation": ["connection", false, true],
  "bpmn:DataOutputAssociation": ["connection", false, true],
} as const satisfies Readonly<
  Record<string, readonly [InspectorFamily, boolean, boolean]>
>;

function runtimeTypesForTool(
  tool: ReturnType<typeof bpmnLauncherToolDefinitions>[number]["tool"],
): readonly string[] {
  if (tool.kind === "shape") return [tool.type];
  if (tool.connector === "sequence") return ["bpmn:SequenceFlow"];
  if (tool.connector === "message") return ["bpmn:MessageFlow"];
  if (tool.connector === "association") return ["bpmn:Association"];
  return ["bpmn:DataInputAssociation", "bpmn:DataOutputAssociation"];
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function cssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`),
  );
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1]!;
}

function sourceBetween(
  text: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing source marker: ${startMarker}`).toBeGreaterThanOrEqual(
    0,
  );
  expect(end, `missing source marker: ${endMarker}`).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("SDD52 canonical canvas selection", () => {
  it("resolves an external label to its semantic target before authoring", () => {
    const group = { id: "Group_1", type: "bpmn:Group" };
    const externalLabel = {
      id: "Group_1_label",
      type: "label",
      labelTarget: group,
    };

    expect(resolveBpmnSemanticElement(externalLabel)).toBe(group);
    expect(resolveBpmnSemanticElement(group)).toBe(group);
    expect(
      resolveBpmnSemanticElement({
        id: "Imported_label_without_target",
        type: "label",
        labelTarget: null,
      }),
    ).toEqual({
      id: "Imported_label_without_target",
      type: "label",
      labelTarget: null,
    });
    expect(resolveBpmnSemanticElement(null)).toBeNull();
    expect(resolveBpmnSemanticElement(undefined)).toBeNull();
  });
});

describe("SDD52 compact Unicode selection preview", () => {
  it("compacts multiline whitespace without changing the authored string", () => {
    const authored = "  Dòng một\n\nDòng\thai  👩🏽‍💻  ";

    expect(compactBpmnSelectionText(authored)).toBe(
      "Dòng một Dòng hai 👩🏽‍💻",
    );
    expect(authored).toBe("  Dòng một\n\nDòng\thai  👩🏽‍💻  ");
  });

  it("counts the ellipsis inside the limit and never splits a grapheme", () => {
    expect(compactBpmnSelectionText("A 👩🏽‍💻 B", 4)).toBe("A 👩🏽‍💻…");
    expect(compactBpmnSelectionText("abcdef", 1)).toBe("…");
    expect(compactBpmnSelectionText("abcdef", 0)).toBe("");
    expect(compactBpmnSelectionText("abcdef", -1)).toBe("");
  });
});

describe("SDD52 unapplied artifact draft reconciliation", () => {
  it.each(["TextAnnotation", "Group"] as const)(
    "preserves a %s draft across Undo and Redo, then Escape restores the latest semantic value",
    () => {
      const initialSemantic = "Giá trị ban đầu";
      const appliedA = "Giá trị A đã áp dụng";
      const unappliedB = "Bản nháp B chưa áp dụng";
      let snapshot = appliedA;
      let draft = unappliedB;

      draft = reconcileBpmnArtifactDraft(
        draft,
        snapshot,
        initialSemantic,
      );
      snapshot = initialSemantic;
      expect(draft).toBe(unappliedB);

      draft = reconcileBpmnArtifactDraft(draft, snapshot, appliedA);
      snapshot = appliedA;
      expect(draft).toBe(unappliedB);

      draft = snapshot;
      expect(draft).toBe(appliedA);
    },
  );

  it.each(["TextAnnotation", "Group"] as const)(
    "synchronizes a pristine %s draft with semantic history",
    () => {
      expect(
        reconcileBpmnArtifactDraft(
          "Giá trị A",
          "Giá trị A",
          "Giá trị trước A",
        ),
      ).toBe("Giá trị trước A");
    },
  );
});

describe("SDD52 artifact authoring source integration", () => {
  it("canonicalizes selection state and reselects an external label target once", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const selectionHandler = sourceBetween(
      studio,
      "const handleSelection",
      "const handleElementClick",
    );

    expect(selectionHandler).toMatch(
      /const rawSelections = event\.newSelection \?\? \[\];[\s\S]*normalizedBpmnSelections\(rawSelections\);[\s\S]*const next = normalizedSelections\[0\] \?\? null;/,
    );
    expect(selectionHandler).toMatch(
      /rawSelections\.length === 1 &&[\s\S]*rawSelection !== next[\s\S]*selection"\)\.select\(next\);[\s\S]*return;[\s\S]*setSelected\(next\)/,
    );
  });

  it("reveals and focuses the single next field after pointer, drag or keyboard creation", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const revealEditor = sourceBetween(
      studio,
      "const revealArtifactEditor",
      "const publishAcknowledgedProfile",
    );
    const createCleanup = sourceBetween(
      studio,
      "const handleCreateCleanup",
      'modeler.on("selection.changed"',
    );
    const keyboardCreation = sourceBetween(
      studio,
      "const createByKeyboard",
      "const addNext",
    );

    expect(revealEditor).toContain('setInspectorView("properties")');
    expect(revealEditor).toContain('"bpmn-annotation-text"');
    expect(revealEditor).toContain('"bpmn-group-title"');
    expect(revealEditor).toContain("field.focus()");
    expect(revealEditor).toMatch(
      /kind === "group"[\s\S]*field instanceof HTMLInputElement[\s\S]*field\.select\(\)/,
    );
    expect(createCleanup).toContain('revealArtifactEditor("annotation")');
    expect(createCleanup).toContain('revealArtifactEditor("group")');
    expect(studio).toContain('modeler.on("create.cleanup", handleCreateCleanup)');
    expect(keyboardCreation).toMatch(
      /recipe\.kind === "titled-group"[\s\S]*selection"\)\.select\(createdGroup\);[\s\S]*revealArtifactEditor\("group"\)/,
    );
    expect(keyboardCreation).toMatch(
      /created\.type === "bpmn:TextAnnotation"[\s\S]*revealArtifactEditor\("annotation"\)/,
    );
  });

  it("refreshes applied drafts on history changes while preserving an unrelated local draft", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const commandHandler = sourceBetween(
      studio,
      "const handleCommand",
      "const handleCreateCleanup",
    );

    expect(commandHandler).toContain(
      'resolveBpmnSemanticElement(\n              getService(modeler, "selection").get()[0],\n            )',
    );
    expect(commandHandler).toMatch(
      /currentSelection\?\.type === "bpmn:TextAnnotation"[\s\S]*const previousAnnotationSnapshot =[\s\S]*annotationTextSnapshotRef\.current;[\s\S]*annotationTextDraftRef\.current = reconcileBpmnArtifactDraft\([\s\S]*annotationTextDraftRef\.current,[\s\S]*previousAnnotationSnapshot,[\s\S]*nextAnnotationText,[\s\S]*annotationTextSnapshotRef\.current = nextAnnotationText;[\s\S]*setAnnotationText\(\(currentDraft\) =>[\s\S]*reconcileBpmnArtifactDraft\([\s\S]*currentDraft,[\s\S]*previousAnnotationSnapshot,[\s\S]*nextAnnotationText/,
    );
    expect(commandHandler).toMatch(
      /currentSelection\?\.type === "bpmn:Group"[\s\S]*const previousGroupSnapshot = groupTitleSnapshotRef\.current;[\s\S]*groupTitleDraftRef\.current = reconcileBpmnArtifactDraft\([\s\S]*groupTitleDraftRef\.current,[\s\S]*previousGroupSnapshot,[\s\S]*nextGroupTitle,[\s\S]*groupTitleSnapshotRef\.current = nextGroupTitle;[\s\S]*setGroupTitle\(\(currentDraft\) =>[\s\S]*reconcileBpmnArtifactDraft\([\s\S]*currentDraft,[\s\S]*previousGroupSnapshot,[\s\S]*nextGroupTitle/,
    );
    expect(studio).toMatch(
      /const semanticText =[\s\S]*annotationTextSnapshotRef\.current;[\s\S]*annotationTextDraftRef\.current = semanticText;[\s\S]*setAnnotationText\(semanticText\)/,
    );
    expect(studio).toMatch(
      /const semanticTitle = groupTitleSnapshotRef\.current;[\s\S]*groupTitleDraftRef\.current = semanticTitle;[\s\S]*setGroupTitle\(semanticTitle\)/,
    );
    expect(studio).toContain(
      "annotationTextDraftRef.current = event.target.value;",
    );
    expect(studio).toContain(
      "groupTitleDraftRef.current = event.target.value;",
    );
  });

  it("validates before modeling commands and exposes concise, described fields", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const css = source("app/globals.css");
    const validators = sourceBetween(
      studio,
      "function bpmnAnnotationTextError",
      "function profileStageLabel",
    );
    const annotationApply = sourceBetween(
      studio,
      "const applyAnnotationText",
      "const applyGroupTitle",
    );
    const groupApply = sourceBetween(
      studio,
      "const applyGroupTitle",
      "const applyElementColor",
    );

    expect(validators.match(/isSupportedBpmnPlainText/g)).toHaveLength(2);
    expect(validators).toContain("graphemeCount(value) > 2_000");
    expect(validators).toContain("graphemeCount(normalized) > 120");
    expect(annotationApply.indexOf("bpmnAnnotationTextError")).toBeLessThan(
      annotationApply.indexOf("updateProperties"),
    );
    expect(groupApply.indexOf("bpmnGroupTitleError")).toBeLessThan(
      groupApply.indexOf('commandStack").execute'),
    );

    expect(studio).toContain(
      '<label htmlFor="bpmn-annotation-text">Nội dung</label>',
    );
    expect(studio).toContain('id="bpmn-annotation-text-help"');
    expect(studio).toContain('id="bpmn-annotation-text-error"');
    expect(studio).toContain(
      '<label htmlFor="bpmn-group-title">Tiêu đề</label>',
    );
    expect(studio).toContain('id="bpmn-group-title-help"');
    expect(studio).toContain('id="bpmn-group-title-error"');
    expect(studio).toContain("aria-describedby={groupTitleDescriptionIds}");
    expect(studio).toContain("Boolean(annotationTextError)");
    expect(studio).toContain("Boolean(groupTitleError)");
    expect(cssRule(css, ":focus-visible")).toMatch(/outline:\s*3px solid/);
    expect(cssRule(css, ".button")).toMatch(/min-height:\s*44px;/);
  });

  it("renames a shared title atomically and redraws every rendered Group label", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const renameCommand = sourceBetween(
      studio,
      'commandStack.register("teb.documentation.renameGroupTitle"',
      'commandStack.register("teb.advanced.configureCallActivity"',
    );
    const groupApply = sourceBetween(
      studio,
      "const applyGroupTitle",
      "const applyElementColor",
    );

    expect(groupApply).toContain(
      'getService(modeler, "commandStack").execute(\n      "teb.documentation.renameGroupTitle"',
    );
    expect(groupApply).not.toContain("updateModdleProperties");
    expect(renameCommand).toContain("registry.getAll().filter");
    expect(renameCommand).toContain("candidate.labelTarget");
    expect(renameCommand).toMatch(
      /candidateCategoryValue === categoryValue \|\|[\s\S]*candidateCategoryValue\?\.id === categoryValue\.id/,
    );
    expect(renameCommand).toMatch(
      /for \(const group of referencingGroups\) \{[\s\S]*modeling\.updateLabel\(group, title\);[\s\S]*\}/,
    );
  });

  it("keeps primary artifact notices plain and compacts only the sticky summary", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const selectionPresentation = sourceBetween(
      studio,
      "function selectedLabel",
      "function findDefinitions",
    );
    const annotationApply = sourceBetween(
      studio,
      "const applyAnnotationText",
      "const applyGroupTitle",
    );
    const groupApply = sourceBetween(
      studio,
      "const applyGroupTitle",
      "const applyElementColor",
    );

    expect(selectionPresentation.match(/compactBpmnSelectionText/g))
      .toHaveLength(2);
    expect(annotationApply).toContain('setNotice("Đã lưu nội dung chú thích.")');
    expect(groupApply).toContain('"Đã lưu tiêu đề nhóm."');
    expect(annotationApply).not.toContain("một lệnh Undo");
    expect(groupApply).not.toContain("BPMN CategoryValue");
    expect(groupApply).not.toContain("CategoryValue có tham chiếu");
  });
});

describe("SDD51 BPMN inspector activation intent", () => {
  it.each([
    ["DIRECT_CANVAS", true],
    ["VALIDATION_NAVIGATION", false],
    ["CONNECT_WORKFLOW", false],
  ] as const)("projects %s without stealing another workflow", (intent, expected) => {
    expect(shouldActivateInspectorEdit(intent)).toBe(expected);
  });

  it("fails closed for an unrecognized runtime intent", () => {
    expect(shouldActivateInspectorEdit("UNKNOWN_INTENT" as never)).toBe(false);
  });
});

describe("SDD51 BPMN inspector capability projection", () => {
  it.each(Object.entries(expectedRuntimeCapabilities))(
    "maps %s to its declared, bounded editor capability",
    (type, [family, supportsDisplayName, showsEndpointSummary]) => {
      expect(getBpmnInspectorCapability(type)).toEqual({
        family,
        supportsDisplayName,
        showsEndpointSummary,
      });
      expect(supportsEditableBpmnName(type)).toBe(supportsDisplayName);
    },
  );

  it("covers all 32 registered tools plus Lane and both derived data-association directions", () => {
    const definitions = bpmnLauncherToolDefinitions(
      collaborationBpmnProfile.id,
    );

    expect(definitions).toHaveLength(32);
    expect(new Set(definitions.map((definition) => definition.id)).size).toBe(
      32,
    );

    for (const definition of definitions) {
      for (const type of runtimeTypesForTool(definition.tool)) {
        expect(
          getBpmnInspectorCapability(type).family,
          `${definition.id} must not fall through to an unknown editor`,
        ).not.toBe("unknown");
      }
    }

    for (const type of [
      "bpmn:Lane",
      "bpmn:DataInputAssociation",
      "bpmn:DataOutputAssociation",
    ]) {
      expect(getBpmnInspectorCapability(type).family).not.toBe("unknown");
    }
  });

  it("fails closed for an unknown imported type", () => {
    expect(getBpmnInspectorCapability("vendor:UnknownShape")).toEqual({
      family: "unknown",
      supportsDisplayName: false,
      showsEndpointSummary: false,
    });
    expect(supportsEditableBpmnName("vendor:UnknownShape")).toBe(false);
  });
});

describe("SDD51 plain reference and connection presentation", () => {
  it("keeps machine IDs as values while primary option labels stay plain", () => {
    const options = buildPlainReferenceOptions(
      [
        { id: "DataStore_083e806f_technical", name: "Kho nội dung" },
        { id: "DataStore_7d809bea_technical", name: "Kho nội dung" },
        { id: "DataStore_f6b74c21_technical", name: "  Kho nội dung  " },
        { id: "DataStore_unnamed_a", name: "" },
        { id: "DataStore_unnamed_b", name: null },
      ],
      "Kho chưa đặt tên",
    );

    expect(options).toEqual([
      { value: "DataStore_083e806f_technical", label: "Kho nội dung" },
      {
        value: "DataStore_7d809bea_technical",
        label: "Kho nội dung · mục 2",
      },
      {
        value: "DataStore_f6b74c21_technical",
        label: "Kho nội dung · mục 3",
      },
      { value: "DataStore_unnamed_a", label: "Kho chưa đặt tên" },
      {
        value: "DataStore_unnamed_b",
        label: "Kho chưa đặt tên · mục 2",
      },
    ]);
    expect(options.map((option) => option.label).join(" ")).not.toMatch(
      /DataStore_/,
    );
  });

  it.each([
    ["bpmn:MessageFlow", "Trao đổi thông điệp", "Bên gửi → Bên nhận"],
    [
      "bpmn:Association",
      "Liên kết chú thích",
      "Thành phần → Nội dung giải thích",
    ],
    [
      "bpmn:DataAssociation",
      "Đường dữ liệu",
      "Nguồn dữ liệu → Nơi nhận dữ liệu",
    ],
    [
      "bpmn:DataInputAssociation",
      "Dữ liệu đi vào công việc",
      "Nguồn dữ liệu → Công việc",
    ],
    [
      "bpmn:DataOutputAssociation",
      "Dữ liệu đi ra từ công việc",
      "Công việc → Nơi lưu dữ liệu",
    ],
  ] as const)("builds a plain endpoint summary for %s", (type, title, direction) => {
    const presentation = buildPlainConnectionPresentation(
      type,
      "Nguồn nội dung",
      "Bước duyệt",
    );

    expect(presentation).toEqual({
      title,
      direction,
      source: "Nguồn nội dung",
      target: "Bước duyệt",
    });
    expect(
      `${presentation!.title} ${presentation!.direction}`,
    ).not.toMatch(/bpmn:|Association|DataInput|DataOutput|sourceRef|targetRef/i);
  });

  it("does not invent an endpoint editor for an unknown type", () => {
    expect(
      buildPlainConnectionPresentation(
        "vendor:UnknownConnection",
        "Nguồn nội dung",
        "Bước duyệt",
      ),
    ).toBeNull();
    expect(
      buildPlainConnectionPresentation(
        "bpmn:SequenceFlow",
        "Nguồn nội dung",
        "Bước duyệt",
      ),
    ).toBeNull();
  });

  it("uses plain fallback endpoints when an imported reference is missing", () => {
    expect(
      buildPlainConnectionPresentation("bpmn:Association", " ", ""),
    ).toMatchObject({
      source: "Điểm đầu chưa xác định",
      target: "Điểm cuối chưa xác định",
    });
  });
});

describe("SDD51 inspector integration source contract", () => {
  it("canonicalizes a direct canvas click before connector and inspector handling", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const elementClickHandler = sourceBetween(
      studio,
      "const handleElementClick",
      "const handleCommand",
    );

    expect(elementClickHandler).toContain(
      'shouldActivateInspectorEdit("DIRECT_CANVAS")',
    );
    expect(elementClickHandler).toMatch(
      /const clickedElement = resolveBpmnSemanticElement\(event\.element\);[\s\S]*if \(connectArmedRef\.current\) \{[\s\S]*connectionElementActionRef\.current\(clickedElement\);[\s\S]*return;[\s\S]*getBpmnInspectorCapability\([\s\S]*clickedElement\.type[\s\S]*shouldActivateInspectorEdit\("DIRECT_CANVAS"\)/,
    );
    expect(elementClickHandler).toContain("selection.select(clickedElement)");
    expect(elementClickHandler).toContain('setInspectorView("properties")');
    expect(studio).toContain("supportsEditableBpmnName(selected.type)");
  });

  it("keeps validation navigation in the current checking context", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");
    const validationNavigation = sourceBetween(
      studio,
      "const focusInspectionElement",
      "const selectedParticipant",
    );

    expect(studio).toContain("onNavigate={focusInspectionElement}");
    expect(validationNavigation).toContain(
      'getService(modeler, "selection").select(element)',
    );
    expect(validationNavigation).not.toContain("setInspectorView");
    expect(validationNavigation).not.toContain("setInspectorCollapsed");
  });

  it("uses shared reference pickers instead of native long-ID selects", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(studio).toContain("buildPlainReferenceOptions");
    expect(studio.match(/className="bpmn-inspector-select"/g)).toHaveLength(2);
    expect(studio).not.toMatch(
      /<select[\s\S]{0,160}value=\{calledElementId\}/,
    );
    expect(studio).not.toMatch(
      /<select[\s\S]{0,160}value=\{selectedDataStoreId\}/,
    );
    expect(studio).toContain("[role='listbox'], [role='option']");
  });

  it("renders a dedicated plain connection summary", () => {
    const studio = source("modules/process-modeling/ui/bpmn-studio.tsx");

    expect(studio).toContain("buildPlainConnectionPresentation");
    expect(studio).toContain('className="bpmn-inspector-reference-summary"');
  });

  it("gives the shared picker a full-width field and bounds the connection summary", () => {
    const css = source("app/globals.css");
    const trigger = cssRule(
      css,
      ".bpmn-studio__inspector .bpmn-inspector-select .select__trigger",
    );
    const summary = cssRule(
      css,
      ".bpmn-studio__inspector .bpmn-inspector-reference-summary",
    );

    expect(trigger).toMatch(/width:\s*100%;/);
    expect(trigger).toMatch(/min-width:\s*0;/);
    expect(trigger).toMatch(/max-width:\s*100%;/);
    expect(summary).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(summary).toMatch(/min-width:\s*0;/);
    expect(summary).toMatch(/max-width:\s*100%;/);
  });
});
