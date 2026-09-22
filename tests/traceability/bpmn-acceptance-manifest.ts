export type BpmnAcceptanceLayer =
  | "unit"
  | "contract"
  | "postgresql"
  | "browser"
  | "performance";

export type BpmnAutomatedEvidence = {
  readonly layer: BpmnAcceptanceLayer;
  readonly file: string;
  readonly testTitle?: string;
  readonly availability: "implemented" | "planned" | "suite";
  readonly projects?: readonly string[];
};

export type BpmnExternalEvidenceId =
  | "actual-browser-zoom-200"
  | "live-assistive-technology"
  | "representative-authors-6-8";

export type BpmnAcceptanceEntry = {
  readonly id: string;
  readonly source: "SDD56" | "SDD45" | "SDD49" | "SDD54";
  readonly inherited: boolean;
  readonly summary: string;
  readonly automatedEvidence: readonly BpmnAutomatedEvidence[];
  readonly externalEvidence: readonly BpmnExternalEvidenceId[];
};

export type BpmnExternalEvidence = {
  readonly id: BpmnExternalEvidenceId;
  readonly status: "NOT_RUN";
  readonly summary: string;
  readonly completedSessions: number;
  readonly requiredSessions: string;
  readonly recordPath?: string;
};

const browserProjects = [
  "chromium",
  "firefox",
  "webkit",
] as const;

const allBrowserProjects = [
  ...browserProjects,
  "mobile-chromium",
] as const;

export const bpmnExternalEvidence: readonly BpmnExternalEvidence[] = [
  {
    id: "actual-browser-zoom-200",
    status: "NOT_RUN",
    summary:
      "Actual browser zoom at 200% is a manual runtime gate; automated coverage is named 200%-equivalent reflow and is not substituted for it.",
    completedSessions: 0,
    requiredSessions: "1 recorded desktop browser session per release candidate",
  },
  {
    id: "live-assistive-technology",
    status: "NOT_RUN",
    summary:
      "No real VoiceOver or NVDA session has been recorded for the current frozen build.",
    completedSessions: 0,
    requiredSessions: "at least 1 real VoiceOver or NVDA session",
  },
  {
    id: "representative-authors-6-8",
    status: "NOT_RUN",
    summary:
      "Automated agents and browser scripts are not representative author participants.",
    completedSessions: 0,
    requiredSessions: "6-8 eligible representative authors",
    recordPath: "tests/benchmarks/bpmn-component-launcher/STATUS.md",
  },
] as const;

export const sdd56AcceptanceIds = Array.from(
  { length: 18 },
  (_, index) => `AC-S56-${String(index + 1).padStart(3, "0")}`,
);

export const inheritedBpmnCompletionIds = [
  "AC-BCL-011",
  "AC-BCL-014",
  "AC-BCL-015",
  "AC-BIS-002",
  "AC-BIS-003",
  "AC-BIS-004",
  "AC-BIS-006",
  "AC-BIS-007",
  "AC-BIS-008",
  "AC-BIS-009",
  "AC-S54-011",
  "AC-S54-013",
] as const;

export const bpmnAcceptanceManifest: readonly BpmnAcceptanceEntry[] = [
  {
    id: "AC-S56-001",
    source: "SDD56",
    inherited: false,
    summary: "Exact stale draft replay returns its recorded acknowledgement.",
    automatedEvidence: [
      {
        layer: "contract",
        file: "modules/process-modeling/server.save-draft.contract.test.ts",
        testTitle: "returns the original acknowledgement for an exact retry after a later profile revision",
        availability: "implemented",
      },
      {
        layer: "postgresql",
        file: "modules/process-modeling/infrastructure/prisma/prisma-process-model-repository.integration.test.ts",
        testTitle: "persists acknowledged revisions, resolves races, seals and restores immutably",
        availability: "implemented",
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-002",
    source: "SDD56",
    inherited: false,
    summary: "Changed payload, stale new key and invalid profile transitions fail closed.",
    automatedEvidence: [
      {
        layer: "contract",
        file: "modules/process-modeling/server.save-draft.contract.test.ts",
        testTitle: "returns an idempotency mismatch for a changed payload using the stale key",
        availability: "implemented",
      },
      {
        layer: "contract",
        file: "modules/process-modeling/server.save-draft.contract.test.ts",
        testTitle: "returns an idempotency mismatch when the same candidate and key use another precondition",
        availability: "implemented",
      },
      {
        layer: "contract",
        file: "modules/process-modeling/server.save-draft.contract.test.ts",
        testTitle: "returns a revision conflict for a new stale key without widening the profile graph",
        availability: "implemented",
      },
      {
        layer: "contract",
        file: "modules/process-modeling/server.save-draft.contract.test.ts",
        testTitle: "rejects a backward profile transition addressed to the current revision",
        availability: "implemented",
      },
      {
        layer: "postgresql",
        file: "modules/process-modeling/infrastructure/prisma/prisma-process-model-repository.integration.test.ts",
        testTitle: "persists acknowledged revisions, resolves races, seals and restores immutably",
        availability: "implemented",
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-003",
    source: "SDD56",
    inherited: false,
    summary: "Collapsed launcher and milestone controls own valid ARIA targets and focus.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/component-launcher-profile-facade.spec.ts",
        testTitle: "keeps focus on the outside control that dismisses the launcher",
        availability: "implemented",
        projects: browserProjects,
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "keeps ARIA responsive plain-copy and 200%-equivalent reflow gates explicit",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-004",
    source: "SDD56",
    inherited: false,
    summary: "The initial 390px viewer exposes a named semantic outline.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/mobile.spec.ts",
        testTitle: "mobile remains viewer-first without hidden authoring controls",
        availability: "implemented",
        projects: ["mobile-chromium"],
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-005",
    source: "SDD56",
    inherited: false,
    summary: "Responsive, readable and 200%-equivalent automated reflow stays contained.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "keeps ARIA responsive plain-copy and 200%-equivalent reflow gates explicit",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: ["actual-browser-zoom-200"],
  },
  {
    id: "AC-S56-006",
    source: "SDD56",
    inherited: false,
    summary: "Primary BPMN author paths use plain Vietnamese.",
    automatedEvidence: [
      {
        layer: "contract",
        file: "modules/process-modeling/ui/bpmn-component-launcher.test.tsx",
        testTitle: "keeps all primary labels and hints in plain Vietnamese",
        availability: "implemented",
      },
      {
        layer: "contract",
        file: "modules/process-modeling/ui/bpmn-lifecycle-dialogs.test.tsx",
        testTitle: "announces destructive delete impact in plain language and hides IDs in details",
        availability: "implemented",
      },
      {
        layer: "contract",
        file: "modules/process-modeling/ui/bpmn-studio-balance.contract.test.ts",
        testTitle: "keeps live notices free of implementation vocabulary and raw identifiers",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "keeps ARIA responsive plain-copy and 200%-equivalent reflow gates explicit",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-007",
    source: "SDD56",
    inherited: false,
    summary: "Versioned Recent and Favorites recover safely without semantic mutation.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/ui/bpmn-tool-preferences.test.ts",
        testTitle: "loads only the versioned, known and bounded device-local shape",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/component-launcher-profile-facade.spec.ts",
        testTitle: "persists Recent and Favorites while Cmd/Ctrl+K respects guarded editing",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-008",
    source: "SDD56",
    inherited: false,
    summary: "Cmd/Ctrl+K opens the launcher only outside guarded contexts.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/application/bpmn-keyboard-shortcuts.test.ts",
        testTitle: "keeps Cmd/Ctrl+K away from text editing and preserves other controls",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/component-launcher-profile-facade.spec.ts",
        testTitle: "persists Recent and Favorites while Cmd/Ctrl+K respects guarded editing",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-009",
    source: "SDD56",
    inherited: false,
    summary: "Validated XML, SVG and PNG downloads are mutation-free.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/application/bpmn-diagram-export.test.ts",
        testTitle: "normalizes the title and selected extension",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "downloads validated BPMN SVG and PNG without mutating the draft",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-010",
    source: "SDD56",
    inherited: false,
    summary: "SVG sanitization and PNG failure paths create no unsafe file.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/infrastructure/browser/export-bpmn-diagram.test.ts",
        testTitle: "keeps static drawing attributes and local references only",
        availability: "implemented",
      },
      {
        layer: "unit",
        file: "modules/process-modeling/infrastructure/browser/export-bpmn-diagram.test.ts",
        testTitle: "drops active, external and unrelated style declarations",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "sanitizes hostile SVG at runtime and emits no PNG download after raster failure",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-011",
    source: "SDD56",
    inherited: false,
    summary: "Native align and distribute commands remain eligible and one-step undoable.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/application/bpmn-arrange-selection.test.ts",
        testTitle: "maps only to installed native editor actions",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "arranges with native commands and restores the geometry with one Undo",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-012",
    source: "SDD56",
    inherited: false,
    summary: "The hidden legacy palette is removed only after launcher proof.",
    automatedEvidence: [
      {
        layer: "contract",
        file: "modules/process-modeling/ui/bpmn-component-launcher-architecture.contract.test.ts",
        testTitle: "keeps the retired component rail out of the canvas-first source",
        availability: "implemented",
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-013",
    source: "SDD56",
    inherited: false,
    summary: "Horizontal and vertical in-place swimlane conversion are proven end to end.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/domain/bpmn-family-conversion.test.ts",
        testTitle: "accepts the bounded %s conversion produced from the acknowledged Core XML",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "converts the same Core model to a horizontal Collaboration swimlane",
        availability: "implemented",
        projects: browserProjects,
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "converts the same Core model to a vertical Collaboration swimlane",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-014",
    source: "SDD56",
    inherited: false,
    summary: "The full current BPMN browser aggregate has no unexpected outcome.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "playwright.config.ts",
        availability: "suite",
        projects: allBrowserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-015",
    source: "SDD56",
    inherited: false,
    summary: "Every current and inherited completion gate is mapped deterministically.",
    automatedEvidence: [
      {
        layer: "contract",
        file: "tests/traceability/bpmn-acceptance-manifest.test.ts",
        testTitle: "maps every SDD56 and inherited completion gate exactly once",
        availability: "implemented",
      },
    ],
    externalEvidence: [
      "actual-browser-zoom-200",
      "live-assistive-technology",
      "representative-authors-6-8",
    ],
  },
  {
    id: "AC-S56-016",
    source: "SDD56",
    inherited: false,
    summary: "Small Medium and Large fixtures are deterministic and measured separately.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "tests/performance/bpmn/performance-fixtures.test.ts",
        testTitle: "generates deterministic Small Medium and Large BPMN fixtures",
        availability: "implemented",
      },
      {
        layer: "performance",
        file: "tests/performance/bpmn/workspace.performance.pw.ts",
        testTitle: "records the Small Medium and Large workspace measurements",
        availability: "implemented",
        projects: ["bpmn-performance-chromium"],
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-017",
    source: "SDD56",
    inherited: false,
    summary: "Static build database browser and cleanup gates complete on Node 24.",
    automatedEvidence: [
      {
        layer: "contract",
        file: "package.json",
        availability: "suite",
      },
      {
        layer: "postgresql",
        file: "tests/support/e2e-datastore-guard.test.ts",
        availability: "suite",
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S56-018",
    source: "SDD56",
    inherited: false,
    summary: "Human and live assistive-technology evidence remains explicitly not run.",
    automatedEvidence: [],
    externalEvidence: [
      "live-assistive-technology",
      "representative-authors-6-8",
    ],
  },
  {
    id: "AC-BCL-011",
    source: "SDD45",
    inherited: true,
    summary: "Recent and Favorites stay presentation-only and governed.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/ui/bpmn-tool-preferences.test.ts",
        testTitle: "loads only the versioned, known and bounded device-local shape",
        availability: "implemented",
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/component-launcher-profile-facade.spec.ts",
        testTitle: "persists Recent and Favorites while Cmd/Ctrl+K respects guarded editing",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BCL-014",
    source: "SDD45",
    inherited: true,
    summary: "BPMN import export autosave reload version validation and history regressions stay green.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "playwright.config.ts",
        availability: "suite",
        projects: allBrowserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BCL-015",
    source: "SDD45",
    inherited: true,
    summary: "Moderated representative-author benchmark is real human evidence.",
    automatedEvidence: [],
    externalEvidence: ["representative-authors-6-8"],
  },
  {
    id: "AC-BIS-002",
    source: "SDD49",
    inherited: true,
    summary: "Both in-place orientations preserve model identity and prior fingerprints.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "converts the same Core model to a horizontal Collaboration swimlane",
        availability: "implemented",
        projects: browserProjects,
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "converts the same Core model to a vertical Collaboration swimlane",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BIS-003",
    source: "SDD49",
    inherited: true,
    summary: "Conversion failures and held responses do not mutate the live canvas before acknowledgement.",
    automatedEvidence: [
      {
        layer: "unit",
        file: "modules/process-modeling/infrastructure/browser/prepare-core-swimlane-conversion.test.ts",
        testTitle: "fails closed and destroys the detached modeler when import reports warnings",
        availability: "implemented",
      },
      {
        layer: "contract",
        file: "app/api/v1/studio/process-models/[modelId]/collaboration-conversion/route.test.ts",
        testTitle: "maps authoritative CAS conflict without returning candidate XML",
        availability: "implemented",
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BIS-004",
    source: "SDD49",
    inherited: true,
    summary: "Acknowledged conversion imports canonical state and survives reload.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "converts the same Core model to a horizontal Collaboration swimlane",
        availability: "implemented",
        projects: browserProjects,
      },
      {
        layer: "browser",
        file: "tests/e2e/bpmn/completion-journeys.spec.ts",
        testTitle: "converts the same Core model to a vertical Collaboration swimlane",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BIS-006",
    source: "SDD49",
    inherited: true,
    summary: "Drag feedback preserves the dotted canvas background.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/swimlane-layout-frames.spec.ts",
        testTitle: "resolves the owning Pool, grows its Lane, reflows lower Pools and rejects invalid points",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BIS-007",
    source: "SDD49",
    inherited: true,
    summary: "Swimlane launcher dialog and mobile boundary stay responsive and accessible.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/component-launcher-profile-facade.spec.ts",
        testTitle: "keeps the launcher contained across editor viewports and mobile viewer mode",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: ["actual-browser-zoom-200"],
  },
  {
    id: "AC-BIS-008",
    source: "SDD49",
    inherited: true,
    summary: "Focused full static and guarded mutation suites complete cleanly.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "playwright.config.ts",
        availability: "suite",
        projects: allBrowserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-BIS-009",
    source: "SDD49",
    inherited: true,
    summary: "Swimlane usability benchmark remains human-only evidence.",
    automatedEvidence: [],
    externalEvidence: ["representative-authors-6-8"],
  },
  {
    id: "AC-S54-011",
    source: "SDD54",
    inherited: true,
    summary: "Lưu thành mốc exposes its prerequisite and stays distinct from automatic save.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "tests/e2e/bpmn/lifecycle-interoperability-studio-balance.spec.ts",
        testTitle: "keeps lifecycle destructive actions exact, durable and responsive",
        availability: "implemented",
        projects: browserProjects,
      },
    ],
    externalEvidence: [],
  },
  {
    id: "AC-S54-013",
    source: "SDD54",
    inherited: true,
    summary: "Focused unit PostgreSQL browser and cleanup evidence stays exact.",
    automatedEvidence: [
      {
        layer: "browser",
        file: "playwright.config.ts",
        availability: "suite",
        projects: allBrowserProjects,
      },
      {
        layer: "postgresql",
        file: "tests/support/e2e-datastore-guard.test.ts",
        availability: "suite",
      },
    ],
    externalEvidence: [],
  },
] as const;
