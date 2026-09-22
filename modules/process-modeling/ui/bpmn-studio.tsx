"use client";

import { awaitRestoreResponse, createRestoreFence } from "@/shared/lib/restore-fence";

import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  Check,
  Clock3,
  Download,
  GitCommitHorizontal,
  Palette,
  Maximize2,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Route,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type Modeler from "bpmn-js/lib/Modeler";
import { BpmnAnnotationTemplates } from "./bpmn-annotation-templates";
import { applyBpmnBulkColor, registerBpmnBulkColors, bpmnColorTargets } from "./bpmn-bulk-colors";
import { BpmnConflictDialog } from "./bpmn-conflict-dialog";
import type { BpmnRecoverySnapshot } from "../application/bpmn-conflict-recovery";
import { BpmnNodeIconPicker } from "./bpmn-node-icon-picker";
import { nodeIconComponents as iconComponents } from "./bpmn-node-icons";
import { planBpmnBranchBalance, type BpmnBranchPlan } from "../application/bpmn-balance-branches";
import { executeBpmnBranchBalance, registerBpmnBranchBalanceCommand } from "../application/bpmn-balance-branches-command";
import type { BpmnTypographyPort } from "../application/bpmn-typography";
import type { BpmnInspectionClient } from "../application/bpmn-inspection-client";
import { bpmnFileIsWithinLimit } from "../application/bpmn-file-policy";
import type { BpmnRenderPreflight } from "../application/bpmn-render-preflight";
import {
  isBpmnSwimlanePreparationError,
  type BpmnSwimlaneConversionPreparer,
  type SwimlaneOrientation,
} from "../application/bpmn-swimlane-conversion-preparer";
import type {
  ProcessModelPersistenceClient,
  ProcessModelVersionSummary,
} from "../application/process-model-persistence-client";
import { LatestRequestGate } from "../application/latest-request-gate";
import {
  cancelBpmnProfileUpgradeIntent,
  createBpmnProfileUpgradeIntent,
  runBpmnProfileUpgradeIntent,
  type ProfileUpgradeIntentState,
} from "../application/bpmn-profile-upgrade-intent";
import { resolveBpmnKeyboardIntent } from "../application/bpmn-keyboard-shortcuts";
import {
  bpmnDiagramDownloadMimeTypes,
  safeBpmnDiagramFilename,
  type BpmnDiagramExportPort,
  type BpmnDiagramDownloadFormat,
} from "../application/bpmn-diagram-export";
import {
  bpmnArrangeNativeCommand,
  doesBpmnArrangeRuleAllow,
  isBpmnArrangeElementEligible,
  type BpmnArrangeAction,
} from "../application/bpmn-arrange-selection";
import { findNonOverlappingPlacement } from "../application/bpmn-local-placement";
import {
  planLowerBpmnParticipantReflow,
  resolveBpmnParticipantAtPoint,
  type BpmnParticipantFrame,
} from "../application/bpmn-swimlane-placement";
import {
  retainOrCaptureLogicalSave,
  type LogicalProcessModelSaveCommand,
} from "../application/logical-save-command";
import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
} from "../domain/core-profile";
import { coreBpmnProfile } from "../domain/core-profile";
import { isSupportedBpmnPlainText } from "../domain/full-authoring";
import {
  coreBpmnVisualProfile,
  coreComplexRoutingBpmnProfile,
  coreSubprocessTimersBpmnProfile,
  supportsSubprocessTimers,
  supportsBoundaryEvents,
  supportsCatchingEvents,
  supportsConditionalRouting,
  supportsEventRouting,
  supportsIntermediateEvents,
  supportsStructuredRouting,
  supportsTaskTypes,
  supportsFullAuthoring,
  supportsActivityContainers,
  supportsDataAuthoring,
  supportsComplexRouting,
  isCoreBpmnProfileId,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  collaborationBpmnProfile,
  collaborationSubprocessTimersBpmnProfile,
  collaborationNestedBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
  isCollaborationBpmnProfileId,
  maxCollaborationLaneDepth,
  supportsNestedLanes,
  supportsSwimlaneLayouts,
} from "../domain/collaboration-profile";
import {
  nodeIconCatalogue,
  supportsNodeVisual,
  type NodeIconKey,
} from "../domain/node-visual";
import { tebModdleDescriptor } from "../application/teb-moddle-contract";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { cn } from "@/shared/lib/cn";
import {
  acknowledgedBpmnAuthoringProfile,
  bpmnAppendActions,
  bpmnBoundaryAttachActions,
  bpmnNodeLibraryGroups,
  type BpmnAppendAction,
  type BpmnLibraryItem,
  type BpmnShapeCreationRecipe,
} from "./bpmn-node-library-catalogue";
import {
  BpmnComponentLauncher,
  allBpmnLauncherToolIds,
  bpmnLauncherToolDefinitions,
  type BpmnLauncherItem,
  type BpmnLauncherMode,
} from "./bpmn-component-launcher";
import { BpmnArrangeMenu } from "./bpmn-arrange-menu";
import { BpmnDownloadDialog } from "./bpmn-download-dialog";
import { ModalDialog } from "@/shared/ui/modal-dialog";
import { bpmnSaveRejectionNotice } from "../application/bpmn-save-feedback";
import { useBpmnToolPreferences } from "./use-bpmn-tool-preferences";
import { BpmnToolPresentationIcon } from "./bpmn-tool-presentation";
import { BpmnValidationInspector } from "./bpmn-validation-inspector";
import {
  bpmnOutlineColorLabel,
  bpmnOutlineAdvancedMetadata,
  bpmnOutlinePrimaryLabel,
  bpmnOutlineTypeLabel,
} from "./bpmn-outline-presentation";
import {
  duplicateMessageNameIds,
  filterMessageRegistry,
  messageOwnerImpactLabel,
  orphanMessageEntries,
} from "./bpmn-message-registry-picker";
import {
  planMessageCleanup,
  type MessageRegistryEntry,
} from "../domain/message-registry";
import type { CategoryRegistryEntry } from "../domain/category-registry";
import type { DataStoreRegistryEntry } from "../domain/data-authoring";
import {
  planDataStoreCleanupCommand,
  planFlowNodeReparentCommand,
  planSubProcessDeleteCommand,
} from "../application/plan-lifecycle-command";
import {
  projectFlowNodeReparentImpact,
  projectSubProcessDeleteImpact,
  type ReparentImpact,
  type SubProcessDeleteImpact,
  type SubProcessLifecycleSnapshot,
} from "../domain/subprocess-lifecycle";
import {
  assessChildRoleName,
  canAddChildRole,
  isLaneResponsibilityType,
  maxChildRoleLanes,
  normalizeChildRoleName,
} from "../domain/swimlane-role-authoring";
import {
  inspectorPrimaryViewProjection,
  inspectorViewForPrimary,
  nextInspectorPrimaryView,
  primaryInspectorViewFor,
  secondaryInspectorViewsFor,
  type InspectorPrimaryView,
  type InspectorView,
} from "./bpmn-inspector-navigation";
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
import { groupBpmnInspectionIssues } from "./bpmn-inspection-presentation";
import {
  editSequenceFlowRouting,
  maxSequenceFlowConditionLength,
  normalizeSequenceFlowRouting,
  sequenceFlowRoutingError,
  type SequenceFlowRoutingDraft,
} from "./sequence-flow-routing-editor";
import {
  bpmnMessageNameError,
  bpmnTimerDraftError,
  normalizeBpmnTimerDraft,
  type BpmnTimerDraft,
} from "./bpmn-event-properties-editor";
import {
  bpmnColorModes,
  bpmnColorModeStorageKey,
  bpmnSemanticCategory,
  bpmnSemanticLegend,
  bpmnSemanticMarker,
  defaultBpmnColorMode,
  isBpmnColorMode,
  type BpmnColorMode,
} from "./bpmn-semantic-presentation";
import {
  bpmnElementColorPalette,
  bpmnElementColorSelection,
  bpmnElementUsesStrokeOnly,
  nextBpmnElementColorIndex,
  supportsBpmnElementColor,
  type BpmnElementColorGridKey,
  type BpmnElementColorId,
} from "./bpmn-element-colors";
import {
  complexActivationError,
  inferDataAssociationDirection,
  type DataAssociationDirection,
} from "./bpmn-advanced-authoring";
import {
  isCollaborationPlacementObstacleType,
  isValidBpmnConnectionSourceType,
  type BpmnConnectKind,
} from "./bpmn-component-interaction";
import {
  BpmnDataStoreCleanupDialog,
  BpmnDeleteImpactDialog,
  BpmnReparentDialog,
  type LifecycleImpactGroup,
  type LifecycleTargetOption,
} from "./bpmn-lifecycle-dialogs";
import {
  BpmnSwimlaneConversionDialog,
  type BpmnSwimlaneConversionDialogState,
} from "./bpmn-swimlane-conversion-dialog";

type BpmnLauncherActivation = "pointer" | "keyboard";

interface PreparedSwimlaneConversionCommand {
  readonly idempotencyKey: string;
  readonly sourceRevisionToken: string;
  readonly sourceProfileId: BpmnProfileId;
  readonly orientation: SwimlaneOrientation;
  readonly candidateXml: string;
}

interface PendingSwimlaneConversion {
  readonly toolId: BpmnLibraryItem["id"];
  readonly orientation: SwimlaneOrientation;
  readonly dialogState: BpmnSwimlaneConversionDialogState;
}

interface CanvasBusinessReference {
  readonly id: string;
  readonly $type: string;
  readonly name?: string;
}

type CanvasBusinessReferenceValue =
  | CanvasBusinessReference
  | readonly CanvasBusinessReference[];

interface CanvasElement {
  readonly id: string;
  readonly type: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly businessObject?: {
    readonly id: string;
    readonly $type: string;
    readonly name?: string;
    readonly text?: string;
    readonly textFormat?: string;
    readonly categoryValueRef?: {
      readonly id?: string;
      readonly value?: string;
      readonly $parent?: Record<string, unknown>;
    };
    readonly processRef?: { readonly id: string; readonly name?: string };
    readonly sourceRef?: CanvasBusinessReferenceValue;
    readonly targetRef?: CanvasBusinessReferenceValue;
    readonly default?: { readonly id: string };
    readonly conditionExpression?: {
      readonly $type?: string;
      readonly body?: string;
    };
    readonly eventDefinitions?: readonly {
      readonly id?: string;
      readonly $type: string;
      readonly $parent?: Record<string, unknown>;
      readonly messageRef?: {
        readonly id: string;
        readonly $type: "bpmn:Message";
        readonly name?: string;
      };
      readonly timeDate?: {
        readonly $type: "bpmn:FormalExpression";
        readonly body?: string;
      };
      readonly timeDuration?: {
        readonly $type: "bpmn:FormalExpression";
        readonly body?: string;
      };
    }[];
    readonly messageRef?: {
      readonly id: string;
      readonly $type: "bpmn:Message";
      readonly name?: string;
    };
    readonly eventGatewayType?: "Exclusive";
    readonly instantiate?: boolean;
    readonly cancelActivity?: boolean;
    readonly calledElement?: string;
    readonly dataObjectRef?: { readonly id?: string; readonly name?: string };
    readonly dataStoreRef?: { readonly id?: string; readonly name?: string };
    readonly activationCondition?: {
      readonly $type?: string;
      readonly body?: string;
    };
    readonly gatewayDirection?: string;
    readonly triggeredByEvent?: boolean;
    readonly attachedToRef?: {
      readonly id: string;
      readonly $type: string;
      readonly name?: string;
    };
    readonly $parent?: Record<string, unknown>;
    readonly childLaneSet?: {
      readonly lanes?: readonly { readonly id: string }[];
    };
    readonly lanes?: readonly { readonly id: string }[];
    readonly extensionElements?: {
      readonly values?: readonly {
        readonly $type?: string;
        readonly iconKey?: string;
      }[];
    };
  };
  readonly parent?: CanvasElement;
  readonly children?: readonly CanvasElement[];
  readonly incoming?: readonly CanvasElement[];
  readonly outgoing?: readonly CanvasElement[];
  readonly source?: CanvasElement;
  readonly target?: CanvasElement;
  readonly labelTarget?: CanvasElement;
  readonly attachers?: readonly CanvasElement[];
  readonly host?: CanvasElement;
  readonly di?: {
    get(name: string): unknown;
  };
}

function firstReference(
  reference: CanvasBusinessReferenceValue | undefined,
): CanvasBusinessReference | undefined {
  if (!reference) return undefined;
  return Array.isArray(reference)
    ? reference[0]
    : (reference as CanvasBusinessReference);
}

function firstReferenceId(
  reference: CanvasBusinessReferenceValue | undefined,
): string | undefined {
  return firstReference(reference)?.id;
}

type ParticipantCanvasElement = CanvasElement & {
  readonly type: "bpmn:Participant";
};
type LaneCanvasElement = CanvasElement & { readonly type: "bpmn:Lane" };
type FlowNodeCanvasElement = CanvasElement & {
  readonly type:
    | "bpmn:StartEvent"
    | "bpmn:Task"
    | "bpmn:ExclusiveGateway"
    | "bpmn:ParallelGateway"
    | "bpmn:InclusiveGateway"
    | "bpmn:IntermediateCatchEvent"
    | "bpmn:ReceiveTask"
    | "bpmn:UserTask"
    | "bpmn:ServiceTask"
    | "bpmn:ManualTask"
    | "bpmn:IntermediateThrowEvent"
    | "bpmn:BoundaryEvent"
    | "bpmn:EventBasedGateway"
    | "bpmn:SubProcess"
    | "bpmn:CallActivity"
    | "bpmn:ComplexGateway"
    | "bpmn:EndEvent";
};

interface CanvasService {
  zoom(value?: number | "fit-viewport"): number;
  viewbox(box?: { x: number; y: number; width: number; height: number }): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly scale: number;
  };
  getRootElement(): CanvasElement;
  scrollToElement(element: CanvasElement): void;
  addMarker(element: CanvasElement | string, marker: string): void;
  removeMarker(element: CanvasElement | string, marker: string): void;
}

interface CommandStackService {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  register(
    command: string,
    handler: {
      preExecute(context: Record<string, unknown>): void;
      execute?(context: Record<string, unknown>): void;
      revert?(context: Record<string, unknown>): void;
    },
  ): void;
  execute(command: string, context: Record<string, unknown>): void;
}

interface SelectionService {
  get(): readonly CanvasElement[];
  select(element: CanvasElement | readonly CanvasElement[]): void;
}

interface ElementRegistryService {
  get(id: string): CanvasElement | undefined;
  getAll(): readonly CanvasElement[];
}

interface ModelingService {
  updateLabel(element: CanvasElement, newLabel: string): void;
  updateProperties(
    element: CanvasElement,
    properties: Readonly<Record<string, unknown>>,
  ): void;
  updateModdleProperties(
    element: CanvasElement,
    moddleElement: Record<string, unknown>,
    properties: Readonly<Record<string, unknown>>,
  ): void;
  createShape(
    shape: CanvasElement,
    position: { readonly x: number; readonly y: number },
    parent: CanvasElement,
    hints?: Readonly<Record<string, unknown>>,
  ): CanvasElement;
  connect(
    source: CanvasElement,
    target: CanvasElement,
    properties: {
      readonly type:
        | "bpmn:SequenceFlow"
        | "bpmn:MessageFlow"
        | "bpmn:Association"
        | "bpmn:DataInputAssociation"
        | "bpmn:DataOutputAssociation";
    },
  ): CanvasElement;
  setColor(
    elements: readonly CanvasElement[],
    colors: {
      readonly fill?: string | undefined;
      readonly stroke?: string | undefined;
    },
  ): void;
  removeElements(elements: readonly CanvasElement[]): void;
  resizeShape(
    element: CanvasElement,
    bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    },
  ): void;
  appendShape(
    source: CanvasElement,
    shape: CanvasElement,
    position: { readonly x: number; readonly y: number },
    target: CanvasElement,
    hints?: Readonly<Record<string, unknown>>,
  ): CanvasElement;
  moveElements(
    elements: readonly CanvasElement[],
    delta: { readonly x: number; readonly y: number },
    target?: CanvasElement,
    hints?: Readonly<Record<string, unknown>>,
  ): void;
  addLane(
    target: CanvasElement,
    location: "top" | "bottom" | "left" | "right",
  ): CanvasElement;
  splitLane(target: CanvasElement, count: number): void;
}

interface ElementFactoryService {
  createShape(options: {
    readonly type: string;
    readonly eventDefinitionType?: string;
    readonly cancelActivity?: boolean;
    readonly businessObject?: Record<string, unknown>;
    readonly width?: number;
    readonly height?: number;
    readonly isExpanded?: boolean;
  }): CanvasElement;
  createParticipantShape(
    options?: boolean | Readonly<Record<string, unknown>>,
  ): CanvasElement;
}

interface CreateService {
  start(event: Event, shape: CanvasElement): void;
}

interface DraggingService {
  cancel(): void;
}

interface GlobalConnectService {
  toggle(event?: Event): void;
}

interface EditorActionsService {
  trigger(action: string, options?: Readonly<Record<string, unknown>>): unknown;
}

interface RulesService {
  allowed(
    action: "elements.align" | "elements.distribute",
    context: { readonly elements: readonly CanvasElement[] },
  ): boolean | readonly CanvasElement[] | null;
}

interface ModdleService {
  create(
    type: string,
    attributes?: Readonly<Record<string, unknown>>,
  ): Record<string, unknown>;
}

interface BpmnFactoryService {
  create(
    type: string,
    attributes?: Readonly<Record<string, unknown>>,
  ): Record<string, unknown>;
}

interface OverlaysService {
  add(
    element: CanvasElement,
    type: string,
    overlay: {
      readonly position: { readonly top: number; readonly left: number };
      readonly html: string;
      readonly scale?: boolean;
    },
  ): string;
  remove(filter: { readonly type: string }): void;
}

interface EventBusService {
  on(
    event: string,
    priority: number,
    handler: (event: { readonly context: Record<string, unknown> }) => void,
  ): void;
}

interface ModelerServices {
  canvas: CanvasService;
  commandStack: CommandStackService;
  selection: SelectionService;
  elementRegistry: ElementRegistryService;
  modeling: ModelingService;
  elementFactory: ElementFactoryService;
  create: CreateService;
  dragging: DraggingService;
  globalConnect: GlobalConnectService;
  editorActions: EditorActionsService;
  rules: RulesService;
  moddle: ModdleService;
  bpmnFactory: BpmnFactoryService;
  overlays: OverlaysService;
  eventBus: EventBusService;
}

const modelPurposeCodes = {
  asIs: "AS_IS",
  toBe: "TO_BE",
  reference: "REFERENCE",
} as const;

const modelPurposeOptions = [
  { value: modelPurposeCodes.asIs, label: "Ghi lại hiện trạng" },
  {
    value: modelPurposeCodes.toBe,
    label: "Thiết kế trạng thái mong muốn",
  },
  { value: modelPurposeCodes.reference, label: "Làm mẫu tham khảo" },
] as const;

function selectedNodeIcon(element: CanvasElement | null): NodeIconKey | null {
  const iconKey = element?.businessObject?.extensionElements?.values?.find(
    (value) => value.$type === "teb:NodeVisual",
  )?.iconKey;
  return nodeIconCatalogue.some((item) => item.id === iconKey)
    ? (iconKey as NodeIconKey)
    : null;
}

function refreshNodeVisualOverlays(modeler: Modeler) {
  const overlays = getService(modeler, "overlays");
  overlays.remove({ type: "teb-node-visual" });
  for (const element of getService(modeler, "elementRegistry").getAll()) {
    const iconKey = selectedNodeIcon(element);
    if (!iconKey || !supportsNodeVisual(element.type)) continue;
    const Icon = iconComponents[iconKey];
    const html = renderToStaticMarkup(
      createElement(
        "span",
        {
          className: "teb-node-visual",
          "data-icon-key": iconKey,
          "aria-hidden": "true",
        },
        createElement(Icon, {
          width: 16,
          height: 16,
          strokeWidth: 1.5,
          focusable: false,
        }),
      ),
    );
    overlays.add(element, "teb-node-visual", {
      position: { top: 5, left: 5 },
      html,
    });
  }
}

function refreshSemanticPresentation(modeler: Modeler, mode: BpmnColorMode) {
  const canvas = getService(modeler, "canvas");
  for (const element of getService(modeler, "elementRegistry").getAll()) {
    const category = bpmnSemanticCategory(element.type);
    if (!category) continue;
    const marker = bpmnSemanticMarker(category);
    canvas.removeMarker(element, marker);
    if (mode !== "CLASSIC") canvas.addMarker(element, marker);
  }
}

function refreshContextActionOverlay(
  modeler: Modeler,
  element: CanvasElement | null,
  expanded: boolean,
  actions: ReturnType<typeof bpmnAppendActions>,
  structuredProfileAcknowledged: boolean,
) {
  const overlays = getService(modeler, "overlays");
  overlays.remove({ type: "teb-context-actions" });
  if (!isFlowNode(element) || element.type === "bpmn:EndEvent") return;

  const menu = expanded
    ? createElement(
        "div",
        {
          className: "teb-context-append__menu",
          role: "menu",
          "aria-label": "Chọn phần tử kế tiếp",
        },
        ...actions.map((action) =>
          createElement(
            "button",
            {
              key: action.id,
              type: "button",
              role: "menuitem",
              "data-bpmn-append-id": action.id,
              disabled:
                action.type === "bpmn:ParallelGateway" &&
                !structuredProfileAcknowledged,
            },
            createElement(
              "span",
              { className: "teb-context-append__glyph", "aria-hidden": "true" },
              createElement(BpmnToolPresentationIcon, {
                toolId: action.id,
                size: 16,
              }),
            ),
            createElement(
              "span",
              null,
              createElement("strong", null, action.label),
              createElement("small", null, action.hint),
            ),
          ),
        ),
        createElement(
          "button",
          {
            type: "button",
            role: "menuitem",
            "data-bpmn-context-more": "true",
          },
          createElement(
            "span",
            { className: "teb-context-append__glyph", "aria-hidden": "true" },
            createElement(Palette, {
              width: 16,
              height: 16,
              strokeWidth: 1.5,
            }),
          ),
          createElement(
            "span",
            null,
            createElement("strong", null, "Thêm thành phần khác…"),
            createElement("small", null, "Mở toàn bộ thư viện thành phần"),
          ),
        ),
      )
    : null;
  const html = renderToStaticMarkup(
    createElement(
      "div",
      { className: "teb-context-append" },
      createElement(
        "button",
        {
          type: "button",
          className: "teb-context-append__trigger",
          "data-bpmn-context-plus": "true",
          "aria-label": "Thêm phần tử kế tiếp",
          "aria-expanded": expanded ? "true" : "false",
        },
        createElement(Plus, {
          width: 18,
          height: 18,
          strokeWidth: 1.5,
          "aria-hidden": "true",
        }),
      ),
      menu,
    ),
  );
  overlays.add(element, "teb-context-actions", {
    position: {
      top: (element.height ?? 60) / 2,
      left: (element.width ?? 100) + 10,
    },
    html,
    scale: false,
  });
}

function getService<K extends keyof ModelerServices>(
  modeler: Modeler,
  name: K,
): ModelerServices[K] {
  return modeler.get(name) as unknown as ModelerServices[K];
}

function selectedLabel(element: CanvasElement | null) {
  if (!element) return "Chưa chọn thành phần";
  if (element.type === "bpmn:TextAnnotation") {
    const preview = compactBpmnSelectionText(
      element.businessObject?.text ?? "",
    );
    return `Chú thích · ${preview || "Chưa có nội dung"}`;
  }
  if (element.type === "bpmn:Group") {
    const preview = compactBpmnSelectionText(
      element.businessObject?.categoryValueRef?.value ?? "",
    );
    return `Nhóm trực quan · ${preview || "Chưa có tiêu đề"}`;
  }
  const typeLabels: Readonly<Record<string, string>> = {
    "bpmn:StartEvent": "Điểm bắt đầu",
    "bpmn:EndEvent": "Điểm kết thúc",
    "bpmn:Task": "Công việc",
    "bpmn:UserTask": "Công việc của người",
    "bpmn:ServiceTask": "Công việc tự động",
    "bpmn:ManualTask": "Công việc thủ công",
    "bpmn:ReceiveTask": "Nhận thông điệp",
    "bpmn:SubProcess": "Quy trình con",
    "bpmn:CallActivity": "Dùng lại quy trình",
    "bpmn:ExclusiveGateway": "Chọn một hướng",
    "bpmn:ParallelGateway": "Chạy song song",
    "bpmn:InclusiveGateway": "Chọn một hoặc nhiều hướng",
    "bpmn:ComplexGateway": "Hợp nhánh theo điều kiện",
    "bpmn:EventBasedGateway": "Chờ sự kiện đầu tiên",
    "bpmn:IntermediateCatchEvent": "Sự kiện chờ",
    "bpmn:IntermediateThrowEvent": "Sự kiện gửi",
    "bpmn:BoundaryEvent": "Sự kiện tại biên",
    "bpmn:SequenceFlow": "Đường thực hiện",
    "bpmn:MessageFlow": "Trao đổi thông điệp",
    "bpmn:Association": "Liên kết chú thích",
    "bpmn:DataInputAssociation": "Dữ liệu đi vào công việc",
    "bpmn:DataOutputAssociation": "Dữ liệu đi ra từ công việc",
    "bpmn:DataObjectReference": "Tài liệu dữ liệu",
    "bpmn:DataStoreReference": "Kho dữ liệu",
    "bpmn:Participant": "Bên tham gia",
    "bpmn:Lane": "Vùng vai trò",
  };
  const typeLabel = typeLabels[element.type] ?? "Thành phần sơ đồ";
  const name = element.businessObject?.name?.trim();
  return name ? `${typeLabel} · ${name}` : typeLabel;
}

function normalizedBpmnSelections(
  selections: readonly CanvasElement[],
): readonly CanvasElement[] {
  return Array.from(
    new Map(
      selections.flatMap((candidate) => {
        const semantic = resolveBpmnSemanticElement(candidate);
        return semantic ? [[semantic.id, semantic] as const] : [];
      }),
    ).values(),
  );
}

function bpmnArrangeCapabilities(
  modeler: Modeler,
  selectedElements: readonly CanvasElement[],
): { readonly canAlign: boolean; readonly canDistribute: boolean } {
  if (
    selectedElements.length < 2 ||
    !selectedElements.every(isBpmnArrangeElementEligible)
  ) {
    return { canAlign: false, canDistribute: false };
  }

  const rules = getService(modeler, "rules");
  return {
    canAlign: doesBpmnArrangeRuleAllow(
      rules.allowed("elements.align", { elements: selectedElements }),
      selectedElements,
      2,
    ),
    canDistribute:
      selectedElements.length >= 3 &&
      doesBpmnArrangeRuleAllow(
        rules.allowed("elements.distribute", { elements: selectedElements }),
        selectedElements,
        3,
      ),
  };
}

function findDefinitions(
  businessObject: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  let current = businessObject;
  while (current) {
    if (current.$type === "bpmn:Definitions") return current;
    current = current.$parent as Record<string, unknown> | undefined;
  }
  return undefined;
}

function projectLiveMessageRegistry(
  modeler: Modeler,
  authoritative: readonly MessageRegistryEntry[],
): readonly MessageRegistryEntry[] {
  const elements = getService(modeler, "elementRegistry").getAll();
  const anchor = elements.find((element) => element.businessObject);
  const definitions = findDefinitions(
    anchor?.businessObject as Record<string, unknown> | undefined,
  );
  const messages = (
    (definitions?.rootElements as Record<string, unknown>[]) ?? []
  ).filter((root) => root.$type === "bpmn:Message");
  return messages.map((message) => {
    const id = String(message.id);
    const owners: MessageRegistryEntry["owners"][number][] = [];
    for (const element of elements) {
      const directRef = element.businessObject?.messageRef;
      if (element.type === "bpmn:ReceiveTask" && directRef?.id === id) {
        owners.push({
          ownerId: element.id,
          ownerType: element.type,
          property: "ReceiveTask.messageRef",
        });
      }
      for (const definition of element.businessObject?.eventDefinitions ?? []) {
        if (
          definition.$type === "bpmn:MessageEventDefinition" &&
          definition.messageRef?.id === id
        ) {
          owners.push({
            ownerId: element.id,
            ownerType: element.type,
            ...(definition.id ? { definitionId: definition.id } : {}),
            property: "MessageEventDefinition.messageRef",
          });
        }
      }
    }
    const prior = authoritative.find((entry) => entry.id === id);
    const unknownCount = prior?.hasUnknownReferences
      ? Math.max(1, prior.referenceCount - prior.owners.length)
      : 0;
    return {
      id,
      name: typeof message.name === "string" ? message.name : "",
      owners,
      referenceCount: owners.length + unknownCount,
      hasUnknownReferences: prior?.hasUnknownReferences ?? false,
    };
  });
}

function shapeCreationOptions(type: string, recipe: BpmnShapeCreationRecipe) {
  if (
    recipe.kind === "catch-event" ||
    recipe.kind === "boundary-event" ||
    (recipe.kind === "throw-event" && recipe.eventDefinitionType)
  ) {
    return {
      type,
      eventDefinitionType: recipe.eventDefinitionType,
      ...(recipe.kind === "boundary-event"
        ? { cancelActivity: recipe.cancelActivity }
        : {}),
    };
  }
  return { type };
}

function artifactShape(
  factory: ElementFactoryService,
  moddle: ModdleService,
  type: string,
  recipe: BpmnShapeCreationRecipe,
) {
  if (recipe.kind === "text-annotation") {
    return factory.createShape({
      type,
      businessObject: moddle.create("bpmn:TextAnnotation", {
        id: `TextAnnotation_${crypto.randomUUID().replaceAll("-", "")}`,
        text: "",
        textFormat: "text/plain",
      }),
    });
  }
  if (recipe.kind === "titled-group") {
    return factory.createShape({
      type,
      businessObject: moddle.create("bpmn:Group", {
        id: `Group_${crypto.randomUUID().replaceAll("-", "")}`,
      }),
    });
  }
  if (recipe.kind === "complex-join") {
    return factory.createShape({
      type,
      businessObject: moddle.create("bpmn:ComplexGateway", {
        id: `ComplexGateway_${crypto.randomUUID().replaceAll("-", "")}`,
        name: "Đồng bộ theo điều kiện",
        gatewayDirection: "Converging",
      }),
    });
  }
  return factory.createShape(shapeCreationOptions(type, recipe));
}

const appendableBpmnToolIds = new Set<BpmnLibraryItem["id"]>([
  "task",
  "exclusive-gateway",
  "parallel-gateway",
  "inclusive-gateway",
  "message-catch-event",
  "timer-catch-event",
  "receive-task",
  "user-task",
  "service-task",
  "manual-task",
  "none-throw-event",
  "message-throw-event",
  "event-based-gateway",
  "end-event",
]);

function issueSummary(issues: readonly BpmnInspectionIssue[]) {
  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;
  return `${errors} lỗi · ${warnings} cảnh báo`;
}

function graphemeCount(value: string): number {
  return [...new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(value)]
    .length;
}

function bpmnAnnotationTextError(value: string): string | null {
  if (!isSupportedBpmnPlainText(value)) {
    return "Xóa các ký tự ẩn không được hỗ trợ rồi thử lại.";
  }
  if (graphemeCount(value) > 2_000) {
    return "Rút gọn nội dung còn tối đa 2.000 ký tự.";
  }
  return null;
}

function bpmnGroupTitleError(value: string): string | null {
  const normalized = value.trim();
  if (!isSupportedBpmnPlainText(value)) {
    return "Xóa các ký tự ẩn không được hỗ trợ rồi thử lại.";
  }
  if (!normalized) return "Nhập tiêu đề cho nhóm.";
  if (graphemeCount(normalized) > 120) {
    return "Rút gọn tiêu đề còn tối đa 120 ký tự.";
  }
  return null;
}

function profileStageLabel(profileId: BpmnProfileId) {
  if (supportsSubprocessTimers(profileId)) return "Hẹn giờ quy trình con";
  if (supportsSwimlaneLayouts(profileId)) return "Bố cục vai trò";
  if (supportsComplexRouting(profileId)) return "Điều phối nâng cao";
  if (supportsDataAuthoring(profileId)) return "Dữ liệu và chú thích";
  if (supportsActivityContainers(profileId))
    return "Quy trình con và dùng lại";
  if (supportsFullAuthoring(profileId)) return "Đầy đủ thành phần";
  if (supportsBoundaryEvents(profileId)) return "Sự kiện tại biên";
  if (supportsIntermediateEvents(profileId)) return "Sự kiện gửi";
  if (supportsTaskTypes(profileId)) return "Các loại công việc";
  if (supportsEventRouting(profileId)) return "Chờ sự kiện đầu tiên";
  if (supportsCatchingEvents(profileId)) return "Sự kiện chờ";
  if (supportsConditionalRouting(profileId)) return "Rẽ nhiều hướng";
  if (supportsStructuredRouting(profileId)) return "Chạy song song";
  if (profileId === collaborationNestedBpmnProfile.id) {
    return "Phân vai nhiều cấp";
  }
  return isCollaborationBpmnProfileId(profileId)
    ? "Sơ đồ nhiều bên tham gia"
    : "Sơ đồ cơ bản";
}

function isFlowNode(
  element: CanvasElement | null | undefined,
): element is FlowNodeCanvasElement {
  return Boolean(
    element &&
    [
      "bpmn:StartEvent",
      "bpmn:Task",
      "bpmn:ExclusiveGateway",
      "bpmn:ParallelGateway",
      "bpmn:InclusiveGateway",
      "bpmn:IntermediateCatchEvent",
      "bpmn:ReceiveTask",
      "bpmn:UserTask",
      "bpmn:ServiceTask",
      "bpmn:ManualTask",
      "bpmn:IntermediateThrowEvent",
      "bpmn:BoundaryEvent",
      "bpmn:EventBasedGateway",
      "bpmn:SubProcess",
      "bpmn:CallActivity",
      "bpmn:ComplexGateway",
      "bpmn:EndEvent",
    ].includes(element.type),
  );
}

function isDataReference(element: CanvasElement | null | undefined): boolean {
  return Boolean(
    element &&
      ["bpmn:DataObjectReference", "bpmn:DataStoreReference"].includes(
        element.type,
      ),
  );
}

function isReparentableFlowNode(
  element: CanvasElement | null | undefined,
): element is FlowNodeCanvasElement {
  return Boolean(
    isFlowNode(element) &&
      element?.type !== "bpmn:SubProcess" &&
      element?.type !== "bpmn:BoundaryEvent",
  );
}

function owningFlowContainer(element: CanvasElement | null | undefined) {
  let current = element?.parent;
  while (current) {
    if (
      current.type === "bpmn:SubProcess" ||
      current.type === "bpmn:Process" ||
      isParticipant(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

function isParticipant(
  element: CanvasElement | null | undefined,
): element is ParticipantCanvasElement {
  return element?.type === "bpmn:Participant";
}

function isTextAnnotation(
  element: CanvasElement | null | undefined,
): boolean {
  return element?.type === "bpmn:TextAnnotation";
}

function isAssociationEndpoint(
  element: CanvasElement | null | undefined,
): boolean {
  return Boolean(
    element &&
      ![
        "bpmn:Association",
        "bpmn:SequenceFlow",
        "bpmn:MessageFlow",
        "bpmn:Process",
        "bpmn:Collaboration",
        "bpmn:LaneSet",
      ].includes(element.type),
  );
}

function isBoundaryHost(element: CanvasElement | null | undefined): element is FlowNodeCanvasElement {
  return Boolean(element && (["bpmn:Task", "bpmn:UserTask", "bpmn:ServiceTask", "bpmn:ManualTask", "bpmn:ReceiveTask"].includes(element.type) || (element.type === "bpmn:SubProcess" && element.businessObject?.triggeredByEvent !== true)));
}

function isLane(
  element: CanvasElement | null | undefined,
): element is LaneCanvasElement {
  return element?.type === "bpmn:Lane";
}

function isHorizontalSwimlane(
  element: CanvasElement | null | undefined,
): boolean {
  const participant = isParticipant(element)
    ? element
    : owningParticipant(element);
  return participant?.di?.get("isHorizontal") !== false;
}

function owningParticipant(element: CanvasElement | null | undefined) {
  let current = element;
  while (current) {
    if (isParticipant(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function participantFrame(element: ParticipantCanvasElement): BpmnParticipantFrame {
  return {
    id: element.id,
    x: element.x ?? Number.NaN,
    y: element.y ?? Number.NaN,
    width: element.width ?? Number.NaN,
    height: element.height ?? Number.NaN,
    whiteBox: Boolean(element.businessObject?.processRef),
  };
}

function participantFrames(
  registry: ElementRegistryService,
): readonly BpmnParticipantFrame[] {
  return registry.getAll().filter(isParticipant).map(participantFrame);
}

function laneDepth(element: CanvasElement | null | undefined) {
  let depth = -1;
  let current = element;
  while (current && !isParticipant(current)) {
    if (isLane(current)) depth += 1;
    current = current.parent;
  }
  return Math.max(0, depth);
}

function descendantLanes(element: CanvasElement | null | undefined) {
  if (!element) return [] as CanvasElement[];
  const found: CanvasElement[] = [];
  const visit = (candidate: CanvasElement) => {
    for (const child of candidate.children ?? []) {
      if (isLane(child)) {
        found.push(child);
        visit(child);
      }
    }
  };
  visit(element);
  return found;
}

function canvasDeleteImpactIds(element: CanvasElement): readonly string[] {
  const ids = new Set<string>([element.id]);
  const visit = (candidate: CanvasElement) => {
    for (const child of candidate.children ?? []) {
      ids.add(child.id);
      visit(child);
    }
  };
  visit(element);
  for (const related of [
    ...(element.incoming ?? []),
    ...(element.outgoing ?? []),
    ...(element.attachers ?? []),
  ]) {
    ids.add(related.id);
  }
  return [...ids].sort();
}

interface BpmnStudioProps {
  readonly modelId: string;
  readonly initialXml: string;
  readonly inspectXml: BpmnInspectionClient;
  readonly preflightXml: BpmnRenderPreflight;
  readonly prepareSwimlaneConversion: BpmnSwimlaneConversionPreparer;
  readonly persistence: ProcessModelPersistenceClient;
  readonly diagramExport: BpmnDiagramExportPort;
  readonly typography: BpmnTypographyPort;
}

export function BpmnStudio({
  modelId,
  initialXml,
  inspectXml,
  preflightXml,
  prepareSwimlaneConversion,
  persistence,
  diagramExport,
  typography,
}: BpmnStudioProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelerRef = useRef<Modeler | null>(null);
  const currentXmlRef = useRef(initialXml);
  const refreshTimerRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveActionRef = useRef<() => void>(() => undefined);
  const saveInFlightRef = useRef(false);
  const conflictRef = useRef(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const saveQueuedRef = useRef(false);
  const editSequenceRef = useRef(0);
  const restoreFenceRef = useRef(createRestoreFence());
  const [restoring, setRestoring] = useState(false);
  const [pendingRestoreVersionId, setPendingRestoreVersionId] = useState<string | null>(null);
  const pendingSaveCommandRef = useRef<LogicalProcessModelSaveCommand | null>(
    null,
  );
  const nextRevisionSourceRef = useRef<"EDITED" | "IMPORTED">("EDITED");
  const saveRetryCountRef = useRef(0);
  const allowNavigationRef = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false);
  const [leaveSaveError, setLeaveSaveError] = useState(false);
  const pendingVersionCommandRef = useRef<{
    fingerprint: string;
    idempotencyKey: string;
    restoreSequence?: number;
  } | null>(null);
  const hydratingRef = useRef(true);
  const titleRef = useRef("Quy trình duyệt bài phân tích");
  const descriptionRef = useRef("");
  const purposeRef = useRef<"AS_IS" | "TO_BE" | "REFERENCE">("AS_IS");
  const profileIdRef = useRef<BpmnProfileId>(coreBpmnProfile.id);
  const colorModeRef = useRef<BpmnColorMode>(defaultBpmnColorMode);
  const durableModelRef = useRef<{
    modelId: string;
    revisionToken: string;
    profileId: BpmnProfileId;
    description: string;
    purpose: "AS_IS" | "TO_BE" | "REFERENCE";
  } | null>(null);
  const acknowledgedProfileIdRef = useRef<BpmnProfileId>(coreBpmnProfile.id);
  const projectionGateRef = useRef(new LatestRequestGate());
  const importGateRef = useRef(new LatestRequestGate());
  const importInFlightRef = useRef(false);
  const connectArmedRef = useRef(false);
  const connectSourceIdRef = useRef<string | null>(null);
  const connectKindRef = useRef<BpmnConnectKind>("sequence");
  const connectionElementActionRef = useRef<
    (element: CanvasElement) => boolean
  >(() => false);
  const restoreContextTriggerFocusRef = useRef(false);
  const routingSnapshotRef = useRef<SequenceFlowRoutingDraft>({
    condition: "",
    isDefault: false,
  });
  const messageNameSnapshotRef = useRef("");
  const annotationTextSnapshotRef = useRef("");
  const groupTitleSnapshotRef = useRef("");
  const annotationTextDraftRef = useRef("");
  const groupTitleDraftRef = useRef("");
  const cleanupDialogRef = useRef<HTMLDialogElement>(null);
  const cleanupTriggerRef = useRef<HTMLButtonElement>(null);
  const cascadeTriggerRef = useRef<HTMLButtonElement>(null);
  const reparentDialogRef = useRef<HTMLDialogElement>(null);
  const reparentTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteImpactDialogRef = useRef<HTMLDialogElement>(null);
  const deleteImpactTriggerRef = useRef<HTMLButtonElement>(null);
  const dataStoreCleanupDialogRef = useRef<HTMLDialogElement>(null);
  const dataStoreCleanupTriggerRef = useRef<HTMLButtonElement>(null);
  const roleDialogRef = useRef<HTMLDialogElement>(null);
  const roleDialogTriggerRef = useRef<HTMLButtonElement>(null);
  const profileUpgradeDialogRef = useRef<HTMLDialogElement>(null);
  const profileUpgradeInFlightRef = useRef(false);
  const profileUpgradeRequestRef = useRef(false);
  const profileUpgradeAutoStartedRef = useRef<string | null>(null);
  const executeProfileUpgradeRef = useRef<() => void>(() => undefined);
  const swimlaneConversionInFlightRef = useRef(false);
  const swimlaneConversionCommandRef =
    useRef<PreparedSwimlaneConversionCommand | null>(null);
  const pendingCreatedToolRef = useRef<BpmnLibraryItem["id"] | null>(null);
  const pendingConnectionToolRef = useRef<BpmnLibraryItem["id"] | null>(null);
  const recordRecentToolRef = useRef<
    (toolId: BpmnLibraryItem["id"]) => void
  >(() => undefined);
  const timerSnapshotRef = useRef<BpmnTimerDraft>({
    kind: "DURATION",
    value: "",
  });
  const [ready, setReady] = useState(false);
  const [mobileViewer, setMobileViewer] = useState(false);
  const [balancingBranches, setBalancingBranches] = useState(false);
  const [branchRecoveryXml, setBranchRecoveryXml] = useState<string | null>(null);
  const [branchBalancePlan, setBranchBalancePlan] = useState<BpmnBranchPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<CanvasElement | null>(null);
  const [selectedElements, setSelectedElements] = useState<
    readonly CanvasElement[]
  >([]);
  const [arrangeCapabilities, setArrangeCapabilities] = useState({
    canAlign: false,
    canDistribute: false,
  });
  const [elementName, setElementName] = useState("");
  const [annotationText, setAnnotationText] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [processName, setProcessName] = useState("");
  const [outline, setOutline] = useState<readonly CoreBpmnElement[]>([]);
  const [lifecycleSnapshot, setLifecycleSnapshot] =
    useState<SubProcessLifecycleSnapshot | null>(null);
  const [outlineColors, setOutlineColors] = useState<
    ReadonlyMap<string, { readonly fill?: string; readonly stroke?: string }>
  >(new Map());
  const [issues, setIssues] = useState<readonly BpmnInspectionIssue[]>([]);
  const [inspectorView, setInspectorView] =
    useState<InspectorView>("properties");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("Đang mở vùng vẽ…");
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [modelTitle, setModelTitle] = useState("Quy trình duyệt bài phân tích");
  const [modelDescription, setModelDescription] = useState("");
  const [modelPurpose, setModelPurpose] = useState<
    "AS_IS" | "TO_BE" | "REFERENCE"
  >("AS_IS");
  const [modelProfileId, setModelProfileId] = useState<BpmnProfileId>(
    coreBpmnProfile.id,
  );
  const [acknowledgedProfileId, setAcknowledgedProfileId] =
    useState<BpmnProfileId>(coreBpmnProfile.id);
  const [nestedProfileAcknowledged, setNestedProfileAcknowledged] =
    useState(false);
  const [structuredProfileAcknowledged, setStructuredProfileAcknowledged] =
    useState(false);
  const [conditionalProfileAcknowledged, setConditionalProfileAcknowledged] =
    useState(false);
  const [
    catchingEventsProfileAcknowledged,
    setCatchingEventsProfileAcknowledged,
  ] = useState(false);
  const [eventRoutingProfileAcknowledged, setEventRoutingProfileAcknowledged] =
    useState(false);
  const [taskTypesProfileAcknowledged, setTaskTypesProfileAcknowledged] =
    useState(false);
  const [
    intermediateEventsProfileAcknowledged,
    setIntermediateEventsProfileAcknowledged,
  ] = useState(false);
  const [boundaryEventsProfileAcknowledged, setBoundaryEventsProfileAcknowledged] =
    useState(false);
  const [
    activityContainersProfileAcknowledged,
    setActivityContainersProfileAcknowledged,
  ] = useState(false);
  const [dataAuthoringProfileAcknowledged, setDataAuthoringProfileAcknowledged] =
    useState(false);
  const [complexRoutingProfileAcknowledged, setComplexRoutingProfileAcknowledged] =
    useState(false);
  const [calledElementId, setCalledElementId] = useState("");
  const [callableProcesses, setCallableProcesses] = useState<
    readonly { readonly id: string; readonly name: string }[]
  >([]);
  const [dataStores, setDataStores] = useState<
    readonly { readonly id: string; readonly name: string }[]
  >([]);
  const [selectedDataStoreId, setSelectedDataStoreId] = useState("");
  const [activationCondition, setActivationCondition] = useState("");
  const activationSnapshotRef = useRef("");
  const [colorMode, setColorMode] =
    useState<BpmnColorMode>(defaultBpmnColorMode);
  const [colorPreferenceReady, setColorPreferenceReady] = useState(false);
  const [routingDraft, setRoutingDraft] = useState<SequenceFlowRoutingDraft>({
    condition: "",
    isDefault: false,
  });
  const [messageName, setMessageName] = useState("");
  const [messageRegistry, setMessageRegistry] = useState<
    readonly MessageRegistryEntry[]
  >([]);
  const [categoryRegistry, setCategoryRegistry] = useState<
    readonly CategoryRegistryEntry[]
  >([]);
  const [dataStoreRegistry, setDataStoreRegistry] = useState<
    readonly DataStoreRegistryEntry[]
  >([]);
  const [dataStoreCleanupSnapshot, setDataStoreCleanupSnapshot] = useState<{
    readonly revisionToken: string;
    readonly entries: readonly DataStoreRegistryEntry[];
  } | null>(null);
  const [deleteImpactSnapshot, setDeleteImpactSnapshot] =
    useState<SubProcessDeleteImpact | null>(null);
  const [genericDeleteSnapshot, setGenericDeleteSnapshot] = useState<{
    readonly elementId: string;
    readonly revisionToken: string;
    readonly impactIds: readonly string[];
    readonly groups: readonly LifecycleImpactGroup[];
  } | null>(null);
  const [reparentPreview, setReparentPreview] =
    useState<ReparentImpact | null>(null);
  const [reparentTargetId, setReparentTargetId] = useState("");
  const [reparentTargetLaneId, setReparentTargetLaneId] = useState("");
  const [reparentRevisionToken, setReparentRevisionToken] = useState("");
  const [reparentTargets, setReparentTargets] = useState<
    readonly LifecycleTargetOption[]
  >([]);
  const [reparentImpact, setReparentImpact] = useState<
    readonly LifecycleImpactGroup[]
  >([]);
  const [reparentBlockers, setReparentBlockers] = useState<readonly string[]>(
    [],
  );
  const [messageSearch, setMessageSearch] = useState("");
  const [messagePickerMode, setMessagePickerMode] =
    useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [registryRenameId, setRegistryRenameId] = useState("");
  const [registryRenameName, setRegistryRenameName] = useState("");
  const [cleanupSnapshot, setCleanupSnapshot] = useState<
    readonly MessageRegistryEntry[]
  >([]);
  const [roleDialogMode, setRoleDialogMode] = useState<
    "CREATE_CHILDREN" | "ADD_CHILD"
  >("CREATE_CHILDREN");
  const [roleDialogTargetId, setRoleDialogTargetId] = useState("");
  const [roleCount, setRoleCount] = useState<2 | 3>(2);
  const [roleNames, setRoleNames] = useState(["", "", ""]);
  const [timerDraft, setTimerDraft] = useState<BpmnTimerDraft>({
    kind: "DURATION",
    value: "",
  });
  const [contextAppendOpen, setContextAppendOpen] = useState(false);
  const [componentLauncherOpen, setComponentLauncherOpen] = useState(false);
  const [componentLauncherMode, setComponentLauncherMode] =
    useState<BpmnLauncherMode>({ kind: "place" });
  const [armedLauncherItem, setArmedLauncherItem] =
    useState<BpmnLauncherItem | null>(null);
  const [profileUpgradeItem, setProfileUpgradeItem] = useState<{
    readonly item: BpmnLauncherItem;
    readonly mode: BpmnLauncherMode;
    readonly activation: BpmnLauncherActivation;
  } | null>(null);
  const [profileUpgradeIntent, setProfileUpgradeIntent] =
    useState<ProfileUpgradeIntentState | null>(null);
  const [profileUpgradeBusy, setProfileUpgradeBusy] = useState(false);
  const [swimlaneConversion, setSwimlaneConversion] =
    useState<PendingSwimlaneConversion | null>(null);
  const [importing, setImporting] = useState(false);
  const [preparedFile, setPreparedFile] = useState<{ xml: string; profileId: BpmnProfileId; title: string; notices: readonly string[]; idempotencyKey: string } | null>(null);
  const [importCopyId, setImportCopyId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState("");
  const importCreateInFlightRef = useRef(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [connectArmed, setConnectArmed] = useState(false);
  const [connectKind, setConnectKind] = useState<BpmnConnectKind>(
    "sequence",
  );
  const [saveState, setSaveState] = useState<
    "LOADING" | "ACKNOWLEDGED" | "DIRTY" | "SAVING" | "CONFLICT" | "ERROR"
  >("LOADING");
  const [versionCount, setVersionCount] = useState(0);
  const [versions, setVersions] = useState<
    readonly ProcessModelVersionSummary[]
  >([]);
  const [versioning, setVersioning] = useState(false);
  const versionInFlightRef = useRef(false);
  const [versionNote, setVersionNote] = useState("");
  const versionNoteRef = useRef<HTMLInputElement>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const {
    preferences: toolPreferences,
    recordRecent: recordRecentTool,
    toggleFavorite: toggleFavoriteTool,
  } = useBpmnToolPreferences(allBpmnLauncherToolIds);

  useEffect(() => {
    recordRecentToolRef.current = recordRecentTool;
  }, [recordRecentTool]);

  const revealArtifactEditor = useCallback(
    (kind: "annotation" | "group") => {
      setInspectorCollapsed(false);
      setInspectorView("properties");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const field = document.getElementById(
            kind === "annotation"
              ? "bpmn-annotation-text"
              : "bpmn-group-title",
          );
          if (!(field instanceof HTMLInputElement) &&
              !(field instanceof HTMLTextAreaElement)) {
            return;
          }
          field.focus();
          if (kind === "group" && field instanceof HTMLInputElement) {
            field.select();
          }
        });
      });
    },
    [],
  );

  const publishAcknowledgedProfile = useCallback(
    (profileId: BpmnProfileId) => {
      acknowledgedProfileIdRef.current = profileId;
      profileIdRef.current = profileId;
      setAcknowledgedProfileId(profileId);
      setModelProfileId(profileId);
      setNestedProfileAcknowledged(supportsNestedLanes(profileId));
      setStructuredProfileAcknowledged(supportsStructuredRouting(profileId));
      setConditionalProfileAcknowledged(supportsConditionalRouting(profileId));
      setCatchingEventsProfileAcknowledged(supportsCatchingEvents(profileId));
      setEventRoutingProfileAcknowledged(supportsEventRouting(profileId));
      setTaskTypesProfileAcknowledged(supportsTaskTypes(profileId));
      setIntermediateEventsProfileAcknowledged(
        supportsIntermediateEvents(profileId),
      );
      setBoundaryEventsProfileAcknowledged(supportsBoundaryEvents(profileId));
      setActivityContainersProfileAcknowledged(
        supportsActivityContainers(profileId),
      );
      setDataAuthoringProfileAcknowledged(supportsDataAuthoring(profileId));
      setComplexRoutingProfileAcknowledged(supportsComplexRouting(profileId));
    },
    [],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setMobileViewer(media.matches);
      if (media.matches) {
        setInspectorView("structure");
        setInspectorCollapsed(false);
        setComponentLauncherOpen(false);
      }
    };
    const timer = window.setTimeout(sync, 0);
    media.addEventListener("change", sync);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(bpmnColorModeStorageKey);
      if (isBpmnColorMode(stored)) setColorMode(stored);
      setColorPreferenceReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!colorPreferenceReady) return;
    colorModeRef.current = colorMode;
    window.localStorage.setItem(bpmnColorModeStorageKey, colorMode);
    const modeler = modelerRef.current;
    if (modeler) refreshSemanticPresentation(modeler, colorMode);
  }, [colorMode, colorPreferenceReady]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inspectorCollapsed]);

  const scheduleAutosave = useCallback((delayMs = 2_000) => {
    if (conflictRef.current) { setSaveState("CONFLICT"); return; }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      autosaveActionRef.current();
    }, delayMs);
  }, []);

  const applyInspectionProjection = useCallback(
    (inspection: Awaited<ReturnType<BpmnInspectionClient>>, modeler: Modeler) => {
        setIssues(inspection.issues);
        setOutline(inspection.outline);
        setLifecycleSnapshot(
          inspection.snapshot
            ? (inspection.snapshot as SubProcessLifecycleSnapshot)
            : null,
        );
        setOutlineColors(
          new Map(
            [
              ...(inspection.snapshot?.shapes ?? []),
              ...(inspection.snapshot?.edges ?? []),
            ].map((item) => [
              item.elementId,
              {
                ...(item.fill ? { fill: item.fill } : {}),
                ...(item.stroke ? { stroke: item.stroke } : {}),
              },
            ]),
          ),
        );
        setMessageRegistry(inspection.messageRegistry ?? []);
        setCategoryRegistry(inspection.categoryRegistry ?? []);
        setDataStoreRegistry(inspection.dataStoreRegistry ?? []);
        if (inspection.accepted && inspection.canonicalXml) {
          currentXmlRef.current = inspection.canonicalXml;
        }
        refreshNodeVisualOverlays(modeler);
        refreshSemanticPresentation(modeler, colorModeRef.current);
        const commandStack = getService(modeler, "commandStack");
        setHistory({
          canUndo: commandStack.canUndo(),
          canRedo: commandStack.canRedo(),
        });
    },
    [],
  );

  const refreshProjection = useCallback(
    async (modeler: Modeler) => {
      const requestId = projectionGateRef.current.next();
      try {
        const { xml } = await modeler.saveXML({ format: true });
        if (!xml) throw new Error("Modeler returned no XML.");
        const inspection = await inspectXml(xml, profileIdRef.current);
        if (!projectionGateRef.current.isLatest(requestId)) return;
        applyInspectionProjection(inspection, modeler);
        setNotice(
          inspection.accepted
            ? `Đã kiểm tra phần ${profileStageLabel(
                profileIdRef.current,
              )}: ${issueSummary(inspection.issues)}`
            : `Kiểu sơ đồ chưa phù hợp: ${issueSummary(inspection.issues)}`,
        );
      } catch {
        if (!projectionGateRef.current.isLatest(requestId)) return;
        setNotice("Không thể cập nhật danh sách bước. Vùng vẽ hiện tại vẫn được giữ.");
      }
    },
    [inspectXml, applyInspectionProjection],
  );

  const persistCurrent = useCallback(async () => {
    if (conflictRef.current) return false;
    if (restoreFenceRef.current.pending) return false;
    if (pendingVersionCommandRef.current?.restoreSequence !== undefined) {
      setNotice("Chưa xác định được kết quả khôi phục. Hãy thử lại đúng bản đã chọn; các chỉnh sửa trong tab vẫn được giữ.");
      return false;
    }
    const modeler = modelerRef.current;
    const durable = durableModelRef.current;
    if (!modeler || !durable || hydratingRef.current) return false;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return false;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    saveInFlightRef.current = true;
    setSaveState("SAVING");
    setNotice("Đang lưu bản nháp…");
    try {
      let pendingCommand = pendingSaveCommandRef.current;
      if (!pendingCommand) {
        const normalizedTitle = titleRef.current.trim();
        if (!normalizedTitle) {
          setSaveState("ERROR");
          setDirty(true);
          setNotice("Tên sơ đồ cần từ 1 đến 180 ký tự trước khi tự động lưu.");
          return false;
        }
        const { xml } = await modeler.saveXML({ format: true });
        if (!xml) throw new Error("No BPMN XML.");
        pendingCommand = retainOrCaptureLogicalSave(pendingCommand, () => ({
          sequence: editSequenceRef.current,
          idempotencyKey: `save-model:${crypto.randomUUID()}`,
          revisionToken: durable.revisionToken,
          title: normalizedTitle,
          description: descriptionRef.current,
          purpose: purposeRef.current,
          profileId: profileIdRef.current,
          xml,
          source: nextRevisionSourceRef.current,
        }));
        nextRevisionSourceRef.current = "EDITED";
        pendingSaveCommandRef.current = pendingCommand;
      }
      const result = await persistence.save({
        idempotencyKey: pendingCommand.idempotencyKey,
        modelId: durable.modelId,
        revisionToken: pendingCommand.revisionToken,
        title: pendingCommand.title,
        description: pendingCommand.description,
        purpose: pendingCommand.purpose,
        profileId: pendingCommand.profileId,
        xml: pendingCommand.xml,
        source: pendingCommand.source,
      });
      if (result.kind === "acknowledged" || result.kind === "idempotent") {
        saveRetryCountRef.current = 0;
        if (pendingSaveCommandRef.current === pendingCommand) {
          pendingSaveCommandRef.current = null;
        }
        durable.revisionToken = result.revisionToken;
        durable.profileId = pendingCommand.profileId as BpmnProfileId;
        publishAcknowledgedProfile(durable.profileId);
        if (editSequenceRef.current === pendingCommand.sequence) {
          saveQueuedRef.current = false;
          if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
          }
          setDirty(false);
          setSaveState("ACKNOWLEDGED");
          setNotice("Đã lưu bản nháp.");
        } else {
          setSaveState("DIRTY");
          scheduleAutosave();
        }
        return { acknowledgedSequence: pendingCommand.sequence } as const;
      }
      if (result.kind === "conflict") {
        if (pendingSaveCommandRef.current === pendingCommand) {
          pendingSaveCommandRef.current = null;
        }
        conflictRef.current = true;
        setSaveState("CONFLICT");
        setDirty(true);
        publishAcknowledgedProfile(durable.profileId);
        setNotice(
          "Có bản mới hơn trên máy chủ. Tự động lưu đã tạm dừng; chọn Giữ cả hai bản để đối chiếu và khôi phục.",
        );
        return false;
      }
      setSaveState("ERROR");
      if (
        result.kind !== "unavailable" &&
        pendingSaveCommandRef.current === pendingCommand
      ) {
        pendingSaveCommandRef.current = null;
      }
      setDirty(true);
      publishAcknowledgedProfile(durable.profileId);
      if (result.kind === "unavailable" && saveRetryCountRef.current < 5) {
        saveRetryCountRef.current += 1;
        scheduleAutosave(
          Math.min(30_000, 2_000 * 2 ** saveRetryCountRef.current),
        );
      }
      setNotice(
        result.kind === "unauthenticated"
          ? "Phiên đăng nhập đã hết hạn. Bản trên thiết bị vẫn được giữ để bạn tải xuống."
          : result.kind === "rejected"
            ? bpmnSaveRejectionNotice(result)
            : "Chưa thể lưu. Bản trên thiết bị vẫn được giữ và ứng dụng sẽ tự thử lại.",
      );
      return false;
    } catch {
      setSaveState("ERROR");
      setDirty(true);
      if (durableModelRef.current) {
        publishAcknowledgedProfile(durableModelRef.current.profileId);
      }
      if (saveRetryCountRef.current < 5) {
        saveRetryCountRef.current += 1;
        scheduleAutosave(
          Math.min(30_000, 2_000 * 2 ** saveRetryCountRef.current),
        );
      }
      setNotice(
        "Kết nối lưu bị gián đoạn. Bản trên thiết bị được giữ để tự thử lại.",
      );
      return false;
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        scheduleAutosave();
      }
    }
  }, [persistence, publishAcknowledgedProfile, scheduleAutosave]);

  useEffect(() => {
    autosaveActionRef.current = () => {
      void persistCurrent();
    };
  }, [persistCurrent]);

  const completeConnection = useCallback(
    (
      source: CanvasElement,
      target: CanvasElement,
      kind: BpmnConnectKind,
    ) => {
      const modeler = modelerRef.current;
      if (!modeler || source.id === target.id) {
        setNotice("Điểm bắt đầu và điểm đích phải là hai phần tử khác nhau.");
        return false;
      }
      const validEndpoints =
        kind === "message"
          ? (isFlowNode(source) || isParticipant(source)) &&
            (isFlowNode(target) || isParticipant(target))
          : kind === "association"
            ? isAssociationEndpoint(source) &&
              isAssociationEndpoint(target) &&
              isTextAnnotation(source) !== isTextAnnotation(target)
            : kind === "data-association"
              ? inferDataAssociationDirection(source.type, target.type) !== null
            : isFlowNode(source) && isFlowNode(target);
      if (!validEndpoints) {
        setNotice(
          kind === "message"
            ? "Trao đổi thông điệp chỉ nối các bước thuộc hai bên tham gia khác nhau."
            : kind === "association"
              ? "Liên kết chú thích cần một ghi chú và một thành phần khác trên cùng sơ đồ."
              : kind === "data-association"
                ? "Đường dữ liệu cần một công việc và một nguồn dữ liệu."
                : "Đường thực hiện chỉ nối hai bước trong cùng quy trình.",
        );
        return false;
      }
      if (
        kind === "sequence" &&
        (source.type === "bpmn:EndEvent" || target.type === "bpmn:StartEvent")
      ) {
        setNotice(
          source.type === "bpmn:EndEvent"
            ? "Điểm kết thúc không thể có đường thực hiện đi ra."
            : "Điểm bắt đầu không thể nhận đường thực hiện đi vào.",
        );
        return false;
      }
      if (kind === "sequence" && target.type === "bpmn:BoundaryEvent") {
        setNotice("Sự kiện tại biên không nhận đường thực hiện đi vào.");
        return false;
      }
      if (
        kind === "sequence" &&
        source.type === "bpmn:BoundaryEvent" &&
        (source.outgoing?.length ?? 0) >= 1
      ) {
        setNotice("Sự kiện tại biên chỉ có một đường thực hiện đi ra.");
        return false;
      }
      if (
        kind === "sequence" &&
        source.type === "bpmn:EventBasedGateway" &&
        !["bpmn:IntermediateCatchEvent", "bpmn:ReceiveTask"].includes(
          target.type,
        )
      ) {
        setNotice(
          "Điểm chờ sự kiện chỉ nối tới chờ thông điệp, chờ thời gian hoặc nhận thông điệp.",
        );
        return false;
      }
      if (
        kind === "sequence" &&
        target.type === "bpmn:EventBasedGateway" &&
        (target.incoming?.length ?? 0) >= 1
      ) {
        setNotice("Điểm chờ sự kiện chỉ nhận một đường thực hiện đi vào.");
        return false;
      }
      if (
        kind === "sequence" &&
        ["bpmn:IntermediateCatchEvent", "bpmn:ReceiveTask"].includes(
          target.type,
        ) &&
        (target.incoming?.length ?? 0) >= 1
      ) {
        setNotice("Bước chờ này chỉ nhận một đường thực hiện đi vào.");
        return false;
      }
      const sourceParticipant = owningParticipant(source);
      const targetParticipant = owningParticipant(target);
      if (
        kind === "data-association" &&
        (owningFlowContainer(source)?.id !== owningFlowContainer(target)?.id ||
          sourceParticipant?.id !== targetParticipant?.id)
      ) {
        setNotice(
          "Đường dữ liệu chỉ nối nguồn dữ liệu và công việc trong cùng quy trình.",
        );
        return false;
      }
      if (
        kind === "message" &&
        (!sourceParticipant ||
          !targetParticipant ||
          sourceParticipant.id === targetParticipant.id)
      ) {
        setNotice(
          "Trao đổi thông điệp cần hai điểm thuộc hai bên tham gia khác nhau.",
        );
        return false;
      }
      if (
        kind === "sequence" &&
        isCollaborationBpmnProfileId(profileIdRef.current) &&
        (!sourceParticipant ||
          !targetParticipant ||
          sourceParticipant.id !== targetParticipant.id)
      ) {
        setNotice(
          "Đường thực hiện chỉ nối các bước cùng một bên tham gia. Hãy dùng trao đổi thông điệp để nối hai bên.",
        );
        return false;
      }
      try {
        const dataDirection =
          kind === "data-association"
            ? inferDataAssociationDirection(source.type, target.type)
            : null;
        let connection: CanvasElement;
        if (kind === "data-association" && dataDirection) {
          const context: Record<string, unknown> = {
            source,
            target,
            direction: dataDirection,
          };
          getService(modeler, "commandStack").execute(
            "teb.advanced.createDataAssociation",
            context,
          );
          connection = context.created as CanvasElement;
        } else {
          connection = getService(modeler, "modeling").connect(
            source,
            target,
            {
              type:
                kind === "message"
                  ? "bpmn:MessageFlow"
                  : kind === "association"
                    ? "bpmn:Association"
                    : "bpmn:SequenceFlow",
            },
          );
        }
        if (!connection) throw new Error("Connection command returned no edge.");
        connectArmedRef.current = false;
        connectSourceIdRef.current = null;
        const completedToolId = pendingConnectionToolRef.current;
        pendingConnectionToolRef.current = null;
        setConnectArmed(false);
        setConnectSourceId(null);
        getService(modeler, "selection").select(connection);
        setNotice(
          `Đã tạo ${
            kind === "message"
              ? "trao đổi thông điệp giữa hai bên tham gia"
              : kind === "association"
                ? "liên kết chú thích"
                : kind === "data-association"
                  ? dataDirection === "INPUT"
                    ? "dữ liệu đi vào công việc"
                    : "dữ liệu đi ra từ công việc"
                  : "đường thực hiện"
          }: ${source.businessObject?.name || source.businessObject?.text || "điểm chưa đặt tên"} → ${target.businessObject?.name || target.businessObject?.text || "điểm chưa đặt tên"}.`,
        );
        if (completedToolId) recordRecentToolRef.current(completedToolId);
        return true;
      } catch {
        setNotice(
          kind === "message"
            ? "Không thể tạo trao đổi thông điệp giữa hai điểm này."
            : kind === "association"
              ? "Không thể tạo liên kết chú thích giữa hai điểm này."
              : kind === "data-association"
                ? "Không thể tạo đường dữ liệu giữa hai điểm này."
                : "Không thể tạo đường thực hiện giữa hai bước này.",
        );
        return false;
      }
    },
    [],
  );

  const handleConnectionElement = useCallback(
    (element: CanvasElement) => {
      if (!connectArmedRef.current) return false;
      const kind = connectKindRef.current;
      const sourceId = connectSourceIdRef.current;
      if (!sourceId) {
        const validSource = isValidBpmnConnectionSourceType(kind, element.type);
        if (!validSource) {
          setNotice(
            kind === "message"
              ? "Bước 1/2: chọn bên tham gia hoặc bước làm điểm gửi."
              : kind === "association"
                ? "Bước 1/2: chọn ghi chú hoặc phần tử cần giải thích."
                : kind === "data-association"
                  ? "Bước 1/2: chọn công việc, tài liệu hoặc kho dữ liệu."
                : "Bước 1/2: chọn một bước làm điểm bắt đầu.",
          );
          return true;
        }
        connectSourceIdRef.current = element.id;
        setConnectSourceId(element.id);
        setNotice(
          `Bước 2/2: đã chọn ${selectedLabel(element)}. Chọn ${
            kind === "message"
              ? "điểm nhận thuộc bên tham gia khác"
              : kind === "association"
                ? isTextAnnotation(element)
                  ? "phần tử được chú thích"
                  : "ghi chú"
                : kind === "data-association"
                  ? isDataReference(element)
                    ? "công việc nhận hoặc tạo dữ liệu"
                    : "tài liệu hoặc kho dữ liệu"
                : "bước đích trong cùng quy trình"
          }.`,
        );
        return true;
      }
      const modeler = modelerRef.current;
      const source = modeler
        ? getService(modeler, "elementRegistry").get(sourceId)
        : undefined;
      if (!source) {
        connectSourceIdRef.current = null;
        setConnectSourceId(null);
        setNotice("Điểm bắt đầu không còn tồn tại. Hãy chọn lại.");
        return true;
      }
      completeConnection(source, element, kind);
      return true;
    },
    [completeConnection],
  );

  useEffect(() => {
    connectionElementActionRef.current = handleConnectionElement;
  }, [handleConnectionElement]);

  useEffect(() => {
    let disposed = false;
    let modeler: Modeler | null = null;
    const projectionGate = projectionGateRef.current;
    const importGate = importGateRef.current;

    async function initialize() {
      try {
        if (!canvasRef.current) return;
        const opened = await persistence.openModel(modelId);
        if (disposed) return;
        let openedVersions: readonly ProcessModelVersionSummary[] = [];
        let historyLoadFailed = false;
        try {
          openedVersions = await persistence.listVersions(opened.modelId);
        } catch {
          historyLoadFailed = true;
        }
        if (disposed) return;
        durableModelRef.current = {
          modelId: opened.modelId,
          revisionToken: opened.revisionToken,
          profileId: opened.profileId as BpmnProfileId,
          description: opened.description,
          purpose: opened.purpose,
        };
        titleRef.current = opened.title;
        descriptionRef.current = opened.description;
        purposeRef.current = opened.purpose;
        setModelTitle(opened.title);
        setModelDescription(opened.description);
        setModelPurpose(opened.purpose);
        publishAcknowledgedProfile(opened.profileId as BpmnProfileId);
        setVersionCount(openedVersions.length);
        setVersions(openedVersions);
        currentXmlRef.current = opened.xml;

        const { default: BpmnModeler } = await import("bpmn-js/lib/Modeler");
        await typography.prepare();
        if (disposed || !canvasRef.current) return;

        modeler = new BpmnModeler({
          container: canvasRef.current,
          textRenderer: typography.config(),
          moddleExtensions: { teb: tebModdleDescriptor },
        });
        modelerRef.current = modeler;
        const commandStack = getService(modeler, "commandStack");
        const modeling = getService(modeler, "modeling");
        const registry = getService(modeler, "elementRegistry");
        registerBpmnBranchBalanceCommand(commandStack, registry, modeling);
        registerBpmnBulkColors<CanvasElement>(commandStack, modeling);
        const refreshBranchBalancePlan = (selections: readonly CanvasElement[]) => {
          const gateway = selections.length === 1 ? selections[0] : undefined;
          setBranchBalancePlan(gateway?.type.endsWith("Gateway")
            ? planBpmnBranchBalance(gateway, registry.getAll()) : null);
        };
        const modelingCanvas = getService(modeler, "canvas");
        const moddle = getService(modeler, "moddle");
        let participantReflowInProgress = false;
        const reflowLowerParticipants = (participant: CanvasElement) => {
          if (
            participantReflowInProgress ||
            !isParticipant(participant) ||
            !participant.businessObject?.processRef
          ) {
            return;
          }
          const participantWidth = participant.width ?? 0;
          const participantHeight = participant.height ?? 0;
          if (
            !supportsSwimlaneLayouts(profileIdRef.current) &&
            participantWidth <= participantHeight
          ) {
            modeling.resizeShape(participant, {
              x: participant.x ?? 0,
              y: participant.y ?? 0,
              width: participantHeight + 120,
              height: participantHeight,
            });
          }
          const moves = planLowerBpmnParticipantReflow(
            participantFrames(registry),
            participant.id,
          );
          if (moves.length === 0) return;
          participantReflowInProgress = true;
          try {
            for (const move of moves) {
              const lower = registry.get(move.participantId);
              if (!isParticipant(lower)) continue;
              modeling.moveElements(
                [lower],
                move.delta,
                modelingCanvas.getRootElement(),
                { autoResize: false },
              );
            }
          } finally {
            participantReflowInProgress = false;
          }
        };
        getService(modeler, "eventBus").on(
          "commandStack.shape.resize.postExecuted",
          250,
          (event) => {
            if (
              participantReflowInProgress ||
              !supportsSwimlaneLayouts(acknowledgedProfileIdRef.current)
            ) {
              return;
            }
            const participant = event.context.shape as
              | CanvasElement
              | undefined;
            const oldBounds = event.context.oldBounds as
              | {
                  readonly x: number;
                  readonly y: number;
                  readonly width: number;
                  readonly height: number;
                }
              | undefined;
            if (
              !isParticipant(participant) ||
              !participant.businessObject?.processRef ||
              !oldBounds ||
              ![oldBounds.x, oldBounds.y, oldBounds.width, oldBounds.height]
                .every(Number.isFinite)
            ) {
              return;
            }
            const current = participantFrame(participant);
            const expanded =
              current.x < oldBounds.x ||
              current.y < oldBounds.y ||
              current.x + current.width > oldBounds.x + oldBounds.width ||
              current.y + current.height > oldBounds.y + oldBounds.height;
            if (expanded) reflowLowerParticipants(participant);
          },
        );
        commandStack.register("teb.collaboration.createSwimlaneFrame", {
          preExecute(context) {
            const orientation = context.orientation as
              | "horizontal"
              | "vertical";
            const position = context.position as { x: number; y: number };
            if (
              !supportsSwimlaneLayouts(profileIdRef.current) ||
              (orientation !== "horizontal" && orientation !== "vertical") ||
              !Number.isFinite(position.x) ||
              !Number.isFinite(position.y)
            ) {
              throw new Error("Swimlane layout profile is not acknowledged.");
            }
            const horizontal = orientation === "horizontal";
            const participant = getService(
              modeler!,
              "elementFactory",
            ).createParticipantShape({
              isExpanded: true,
              isHorizontal: horizontal,
            });
            const created = modeling.createShape(
              participant,
              position,
              modelingCanvas.getRootElement(),
            );
            modeling.updateProperties(created, {
              name: horizontal ? "Quy trình theo vai trò" : "Quy trình theo cột",
            });
            modeling.splitLane(created, 2);
            const lanes = (created.children ?? []).filter(isLane);
            const names = horizontal
              ? ["Vai trò trên", "Vai trò dưới"]
              : ["Vai trò trái", "Vai trò phải"];
            lanes.forEach((lane, index) => {
              modeling.updateProperties(lane, { name: names[index] });
            });
            context.created = created;
            context.lanes = lanes;
          },
        });
        commandStack.register("teb.collaboration.addLaneAndReflow", {
          preExecute(context) {
            const target = context.target as CanvasElement;
            const location = context.location as
              | "top"
              | "bottom"
              | "left"
              | "right";
            const participant = isParticipant(target)
              ? target
              : owningParticipant(target);
            const horizontal = isHorizontalSwimlane(target);
            const validLocation = horizontal
              ? location === "top" || location === "bottom"
              : location === "left" || location === "right";
            if (
              registry.get(target?.id) !== target ||
              (!isParticipant(target) && !isLane(target)) ||
              !participant?.businessObject?.processRef ||
              (supportsSwimlaneLayouts(profileIdRef.current) && !validLocation)
            ) {
              throw new Error("Stale or invalid swimlane target.");
            }
            const lane = modeling.addLane(target, location);
            context.newLane = lane;
            reflowLowerParticipants(participant);
          },
        });
        commandStack.register("teb.collaboration.splitLaneAndAssign", {
          preExecute(context) {
            const target = context.target as CanvasElement;
            const count = context.count as number;
            const expectedTargetId = context.expectedTargetId as string;
            const names = context.names as readonly string[] | undefined;
            if (
              !isLane(target) ||
              !supportsNestedLanes(profileIdRef.current) ||
              target.id !== expectedTargetId ||
              laneDepth(target) !== 0 ||
              (target.children ?? []).some(isLane) ||
              (count !== 2 && count !== 3) ||
              names?.length !== count ||
              names.some(
                (name) => assessChildRoleName(name).error !== undefined,
              )
            ) {
              throw new Error("Stale or invalid role group.");
            }
            context.previousChildLaneSet =
              target.businessObject?.childLaneSet;
            modeling.splitLane(target, count);
            context.createdChildLaneSet =
              target.businessObject?.childLaneSet;
            const childLanes = (target.children ?? []).filter(isLane);
            const participant = owningParticipant(target);
            if (!participant || childLanes.length === 0) return;
            childLanes.forEach((lane, index) => {
              modeling.updateProperties(lane, { name: names[index] });
            });
            context.childLanes = childLanes;
            const nodes = registry.getAll().filter((element) => {
              if (!isFlowNode(element)) return false;
              if (owningParticipant(element)?.id !== participant.id)
                return false;
              const centerX = (element.x ?? 0) + (element.width ?? 0) / 2;
              const centerY = (element.y ?? 0) + (element.height ?? 0) / 2;
              return (
                centerX > (target.x ?? 0) &&
                centerX < (target.x ?? 0) + (target.width ?? 0) &&
                centerY > (target.y ?? 0) &&
                centerY < (target.y ?? 0) + (target.height ?? 0)
              );
            });
            for (const node of nodes) {
              const centerX = (node.x ?? 0) + (node.width ?? 0) / 2;
              const centerY = (node.y ?? 0) + (node.height ?? 0) / 2;
              const alreadyInside = childLanes.some(
                (lane) =>
                  centerX > (lane.x ?? 0) &&
                  centerX < (lane.x ?? 0) + (lane.width ?? 0) &&
                  centerY > (lane.y ?? 0) &&
                  centerY < (lane.y ?? 0) + (lane.height ?? 0),
              );
              if (alreadyInside) continue;
              const horizontal = isHorizontalSwimlane(target);
              const nearest = [...childLanes].sort((left, right) => {
                const leftCenter = horizontal
                  ? (left.y ?? 0) + (left.height ?? 0) / 2
                  : (left.x ?? 0) + (left.width ?? 0) / 2;
                const rightCenter = horizontal
                  ? (right.y ?? 0) + (right.height ?? 0) / 2
                  : (right.x ?? 0) + (right.width ?? 0) / 2;
                const nodeCenter = horizontal ? centerY : centerX;
                return (
                  Math.abs(leftCenter - nodeCenter) -
                  Math.abs(rightCenter - nodeCenter)
                );
              })[0];
              if (!nearest) continue;
              const correctedCenter = horizontal
                ? Math.min(
                    (nearest.y ?? 0) + (nearest.height ?? 0) - 1,
                    Math.max((nearest.y ?? 0) + 1, centerY),
                  )
                : Math.min(
                    (nearest.x ?? 0) + (nearest.width ?? 0) - 1,
                    Math.max((nearest.x ?? 0) + 1, centerX),
                  );
              modeling.moveElements(
                [node],
                horizontal
                  ? { x: 0, y: correctedCenter - centerY }
                  : { x: correctedCenter - centerX, y: 0 },
                participant,
              );
            }
            reflowLowerParticipants(participant);
          },
          execute(context) {
            const target = context.target as CanvasElement;
            const createdChildLaneSet = context.createdChildLaneSet as
              | Record<string, unknown>
              | undefined;
            if (!createdChildLaneSet || !target.businessObject) return;
            const businessObject = target.businessObject as unknown as Record<
              string,
              unknown
            >;
            if (!businessObject.childLaneSet) {
              businessObject.childLaneSet = createdChildLaneSet;
              createdChildLaneSet.$parent = businessObject;
            } else if (businessObject.childLaneSet !== createdChildLaneSet) {
              const activeChildLaneSet =
                businessObject.childLaneSet as Record<string, unknown>;
              activeChildLaneSet.id = createdChildLaneSet.id;
            }
          },
          revert(context) {
            const target = context.target as CanvasElement;
            if (!target.businessObject) return;
            const businessObject = target.businessObject as unknown as Record<
              string,
              unknown
            >;
            const previousChildLaneSet = context.previousChildLaneSet as
              | Record<string, unknown>
              | undefined;
            businessObject.childLaneSet = previousChildLaneSet;
            if (previousChildLaneSet) {
              previousChildLaneSet.$parent = businessObject;
            }
          },
        });
        commandStack.register("teb.collaboration.addNamedChildRole", {
          preExecute(context) {
            const target = context.target as CanvasElement;
            const expectedTargetId = context.expectedTargetId as string;
            const name = context.name as string;
            if (
              !isLane(target) ||
              !supportsNestedLanes(profileIdRef.current) ||
              target.id !== expectedTargetId ||
              laneDepth(target) !== 0 ||
              assessChildRoleName(name).error !== undefined
            ) {
              throw new Error("Stale or invalid role group.");
            }
            const childLanes = (target.children ?? []).filter(isLane);
            if (
              childLanes.length < 2 ||
              childLanes.length >= maxChildRoleLanes
            ) {
              throw new Error("Child role authoring cap reached.");
            }
            const lastChild = childLanes[childLanes.length - 1]!;
            const newLane = modeling.addLane(
              lastChild,
              isHorizontalSwimlane(target) ? "bottom" : "right",
            );
            modeling.updateProperties(newLane, { name });
            context.newLane = newLane;
            const participant = owningParticipant(target);
            if (participant) reflowLowerParticipants(participant);
          },
        });
        commandStack.register("teb.routing.configureSequenceFlow", {
          preExecute(context) {
            const flow = context.flow as CanvasElement;
            const source = context.source as CanvasElement;
            const condition = context.condition as string;
            const isDefault = context.isDefault as boolean;
            const conditionExpression = condition
              ? moddle.create("bpmn:FormalExpression", { body: condition })
              : null;
            if (conditionExpression) {
              conditionExpression.$parent = flow.businessObject;
            }
            modeling.updateProperties(flow, {
              conditionExpression,
            });
            const currentDefaultId = source.businessObject?.default?.id;
            if (isDefault || currentDefaultId === flow.id) {
              modeling.updateProperties(source, {
                default: isDefault ? flow : null,
              });
            }
          },
        });
        commandStack.register("teb.events.configureMessageReference", {
          preExecute(context) {
            const element = context.element as CanvasElement;
            const businessObject = element.businessObject as
              Record<string, unknown> | undefined;
            if (!businessObject) return;
            const definition =
              element.type === "bpmn:IntermediateCatchEvent" ||
              element.type === "bpmn:IntermediateThrowEvent" ||
              element.type === "bpmn:BoundaryEvent"
                ? (
                    businessObject.eventDefinitions as
                      Record<string, unknown>[] | undefined
                  )?.[0]
                : undefined;
            const owner = definition ?? businessObject;
            const selectedMessage = context.message as
              | Record<string, unknown>
              | undefined;
            if (selectedMessage) {
              modeling.updateModdleProperties(element, owner, {
                messageRef: selectedMessage,
                ...(element.type === "bpmn:ReceiveTask"
                  ? { instantiate: false }
                  : {}),
              });
              return;
            }
            const name = context.name as string;
            const definitions = findDefinitions(businessObject);
            if (!definitions) return;
            const usedIds = new Set(
              ((definitions.rootElements as Record<string, unknown>[]) ?? [])
                .map((root) => root.id)
                .filter((id): id is string => typeof id === "string"),
            );
            const baseId = `Message_${element.id.replace(/[^A-Za-z0-9_]/g, "_")}`;
            let messageId = baseId;
            let suffix = 2;
            while (usedIds.has(messageId)) messageId = `${baseId}_${suffix++}`;
            const message = moddle.create("bpmn:Message", {
              id: messageId,
              name,
            });
            message.$parent = definitions;
            modeling.updateModdleProperties(element, definitions, {
              rootElements: [
                ...((definitions.rootElements as unknown[]) ?? []),
                message,
              ],
            });
            modeling.updateModdleProperties(element, owner, {
              messageRef: message,
              ...(element.type === "bpmn:ReceiveTask"
                ? { instantiate: false }
                : {}),
            });
          },
        });
        commandStack.register("teb.events.renameMessage", {
          preExecute(context) {
            const element = context.element as CanvasElement;
            const message = context.message as Record<string, unknown>;
            const name = context.name as string;
            modeling.updateModdleProperties(element, message, { name });
          },
        });
        commandStack.register("teb.events.configureTimer", {
          preExecute(context) {
            const element = context.element as CanvasElement;
            const kind = context.kind as BpmnTimerDraft["kind"];
            const value = context.value as string;
            const businessObject = element.businessObject as
              Record<string, unknown> | undefined;
            if (!businessObject) return;
            let definition = (
              businessObject.eventDefinitions as
                Record<string, unknown>[] | undefined
            )?.[0];
            if (!definition) {
              definition = moddle.create("bpmn:TimerEventDefinition", {
                id: `TimerDefinition_${element.id.replace(
                  /[^A-Za-z0-9_]/g,
                  "_",
                )}`,
              });
              definition.$parent = businessObject;
              modeling.updateModdleProperties(element, businessObject, {
                eventDefinitions: [definition],
              });
            }
            const expression = moddle.create("bpmn:FormalExpression", {
              body: value,
            });
            expression.$parent = definition;
            modeling.updateModdleProperties(element, definition, {
              timeDate: kind === "DATE" ? expression : null,
              timeDuration: kind === "DURATION" ? expression : null,
            });
          },
        });
        commandStack.register("teb.documentation.createTitledGroup", {
          preExecute(context) {
            const parent = context.parent as CanvasElement;
            const position = context.position as { x: number; y: number };
            const title = context.title as string;
            const anchor = registry
              .getAll()
              .find((element) => element.businessObject);
            const definitions = findDefinitions(
              anchor?.businessObject as Record<string, unknown> | undefined,
            );
            if (!definitions || !parent || !title) {
              throw new Error("Invalid titled Group context.");
            }
            const suffix = crypto.randomUUID().replaceAll("-", "_");
            const categoryValue = moddle.create("bpmn:CategoryValue", {
              id: `CategoryValue_${suffix}`,
              value: title,
            });
            const category = moddle.create("bpmn:Category", {
              id: `Category_${suffix}`,
              categoryValue: [categoryValue],
            });
            categoryValue.$parent = category;
            const roots =
              (definitions.rootElements as Record<string, unknown>[]) ?? [];
            modeling.updateModdleProperties(anchor!, definitions, {
              rootElements: [...roots, category],
            });
            const groupBusinessObject = moddle.create("bpmn:Group", {
              id: `Group_${suffix}`,
              categoryValueRef: categoryValue,
            });
            const group = getService(modeler!, "elementFactory").createShape({
              type: "bpmn:Group",
              businessObject: groupBusinessObject,
              width: 240,
              height: 120,
            });
            context.created = modeling.createShape(group, position, parent);
          },
        });
        commandStack.register("teb.documentation.renameGroupTitle", {
          preExecute(context) {
            const element = context.element as CanvasElement;
            const title = context.title as string;
            const categoryValue = element.businessObject?.categoryValueRef;
            if (
              element.type !== "bpmn:Group" ||
              !categoryValue?.id ||
              !title
            ) {
              throw new Error("Invalid Group title rename context.");
            }
            const referencingGroups = registry.getAll().filter((candidate) => {
              if (
                candidate.type !== "bpmn:Group" ||
                candidate.labelTarget
              ) {
                return false;
              }
              const candidateCategoryValue =
                candidate.businessObject?.categoryValueRef;
              return (
                candidateCategoryValue === categoryValue ||
                candidateCategoryValue?.id === categoryValue.id
              );
            });
            if (referencingGroups.length === 0) {
              throw new Error("Group title target is not rendered.");
            }
            for (const group of referencingGroups) {
              modeling.updateLabel(group, title);
            }
          },
        });
        commandStack.register("teb.advanced.configureCallActivity", {
          preExecute(context) {
            modeling.updateProperties(context.element as CanvasElement, {
              calledElement: context.calledElement as string,
            });
          },
        });
        commandStack.register("teb.advanced.createCallActivityStarter", {
          preExecute(context) {
            const parent = context.parent as CanvasElement;
            const position = context.position as { x: number; y: number };
            const anchor = registry
              .getAll()
              .find((element) => element.businessObject);
            const definitions = findDefinitions(
              anchor?.businessObject as Record<string, unknown> | undefined,
            );
            if (!definitions || !anchor || !parent || !position) {
              throw new Error("Invalid reusable process creation context.");
            }
            const bpmnFactory = getService(modeler!, "bpmnFactory");
            const calledProcess = bpmnFactory.create("bpmn:Process", {
              name: "Quy trình dùng chung",
              isExecutable: false,
            });
            calledProcess.$parent = definitions;
            modeling.updateModdleProperties(anchor, definitions, {
              rootElements: [
                ...((definitions.rootElements as unknown[]) ?? []),
                calledProcess,
              ],
            });
            const callActivity = getService(
              modeler!,
              "elementFactory",
            ).createShape({
              type: "bpmn:CallActivity",
              businessObject: bpmnFactory.create("bpmn:CallActivity", {
                name: "Dùng lại quy trình",
                calledElement: calledProcess.id,
              }),
            });
            context.calledProcessId = calledProcess.id;
            context.created = modeling.createShape(
              callActivity,
              position,
              parent,
            );
          },
        });
        commandStack.register("teb.advanced.configureComplexJoin", {
          preExecute(context) {
            const element = context.element as CanvasElement;
            const expression = moddle.create("bpmn:FormalExpression", {
              body: context.activationCondition as string,
            });
            expression.$parent = element.businessObject;
            modeling.updateProperties(element, {
              gatewayDirection: "Converging",
              activationCondition: expression,
            });
          },
        });
        commandStack.register("teb.advanced.createDataAssociation", {
          preExecute(context) {
            const source = context.source as CanvasElement;
            const target = context.target as CanvasElement;
            const direction = context.direction as
              | DataAssociationDirection
              | undefined;
            if (!direction) {
              throw new Error("Data Association direction is required.");
            }
            const connection = modeling.connect(source, target, {
              type:
                direction === "INPUT"
                  ? "bpmn:DataInputAssociation"
                  : "bpmn:DataOutputAssociation",
            });
            if (!connection?.businessObject) {
              throw new Error("Data Association connection was not created.");
            }
            context.created = connection;
          },
        });
        commandStack.register("teb.advanced.createDataArtifact", {
          preExecute(context) {
            const parent = context.parent as CanvasElement;
            const position = context.position as { x: number; y: number };
            const kind = context.kind as "data-object" | "data-store";
            const anchor = registry
              .getAll()
              .find((element) => element.businessObject);
            const definitions = findDefinitions(
              anchor?.businessObject as Record<string, unknown> | undefined,
            );
            if (!definitions || !anchor || !parent || !position) {
              throw new Error("Invalid data artifact creation context.");
            }
            const suffix = crypto.randomUUID().replaceAll("-", "_");
            const dataStoreBacking =
              kind === "data-store"
                ? moddle.create("bpmn:DataStore", {
                    id: `DataStore_${suffix}`,
                    name: "Kho dữ liệu",
                  })
                : undefined;
            const reference = moddle.create(
              kind === "data-object"
                ? "bpmn:DataObjectReference"
                : "bpmn:DataStoreReference",
              {
                id: `${kind === "data-object" ? "DataObjectReference" : "DataStoreReference"}_${suffix}`,
                name:
                  kind === "data-object"
                    ? "Đối tượng dữ liệu"
                    : "Kho dữ liệu",
                ...(dataStoreBacking
                  ? { dataStoreRef: dataStoreBacking }
                  : {}),
              },
            );
            if (dataStoreBacking) {
              dataStoreBacking.$parent = definitions;
              modeling.updateModdleProperties(anchor, definitions, {
                rootElements: [
                  ...((definitions.rootElements as unknown[]) ?? []),
                  dataStoreBacking,
                ],
              });
            }
            const shape = getService(modeler!, "elementFactory").createShape({
              type:
                kind === "data-object"
                  ? "bpmn:DataObjectReference"
                  : "bpmn:DataStoreReference",
              businessObject: reference,
            });
            context.created = modeling.createShape(shape, position, parent);
          },
        });
        commandStack.register("teb.advanced.reuseDataStore", {
          preExecute(context) {
            const element = context.element as CanvasElement;
            const dataStore = context.dataStore as Record<string, unknown>;
            if (!element.businessObject || dataStore.$type !== "bpmn:DataStore") {
              throw new Error("Invalid DataStore reuse context.");
            }
            modeling.updateModdleProperties(
              element,
              element.businessObject as unknown as Record<string, unknown>,
              { dataStoreRef: dataStore },
            );
          },
        });
        commandStack.register("teb.advanced.createSubProcessStarter", {
          preExecute(context) {
            const parent = context.parent as CanvasElement;
            const position = context.position as { x: number; y: number };
            const suffix = crypto.randomUUID().replaceAll("-", "_");
            const subprocess = getService(modeler!, "elementFactory").createShape({
              type: "bpmn:SubProcess",
              isExpanded: true,
              width: 420,
              height: 220,
              businessObject: moddle.create("bpmn:SubProcess", {
                id: `SubProcess_${suffix}`,
                name: "Quy trình con",
                triggeredByEvent: false,
              }),
            });
            const created = modeling.createShape(subprocess, position, parent);
            const childTypes = [
              "bpmn:StartEvent",
              "bpmn:Task",
              "bpmn:EndEvent",
            ] as const;
            const children = childTypes.map((type, index) =>
              modeling.createShape(
                getService(modeler!, "elementFactory").createShape({ type }),
                {
                  x: (created.x ?? position.x) - 120 + index * 120,
                  y: created.y ?? position.y,
                },
                created,
              ),
            );
            modeling.updateProperties(children[1]!, { name: "Bước xử lý" });
            modeling.connect(children[0]!, children[1]!, {
              type: "bpmn:SequenceFlow",
            });
            modeling.connect(children[1]!, children[2]!, {
              type: "bpmn:SequenceFlow",
            });
            context.created = created;
          },
        });

        const handleSelection = (event: {
          readonly newSelection?: readonly CanvasElement[];
        }) => {
          const rawSelections = event.newSelection ?? [];
          const rawSelection = rawSelections[0] ?? null;
          const normalizedSelections = normalizedBpmnSelections(rawSelections);
          refreshBranchBalancePlan(normalizedSelections);
          const next = normalizedSelections[0] ?? null;
          if (
            rawSelections.length === 1 &&
            rawSelection &&
            next &&
            rawSelection !== next
          ) {
            getService(modeler!, "selection").select(next);
            return;
          }
          setSelectedElements(normalizedSelections);
          setArrangeCapabilities(
            bpmnArrangeCapabilities(modeler!, normalizedSelections),
          );
          setSelected(next);
          setInspectorCollapsed(
            next === null &&
              !window.matchMedia("(max-width: 767px)").matches,
          );
          setContextAppendOpen(false);
          setElementName(next?.businessObject?.name ?? "");
          const nextAnnotationText = next?.businessObject?.text ?? "";
          annotationTextDraftRef.current = nextAnnotationText;
          annotationTextSnapshotRef.current = nextAnnotationText;
          setAnnotationText(nextAnnotationText);
          const nextGroupTitle =
            next?.businessObject?.categoryValueRef?.value ?? "";
          groupTitleDraftRef.current = nextGroupTitle;
          groupTitleSnapshotRef.current = nextGroupTitle;
          setGroupTitle(nextGroupTitle);
          setProcessName(next?.businessObject?.processRef?.name ?? "");
          setCalledElementId(next?.businessObject?.calledElement ?? "");
          if (next?.type === "bpmn:CallActivity") {
            const anchor = registry
              .getAll()
              .find((element) => element.businessObject);
            const definitions = findDefinitions(
              anchor?.businessObject as Record<string, unknown> | undefined,
            );
            const ownerId = (
              owningFlowContainer(next)?.businessObject as
                | { readonly id?: string }
                | undefined
            )?.id;
            const participantProcessIds = new Set(
              registry
                .getAll()
                .filter(isParticipant)
                .map(
                  (participant) => participant.businessObject?.processRef?.id,
                )
                .filter((id): id is string => Boolean(id)),
            );
            setCallableProcesses(
              (
                (definitions?.rootElements as
                  | Record<string, unknown>[]
                  | undefined) ?? []
              )
                .filter(
                  (root) =>
                    root.$type === "bpmn:Process" &&
                    root.isExecutable !== true &&
                    root.id !== ownerId &&
                    !participantProcessIds.has(String(root.id)),
                )
                .map((root) => ({
                  id: String(root.id),
                  name:
                    typeof root.name === "string" && root.name.trim()
                      ? root.name
                      : "",
                })),
            );
          } else {
            setCallableProcesses([]);
          }
          if (next?.type === "bpmn:DataStoreReference") {
            const anchor = registry
              .getAll()
              .find((element) => element.businessObject);
            const definitions = findDefinitions(
              anchor?.businessObject as Record<string, unknown> | undefined,
            );
            setDataStores(
              (
                (definitions?.rootElements as
                  | Record<string, unknown>[]
                  | undefined) ?? []
              )
                .filter((root) => root.$type === "bpmn:DataStore")
                .map((root) => ({
                  id: String(root.id),
                  name:
                    typeof root.name === "string" && root.name.trim()
                      ? root.name
                      : "",
                })),
            );
            setSelectedDataStoreId(
              next.businessObject?.dataStoreRef?.id ?? "",
            );
          } else {
            setDataStores([]);
            setSelectedDataStoreId("");
          }
          const nextActivation =
            next?.businessObject?.activationCondition?.body ?? "";
          setActivationCondition(nextActivation);
          activationSnapshotRef.current = nextActivation;
          const source =
            next?.type === "bpmn:SequenceFlow"
              ? registry.get(
                  firstReferenceId(next.businessObject?.sourceRef) ?? "",
                )
              : undefined;
          const nextRoutingDraft = {
            condition:
              next?.businessObject?.conditionExpression?.body?.trim() ?? "",
            isDefault: source?.businessObject?.default?.id === next?.id,
          };
          routingSnapshotRef.current = nextRoutingDraft;
          setRoutingDraft(nextRoutingDraft);
          const definition = next?.businessObject?.eventDefinitions?.[0];
          const referencedMessage =
            definition?.messageRef ?? next?.businessObject?.messageRef;
          const nextMessageName = referencedMessage?.name ?? "";
          messageNameSnapshotRef.current = nextMessageName;
          setMessageName(nextMessageName);
          setSelectedMessageId(referencedMessage?.id ?? "");
          setMessagePickerMode(referencedMessage ? "EXISTING" : "NEW");
          const nextTimerDraft: BpmnTimerDraft = definition?.timeDate
            ? { kind: "DATE", value: definition.timeDate.body ?? "" }
            : {
                kind: "DURATION",
                value: definition?.timeDuration?.body ?? "",
              };
          timerSnapshotRef.current = nextTimerDraft;
          setTimerDraft(nextTimerDraft);
          if (!connectArmedRef.current) {
            setNotice(
              next ? `Đã chọn ${selectedLabel(next)}` : "Đã bỏ chọn phần tử",
            );
          }
        };
        const handleElementClick = (event: {
          readonly element?: CanvasElement;
          readonly originalEvent?: Event;
        }) => {
          const clickedElement = resolveBpmnSemanticElement(event.element);
          if (!clickedElement) return;
          if (connectArmedRef.current) {
            event.originalEvent?.preventDefault();
            connectionElementActionRef.current(clickedElement);
            return;
          }

          const selection = getService(modeler!, "selection");
          if (
            clickedElement !== event.element &&
            selection.get()[0] !== clickedElement
          ) {
            selection.select(clickedElement);
          }
          const capability = getBpmnInspectorCapability(
            clickedElement.type || clickedElement.businessObject?.$type || "",
          );
          if (
            capability.family === "unknown" ||
            !shouldActivateInspectorEdit("DIRECT_CANVAS")
          ) {
            return;
          }

          setInspectorCollapsed(false);
          setInspectorView("properties");
          window.requestAnimationFrame(() => {
            const inspector = document.querySelector<HTMLElement>(
              ".bpmn-studio__inspector",
            );
            if (inspector) inspector.scrollTop = 0;
          });
        };
        const handleCommand = () => {
          if (hydratingRef.current) return;
          if (modeler) refreshBranchBalancePlan(normalizedBpmnSelections(getService(modeler, "selection").get()));
          editSequenceRef.current += 1;
          setDirty(true);
          setSaveState("DIRTY");
          scheduleAutosave();
          if (modeler) {
            const commandStack = getService(modeler, "commandStack");
            setHistory({
              canUndo: commandStack.canUndo(),
              canRedo: commandStack.canRedo(),
            });
            setArrangeCapabilities(
              bpmnArrangeCapabilities(
                modeler,
                normalizedBpmnSelections(
                  getService(modeler, "selection").get(),
                ),
              ),
            );
            const currentSelection = resolveBpmnSemanticElement(
              getService(modeler, "selection").get()[0],
            );
            if (currentSelection?.type === "bpmn:TextAnnotation") {
              const nextAnnotationText =
                currentSelection.businessObject?.text ?? "";
              const previousAnnotationSnapshot =
                annotationTextSnapshotRef.current;
              annotationTextDraftRef.current = reconcileBpmnArtifactDraft(
                annotationTextDraftRef.current,
                previousAnnotationSnapshot,
                nextAnnotationText,
              );
              annotationTextSnapshotRef.current = nextAnnotationText;
              setAnnotationText((currentDraft) =>
                reconcileBpmnArtifactDraft(
                  currentDraft,
                  previousAnnotationSnapshot,
                  nextAnnotationText,
                ),
              );
            }
            if (currentSelection?.type === "bpmn:Group") {
              const nextGroupTitle =
                currentSelection.businessObject?.categoryValueRef?.value ?? "";
              const previousGroupSnapshot = groupTitleSnapshotRef.current;
              groupTitleDraftRef.current = reconcileBpmnArtifactDraft(
                groupTitleDraftRef.current,
                previousGroupSnapshot,
                nextGroupTitle,
              );
              groupTitleSnapshotRef.current = nextGroupTitle;
              setGroupTitle((currentDraft) =>
                reconcileBpmnArtifactDraft(
                  currentDraft,
                  previousGroupSnapshot,
                  nextGroupTitle,
                ),
              );
            }
            if (currentSelection?.type === "bpmn:SequenceFlow") {
              const source = getService(modeler, "elementRegistry").get(
                firstReferenceId(
                  currentSelection.businessObject?.sourceRef,
                ) ?? "",
              );
              const nextRoutingDraft = {
                condition:
                  currentSelection.businessObject?.conditionExpression?.body ??
                  "",
                isDefault:
                  source?.businessObject?.default?.id === currentSelection.id,
              };
              routingSnapshotRef.current = nextRoutingDraft;
              setRoutingDraft(nextRoutingDraft);
            }
            if (
              currentSelection?.type === "bpmn:ReceiveTask" ||
              currentSelection?.businessObject?.eventDefinitions?.[0]?.$type ===
                "bpmn:MessageEventDefinition"
            ) {
              const definition =
                currentSelection.businessObject?.eventDefinitions?.[0];
              const nextMessageName =
                (
                  definition?.messageRef ??
                  currentSelection.businessObject?.messageRef
                )?.name ?? "";
              messageNameSnapshotRef.current = nextMessageName;
              setMessageName(nextMessageName);
            }
            if (
              currentSelection?.businessObject?.eventDefinitions?.[0]?.$type ===
              "bpmn:TimerEventDefinition"
            ) {
              const definition =
                currentSelection.businessObject.eventDefinitions[0];
              const nextTimerDraft: BpmnTimerDraft = definition.timeDate
                ? { kind: "DATE", value: definition.timeDate.body ?? "" }
                : {
                    kind: "DURATION",
                    value: definition.timeDuration?.body ?? "",
                  };
              timerSnapshotRef.current = nextTimerDraft;
              setTimerDraft(nextTimerDraft);
            }
          }
          if (refreshTimerRef.current !== null) {
            window.clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = window.setTimeout(() => {
            if (modeler) {
              void refreshProjection(modeler);
            }
          }, 220);
        };
        const handleCreateCleanup = (event: {
          readonly context?: { readonly shape?: CanvasElement };
        }) => {
          setArmedLauncherItem(null);
          const pendingToolId = pendingCreatedToolRef.current;
          pendingCreatedToolRef.current = null;
          const created = resolveBpmnSemanticElement(event.context?.shape);
          if (!created || registry.get(created.id) !== created) return;
          if (pendingToolId) recordRecentToolRef.current(pendingToolId);
          if (created.type === "bpmn:TextAnnotation") {
            revealArtifactEditor("annotation");
            setNotice("Đã tạo chú thích. Nhập nội dung để hoàn tất.");
          } else if (created.type === "bpmn:Group") {
            revealArtifactEditor("group");
            setNotice("Đã tạo nhóm trực quan. Nhập tiêu đề để hoàn tất.");
          }
        };

        modeler.on("selection.changed", handleSelection);
        modeler.on("element.click", handleElementClick);
        modeler.on("commandStack.changed", handleCommand);
        modeler.on("create.cleanup", handleCreateCleanup);

        await modeler.importXML(opened.xml);
        const canvas = getService(modeler, "canvas");
        const canvasBounds = canvasRef.current?.getBoundingClientRect();
        if (canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0) {
          canvas.zoom("fit-viewport");
          setZoom(canvas.zoom());
        }
        await refreshProjection(modeler);
        if (!disposed) {
          setReady(true);
          setDirty(false);
          setSaveState("ACKNOWLEDGED");
          setNotice(
            historyLoadFailed
              ? "Đã mở sơ đồ; các bản đã lưu tạm thời chưa xem được."
              : "Đã mở bản lưu gần nhất.",
          );
          hydratingRef.current = false;
        }
      } catch {
        if (!disposed) {
          setSaveState("ERROR");
          setNotice(
            "Không thể mở sơ đồ đã lưu. Hãy tải lại trang; dữ liệu trên máy chủ không bị ghi đè.",
          );
        }
      }
    }

    void initialize();
    return () => {
      disposed = true;
      projectionGate.invalidate();
      importGate.invalidate();
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      modeler?.destroy();
      modelerRef.current = null;
    };
  }, [
    initialXml,
    typography,
    modelId,
    persistence,
    publishAcknowledgedProfile,
    refreshProjection,
    revealArtifactEditor,
    scheduleAutosave,
  ]);

  useEffect(() => {
    if (!connectArmed) return;
    const cancelConnect = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      connectArmedRef.current = false;
      connectSourceIdRef.current = null;
      setConnectArmed(false);
      setConnectSourceId(null);
      setNotice("Đã hủy chế độ kết nối.");
    };
    window.addEventListener("keydown", cancelConnect);
    return () => window.removeEventListener("keydown", cancelConnect);
  }, [connectArmed]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if ((!dirty && !restoreFenceRef.current.pending) || allowNavigationRef.current) return;
      event.preventDefault();
    };
    const guardClientNavigation = (event: MouseEvent) => {
      if (
        !dirty ||
        allowNavigationRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return false;
      }
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = new URL(anchor.href, window.location.href);
      if (
        target.origin !== window.location.origin ||
        target.href === window.location.href ||
        (target.pathname === window.location.pathname &&
          target.search === window.location.search &&
          target.hash !== window.location.hash)
      ) {
        return false;
      }
      if (anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveSaveError(false);
      setPendingNavigation(target.href);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("click", guardClientNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("click", guardClientNavigation, true);
    };
  }, [dirty]);

  const saveAndLeave = async () => {
    if (!pendingNavigation || savingBeforeLeave) return;
    setSavingBeforeLeave(true);
    setLeaveSaveError(false);
    try {
      const result = await persistCurrent();
      // Never leave on an earlier ACK while a newer edit is still local.
      if (!result || result.acknowledgedSequence !== editSequenceRef.current) {
        setLeaveSaveError(true);
        return;
      }
      allowNavigationRef.current = true;
      window.location.assign(pendingNavigation);
    } finally {
      setSavingBeforeLeave(false);
    }
  };

  const changeZoom = (delta: number) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const canvas = getService(modeler, "canvas");
    const next = Math.min(4, Math.max(0.25, canvas.zoom() + delta));
    canvas.zoom(next);
    setZoom(next);
  };

  const fitCanvas = () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const canvas = getService(modeler, "canvas");
    canvas.zoom("fit-viewport");
    setZoom(canvas.zoom());
  };

  const fitSelection = () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const elements = getService(modeler, "selection").get().filter((element) => typeof element.x === "number" && typeof element.y === "number" && typeof element.width === "number" && typeof element.height === "number");
    if (!elements.length) return;
    const x = Math.min(...elements.map((element) => element.x!)) - 60;
    const y = Math.min(...elements.map((element) => element.y!)) - 60;
    const right = Math.max(...elements.map((element) => element.x! + element.width!)) + 60;
    const bottom = Math.max(...elements.map((element) => element.y! + element.height!)) + 60;
    const canvas = getService(modeler, "canvas");
    canvas.viewbox({ x, y, width: right - x, height: bottom - y });
    setZoom(canvas.zoom());
  };

  const startCreate = (
    event: ReactDragEvent<HTMLButtonElement>,
    type: string,
    recipe: BpmnShapeCreationRecipe,
    participantExpanded?: boolean,
  ): boolean => {
    const modeler = modelerRef.current;
    if (!modeler) return false;
    const factory = getService(modeler, "elementFactory");
    const moddle = getService(modeler, "moddle");
    const shape =
      type === "bpmn:Participant"
        ? factory.createParticipantShape(
            recipe.kind === "swimlane-frame"
              ? {
                  isExpanded: true,
                  isHorizontal: recipe.orientation === "horizontal",
                }
              : (participantExpanded ?? true),
          )
        : artifactShape(factory, moddle, type, recipe);
    getService(modeler, "create").start(event.nativeEvent, shape);
    return true;
  };

  const availablePosition = (
    shape: CanvasElement,
    preferred: { readonly x: number; readonly y: number },
    parent: CanvasElement,
  ) => {
    const modeler = modelerRef.current;
    if (!modeler) return preferred;
    const occupied = getService(modeler, "elementRegistry")
      .getAll()
      .filter(
        (element) =>
          element.parent === parent &&
          (shape.type === "bpmn:Participant"
            ? element.type === "bpmn:Participant"
            : isCollaborationBpmnProfileId(profileIdRef.current)
              ? isCollaborationPlacementObstacleType(element.type)
              : true) &&
          Number.isFinite(element.x) &&
          Number.isFinite(element.y) &&
          Number.isFinite(element.width) &&
          Number.isFinite(element.height) &&
          (element.width ?? 0) > 0 &&
          (element.height ?? 0) > 0,
      )
      .map((element) => ({
        x: element.x!,
        y: element.y!,
        width: element.width!,
        height: element.height!,
      }));
    return findNonOverlappingPlacement(
      occupied,
      { width: shape.width ?? 100, height: shape.height ?? 80 },
      preferred,
    );
  };

  const createByKeyboard = (
    type: string,
    recipe: BpmnShapeCreationRecipe,
    participantExpanded?: boolean,
    requestedPosition?: { readonly x: number; readonly y: number },
    requestedParent?: CanvasElement,
  ) => {
    const modeler = modelerRef.current;
    if (!modeler) return false;
    const factory = getService(modeler, "elementFactory");
    const moddle = getService(modeler, "moddle");
    const modeling = getService(modeler, "modeling");
    const canvas = getService(modeler, "canvas");
    const registry = getService(modeler, "elementRegistry");
    const selection = getService(modeler, "selection").get()[0];
    if (type === "bpmn:BoundaryEvent" && selection?.type === "bpmn:SubProcess" && (!supportsSubprocessTimers(acknowledgedProfileIdRef.current) || recipe.kind !== "boundary-event" || recipe.eventDefinitionType !== "bpmn:TimerEventDefinition")) {
      setNotice("Chọn Hẹn giờ chung cho quy trình con để chuẩn bị khả năng phù hợp.");
      return false;
    }
    if (type === "bpmn:BoundaryEvent" && !isBoundaryHost(selection)) {
      setNotice(
        "Hãy chọn một công việc trước khi gắn sự kiện tại biên.",
      );
      return false;
    }
    const root = canvas.getRootElement();
    const selectedExpandedSubProcess =
      selection?.type === "bpmn:SubProcess" &&
      selection.businessObject?.triggeredByEvent === false
        ? selection
        : undefined;
    const parent =
      type === "bpmn:Participant"
        ? root
        : type === "bpmn:BoundaryEvent"
          ? selection!.parent ?? root
          : requestedParent
            ? requestedParent
            : type === "bpmn:Group" &&
                isCollaborationBpmnProfileId(profileIdRef.current)
              ? (owningParticipant(selection) ?? root)
              : isParticipant(selection)
              ? selection!
                : (selectedExpandedSubProcess ?? selection?.parent ?? root);
    if (
      isCollaborationBpmnProfileId(profileIdRef.current) &&
      type !== "bpmn:Participant" &&
      type !== "bpmn:BoundaryEvent" &&
      !owningParticipant(parent)?.businessObject?.processRef
    ) {
      setNotice(
        "Hãy chọn một bên tham gia có quy trình, vùng vai trò hoặc bước bên trong trước khi đặt.",
      );
      return false;
    }
    if (
      type === "bpmn:SubProcess" &&
      (parent.type === "bpmn:SubProcess" ||
        selection?.parent?.type === "bpmn:SubProcess")
    ) {
      setNotice("Sơ đồ hiện hỗ trợ tối đa một cấp quy trình con.");
      return false;
    }
    const shape =
      type === "bpmn:Participant"
        ? factory.createParticipantShape(
            recipe.kind === "swimlane-frame"
              ? {
                  isExpanded: true,
                  isHorizontal: recipe.orientation === "horizontal",
                }
              : (participantExpanded ?? true),
          )
        : artifactShape(factory, moddle, type, recipe);
    const preferred = requestedPosition ??
      (type === "bpmn:BoundaryEvent"
        ? {
            x: (selection!.x ?? 120) + (selection!.width ?? 100) / 2,
            y: (selection!.y ?? 160) + (selection!.height ?? 60),
          }
        : selection
      ? {
          x: (selection.x ?? 120) + (selection.width ?? 100) + 100,
          y: (selection.y ?? 160) + (selection.height ?? 60) / 2,
        }
      : type === "bpmn:Participant"
        ? { x: 520, y: 240 }
        : { x: 320, y: 240 });
    const position =
      type === "bpmn:BoundaryEvent"
        ? preferred
        : availablePosition(shape, preferred, parent);
    if (recipe.kind === "swimlane-frame") {
      const context: Record<string, unknown> = {
        orientation: recipe.orientation,
        position,
      };
      try {
        getService(modeler, "commandStack").execute(
          "teb.collaboration.createSwimlaneFrame",
          context,
        );
        const created = context.created as CanvasElement | undefined;
        if (created) {
          getService(modeler, "selection").select(created);
          setNotice(
            `Đã chia vai trò ${recipe.orientation === "horizontal" ? "ngang" : "dọc"} thành 2 vùng. Có thể hoàn tác toàn bộ trong một lần.`,
          );
        }
        return Boolean(created);
      } catch {
        setNotice(
          "Chưa thể chia vai trò trong sơ đồ này. Hãy kiểm tra lại sơ đồ rồi thử lại.",
        );
      }
      return false;
    }
    if (recipe.kind === "titled-group") {
      const whiteBox = registry
        .getAll()
        .find(
          (element) =>
            isParticipant(element) && Boolean(element.businessObject?.processRef),
        );
      const context: Record<string, unknown> = {
        parent,
        position: requestedParent
          ? position
          : whiteBox
            ? {
                x: (whiteBox.x ?? 0) + (whiteBox.width ?? 600) / 2,
                y: (whiteBox.y ?? 0) + (whiteBox.height ?? 240) / 2,
              }
            : position,
        title: "Nhóm mới",
      };
      getService(modeler, "commandStack").execute(
        "teb.documentation.createTitledGroup",
        context,
      );
      const createdGroup = context.created as CanvasElement | undefined;
      if (createdGroup) {
        getService(modeler, "selection").select(createdGroup);
        revealArtifactEditor("group");
        setNotice("Đã tạo nhóm trực quan. Nhập tiêu đề để hoàn tất.");
      }
      return Boolean(createdGroup);
    }
    if (recipe.kind === "expanded-subprocess-starter") {
      const context: Record<string, unknown> = { parent, position };
      getService(modeler, "commandStack").execute(
        "teb.advanced.createSubProcessStarter",
        context,
      );
      const createdSubProcess = context.created as CanvasElement | undefined;
      if (createdSubProcess) {
        getService(modeler, "selection").select(createdSubProcess);
        setNotice(
          "Đã tạo quy trình con mẫu gồm Bắt đầu → Công việc → Kết thúc. Có thể hoàn tác toàn bộ trong một lần.",
        );
      }
      return Boolean(createdSubProcess);
    }
    if (recipe.kind === "call-activity") {
      const context: Record<string, unknown> = { parent, position };
      getService(modeler, "commandStack").execute(
        "teb.advanced.createCallActivityStarter",
        context,
      );
      const createdCallActivity = context.created as CanvasElement | undefined;
      if (!createdCallActivity) {
        setNotice("Không thể tạo bước dùng lại quy trình trong sơ đồ này.");
        return false;
      }
      getService(modeler, "selection").select(createdCallActivity);
      setNotice(
        "Đã tạo bước dùng lại quy trình và một quy trình dùng chung đi kèm. Có thể hoàn tác cả hai trong một lần.",
      );
      return true;
    }
    if (
      recipe.kind === "data-object" ||
      recipe.kind === "data-store"
    ) {
      const context: Record<string, unknown> = {
        kind: recipe.kind,
        parent,
        position,
      };
      getService(modeler, "commandStack").execute(
        "teb.advanced.createDataArtifact",
        context,
      );
      const createdData = context.created as CanvasElement | undefined;
      if (!createdData) {
        setNotice("Không thể tạo nguồn dữ liệu trong sơ đồ hiện tại.");
        return false;
      }
      getService(modeler, "selection").select(createdData);
      setNotice(
        recipe.kind === "data-object"
          ? "Đã tạo tài liệu dữ liệu."
          : "Đã tạo kho dữ liệu có thể dùng lại.",
      );
      return true;
    }
    const created = modeling.createShape(
      shape,
      position,
      type === "bpmn:BoundaryEvent" ? selection! : parent,
      type === "bpmn:BoundaryEvent" ? { attach: true } : undefined,
    );
    getService(modeler, "selection").select(created);
    if (created.type === "bpmn:TextAnnotation") {
      revealArtifactEditor("annotation");
      setNotice("Đã tạo chú thích. Nhập nội dung để hoàn tất.");
    }
    return true;
  };

  const addNext = useCallback(
    (action: BpmnAppendAction) => {
      const { type } = action;
      const modeler = modelerRef.current;
      if (
        type === "bpmn:ParallelGateway" &&
        !supportsStructuredRouting(acknowledgedProfileIdRef.current)
      ) {
        setNotice(
          "Hệ thống chưa chuẩn bị xong khả năng chạy song song. Hãy thử lại sau khi máy chủ xác nhận.",
        );
        return false;
      }
      if (
        type === "bpmn:InclusiveGateway" &&
        !supportsConditionalRouting(acknowledgedProfileIdRef.current)
      ) {
        setNotice(
          "Hệ thống chưa chuẩn bị xong khả năng chọn nhiều hướng. Hãy thử lại sau khi máy chủ xác nhận.",
        );
        return false;
      }
      if (
        ["message-catch-event", "timer-catch-event", "receive-task"].includes(
          action.id,
        ) &&
        !supportsCatchingEvents(acknowledgedProfileIdRef.current)
      ) {
        setNotice(
          "Hệ thống chưa chuẩn bị xong thành phần chờ. Hãy thử lại sau khi máy chủ xác nhận.",
        );
        return false;
      }
      if (
        type === "bpmn:EventBasedGateway" &&
        !supportsEventRouting(acknowledgedProfileIdRef.current)
      ) {
        setNotice(
          "Hệ thống chưa chuẩn bị xong điểm chờ sự kiện đầu tiên. Hãy thử lại sau khi máy chủ xác nhận.",
        );
        return false;
      }
      if (
        ["user-task", "service-task", "manual-task"].includes(action.id) &&
        !supportsTaskTypes(acknowledgedProfileIdRef.current)
      ) {
        setNotice("Các loại công việc đang được chuẩn bị. Hãy thử lại sau khi máy chủ xác nhận.");
        return false;
      }
      if (
        ["none-throw-event", "message-throw-event"].includes(action.id) &&
        !supportsIntermediateEvents(acknowledgedProfileIdRef.current)
      ) {
        setNotice(
          "Sự kiện gửi đang được chuẩn bị. Hãy thử lại sau khi máy chủ xác nhận.",
        );
        return false;
      }
      if (!modeler || !isFlowNode(selected) || !selected?.parent) {
        setNotice("Hãy chọn một bước trước khi thêm bước kế tiếp.");
        return false;
      }
      if (
        selected.type === "bpmn:EventBasedGateway" &&
        !["message-catch-event", "timer-catch-event", "receive-task"].includes(
          action.id,
        )
      ) {
        setNotice(
          "Điểm chờ sự kiện chỉ nối tới chờ thông điệp, chờ thời gian hoặc nhận thông điệp.",
        );
        return false;
      }
      try {
        const shape = getService(modeler, "elementFactory").createShape(
          shapeCreationOptions(type, action.recipe),
        );
        const preferred = {
          x:
            (selected.x ?? 120) +
            (selected.width ?? 100) +
            80 +
            (shape.width ?? 100) / 2,
          y: (selected.y ?? 160) + (selected.height ?? 60) / 2,
        };
        const created = getService(modeler, "modeling").appendShape(
          selected,
          shape,
          availablePosition(shape, preferred, selected.parent),
          selected.parent,
        );
        getService(modeler, "selection").select(created);
        setNotice(
          "Đã thêm bước kế tiếp cùng đường thực hiện. Có thể hoàn tác cả hai trong một lần.",
        );
        return true;
      } catch {
        setNotice("Không thể thêm bước kế tiếp từ thành phần đang chọn.");
        return false;
      }
    },
    [selected],
  );

  useEffect(() => {
    const modeler = modelerRef.current;
    const canvas = canvasRef.current;
    if (!modeler || !canvas || !ready) return;
    const availableActions = bpmnAppendActions(
      acknowledgedBpmnAuthoringProfile(
        modelProfileId,
        conditionalProfileAcknowledged,
        catchingEventsProfileAcknowledged,
        eventRoutingProfileAcknowledged,
        taskTypesProfileAcknowledged,
        intermediateEventsProfileAcknowledged,
        boundaryEventsProfileAcknowledged,
        activityContainersProfileAcknowledged,
        dataAuthoringProfileAcknowledged,
        complexRoutingProfileAcknowledged,
      ),
    );
    const actions =
      selected?.type === "bpmn:EventBasedGateway"
        ? availableActions.filter((action) =>
            [
              "message-catch-event",
              "timer-catch-event",
              "receive-task",
            ].includes(action.id),
          )
        : availableActions;
    refreshContextActionOverlay(
      modeler,
      selected,
      contextAppendOpen,
      actions,
      structuredProfileAcknowledged,
    );
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const trigger = target.closest<HTMLButtonElement>(
        "[data-bpmn-context-plus]",
      );
      if (trigger) {
        event.preventDefault();
        setContextAppendOpen((current) => !current);
        return;
      }
      const more = target.closest<HTMLButtonElement>(
        "[data-bpmn-context-more]",
      );
      if (more && selected) {
        event.preventDefault();
        setContextAppendOpen(false);
        setComponentLauncherMode({
          kind: "append",
          sourceId: selected.id,
          sourceLabel:
            selected.businessObject?.name ||
            selected.businessObject?.text ||
            selected.id,
        });
        setComponentLauncherOpen(true);
        return;
      }
      const action = target.closest<HTMLButtonElement>("[data-bpmn-append-id]");
      if (!action || action.disabled) return;
      const appendAction = actions.find(
        (candidate) => candidate.id === action.dataset.bpmnAppendId,
      );
      if (!appendAction) return;
      event.preventDefault();
      restoreContextTriggerFocusRef.current = true;
      setContextAppendOpen(false);
      addNext(appendAction);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "Escape" && target.closest(".teb-context-append")) {
        event.preventDefault();
        restoreContextTriggerFocusRef.current = true;
        setContextAppendOpen(false);
        return;
      }
      if (!target.closest(".teb-context-append__menu")) return;
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = [
        ...canvas.querySelectorAll<HTMLButtonElement>(
          ".teb-context-append__menu [role='menuitem']:not(:disabled)",
        ),
      ];
      if (items.length === 0) return;
      const current = items.indexOf(
        target.closest("button") as HTMLButtonElement,
      );
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[next]?.focus();
    };
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("keydown", handleKeyDown);
    if (contextAppendOpen) {
      window.requestAnimationFrame(() => {
        canvas
          .querySelector<HTMLButtonElement>(
            ".teb-context-append__menu [role='menuitem']:not(:disabled)",
          )
          ?.focus();
      });
    } else if (restoreContextTriggerFocusRef.current) {
      restoreContextTriggerFocusRef.current = false;
      window.requestAnimationFrame(() => {
        canvas
          .querySelector<HTMLButtonElement>("[data-bpmn-context-plus]")
          ?.focus();
      });
    }
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("keydown", handleKeyDown);
      getService(modeler, "overlays").remove({ type: "teb-context-actions" });
    };
  }, [
    addNext,
    catchingEventsProfileAcknowledged,
    boundaryEventsProfileAcknowledged,
    activityContainersProfileAcknowledged,
    dataAuthoringProfileAcknowledged,
    complexRoutingProfileAcknowledged,
    contextAppendOpen,
    conditionalProfileAcknowledged,
    modelProfileId,
    ready,
    selected,
    eventRoutingProfileAcknowledged,
    intermediateEventsProfileAcknowledged,
    structuredProfileAcknowledged,
    taskTypesProfileAcknowledged,
  ]);

  const setSelectedIcon = (iconKey: NodeIconKey | null) => {
    const modeler = modelerRef.current;
    if (!modeler || !selected || !supportsNodeVisual(selected.type)) return;
    const moddle = getService(modeler, "moddle");
    const existingValues =
      selected.businessObject?.extensionElements?.values?.filter(
        (value) => value.$type !== "teb:NodeVisual",
      ) ?? [];
    const values: Record<string, unknown>[] = [...existingValues];
    const extensionElements = moddle.create("bpmn:ExtensionElements", {
      values,
    });
    if (iconKey) {
      const nodeVisual = moddle.create("teb:NodeVisual", { iconKey });
      nodeVisual.$parent = extensionElements;
      values.push(nodeVisual);
      if (profileIdRef.current === coreBpmnProfile.id) {
        profileIdRef.current = coreBpmnVisualProfile.id;
        setModelProfileId(coreBpmnVisualProfile.id);
      }
    }
    getService(modeler, "modeling").updateProperties(selected, {
      extensionElements,
    });
    setNotice(
      iconKey
        ? "Đã chọn biểu tượng cho thành phần."
        : "Đã bỏ biểu tượng; tên thành phần vẫn được giữ.",
    );
  };

  const activateConnect = (
    kind: BpmnConnectKind,
    recentToolId: BpmnLibraryItem["id"] | null = null,
  ) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    if (connectArmedRef.current && connectKindRef.current === kind) {
      connectArmedRef.current = false;
      connectSourceIdRef.current = null;
      pendingConnectionToolRef.current = null;
      setConnectArmed(false);
      setConnectSourceId(null);
      setNotice("Đã hủy chế độ kết nối.");
      return;
    }
    connectArmedRef.current = true;
    connectKindRef.current = kind;
    pendingConnectionToolRef.current = recentToolId;
    setConnectArmed(true);
    setConnectKind(kind);
    const validSource = isValidBpmnConnectionSourceType(kind, selected?.type);
    if (validSource) {
      connectSourceIdRef.current = selected!.id;
      setConnectSourceId(selected!.id);
      setNotice(
        `Bước 2/2: đã chọn ${selectedLabel(selected)}. Chọn ${
          kind === "message"
            ? "điểm nhận thuộc bên tham gia khác"
            : kind === "association"
              ? isTextAnnotation(selected)
                ? "phần tử được chú thích"
                : "ghi chú"
              : kind === "data-association"
                ? isDataReference(selected)
                  ? "công việc nhận hoặc tạo dữ liệu"
                  : "tài liệu hoặc kho dữ liệu"
                : "bước đích trong cùng quy trình"
        } trên sơ đồ hoặc danh sách bước.`,
      );
      return;
    }
    connectSourceIdRef.current = null;
    setConnectSourceId(null);
    setNotice(
      `Bước 1/2: chọn ${
        kind === "message"
          ? "bên tham gia hoặc bước làm điểm gửi"
          : kind === "association"
            ? "ghi chú hoặc phần tử cần giải thích"
            : kind === "data-association"
              ? "công việc, tài liệu hoặc kho dữ liệu"
              : "bước làm điểm bắt đầu"
      } trên sơ đồ hoặc danh sách bước.`,
    );
  };

  const runAvailableLauncherIntent = (
    item: BpmnLauncherItem,
    mode: BpmnLauncherMode,
    activation: BpmnLauncherActivation = "pointer",
  ) => {
    const tool = item.tool;
    if (tool.kind === "connector") {
      setArmedLauncherItem(null);
      activateConnect(tool.connector, item.id);
      return;
    }
    if (mode.kind === "append") {
      const action = bpmnAppendActions(acknowledgedProfileIdRef.current).find(
        (candidate) => candidate.id === tool.id,
      );
      if (!action || selected?.id !== mode.sourceId) {
        setNotice(
          "Thành phần này không thể nối nhanh tại vị trí hiện tại. Hãy đặt trực tiếp trên vùng vẽ.",
        );
        return;
      }
      setArmedLauncherItem(null);
      if (addNext(action)) recordRecentToolRef.current(item.id);
      return;
    }
    if (tool.type === "bpmn:BoundaryEvent" && !isBoundaryHost(selected)) {
      setNotice(
        "Chọn một công việc phù hợp trước khi gắn sự kiện tại biên.",
      );
      return;
    }

    if (activation === "keyboard") {
      if (
        isCollaborationBpmnProfileId(acknowledgedProfileIdRef.current) &&
        tool.type !== "bpmn:Participant" &&
        tool.type !== "bpmn:BoundaryEvent" &&
        !owningParticipant(selected)?.businessObject?.processRef
      ) {
        setArmedLauncherItem(null);
        setComponentLauncherOpen(false);
        setNotice(
          "Chọn một bên tham gia có quy trình, vùng vai trò hoặc thành phần bên trong trước khi đặt bằng bàn phím.",
        );
        return;
      }
      setArmedLauncherItem(null);
      setComponentLauncherOpen(false);
      const created = createByKeyboard(
        tool.type,
        tool.recipe,
        tool.participantExpanded,
      );
      if (
        created &&
        tool.type !== "bpmn:TextAnnotation" &&
        tool.type !== "bpmn:Group"
      ) {
        setNotice(
          `Đã đặt ${tool.label} bằng bàn phím tại vị trí trống gần ngữ cảnh hiện tại.`,
        );
      }
      if (created) recordRecentToolRef.current(item.id);
      return;
    }

    setArmedLauncherItem(item);
    setComponentLauncherOpen(false);
    setNotice(
      `Đã chọn ${tool.label}. Nhấp một vị trí hợp lệ trên vùng vẽ để đặt; nhấn Esc để hủy.`,
    );
  };

  const handleArmedCanvasClick = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    const item = armedLauncherItem;
    if (
      !item ||
      item.tool.kind !== "shape"
    ) {
      return;
    }
    if (
      (event.target as HTMLElement).closest(
        "button, input, textarea, select, [role='menu'], [role='dialog']",
      )
    ) {
      return;
    }
    const modeler = modelerRef.current;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!modeler || !bounds || bounds.width <= 0 || bounds.height <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const viewbox = getService(modeler, "canvas").viewbox();
    const requestedPosition = {
      x: viewbox.x + (event.clientX - bounds.left) / viewbox.scale,
      y: viewbox.y + (event.clientY - bounds.top) / viewbox.scale,
    };
    let requestedParent: CanvasElement | undefined;
    if (
      isCollaborationBpmnProfileId(acknowledgedProfileIdRef.current) &&
      item.tool.type !== "bpmn:Participant" &&
      item.tool.type !== "bpmn:BoundaryEvent"
    ) {
      const registry = getService(modeler, "elementRegistry");
      const resolution = resolveBpmnParticipantAtPoint(
        requestedPosition,
        participantFrames(registry),
      );
      if (resolution.kind === "rejected") {
        setNotice(
          resolution.reason === "OUTSIDE_PARTICIPANT"
            ? "Đặt thành phần bên trong một bên tham gia có quy trình. Công cụ vẫn đang được chọn."
            : resolution.reason === "BLACK_BOX"
              ? "Bên tham gia chỉ trao đổi thông điệp không thể chứa thành phần. Chọn một bên có quy trình; công cụ vẫn đang được chọn."
              : "Vị trí thuộc nhiều bên tham gia. Tách các vùng rồi chọn lại; công cụ vẫn đang được chọn.",
        );
        return;
      }
      const participant = registry.get(resolution.participantId);
      if (
        !isParticipant(participant) ||
        !participant.businessObject?.processRef
      ) {
        setNotice(
          "Không tìm thấy bên tham gia có quy trình tại vị trí này. Công cụ vẫn đang được chọn.",
        );
        return;
      }
      requestedParent = participant;
    }
    const created = createByKeyboard(
      item.tool.type,
      item.tool.recipe,
      item.tool.participantExpanded,
      requestedPosition,
      requestedParent,
    );
    if (created) recordRecentToolRef.current(item.id);
    setArmedLauncherItem(null);
  };

  const handleLauncherToolIntent = (
    item: BpmnLauncherItem,
    mode: BpmnLauncherMode,
    nativeEvent?: Event,
  ) => {
    if (item.id === "timer-boundary-event" && selected?.type === "bpmn:SubProcess" && !supportsSubprocessTimers(acknowledgedProfileIdRef.current)) {
      const target = isCollaborationBpmnProfileId(acknowledgedProfileIdRef.current) ? collaborationSubprocessTimersBpmnProfile : coreSubprocessTimersBpmnProfile;
      item = { ...item, preparation: { kind: "ordered-profile-ack", minimumProfileId: target.id, minimumProfileLabel: target.label } };
    }
    const activation: BpmnLauncherActivation =
      nativeEvent?.type === "keydown" ? "keyboard" : "pointer";
    if (item.actionability === "context-incompatible") {
      setNotice(item.stateLabel);
      return;
    }
    if (item.preparation.kind === "in-place-swimlane-conversion") {
      const durable = durableModelRef.current;
      if (
        !durable ||
        !isCoreBpmnProfileId(durable.profileId) ||
        saveState === "LOADING"
      ) {
        setNotice("Chưa thể thêm khu vực vai trò khi sơ đồ chưa tải xong.");
        return;
      }
      if (
        swimlaneConversionInFlightRef.current ||
        profileUpgradeRequestRef.current ||
        profileUpgradeInFlightRef.current
      ) {
        setNotice("Ứng dụng đang chuẩn bị một thay đổi khác. Vui lòng chờ hoàn tất.");
        return;
      }
      swimlaneConversionCommandRef.current = null;
      setSwimlaneConversion({
        toolId: item.id,
        orientation: item.preparation.orientation,
        dialogState: { kind: "confirming" },
      });
      setComponentLauncherOpen(false);
      return;
    }
    if (item.preparation.kind === "none") {
      runAvailableLauncherIntent(item, mode, activation);
      return;
    }

    if (
      profileUpgradeRequestRef.current ||
      profileUpgradeBusy ||
      profileUpgradeInFlightRef.current
    ) {
      setNotice("Ứng dụng đang chuẩn bị một công cụ khác. Vui lòng chờ hoàn tất.");
      return;
    }

    const durable = durableModelRef.current;
    if (!durable || saveState === "LOADING") {
      setNotice("Chưa thể chuẩn bị công cụ khi sơ đồ chưa tải xong.");
      return;
    }
    profileUpgradeRequestRef.current = true;
    const intent = createBpmnProfileUpgradeIntent({
      intentId: crypto.randomUUID(),
      requestedToolId: item.id,
      acknowledged: {
        profileId: durable.profileId,
        revisionToken: durable.revisionToken,
      },
      minimumProfileId: item.preparation.minimumProfileId,
    });
    if (intent.status === "completed") {
      profileUpgradeRequestRef.current = false;
      runAvailableLauncherIntent(item, mode, activation);
      return;
    }
    if (intent.status === "incompatible") {
      profileUpgradeRequestRef.current = false;
      setNotice("Thành phần này không phù hợp với loại sơ đồ hiện tại.");
      return;
    }
    setProfileUpgradeItem({ item, mode, activation });
    setProfileUpgradeIntent(intent);
    setComponentLauncherOpen(false);
  };

  const restoreComponentLauncherFocus = () => {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          ".bpmn-component-launcher__trigger",
        )
        ?.focus();
    });
  };

  const cancelSwimlaneConversion = () => {
    if (swimlaneConversionInFlightRef.current) return;
    if (
      swimlaneConversion?.dialogState.kind === "blocked" &&
      swimlaneConversion.dialogState.secondaryAction === "reload"
    ) {
      window.location.reload();
      return;
    }
    swimlaneConversionCommandRef.current = null;
    setSwimlaneConversion(null);
    setNotice("Đã dừng chuẩn bị; sơ đồ và lịch sử chỉnh sửa không đổi.");
  };

  const executeSwimlaneConversion = async () => {
    const request = swimlaneConversion;
    const modeler = modelerRef.current;
    if (
      !request ||
      !modeler ||
      swimlaneConversionInFlightRef.current ||
      profileUpgradeInFlightRef.current ||
      importInFlightRef.current
    ) {
      return;
    }

    swimlaneConversionInFlightRef.current = true;
    let conversionDispatched = false;
    setSwimlaneConversion({
      ...request,
      dialogState: { kind: "working" },
    });

    try {
      if (dirty || pendingSaveCommandRef.current) {
        let draftIsCurrent = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const requiredSequence = editSequenceRef.current;
          const draftAcknowledged = await persistCurrent();
          if (!draftAcknowledged) break;
          if (
            draftAcknowledged.acknowledgedSequence === requiredSequence &&
            editSequenceRef.current === requiredSequence &&
            pendingSaveCommandRef.current === null
          ) {
            draftIsCurrent = true;
            break;
          }
        }
        if (!draftIsCurrent) {
          swimlaneConversionCommandRef.current = null;
          setSwimlaneConversion({
            ...request,
            dialogState: {
              kind: "blocked",
              canRetry: true,
              secondaryAction: "close",
              message:
                "Chưa thể xác nhận bản chỉnh sửa mới nhất. Sơ đồ đang mở chưa bị thay đổi.",
            },
          });
          return;
        }
      }

      const durable = durableModelRef.current;
      if (!durable || !isCoreBpmnProfileId(durable.profileId)) {
        swimlaneConversionCommandRef.current = null;
        setSwimlaneConversion({
          ...request,
          dialogState: {
            kind: "blocked",
            canRetry: false,
            secondaryAction: "close",
            message:
              "Sơ đồ đã thay đổi trong lúc chuẩn bị. Hãy đóng thông báo và chọn lại thành phần.",
          },
        });
        return;
      }

      let command = swimlaneConversionCommandRef.current;
      if (
        !command ||
        command.sourceRevisionToken !== durable.revisionToken ||
        command.sourceProfileId !== durable.profileId ||
        command.orientation !== request.orientation
      ) {
        const { xml: sourceXml } = await modeler.saveXML({ format: true });
        if (!sourceXml) throw new Error("No BPMN XML for swimlane conversion.");
        const prepared = await prepareSwimlaneConversion(
          sourceXml,
          request.orientation,
          durable.profileId,
        );
        await preflightXml(prepared.xml);
        const inspection = await inspectXml(
          prepared.xml,
          prepared.targetProfileId,
        );
        if (!inspection.safeToPersist || !inspection.canonicalXml) {
          throw Object.assign(
            new Error(
              "The prepared swimlane diagram did not pass local inspection.",
            ),
            { code: "CANDIDATE_REJECTED" as const },
          );
        }
        command = {
          idempotencyKey: `convert-model:swimlane:${crypto.randomUUID()}`,
          sourceRevisionToken: durable.revisionToken,
          sourceProfileId: durable.profileId,
          orientation: request.orientation,
          candidateXml: inspection.canonicalXml,
        };
        swimlaneConversionCommandRef.current = command;
      }

      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      saveInFlightRef.current = true;
      setSaveState("SAVING");
      conversionDispatched = true;
      const result = await persistence.convertCoreToCollaboration({
        idempotencyKey: command.idempotencyKey,
        modelId: durable.modelId,
        revisionToken: command.sourceRevisionToken,
        sourceProfileId: command.sourceProfileId,
        orientation: command.orientation,
        title: titleRef.current.trim(),
        description: descriptionRef.current,
        purpose: purposeRef.current,
        xml: command.candidateXml,
      });

      if (result.kind === "conflict") {
        swimlaneConversionCommandRef.current = null;
        conflictRef.current = true;
        setSaveState("CONFLICT");
        setSwimlaneConversion({
          ...request,
          dialogState: {
            kind: "blocked",
            canRetry: false,
            secondaryAction: "reload",
            message:
              "Sơ đồ trên máy chủ vừa thay đổi. Sơ đồ đang mở chưa bị thay đổi; hãy tải lại rồi thử lại.",
          },
        });
        return;
      }
      if (result.kind === "rejected") {
        swimlaneConversionCommandRef.current = null;
        setSaveState("ERROR");
        setSwimlaneConversion({
          ...request,
          dialogState: {
            kind: "blocked",
            canRetry: false,
            secondaryAction: "close",
            message:
              "Chưa thể giữ nguyên sơ đồ một cách an toàn. Không có thay đổi nào được áp dụng.",
          },
        });
        return;
      }
      if (result.kind === "unauthenticated") {
        setSaveState("ERROR");
        setSwimlaneConversion({
          ...request,
          dialogState: {
            kind: "blocked",
            canRetry: true,
            secondaryAction: "close",
            message:
              "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử lại cùng yêu cầu này.",
          },
        });
        return;
      }
      if (result.kind === "unavailable") {
        setSaveState("ERROR");
        setSwimlaneConversion({
          ...request,
          dialogState: {
            kind: "blocked",
            canRetry: true,
            secondaryAction: "reload",
            message:
              "Kết nối bị gián đoạn nên ứng dụng chưa xác nhận được kết quả. Hãy thử lại để đối chiếu cùng yêu cầu.",
          },
        });
        return;
      }
      if (result.kind !== "acknowledged" && result.kind !== "idempotent") {
        return;
      }

      await preflightXml(result.canonicalXml);
      hydratingRef.current = true;
      projectionGateRef.current.invalidate();
      getService(modeler, "dragging").cancel();
      getService(modeler, "selection").select([]);
      await modeler.importXML(result.canonicalXml);
      durable.revisionToken = result.revisionToken;
      durable.profileId = result.profileId;
      publishAcknowledgedProfile(result.profileId);
      currentXmlRef.current = result.canonicalXml;
      pendingSaveCommandRef.current = null;
      editSequenceRef.current += 1;
      setSelected(null);
      setSelectedElements([]);
      setArrangeCapabilities({ canAlign: false, canDistribute: false });
      setArmedLauncherItem(null);
      setDirty(false);
      setSaveState("ACKNOWLEDGED");
      await refreshProjection(modeler);
      const canvas = getService(modeler, "canvas");
      canvas.zoom("fit-viewport");
      setZoom(canvas.zoom());
      setHistory({
        canUndo: getService(modeler, "commandStack").canUndo(),
        canRedo: getService(modeler, "commandStack").canRedo(),
      });
      swimlaneConversionCommandRef.current = null;
      setSwimlaneConversion(null);
      setNotice(
        request.orientation === "horizontal"
          ? "Đã chia quy trình thành hai vai trò trên và dưới. Nội dung cũ được giữ nguyên."
          : "Đã chia quy trình thành hai vai trò trái và phải. Nội dung cũ được giữ nguyên.",
      );
      recordRecentToolRef.current(request.toolId);
    } catch (error) {
      const localFailure = isBpmnSwimlanePreparationError(error);
      if (localFailure) swimlaneConversionCommandRef.current = null;
      setSaveState("ERROR");
      setSwimlaneConversion({
        ...request,
        dialogState: {
          kind: "blocked",
          canRetry: !localFailure,
          secondaryAction:
            conversionDispatched && !localFailure ? "reload" : "close",
          message: localFailure
            ? "Sơ đồ này chưa thể chia thành khu vực vai trò mà vẫn giữ nguyên toàn bộ nội dung. Không có thay đổi nào được áp dụng."
            : "Ứng dụng chưa thể xác nhận kết quả. Sơ đồ đang mở vẫn được giữ nguyên; hãy thử lại để đối chiếu.",
        },
      });
    } finally {
      hydratingRef.current = false;
      saveInFlightRef.current = false;
      swimlaneConversionInFlightRef.current = false;
    }
  };

  const cancelProfileUpgrade = () => {
    if (profileUpgradeBusy || profileUpgradeInFlightRef.current) return;
    if (profileUpgradeIntent) {
      setProfileUpgradeIntent(
        cancelBpmnProfileUpgradeIntent(profileUpgradeIntent),
      );
    }
    const durable = durableModelRef.current;
    if (durable) publishAcknowledgedProfile(durable.profileId);
    profileUpgradeRequestRef.current = false;
    profileUpgradeAutoStartedRef.current = null;
    setProfileUpgradeItem(null);
    setProfileUpgradeIntent(null);
    setNotice("Đã dừng chuẩn bị công cụ; vùng vẽ và khả năng hoàn tác không đổi.");
    restoreComponentLauncherFocus();
  };

  const executeProfileUpgrade = async () => {
    const target = profileUpgradeItem;
    let intent = profileUpgradeIntent;
    const modeler = modelerRef.current;
    const durable = durableModelRef.current;
    if (
      !target ||
      !intent ||
      !modeler ||
      !durable ||
      profileUpgradeBusy ||
      profileUpgradeInFlightRef.current ||
      saveInFlightRef.current
    ) {
      return;
    }

    profileUpgradeInFlightRef.current = true;
    setProfileUpgradeBusy(true);
    try {
      if (dirty || pendingSaveCommandRef.current) {
        let draftIsCurrent = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const requiredSequence = editSequenceRef.current;
          const draftAcknowledged = await persistCurrent();
          if (!draftAcknowledged) break;
          if (
            draftAcknowledged.acknowledgedSequence === requiredSequence &&
            editSequenceRef.current === requiredSequence &&
            pendingSaveCommandRef.current === null
          ) {
            draftIsCurrent = true;
            break;
          }
        }
        if (!draftIsCurrent) {
          profileUpgradeRequestRef.current = false;
          profileUpgradeAutoStartedRef.current = null;
          setProfileUpgradeItem(null);
          setProfileUpgradeIntent(null);
          setNotice(
            "Chưa thể chuẩn bị công cụ vì bản nháp hiện tại chưa được máy chủ xác nhận.",
          );
          return;
        }
      }

      const refreshedDurable = durableModelRef.current;
      if (!refreshedDurable) {
        profileUpgradeRequestRef.current = false;
        profileUpgradeAutoStartedRef.current = null;
        setProfileUpgradeItem(null);
        setProfileUpgradeIntent(null);
        setNotice("Không tìm thấy bản sơ đồ đã xác nhận. Hãy tải lại rồi thử lại.");
        return;
      }
      intent = createBpmnProfileUpgradeIntent({
        intentId: intent.intentId,
        requestedToolId: target.item.id,
        acknowledged: {
          profileId: refreshedDurable.profileId,
          revisionToken: refreshedDurable.revisionToken,
        },
        minimumProfileId:
          target.item.preparation.kind === "ordered-profile-ack"
            ? target.item.preparation.minimumProfileId
            : target.item.minimumProfileId,
      });
      setProfileUpgradeIntent(intent);

      if (intent.status === "incompatible") {
        profileUpgradeRequestRef.current = false;
        profileUpgradeAutoStartedRef.current = null;
        setProfileUpgradeItem(null);
        setProfileUpgradeIntent(null);
        setNotice("Thành phần này không tương thích với sơ đồ hiện tại.");
        return;
      }

      if (intent.status === "completed") {
        profileUpgradeRequestRef.current = false;
        profileUpgradeAutoStartedRef.current = null;
        setProfileUpgradeItem(null);
        setProfileUpgradeIntent(null);
        runAvailableLauncherIntent(
          target.item,
          target.mode,
          target.activation,
        );
        return;
      }
      if (intent.status !== "ready" && intent.status !== "blocked") return;

      const { xml } = await modeler.saveXML({ format: true });
      if (!xml) throw new Error("No BPMN XML for profile transition.");
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      saveInFlightRef.current = true;
      setSaveState("SAVING");

      intent = await runBpmnProfileUpgradeIntent(intent, {
        persistStep: async (step) =>
          persistence.save({
            idempotencyKey: step.idempotencyKey,
            modelId: durable.modelId,
            revisionToken: step.expectedRevisionToken,
            title: titleRef.current.trim(),
            description: descriptionRef.current,
            purpose: purposeRef.current,
            profileId: step.targetProfileId,
            xml,
            source: "EDITED",
          }),
        onStateChange: (next) => {
          setProfileUpgradeIntent(next);
          if (next.status === "in-flight") {
            setNotice(
              `Đang chuẩn bị công cụ ${next.pendingStep.ordinal}/${next.pendingStep.total}: ${profileStageLabel(next.pendingStep.targetProfileId)}…`,
            );
            return;
          }
          if (next.status === "ready" || next.status === "completed") {
            durable.profileId = next.acknowledged.profileId;
            durable.revisionToken = next.acknowledged.revisionToken;
            publishAcknowledgedProfile(durable.profileId);
            setDirty(false);
          }
        },
      });
      setProfileUpgradeIntent(intent);

      if (intent.status === "blocked") {
        if (intent.failure.kind === "conflict") conflictRef.current = true;
        publishAcknowledgedProfile(durable.profileId);
        setSaveState(
          intent.failure.kind === "conflict" ? "CONFLICT" : "ERROR",
        );
        setNotice(
          intent.recovery === "RETRY_SAME_STEP"
            ? `Kết nối gián đoạn sau ${intent.acknowledgedSteps.length}/${intent.plannedSteps.length} bước. Tiến độ đã xác nhận được giữ nguyên; có thể thử lại.`
            : intent.recovery === "REAUTHENTICATE_AND_RETRY"
              ? "Phiên đăng nhập đã hết hạn. Tiến độ đã xác nhận được giữ nguyên; đăng nhập lại rồi thử lại."
              : intent.recovery === "RELOAD_AND_REPLAN"
                ? "Bản đã lưu vừa thay đổi. Không có thành phần nào được tạo; hãy tải lại rồi chọn lại."
                : "Máy chủ từ chối bước chuẩn bị. Không có thành phần nào được tạo.",
        );
        return;
      }

      if (intent.status === "completed") {
        setSaveState("ACKNOWLEDGED");
        setDirty(false);
        profileUpgradeRequestRef.current = false;
        profileUpgradeAutoStartedRef.current = null;
        setProfileUpgradeItem(null);
        setProfileUpgradeIntent(null);
        runAvailableLauncherIntent(
          target.item,
          target.mode,
          target.activation,
        );
      }
    } catch {
      publishAcknowledgedProfile(durable.profileId);
      setSaveState("ERROR");
      profileUpgradeRequestRef.current = false;
      profileUpgradeAutoStartedRef.current = null;
      setProfileUpgradeItem(null);
      setProfileUpgradeIntent(null);
      setNotice(
        "Không thể hoàn tất chuẩn bị công cụ. Tiến độ đã lưu gần nhất được giữ nguyên và không có thành phần nào được tạo.",
      );
    } finally {
      saveInFlightRef.current = false;
      profileUpgradeInFlightRef.current = false;
      setProfileUpgradeBusy(false);
    }
  };

  useEffect(() => {
    executeProfileUpgradeRef.current = () => {
      void executeProfileUpgrade();
    };
  });

  useEffect(() => {
    const dialog = profileUpgradeDialogRef.current;
    if (!dialog) return;
    if (profileUpgradeItem && !dialog.open) dialog.showModal();
    if (!profileUpgradeItem && dialog.open) dialog.close();
  }, [profileUpgradeItem]);

  useEffect(() => {
    if (!profileUpgradeItem || !profileUpgradeIntent) {
      profileUpgradeAutoStartedRef.current = null;
      return;
    }
    if (
      profileUpgradeIntent.status !== "ready" ||
      profileUpgradeBusy ||
      profileUpgradeInFlightRef.current ||
      saveInFlightRef.current ||
      saveState === "LOADING" ||
      saveState === "SAVING" ||
      profileUpgradeAutoStartedRef.current === profileUpgradeIntent.intentId
    ) {
      return;
    }
    profileUpgradeAutoStartedRef.current = profileUpgradeIntent.intentId;
    executeProfileUpgradeRef.current();
  }, [profileUpgradeBusy, profileUpgradeIntent, profileUpgradeItem, saveState]);

  const addLane = (
    location: "top" | "bottom" | "left" | "right",
  ) => {
    const modeler = modelerRef.current;
    if (
      !modeler ||
      !isCollaborationBpmnProfileId(profileIdRef.current) ||
      (!isParticipant(selected) && !isLane(selected))
    ) {
      setNotice("Chọn một bên tham gia có quy trình hoặc vùng vai trò trước khi thêm vùng.");
      return;
    }
    try {
      const context: Record<string, unknown> = {
        target: selected!,
        location,
      };
      getService(modeler, "commandStack").execute(
        "teb.collaboration.addLaneAndReflow",
        context,
      );
      const lane = context.newLane as CanvasElement | undefined;
      if (lane) getService(modeler, "selection").select(lane);
      const locationLabel = {
        top: "phía trên",
        bottom: "phía dưới",
        left: "bên trái",
        right: "bên phải",
      }[location];
      setNotice(
        `Đã thêm vùng vai trò ${locationLabel}. Có thể hoàn tác một lần.`,
      );
    } catch {
      setNotice("Không thể thêm vùng vai trò vào bên chỉ trao đổi thông điệp hoặc phần tử đã chọn.");
    }
  };

  const enableNestedProfile = async () => {
    if (
      profileIdRef.current !== collaborationBpmnProfile.id ||
      saveState === "SAVING"
    )
      return;
    profileIdRef.current = collaborationNestedBpmnProfile.id;
    setModelProfileId(collaborationNestedBpmnProfile.id);
    setNestedProfileAcknowledged(false);
    editSequenceRef.current += 1;
    setDirty(true);
    setSaveState("DIRTY");
    setNotice(
      "Đang mở phân vai hai cấp; các thao tác mới sẽ dùng được sau khi lưu xong.",
    );
    const acknowledged = await persistCurrent();
    if (acknowledged) {
      setNestedProfileAcknowledged(true);
      const modeler = modelerRef.current;
      if (modeler) await refreshProjection(modeler);
      setNotice(
        "Đã mở phân vai hai cấp. Các bản đã lưu trước đó không thay đổi.",
      );
    }
  };

  const openRoleDialog = (
    trigger: HTMLButtonElement,
    mode: "CREATE_CHILDREN" | "ADD_CHILD",
  ) => {
    if (!isLane(selected)) return;
    roleDialogTriggerRef.current = trigger;
    setRoleDialogMode(mode);
    setRoleDialogTargetId(selected.id);
    setRoleCount(2);
    setRoleNames(["", "", ""]);
    roleDialogRef.current?.showModal();
  };

  const confirmRoleDialog = () => {
    const modeler = modelerRef.current;
    const target = modeler
      ? getService(modeler, "elementRegistry").get(roleDialogTargetId)
      : undefined;
    if (
      !modeler ||
      !supportsNestedLanes(profileIdRef.current) ||
      !nestedProfileAcknowledged ||
      !isLane(target)
    ) {
      setNotice(
        "Hãy chọn một vùng vai trò trong sơ đồ đã bật phân vai hai cấp và được lưu xong.",
      );
      return;
    }
    if (laneDepth(target) >= maxCollaborationLaneDepth) {
      setNotice("Sơ đồ hỗ trợ tối đa hai cấp vùng vai trò.");
      return;
    }
    const childLanes = (target.children ?? []).filter(isLane);
    const submittedNames =
      roleDialogMode === "CREATE_CHILDREN"
        ? roleNames.slice(0, roleCount)
        : roleNames.slice(0, 1);
    if (
      submittedNames.some(
        (name) => assessChildRoleName(name).error !== undefined,
      )
    ) return;
    try {
      const context: Record<string, unknown> = {
        target,
        expectedTargetId: roleDialogTargetId,
      };
      if (roleDialogMode === "CREATE_CHILDREN") {
        if (childLanes.length > 0) return;
        context.count = roleCount;
        context.names = submittedNames.map(normalizeChildRoleName);
        getService(modeler, "commandStack").execute(
          "teb.collaboration.splitLaneAndAssign",
          context,
        );
        const created = context.childLanes as CanvasElement[] | undefined;
        if (created?.[0]) getService(modeler, "selection").select(created[0]);
        setNotice(
          `Đã tạo ${roleCount} vai trò con có tên. Có thể hoàn tác một lần.`,
        );
      } else {
        if (
          childLanes.length < 2 ||
          childLanes.length >= maxChildRoleLanes
        ) return;
        context.name = normalizeChildRoleName(submittedNames[0]!);
        getService(modeler, "commandStack").execute(
          "teb.collaboration.addNamedChildRole",
          context,
        );
        const created = context.newLane as CanvasElement | undefined;
        if (created) getService(modeler, "selection").select(created);
        setNotice(
          `Đã thêm vai trò ${context.name as string} ở cuối nhóm. Có thể hoàn tác một lần.`,
        );
      }
      roleDialogRef.current?.close();
    } catch {
      setNotice(
        "Không thể cập nhật vai trò; sơ đồ và khả năng hoàn tác không đổi.",
      );
    }
  };

  const updateSelectedProcessName = () => {
    const modeler = modelerRef.current;
    const processRef = selected?.businessObject?.processRef;
    if (!modeler || !selected || !isParticipant(selected) || !processRef)
      return;
    getService(modeler, "commandStack").execute(
      "element.updateModdleProperties",
      {
        element: selected,
        moddleElement: processRef,
        properties: { name: processName.trim() },
      },
    );
    setNotice("Đã đổi tên quy trình. Có thể hoàn tác một lần.");
  };

  const updateSelectedName = () => {
    const modeler = modelerRef.current;
    if (
      !modeler ||
      !selected ||
      !supportsEditableBpmnName(selected.type)
    ) {
      return;
    }
    getService(modeler, "modeling").updateProperties(selected, {
      name: elementName.trim(),
    });
    setNotice(`Đã đổi tên ${selectedLabel(selected)}.`);
  };

  const applyAnnotationText = () => {
    const modeler = modelerRef.current;
    if (!modeler || selected?.type !== "bpmn:TextAnnotation") return;
    const error = bpmnAnnotationTextError(annotationText);
    if (error) {
      setNotice(error);
      return;
    }
    getService(modeler, "modeling").updateProperties(selected, {
      text: annotationText,
      textFormat: "text/plain",
    });
    annotationTextSnapshotRef.current = annotationText;
    annotationTextDraftRef.current = annotationText;
    setNotice("Đã lưu nội dung chú thích.");
  };

  const applyGroupTitle = () => {
    const modeler = modelerRef.current;
    const categoryValue = selected?.businessObject?.categoryValueRef;
    const title = groupTitle.trim();
    const error = bpmnGroupTitleError(groupTitle);
    const registryEntry = categoryRegistry.find(
      (entry) => entry.categoryValueId === categoryValue?.id,
    );
    if (
      !modeler ||
      selected?.type !== "bpmn:Group" ||
      !categoryValue ||
      error
    ) {
      setNotice(error ?? "Chưa thể tìm thấy tiêu đề của nhóm này.");
      return;
    }
    if (registryEntry?.hasUnknownReferences) {
      setNotice(
        "Không thể đổi tiêu đề vì nhóm còn được dùng ở vị trí ứng dụng chưa hỗ trợ.",
      );
      return;
    }
    getService(modeler, "commandStack").execute(
      "teb.documentation.renameGroupTitle",
      { element: selected, title },
    );
    groupTitleSnapshotRef.current = title;
    groupTitleDraftRef.current = title;
    setGroupTitle(title);
    setNotice(
      registryEntry && registryEntry.referenceCount > 1
        ? `Đã đổi tiêu đề cho ${registryEntry.referenceCount} nhóm dùng chung.`
        : "Đã lưu tiêu đề nhóm.",
    );
  };

  const applyElementColor = (colorId: BpmnElementColorId | null) => {
    const modeler = modelerRef.current;
    if (
      !modeler ||
      !selected ||
      !supportsFullAuthoring(profileIdRef.current) ||
      !supportsBpmnElementColor(selected.type)
    ) {
      return;
    }
    const targets = getService(modeler, "selection").get();
    const count = applyBpmnBulkColor(getService(modeler, "commandStack"), targets, colorId);
    setNotice(colorId ? `Đã áp dụng màu cho ${count} thành phần. Có thể hoàn tác trong một lần.` : `Đã dùng màu mặc định cho ${count} thành phần.`);
  };

  const applySelectedSequenceFlowRouting = () => {
    const modeler = modelerRef.current;
    if (
      !modeler ||
      selected?.type !== "bpmn:SequenceFlow" ||
      !conditionalProfileAcknowledged ||
      !supportsConditionalRouting(profileIdRef.current)
    ) {
      setNotice(
        "Điều kiện rẽ nhánh chỉ dùng được sau khi kiểu sơ đồ đã lưu và có đường nối phù hợp.",
      );
      return;
    }
    const source = getService(modeler, "elementRegistry").get(
      firstReferenceId(selected.businessObject?.sourceRef) ?? "",
    );
    if (
      source?.type !== "bpmn:ExclusiveGateway" &&
      source?.type !== "bpmn:InclusiveGateway"
    ) {
      setNotice(
        "Điều kiện và nhánh mặc định chỉ áp dụng cho đường đi ra từ điểm chọn một hoặc nhiều hướng.",
      );
      return;
    }
    const error = sequenceFlowRoutingError(routingDraft);
    if (error) {
      setNotice(error);
      return;
    }
    const normalized = normalizeSequenceFlowRouting(routingDraft);
    getService(modeler, "commandStack").execute(
      "teb.routing.configureSequenceFlow",
      {
        flow: selected,
        source,
        condition: normalized.condition,
        isDefault: normalized.isDefault,
      },
    );
    routingSnapshotRef.current = normalized;
    setRoutingDraft(normalized);
    setNotice(
      normalized.isDefault
        ? "Đã đặt đường nối làm nhánh mặc định. Có thể hoàn tác một lần."
        : "Đã áp dụng điều kiện cho đường nối. Có thể hoàn tác một lần.",
    );
  };

  const applySelectedMessageReference = () => {
    const modeler = modelerRef.current;
    if (
      !modeler ||
      !selected ||
      !catchingEventsProfileAcknowledged ||
      (selected.type !== "bpmn:ReceiveTask" &&
        !(
          [
            "bpmn:IntermediateCatchEvent",
            "bpmn:IntermediateThrowEvent",
            "bpmn:BoundaryEvent",
          ].includes(selected.type) &&
          selected.businessObject?.eventDefinitions?.[0]?.$type ===
            "bpmn:MessageEventDefinition"
        ))
    ) {
      return;
    }
    if (messagePickerMode === "EXISTING") {
      const businessObject = selected.businessObject as
        | Record<string, unknown>
        | undefined;
      const definitions = findDefinitions(businessObject);
      const message = (
        (definitions?.rootElements as Record<string, unknown>[]) ?? []
      ).find(
        (root) =>
          root.$type === "bpmn:Message" && root.id === selectedMessageId,
      );
      if (!message) {
        setNotice("Thông điệp đã chọn không còn tồn tại. Hãy tải lại danh sách.");
        return;
      }
      getService(modeler, "commandStack").execute(
        "teb.events.configureMessageReference",
        { element: selected, message },
      );
      setNotice(
        "Đã dùng lại thông điệp hiện có; tên dùng chung không đổi.",
      );
      return;
    }
    const error = bpmnMessageNameError(messageName);
    if (error) {
      setNotice(error);
      return;
    }
    const normalized = messageName.trim();
    getService(modeler, "commandStack").execute(
      "teb.events.configureMessageReference",
      { element: selected, name: normalized },
    );
    messageNameSnapshotRef.current = normalized;
    setMessageName(normalized);
    setNotice("Đã tạo và gán thông điệp mới. Có thể hoàn tác một lần.");
  };

  const renameRegistryMessage = () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const anchor =
      selected ?? getService(modeler, "elementRegistry").getAll()[0];
    if (!anchor) return;
    const error = bpmnMessageNameError(registryRenameName);
    if (error) {
      setNotice(error);
      return;
    }
    const definitions = findDefinitions(
      anchor.businessObject as Record<string, unknown> | undefined,
    );
    const message = (
      (definitions?.rootElements as Record<string, unknown>[]) ?? []
    ).find(
      (root) =>
        root.$type === "bpmn:Message" && root.id === registryRenameId,
    );
    if (!message) {
      setNotice("Thông điệp cần đổi tên không còn tồn tại.");
      return;
    }
    getService(modeler, "commandStack").execute("teb.events.renameMessage", {
      element: anchor,
      message,
      name: registryRenameName.trim(),
    });
    setNotice(
      `Đã đổi tên thông điệp dùng chung tại ${messageRegistry.find((item) => item.id === registryRenameId)?.referenceCount ?? 0} nơi sử dụng.`,
    );
  };

  const openCleanupDialog = () => {
    const candidates = orphanMessageEntries(messageRegistry);
    setCleanupSnapshot(candidates);
    cleanupDialogRef.current?.showModal();
  };

  const confirmMessageCleanup = () => {
    const modeler = modelerRef.current;
    const anchor = modeler
      ? selected ?? getService(modeler, "elementRegistry").getAll()[0]
      : undefined;
    if (!modeler || !anchor) return;
    const intent = {
      candidateIds: cleanupSnapshot.map((entry) => entry.id),
      expectedReferenceCounts: Object.fromEntries(
        cleanupSnapshot.map((entry) => [entry.id, entry.referenceCount]),
      ),
    };
    const liveRegistry = projectLiveMessageRegistry(modeler, messageRegistry);
    const plan = planMessageCleanup(liveRegistry, intent);
    if (!plan.accepted) {
      cleanupDialogRef.current?.close();
      cleanupTriggerRef.current?.focus();
      setNotice(
        "Danh sách thông điệp vừa thay đổi hoặc còn liên kết chưa xác định; không thông điệp nào bị xoá.",
      );
      return;
    }
    const definitions = findDefinitions(
      anchor.businessObject as Record<string, unknown> | undefined,
    );
    if (!definitions) return;
    const deleteIds = new Set(plan.deleteIds);
    const rootElements =
      (definitions.rootElements as Record<string, unknown>[]) ?? [];
    if (
      plan.deleteIds.some(
        (id) =>
          !rootElements.some(
            (root) => root.$type === "bpmn:Message" && root.id === id,
          ),
      )
    ) {
      cleanupDialogRef.current?.close();
      cleanupTriggerRef.current?.focus();
      setNotice(
        "Danh sách thông điệp vừa thay đổi; không thông điệp nào bị xoá.",
      );
      return;
    }
    getService(modeler, "modeling").updateModdleProperties(
      anchor,
      definitions,
      {
        rootElements: rootElements.filter(
          (root) =>
            root.$type !== "bpmn:Message" ||
            !deleteIds.has(String(root.id)),
        ),
      },
    );
    cleanupDialogRef.current?.close();
    cleanupTriggerRef.current?.focus();
    setNotice(
      `Đã xoá ${plan.deleteIds.length} thông điệp không còn sử dụng.`,
    );
  };

  const openDataStoreCleanupDialog = (trigger: HTMLButtonElement) => {
    const revisionToken = durableModelRef.current?.revisionToken;
    if (!revisionToken) {
      setNotice("Chưa có bản lưu ổn định để dọn kho dữ liệu.");
      return;
    }
    const entries = dataStoreRegistry.filter(
      (entry) =>
        entry.referenceCount === 0 && !entry.hasUnknownReferences,
    );
    dataStoreCleanupTriggerRef.current = trigger;
    setDataStoreCleanupSnapshot({ revisionToken, entries });
    dataStoreCleanupDialogRef.current?.showModal();
  };

  const confirmDataStoreCleanup = async () => {
    const modeler = modelerRef.current;
    if (!modeler || !dataStoreCleanupSnapshot) return;
    try {
      const { xml } = await modeler.saveXML({ format: true });
      if (!xml) throw new Error("No XML");
      const inspection = await inspectXml(xml, profileIdRef.current);
      const currentRegistry = inspection.dataStoreRegistry ?? [];
      const currentRevisionToken = durableModelRef.current?.revisionToken;
      if (!currentRevisionToken) throw new Error("No revision");
      const entries = dataStoreCleanupSnapshot.entries;
      const plan = planDataStoreCleanupCommand(currentRegistry, {
        action: "DELETE",
        expectedRevisionToken: dataStoreCleanupSnapshot.revisionToken,
        currentRevisionToken,
        candidateStoreIds: entries.map((entry) => entry.dataStoreId),
        expectedReferenceCounts: Object.fromEntries(
          entries.map((entry) => [
            entry.dataStoreId,
            entry.referenceCount,
          ]),
        ),
        expectedReferenceIds: Object.fromEntries(
          entries.map((entry) => [
            entry.dataStoreId,
            [...entry.referenceIds].sort(),
          ]),
        ),
      });
      if (!plan.accepted) {
        dataStoreCleanupDialogRef.current?.close();
        setNotice(
          "Danh sách kho dữ liệu vừa thay đổi; thao tác xoá đã được huỷ.",
        );
        return;
      }
      const registry = getService(modeler, "elementRegistry");
      const anchor =
        selected ?? registry.getAll().find((element) => element.businessObject);
      const definitions = findDefinitions(
        anchor?.businessObject as Record<string, unknown> | undefined,
      );
      if (!anchor || !definitions) throw new Error("No Definitions");
      const deleteIds = new Set(plan.deleteDataStoreIds);
      const roots =
        (definitions.rootElements as Record<string, unknown>[]) ?? [];
      getService(modeler, "modeling").updateModdleProperties(
        anchor,
        definitions,
        {
          rootElements: roots.filter(
            (root) =>
              root.$type !== "bpmn:DataStore" ||
              !deleteIds.has(String(root.id)),
          ),
        },
      );
      dataStoreCleanupDialogRef.current?.close();
      setNotice(
        `Đã xoá ${plan.deleteDataStoreIds.length} kho dữ liệu không dùng. Có thể hoàn tác một lần.`,
      );
    } catch {
      dataStoreCleanupDialogRef.current?.close();
      setNotice("Chưa thể xoá kho dữ liệu; danh sách được giữ nguyên.");
    }
  };

  const applySelectedTimer = () => {
    const modeler = modelerRef.current;
    if (
      !modeler ||
      !["bpmn:IntermediateCatchEvent", "bpmn:BoundaryEvent"].includes(
        selected?.type ?? "",
      ) ||
      selected?.businessObject?.eventDefinitions?.[0]?.$type !==
        "bpmn:TimerEventDefinition" ||
      !catchingEventsProfileAcknowledged
    ) {
      return;
    }
    const error = bpmnTimerDraftError(timerDraft);
    if (error) {
      setNotice(error);
      return;
    }
    const normalized = normalizeBpmnTimerDraft(timerDraft);
    getService(modeler, "commandStack").execute("teb.events.configureTimer", {
      element: selected,
      kind: normalized.kind,
      value: normalized.value,
    });
    timerSnapshotRef.current = normalized;
    setTimerDraft(normalized);
    setNotice("Đã áp dụng thời gian chờ. Có thể hoàn tác một lần.");
  };

  const setBoundaryInterrupting = (cancelActivity: boolean) => {
    const modeler = modelerRef.current;
    if (!modeler || selected?.type !== "bpmn:BoundaryEvent") return;
    getService(modeler, "modeling").updateProperties(selected, {
      cancelActivity,
    });
    setNotice(
      cancelActivity
        ? "Sự kiện tại biên sẽ dừng công việc đang chạy."
        : "Sự kiện tại biên không dừng công việc đang chạy.",
    );
  };

  const focusBoundaryHost = () => {
    const modeler = modelerRef.current;
    const hostId =
      selected?.businessObject?.attachedToRef?.id ?? selected?.host?.id;
    if (!modeler || !hostId) {
      setNotice("Sự kiện tại biên chưa gắn với công việc phù hợp.");
      return;
    }
    const host = getService(modeler, "elementRegistry").get(hostId);
    if (!host) return;
    getService(modeler, "selection").select(host);
    getService(modeler, "canvas").scrollToElement(host);
  };

  const reparentBlockLabel = (reason: string) =>
    ({
      CROSS_CONTAINER_CONNECTOR:
        "Đường nối sẽ vượt ra ngoài vùng hiện tại; ứng dụng không tự nối lại.",
      CROSS_CONTAINER_DATA_ASSOCIATION:
        "Đường dữ liệu sẽ vượt ra ngoài vùng hiện tại; hãy xử lý đường nối trước.",
      TARGET_LANE_REQUIRED: "Cần chọn vùng vai trò con phù hợp khi chuyển phần tử.",
      INVALID_TARGET_LANE: "Vùng vai trò đích không còn phù hợp.",
      STALE_REVISION: "Bản đã lưu vừa thay đổi; hãy mở phần xem trước mới.",
      STALE_CLOSURE: "Các sự kiện đi cùng đã thay đổi.",
      STALE_REFERENCES: "Các liên kết đi cùng đã thay đổi.",
    })[reason] ?? `Không thể di chuyển: ${reason}.`;

  const evaluateReparentTarget = (
    preview: ReparentImpact,
    targetId: string,
    targetLaneId: string,
    snapshot = lifecycleSnapshot,
    revisionToken = reparentRevisionToken,
  ) => {
    if (!snapshot || !targetId || !revisionToken) {
      setReparentBlockers([]);
      return;
    }
    const target = preview.eligibleTargets.find(
      (candidate) => candidate.containerId === targetId,
    );
    const plan = planFlowNodeReparentCommand(snapshot, {
      selectedElementId: preview.selectedElementId,
      expectedSourceContainerId: preview.sourceContainerId,
      targetContainerId: targetId,
      expectedRevisionToken: revisionToken,
      currentRevisionToken: revisionToken,
      expectedClosureIds: preview.closureIds,
      expectedReferenceIds: preview.referenceIds,
      ...(target?.requiresTargetLeafLane && targetLaneId
        ? { targetLaneId }
        : target?.inheritedLaneId
          ? { targetLaneId: target.inheritedLaneId }
          : {}),
    });
    setReparentBlockers(plan.accepted ? [] : [reparentBlockLabel(plan.reason)]);
  };

  const openReparentDialog = (
    trigger: HTMLButtonElement,
    element: CanvasElement,
  ) => {
    const revisionToken = durableModelRef.current?.revisionToken;
    if (!lifecycleSnapshot || !revisionToken) {
      setNotice("Chưa có dữ liệu sơ đồ ổn định để di chuyển vùng chứa.");
      return;
    }
    const preview = projectFlowNodeReparentImpact(
      lifecycleSnapshot,
      element.id,
    );
    if (!preview || preview.eligibleTargets.length === 0) {
      setNotice("Phần tử này không có vùng đích phù hợp trong cùng quy trình.");
      return;
    }
    reparentTriggerRef.current = trigger;
    setReparentPreview(preview);
    setReparentRevisionToken(revisionToken);
    setReparentTargetId("");
    setReparentTargetLaneId("");
    setReparentBlockers([]);
    setReparentTargets(
      preview.eligibleTargets.map((target) => {
        const projected = lifecycleSnapshot.elements.find(
          (element) => element.id === target.containerId,
        );
        return {
          id: target.containerId,
          label:
            projected?.name ||
            (target.type === "bpmn:Process"
              ? "Quy trình chính"
              : "Quy trình con mở rộng"),
          detail: target.containerId,
        };
      }),
    );
    setReparentImpact([
      { label: "Phần tử đi cùng", ids: preview.closureIds },
      { label: "Liên kết đi cùng", ids: preview.referenceIds },
      {
        label: "Sự kiện gắn kèm",
        ids: preview.attachedBoundaryEventIds,
      },
    ]);
    reparentDialogRef.current?.showModal();
  };

  const confirmReparent = async () => {
    const modeler = modelerRef.current;
    if (!modeler || !reparentPreview || !reparentTargetId) return;
    try {
      const { xml } = await modeler.saveXML({ format: true });
      if (!xml) throw new Error("No XML");
      const inspection = await inspectXml(xml, profileIdRef.current);
      const snapshot = inspection.snapshot as
        | SubProcessLifecycleSnapshot
        | undefined;
      const currentRevisionToken = durableModelRef.current?.revisionToken;
      if (!snapshot || !currentRevisionToken) throw new Error("No snapshot");
      const target = reparentPreview.eligibleTargets.find(
        (candidate) => candidate.containerId === reparentTargetId,
      );
      const plan = planFlowNodeReparentCommand(snapshot, {
        selectedElementId: reparentPreview.selectedElementId,
        expectedSourceContainerId: reparentPreview.sourceContainerId,
        targetContainerId: reparentTargetId,
        expectedRevisionToken: reparentRevisionToken,
        currentRevisionToken,
        expectedClosureIds: reparentPreview.closureIds,
        expectedReferenceIds: reparentPreview.referenceIds,
        ...(target?.requiresTargetLeafLane && reparentTargetLaneId
          ? { targetLaneId: reparentTargetLaneId }
          : target?.inheritedLaneId
            ? { targetLaneId: target.inheritedLaneId }
            : {}),
      });
      if (!plan.accepted) {
        reparentDialogRef.current?.close();
        setNotice(`${reparentBlockLabel(plan.reason)} Phần xem trước đã được đóng.`);
        return;
      }
      const registry = getService(modeler, "elementRegistry");
      const moving = registry.get(plan.selectedElementId);
      const containerTarget = registry.get(plan.targetContainerId);
      const laneTarget = plan.targetLaneId
        ? registry.get(plan.targetLaneId)
        : undefined;
      const visualTarget =
        containerTarget?.type === "bpmn:SubProcess"
          ? containerTarget
          : laneTarget ?? containerTarget;
      if (!moving || !visualTarget) throw new Error("Missing live shape");
      const delta =
        visualTarget.type === "bpmn:SubProcess"
          ? {
              x:
                (visualTarget.x ?? 0) +
                (visualTarget.width ?? 0) / 2 -
                ((moving.x ?? 0) + (moving.width ?? 0) / 2),
              y:
                (visualTarget.y ?? 0) +
                (visualTarget.height ?? 0) / 2 -
                ((moving.y ?? 0) + (moving.height ?? 0) / 2),
            }
          : { x: 0, y: 0 };
      getService(modeler, "modeling").moveElements(
        [moving],
        delta,
        visualTarget,
      );
      reparentDialogRef.current?.close();
      getService(modeler, "selection").select(moving);
      setNotice(
        "Đã di chuyển phần tử và giữ nguyên các liên kết. Có thể hoàn tác một lần.",
      );
    } catch {
      reparentDialogRef.current?.close();
      setNotice("Không thể di chuyển phần tử; sơ đồ hiện tại được giữ nguyên.");
    }
  };

  const deleteSelected = useCallback(() => {
    const modeler = modelerRef.current;
    const revisionToken = durableModelRef.current?.revisionToken;
    if (!modeler || !selected || !revisionToken) return;
    if (isLane(selected) && (selected.children ?? []).some(isLane)) {
      setNotice(
        "Chưa thể xoá vùng vai trò cha khi vẫn còn vùng con. Hãy chuyển hoặc xoá các vùng con trước.",
      );
      return;
    }
    deleteImpactTriggerRef.current = cascadeTriggerRef.current;
    if (selected.type === "bpmn:SubProcess") {
      if (!lifecycleSnapshot) {
        setNotice("Chưa có đủ thông tin để xem nội dung sẽ bị xoá.");
        return;
      }
      const impact = projectSubProcessDeleteImpact(
        lifecycleSnapshot,
        selected.id,
        revisionToken,
      );
      if (!impact) {
        setNotice("Quy trình con không còn trong sơ đồ hiện tại.");
        return;
      }
      setGenericDeleteSnapshot(null);
      setDeleteImpactSnapshot(impact);
      deleteImpactDialogRef.current?.showModal();
      return;
    }
    const impactIds = canvasDeleteImpactIds(selected);
    setDeleteImpactSnapshot(null);
    setGenericDeleteSnapshot({
      elementId: selected.id,
      revisionToken,
      impactIds,
      groups: [
        { label: "Phần tử này và nội dung bên trong", ids: impactIds },
        {
          label: "Sự kiện gắn kèm",
          ids: (selected.attachers ?? [])
            .filter((item) => item.type === "bpmn:BoundaryEvent")
            .map((item) => item.id)
            .sort(),
        },
      ],
    });
    deleteImpactDialogRef.current?.showModal();
  }, [lifecycleSnapshot, selected]);

  const confirmDeleteImpact = async () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      const currentRevisionToken = durableModelRef.current?.revisionToken;
      if (!currentRevisionToken) throw new Error("No revision");
      const registry = getService(modeler, "elementRegistry");
      if (deleteImpactSnapshot) {
        const { xml } = await modeler.saveXML({ format: true });
        if (!xml) throw new Error("No XML");
        const inspection = await inspectXml(xml, profileIdRef.current);
        const snapshot = inspection.snapshot as
          | SubProcessLifecycleSnapshot
          | undefined;
        if (!snapshot) throw new Error("No snapshot");
        const plan = planSubProcessDeleteCommand(snapshot, {
          action: "CASCADE",
          subProcessId: deleteImpactSnapshot.subProcessId,
          expectedRevisionToken: deleteImpactSnapshot.revisionToken,
          currentRevisionToken,
          expectedDeleteElementIds: deleteImpactSnapshot.deleteElementIds,
          expectedRetainedRootRegistryIds:
            deleteImpactSnapshot.retainedRootRegistryIds,
        });
        if (!plan.accepted) {
          deleteImpactDialogRef.current?.close();
          setNotice(
            "Nội dung bị ảnh hưởng vừa thay đổi; không phần tử nào bị xoá.",
          );
          return;
        }
        const subProcess = registry.get(deleteImpactSnapshot.subProcessId);
        if (!subProcess) throw new Error("Missing SubProcess");
        getService(modeler, "modeling").removeElements([subProcess]);
      } else if (genericDeleteSnapshot) {
        if (
          genericDeleteSnapshot.revisionToken !== currentRevisionToken
        ) {
          deleteImpactDialogRef.current?.close();
          setNotice("Bản đã lưu vừa thay đổi; hãy xem lại ảnh hưởng trước khi xoá.");
          return;
        }
        const live = registry.get(genericDeleteSnapshot.elementId);
        if (
          !live ||
          JSON.stringify(canvasDeleteImpactIds(live)) !==
            JSON.stringify(genericDeleteSnapshot.impactIds)
        ) {
          deleteImpactDialogRef.current?.close();
          setNotice("Nội dung bị ảnh hưởng vừa thay đổi; không phần tử nào bị xoá.");
          return;
        }
        getService(modeler, "modeling").removeElements([live]);
      } else {
        return;
      }
      deleteImpactDialogRef.current?.close();
      setSelected(null);
      setElementName("");
      setNotice("Đã xoá các nội dung đã xác nhận. Có thể hoàn tác một lần.");
    } catch {
      deleteImpactDialogRef.current?.close();
      setNotice("Không thể xoá; sơ đồ hiện tại được giữ nguyên.");
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (restoreFenceRef.current.pending) { event.preventDefault(); return; }
      if (event.key === "Escape") {
        const lifecycleDialog =
          document.querySelector<HTMLDialogElement>(
            "dialog.bpmn-lifecycle-dialog[open]",
          );
        if (lifecycleDialog) {
          event.preventDefault();
          event.stopPropagation();
          lifecycleDialog.close();
          return;
        }
        if (document.querySelector<HTMLDialogElement>("dialog[open]")) return;
        if (armedLauncherItem) {
          event.preventDefault();
          event.stopPropagation();
          setArmedLauncherItem(null);
          pendingCreatedToolRef.current = null;
          const modeler = modelerRef.current;
          if (modeler) getService(modeler, "dragging").cancel();
          setNotice("Đã huỷ công cụ đang chọn; vùng vẽ không thay đổi.");
          return;
        }
      }
      if (
        document.querySelector<HTMLDialogElement>("dialog[open]") ||
        profileUpgradeRequestRef.current ||
        profileUpgradeInFlightRef.current
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const intent = resolveBpmnKeyboardIntent({
        key: event.key,
        ctrlOrMeta: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
        isComposing: event.isComposing,
        isTextEditing: Boolean(
          target?.closest(
            "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], [role='listbox'], [role='option']",
          ),
        ),
        isInteractiveControl: Boolean(
          target?.closest(
            "button, a[href], summary, [role='button'], [role='tab'], [role='tablist']",
          ),
        ),
        isMobileViewer: window.matchMedia("(max-width: 767px)").matches,
        isBlocked: importing || saveState === "LOADING",
      });
      if (!intent) return;
      event.preventDefault();
      event.stopPropagation();
      if (intent.intent === "OPEN_COMPONENTS") {
        setComponentLauncherMode({ kind: "place" });
        setComponentLauncherOpen(true);
        return;
      }
      const modeler = modelerRef.current;
      if (!modeler) return;
      const editorActions = getService(modeler, "editorActions");
      if (intent.intent === "DELETE") deleteSelected();
      else if (intent.intent === "UNDO") editorActions.trigger("undo");
      else if (intent.intent === "REDO") editorActions.trigger("redo");
      else if (intent.intent === "COPY") editorActions.trigger("copy");
      else if (intent.intent === "PASTE") editorActions.trigger("paste");
      else if (intent.intent === "DUPLICATE")
        editorActions.trigger("duplicate");
      else if (intent.intent === "ZOOM_IN")
        editorActions.trigger("stepZoom", { value: 1 });
      else if (intent.intent === "ZOOM_OUT")
        editorActions.trigger("stepZoom", { value: -1 });
      else if (intent.intent === "ZOOM_RESET")
        editorActions.trigger("zoom", { value: 1 });
      else if (intent.intent === "HAND_MODE") editorActions.trigger("handTool");
      else if (intent.intent === "CONNECT_MODE")
        editorActions.trigger("globalConnectTool");
      else if (intent.intent === "SELECT_MODE") {
        getService(modeler, "selection").select([]);
        setNotice("Đã về chế độ chọn.");
      } else if (intent.intent === "FIT_PROCESS") fitCanvas();
      else if (intent.intent === "FIT_SELECTION") {
        if (selected) getService(modeler, "canvas").scrollToElement(selected);
      } else if (intent.intent === "CANCEL") {
        connectArmedRef.current = false;
        connectSourceIdRef.current = null;
        pendingConnectionToolRef.current = null;
        pendingCreatedToolRef.current = null;
        setConnectArmed(false);
        setConnectSourceId(null);
        setArmedLauncherItem(null);
        getService(modeler, "dragging").cancel();
        getService(modeler, "selection").select([]);
      } else if (
        selected &&
        selected.parent &&
        intent.intent.startsWith("MOVE_")
      ) {
        const distance = intent.accelerated ? 25 : 5;
        const delta =
          intent.intent === "MOVE_LEFT"
            ? { x: -distance, y: 0 }
            : intent.intent === "MOVE_RIGHT"
              ? { x: distance, y: 0 }
              : intent.intent === "MOVE_UP"
                ? { x: 0, y: -distance }
                : { x: 0, y: distance };
        getService(modeler, "modeling").moveElements(
          [selected],
          delta,
          selected.parent,
        );
      }
    };
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [armedLauncherItem, deleteSelected, importing, saveState, selected]);

  const runInspection = async () => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    setNotice("Đang kiểm tra sơ đồ…");
    await refreshProjection(modeler);
    setInspectorView("navigation");
  };

  const openVersionComposer = () => {
    setInspectorView("versions");
    setInspectorCollapsed(false);
    window.requestAnimationFrame(() => versionNoteRef.current?.focus());
  };

  const createVersion = async () => {
    const durable = durableModelRef.current;
    if (!durable || dirty || saveInFlightRef.current || saveState === "SAVING" || versionInFlightRef.current || restoreFenceRef.current.pending || pendingVersionCommandRef.current?.restoreSequence !== undefined) {
      setNotice(
        "Hãy đợi bản nháp được lưu xong trước khi tạo mốc.",
      );
      return;
    }
    const note = versionNote.trim();
    if (!note) {
      setNotice("Nhập ghi chú để mô tả mốc này.");
      return;
    }
    setVersioning(true);
    setNotice("Đang lưu mốc từ bản nháp đã xác nhận…");
    versionInFlightRef.current = true;
    const fingerprint = `${durable.revisionToken}:${note}`;
    const pendingCommand =
      pendingVersionCommandRef.current?.fingerprint === fingerprint
        ? pendingVersionCommandRef.current
        : {
            fingerprint,
            idempotencyKey: `create-version:${crypto.randomUUID()}`,
          };
    pendingVersionCommandRef.current = pendingCommand;
    try {
      const result = await persistence.createVersion({
        idempotencyKey: pendingCommand.idempotencyKey,
        modelId: durable.modelId,
        revisionToken: durable.revisionToken,
        note,
      });
      if (result.kind === "acknowledged" || result.kind === "idempotent") {
        pendingVersionCommandRef.current = null;
        durable.revisionToken = result.revisionToken;
        setVersionCount(result.versionNumber);
        setVersionNote("");
        setNotice(
          `Đã lưu mốc ${result.versionNumber}; bản nháp hiện tại không bị thay đổi.`,
        );
        try {
          setVersions(await persistence.listVersions(durable.modelId));
        } catch {
          setNotice(
            `Đã lưu mốc ${result.versionNumber}; danh sách sẽ được tải lại ở lần mở sau.`,
          );
        }
        return;
      }
      if (result.kind === "conflict") { conflictRef.current = true; setSaveState("CONFLICT"); }
      setNotice(
        result.kind === "conflict"
          ? "Không thể lưu mốc vì bản trên máy chủ đã thay đổi."
          : "Chưa thể lưu mốc; bản nháp hiện tại không bị thay đổi.",
      );
      if (result.kind !== "unavailable")
        pendingVersionCommandRef.current = null;
    } catch {
      setNotice(
        "Kết nối bị gián đoạn; bản nháp và các mốc trước không bị thay đổi.",
      );
    } finally {
      versionInFlightRef.current = false;
      setVersioning(false);
    }
  };

  const restoreVersion = async (version: ProcessModelVersionSummary) => {
    const durable = durableModelRef.current;
    const fingerprint = `${durable?.revisionToken}:restore:${version.id}`;
    const pendingRestore = pendingVersionCommandRef.current?.restoreSequence !== undefined;
    const retryingRestore = pendingRestore && pendingVersionCommandRef.current?.fingerprint === fingerprint;
    if (pendingRestore && !retryingRestore) {
      setNotice("Chưa xác định được lệnh khôi phục trước. Hãy thử lại đúng bản đã chọn trước khi chọn bản khác.");
      return;
    }
    if (!durable || (dirty && !retryingRestore) || saveInFlightRef.current || saveState === "SAVING" || versionInFlightRef.current || restoreFenceRef.current.pending) {
      setNotice("Hãy đợi bản nháp được lưu xong trước khi khôi phục bản đã lưu.");
      return;
    }
    if (
      !window.confirm(
        `Khôi phục bản ${version.versionNumber} thành bản nháp mới?`,
      )
    ) {
      return;
    }
    const pendingCommand =
      pendingVersionCommandRef.current?.fingerprint === fingerprint
        ? pendingVersionCommandRef.current
        : {
            fingerprint,
            idempotencyKey: `restore-version:${crypto.randomUUID()}`,
            restoreSequence: editSequenceRef.current,
          };
    const operation = restoreFenceRef.current.begin({ resourceId: durable.modelId, sequence: pendingCommand.restoreSequence ?? editSequenceRef.current, versionToken: durable.revisionToken });
    if (!operation) return;
    versionInFlightRef.current = true;
    setVersioning(true);
    setRestoring(true);
    setPendingRestoreVersionId(version.id);
    pendingVersionCommandRef.current = pendingCommand;
    setNotice(`Đang khôi phục bản ${version.versionNumber}…`);
    try {
      const result = await awaitRestoreResponse(persistence.restoreVersion({
        idempotencyKey: pendingCommand.idempotencyKey,
        modelId: durable.modelId,
        versionId: version.id,
        revisionToken: durable.revisionToken,
      }));
      if (result.kind === "acknowledged" || result.kind === "idempotent") {
        pendingVersionCommandRef.current = null;
        if (!operation.canReplace({ resourceId: durableModelRef.current?.modelId ?? null, sequence: editSequenceRef.current, versionToken: durableModelRef.current?.revisionToken ?? null })) {
          setPendingRestoreVersionId(null);
          conflictRef.current = true;
        setSaveState("CONFLICT");
          setNotice("Đã khôi phục trên máy chủ. Các chỉnh sửa mới trong tab được giữ nguyên; hãy tải sơ đồ cục bộ trước khi mở lại bản trên máy chủ.");
          return;
        }
        setNotice(
          `Đã khôi phục bản ${version.versionNumber}; đang mở bản nháp mới.`,
        );
        setPendingRestoreVersionId(null);
        allowNavigationRef.current = true;
        window.location.reload();
        return;
      }
      if (result.kind !== "unavailable")
        pendingVersionCommandRef.current = null;
      if (result.kind === "conflict") { conflictRef.current = true; setSaveState("CONFLICT"); }
      setNotice(
        result.kind === "conflict"
          ? "Không thể khôi phục vì bản trên máy chủ đã thay đổi."
          : "Chưa thể khôi phục; bản nháp hiện tại không bị thay đổi.",
      );
      if (result.kind !== "unavailable") setPendingRestoreVersionId(null);
    } catch {
      setNotice("Kết nối bị gián đoạn; có thể thử khôi phục lại cùng bản.");
    } finally {
      operation.finish();
      versionInFlightRef.current = false;
      setRestoring(false);
      setVersioning(false);
    }
  };

  const importFile = async (file: File) => {
    const modeler = modelerRef.current;
    if (!modeler || importInFlightRef.current || restoreFenceRef.current.pending) return;
    importInFlightRef.current = true;
    setImporting(true);
    const requestId = importGateRef.current.next();
    const startingImportSequence = editSequenceRef.current;
    projectionGateRef.current.invalidate();
    const previousSelectionId = selected?.id;
    if (!bpmnFileIsWithinLimit(file.size)) {
      setIssues([
        {
          ruleId: "BPMN-LIMIT-001",
          severity: "error",
          message: "Tệp quy trình vượt quá giới hạn 1 MiB.",
          recovery: "Giảm kích thước tệp trước khi mở lại.",
        },
      ]);
      setInspectorView("navigation");
      setNotice("Tệp vượt giới hạn 1 MiB nên chưa được mở.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      importInFlightRef.current = false;
      setImporting(false);
      return;
    }
    setNotice("Đang kiểm tra tệp an toàn trước khi mở…");

    try {
      const previous = await modeler.saveXML({ format: true });
      if (!previous.xml) throw new Error("Current XML unavailable.");
      const previousXml = previous.xml;
      const candidate = await file.text();
      const inspection = await inspectXml(candidate, profileIdRef.current, { fileImport: true, inferProfile: true });
      if (!importGateRef.current.isLatest(requestId)) return;
      setIssues(inspection.issues);
      setInspectorView("navigation");
      if (!inspection.accepted || !inspection.canonicalXml) {
        setNotice(`Chưa thể mở tệp: ${issueSummary(inspection.issues)}`);
        return;
      }

      try {
        await preflightXml(inspection.canonicalXml);
      } catch {
        setNotice(
          "Tệp không thể hiển thị an toàn; vùng vẽ và khả năng hoàn tác hiện tại không đổi.",
        );
        return;
      }
      if (!importGateRef.current.isLatest(requestId)) return;

      if (startingImportSequence !== editSequenceRef.current) {
        setNotice("Sơ đồ vừa được chỉnh sửa trong lúc kiểm tra tệp. Hãy mở lại tệp khi đã hoàn tất chỉnh sửa.");
        return;
      }
      if (inspection.profileId !== profileIdRef.current) {
        setImportCopyId(null);
        setImportNotice("");
        setPreparedFile({ xml: inspection.canonicalXml, profileId: inspection.profileId, title: file.name.replace(/\.(bpmn|xml)$/iu, "").slice(0, 160) || "Sơ đồ đã nhập", notices: inspection.importNotices ?? [], idempotencyKey: `import-model:${crypto.randomUUID()}` });
        setNotice("Tệp dùng khả năng BPMN khác. Có thể mở thành sơ đồ mới và giữ nguyên bản hiện tại.");
        return;
      }

      try {
        projectionGateRef.current.invalidate();
        await modeler.importXML(inspection.canonicalXml);
        if (!importGateRef.current.isLatest(requestId)) return;
        projectionGateRef.current.invalidate();
        currentXmlRef.current = inspection.canonicalXml;
        // Publish the validated import as one projection; a later worker may time out.
        applyInspectionProjection(inspection, modeler);
        const canvasBounds = canvasRef.current?.getBoundingClientRect();
        if (canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0) {
          getService(modeler, "canvas").zoom("fit-viewport");
        }
        editSequenceRef.current += 1;
        nextRevisionSourceRef.current = "IMPORTED";
        setDirty(true);
        setSaveState("DIRTY");
        scheduleAutosave();
        setNotice(
          [...(inspection.importNotices ?? []), "Đã mở tệp theo kiểu sơ đồ hiện tại và bắt đầu lịch hoàn tác mới. Bản nháp trên thiết bị chưa được lưu lên máy chủ."].join(" "),
        );
      } catch {
        await modeler.importXML(previousXml);
        if (previousSelectionId) {
          const restoredElement = getService(modeler, "elementRegistry").get(
            previousSelectionId,
          );
          if (restoredElement) {
            getService(modeler, "selection").select(restoredElement);
          }
        }
        setNotice(
          "Không thể áp dụng tệp; sơ đồ trước đã được khôi phục nhưng lịch hoàn tác đã bắt đầu lại.",
        );
      }
    } catch {
      setNotice(
        "Kiểm tra tệp mất quá nhiều thời gian hoặc bị gián đoạn; sơ đồ hiện tại không đổi.",
      );
    } finally {
      importInFlightRef.current = false;
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadDiagram = async (format: BpmnDiagramDownloadFormat) => {
    const modeler = modelerRef.current;
    if (!modeler || downloading) return;
    const startingEditSequence = editSequenceRef.current;
    const assertUnchanged = () => {
      if (editSequenceRef.current !== startingEditSequence) {
        throw Object.assign(
          new Error("The diagram changed during download preparation."),
          { code: "DIAGRAM_CHANGED" as const },
        );
      }
    };
    setDownloading(true);
    setNotice("Đang kiểm tra sơ đồ trước khi tải…");
    try {
      const { xml } = await modeler.saveXML({ format: true });
      if (!xml) throw new Error("No XML");
      assertUnchanged();
      const inspection = await inspectXml(xml, profileIdRef.current);
      assertUnchanged();
      setIssues(inspection.issues);
      if (!inspection.accepted || !inspection.canonicalXml) {
        setInspectorView("navigation");
        setInspectorCollapsed(false);
        setNotice("Chưa thể tải vì sơ đồ còn vấn đề cần xử lý.");
        return;
      }
      let blob: Blob;
      if (format === "bpmn") {
        blob = new Blob([inspection.canonicalXml], {
          type: bpmnDiagramDownloadMimeTypes.bpmn,
        });
      } else {
        const { svg } = await modeler.saveSVG();
        assertUnchanged();
        if (!svg) throw new Error("No SVG");
        const sanitized = diagramExport.sanitizeSvg(svg);
        blob =
          format === "svg"
            ? new Blob([sanitized.svg], {
                type: bpmnDiagramDownloadMimeTypes.svg,
              })
            : await diagramExport.renderPng(sanitized);
      }
      assertUnchanged();
      const filename = safeBpmnDiagramFilename(modelTitle, format);
      diagramExport.downloadBlob(blob, filename);
      setDownloadDialogOpen(false);
      setNotice(`Đã tải ${filename}. Sơ đồ đang mở không thay đổi.`);
    } catch (error) {
      setNotice(
        (error as { readonly code?: string }).code === "DIAGRAM_CHANGED"
          ? "Sơ đồ vừa thay đổi trong lúc chuẩn bị tệp. Hãy kiểm tra rồi tải lại."
          : "Chưa thể tạo tệp an toàn. Sơ đồ đang mở không thay đổi.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const selectOutlineElement = (id: string) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const element = getService(modeler, "elementRegistry").get(id);
    if (!element) return;
    if (connectArmed) {
      handleConnectionElement(element);
      return;
    }
    getService(modeler, "selection").select(element);
    getService(modeler, "canvas").scrollToElement(element);
  };

  const focusInspectionElement = (id: string) => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const element = getService(modeler, "elementRegistry").get(id);
    if (!element) {
      setNotice("Phần tử này không còn trên vùng vẽ. Hãy kiểm tra lại sơ đồ.");
      return;
    }

    connectArmedRef.current = false;
    connectSourceIdRef.current = null;
    setConnectArmed(false);
    setConnectSourceId(null);
    setArmedLauncherItem(null);
    setContextAppendOpen(false);
    setComponentLauncherOpen(false);
    setComponentLauncherMode({ kind: "place" });
    getService(modeler, "dragging").cancel();
    getService(modeler, "selection").select(element);
    getService(modeler, "canvas").scrollToElement(element);
    setNotice(
      `Đã đi tới ${selectedLabel(element)}.`,
    );
  };

  const selectedParticipant = owningParticipant(selected);
  const selectedEventDefinition =
    [
      "bpmn:IntermediateCatchEvent",
      "bpmn:IntermediateThrowEvent",
      "bpmn:BoundaryEvent",
    ].includes(selected?.type ?? "")
      ? selected?.businessObject?.eventDefinitions?.[0]
      : undefined;
  const selectedIsMessageReceiver =
    selected?.type === "bpmn:ReceiveTask" ||
    selectedEventDefinition?.$type === "bpmn:MessageEventDefinition";
  const selectedIsTimerCatch =
    selectedEventDefinition?.$type === "bpmn:TimerEventDefinition";
  const messageError = selectedIsMessageReceiver && messagePickerMode === "NEW"
    ? bpmnMessageNameError(messageName)
    : null;
  const timerError = selectedIsTimerCatch
    ? bpmnTimerDraftError(timerDraft)
    : null;
  const selectedSequenceSource =
    selected?.type === "bpmn:SequenceFlow"
      ? firstReference(selected.businessObject?.sourceRef)
      : undefined;
  const selectedSequenceTarget =
    selected?.type === "bpmn:SequenceFlow"
      ? firstReference(selected.businessObject?.targetRef)
      : undefined;
  const canEditSelectedSequenceRouting =
    conditionalProfileAcknowledged &&
    selected?.type === "bpmn:SequenceFlow" &&
    (selectedSequenceSource?.$type === "bpmn:ExclusiveGateway" ||
      selectedSequenceSource?.$type === "bpmn:InclusiveGateway");
  const routingError = canEditSelectedSequenceRouting
    ? sequenceFlowRoutingError(routingDraft)
    : null;
  const selectedParticipantLanes = selectedParticipant
    ? descendantLanes(selectedParticipant)
    : [];
  const outlineById = new Map(outline.map((item) => [item.id, item] as const));
  const filteredMessages = filterMessageRegistry(messageRegistry, messageSearch);
  const selectedRegistryMessage = messageRegistry.find(
    (entry) => entry.id === selectedMessageId,
  );
  const selectedCategory = categoryRegistry.find(
    (entry) =>
      entry.categoryValueId ===
      selected?.businessObject?.categoryValueRef?.id,
  );
  const annotationTextError = bpmnAnnotationTextError(annotationText);
  const groupTitleError = bpmnGroupTitleError(groupTitle);
  const groupTitleDescriptionIds = [
    "bpmn-group-title-help",
    groupTitleError ? "bpmn-group-title-error" : null,
    selectedCategory && selectedCategory.referenceCount > 1
      ? "bpmn-group-title-shared"
      : null,
    selectedCategory?.hasUnknownReferences
      ? "bpmn-group-title-ownership-error"
      : null,
  ]
    .filter((id): id is string => Boolean(id))
    .join(" ");
  const duplicateNewMessageIds =
    messagePickerMode === "NEW"
      ? duplicateMessageNameIds(messageRegistry, messageName)
      : [];
  const duplicateRenameIds = duplicateMessageNameIds(
    messageRegistry,
    registryRenameName,
    registryRenameId,
  );
  const callableProcessOptions = [
    { value: "", label: "Chọn quy trình" },
    ...buildPlainReferenceOptions(
      callableProcesses,
      "Quy trình chưa đặt tên",
    ),
  ];
  const dataStoreReferenceOptions =
    dataStores.length > 0
      ? buildPlainReferenceOptions(dataStores, "Kho dữ liệu chưa đặt tên")
      : [{ value: "", label: "Chưa có kho dữ liệu dùng chung" }];
  const selectedParticipantNodes = selectedParticipant
    ? outline.filter(
        (item) =>
          item.participantId === selectedParticipant.id &&
          isLaneResponsibilityType(item.type),
      )
    : [];
  const selectedLaneChildren = isLane(selected)
    ? (selected.children ?? []).filter(isLane)
    : [];
  const selectedLaneDirectNodes = isLane(selected)
    ? selectedParticipantNodes.filter((node) => node.parentId === selected.id)
    : [];
  const selectedFill = selected?.di?.get("bioc:fill");
  const selectedStroke = selected?.di?.get("bioc:stroke");
  const firstSelectedColorId = bpmnElementUsesStrokeOnly(selected?.type ?? "")
    ? (bpmnElementColorPalette.find((item) => item.stroke === selectedStroke)
        ?.id ?? null)
    : bpmnElementColorSelection(selectedFill, selectedStroke);
  const selectedColorId = bpmnColorTargets(selectedElements).every((element) => element.di?.get("bioc:stroke") === selectedStroke && (bpmnElementUsesStrokeOnly(element.type) || element.di?.get("bioc:fill") === selectedFill)) ? firstSelectedColorId : null;
  const roleDialogNames =
    roleDialogMode === "CREATE_CHILDREN"
      ? roleNames.slice(0, roleCount)
      : roleNames.slice(0, 1);
  const existingRoleNames =
    roleDialogMode === "ADD_CHILD"
      ? selectedLaneChildren.map((lane) => lane.businessObject?.name ?? "")
      : [];
  const roleDialogAssessments = roleDialogNames.map((name, index) =>
    assessChildRoleName(name, [
      ...existingRoleNames,
      ...roleDialogNames.slice(0, index),
    ]),
  );
  const endpointContext = (endpointId: string | undefined) => {
    const endpoint = endpointId ? outlineById.get(endpointId) : undefined;
    const participantId =
      endpoint?.type === "bpmn:Participant"
        ? endpoint.id
        : endpoint?.participantId;
    const participant = participantId
      ? outlineById.get(participantId)
      : undefined;
    return {
      label: endpoint?.name || "Phần tử chưa đặt tên",
      participant: participant?.name,
    };
  };
  const endpointLabel = (endpointId: string | undefined) => {
    if (!endpointId) return "";
    const context = endpointContext(endpointId);
    return context.participant
      ? `${context.label} · ${context.participant}`
      : context.label;
  };
  const selectedConnectionPresentation = selected
    ? buildPlainConnectionPresentation(
        selected.type,
        endpointLabel(
          selected.source?.id ??
            firstReferenceId(selected.businessObject?.sourceRef),
        ),
        endpointLabel(
          selected.target?.id ??
            firstReferenceId(selected.businessObject?.targetRef),
        ),
      )
    : null;
  const outlineDepth = (item: CoreBpmnElement) => {
    let depth = 0;
    let parentId = item.parentContainerId ?? item.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId) && depth < 4) {
      visited.add(parentId);
      depth += 1;
      const parent = outlineById.get(parentId);
      parentId = parent?.parentContainerId ?? parent?.parentId;
    }
    return depth;
  };
  const outlineColorLabel = (elementId: string) => {
    const color = outlineColors.get(elementId);
    return bpmnOutlineColorLabel(color?.fill, color?.stroke);
  };
  const selectedReparentTarget = reparentPreview?.eligibleTargets.find(
    (target) => target.containerId === reparentTargetId,
  );
  const reparentLaneTargets: readonly LifecycleTargetOption[] =
    selectedReparentTarget?.requiresTargetLeafLane && lifecycleSnapshot?.lanes
      ? lifecycleSnapshot.lanes
          .filter(
            (lane) =>
              lane.processId === reparentTargetId &&
              !lifecycleSnapshot.lanes?.some(
                (candidate) => candidate.parentLaneId === lane.id,
              ),
          )
          .map((lane) => ({
            id: lane.id,
            label: lane.name || "Vai trò chưa đặt tên",
            detail: lane.id,
          }))
      : [];
  const deleteImpactGroups: readonly LifecycleImpactGroup[] =
    deleteImpactSnapshot
      ? [
          {
            label: "Phần tử bên trong",
            ids: deleteImpactSnapshot.descendantIds,
          },
          {
            label: "Sự kiện gắn kèm",
            ids: deleteImpactSnapshot.boundaryEventIds,
          },
          {
            label: "Luồng tuần tự bên trong",
            ids: deleteImpactSnapshot.internalSequenceFlowIds,
          },
          {
            label: "Luồng tuần tự liên quan",
            ids: deleteImpactSnapshot.incidentSequenceFlowIds,
          },
          {
            label: "Ghi chú và nhóm trực quan",
            ids: deleteImpactSnapshot.artifactIds,
          },
          {
            label: "Tài liệu dữ liệu",
            ids: deleteImpactSnapshot.dataReferenceIds,
          },
          {
            label: "Liên kết dữ liệu",
            ids: deleteImpactSnapshot.dataAssociationIds,
          },
          {
            label: "Tài liệu dữ liệu không còn dùng",
            ids: deleteImpactSnapshot.orphanDataObjectIds,
          },
        ]
      : (genericDeleteSnapshot?.groups ?? []);
  const reparentSourceLabel = reparentPreview
    ? outlineById.get(reparentPreview.selectedElementId)?.name || "Phần tử đã chọn"
    : "Chưa chọn phần tử";
  const reparentSourceContainerLabel = reparentPreview
    ? outlineById.get(reparentPreview.sourceContainerId)?.name || "Quy trình chính"
    : "Không rõ";
  const deleteImpactSubjectId =
    deleteImpactSnapshot?.subProcessId ?? genericDeleteSnapshot?.elementId;
  const deleteImpactSubjectLabel = deleteImpactSubjectId
    ? outlineById.get(deleteImpactSubjectId)?.name || "Phần tử đã chọn"
    : "Phần tử đã chọn";
  const authoringProfileId = acknowledgedBpmnAuthoringProfile(
    modelProfileId,
    conditionalProfileAcknowledged,
    catchingEventsProfileAcknowledged,
    eventRoutingProfileAcknowledged,
    taskTypesProfileAcknowledged,
    intermediateEventsProfileAcknowledged,
    boundaryEventsProfileAcknowledged,
    activityContainersProfileAcknowledged,
    dataAuthoringProfileAcknowledged,
    complexRoutingProfileAcknowledged,
  );
  const launcherContextState = new Map<
    BpmnLibraryItem["id"],
    { readonly state: "context-incompatible"; readonly reason: string }
  >();
  if (!isBoundaryHost(selected)) {
    for (const toolId of [
      "message-boundary-event",
      "timer-boundary-event",
    ] as const) {
      launcherContextState.set(toolId, {
        state: "context-incompatible",
        reason: "Chọn một công việc phù hợp trước khi gắn sự kiện tại biên.",
      });
    }
  }
  if (selected?.type === "bpmn:SubProcess") {
    launcherContextState.set("message-boundary-event", { state: "context-incompatible", reason: "Quy trình con hiện hỗ trợ hẹn giờ tại biên." });
  }
  if (componentLauncherMode.kind === "append") {
    for (const toolId of [
      "horizontal-swimlane-frame",
      "vertical-swimlane-frame",
    ] as const) {
      launcherContextState.set(toolId, {
        state: "context-incompatible",
        reason:
          "Phân vai áp dụng cho toàn bộ sơ đồ; hãy mở Thành phần từ thanh công cụ chính.",
      });
    }
    for (const group of bpmnNodeLibraryGroups(
      isCollaborationBpmnProfileId(acknowledgedProfileId)
        ? collaborationSwimlaneLayoutsBpmnProfile.id
        : coreComplexRoutingBpmnProfile.id,
    )) {
      for (const tool of group.items) {
        if (!appendableBpmnToolIds.has(tool.id)) {
          launcherContextState.set(tool.id, {
            state: "context-incompatible",
            reason: "Thành phần này không thể nối nhanh sau bước đang chọn.",
          });
        }
      }
    }
    if (selected?.type === "bpmn:EventBasedGateway") {
      const allowedAfterEventGateway = new Set<BpmnLibraryItem["id"]>([
        "message-catch-event",
        "timer-catch-event",
        "receive-task",
      ]);
      for (const toolId of appendableBpmnToolIds) {
        if (!allowedAfterEventGateway.has(toolId)) {
          launcherContextState.set(toolId, {
            state: "context-incompatible",
            reason:
              "Điểm chờ sự kiện chỉ nối trực tiếp tới chờ thông điệp, chờ thời gian hoặc nhận thông điệp.",
          });
        }
      }
    }
  }
  const activeInspectorPrimaryView = primaryInspectorViewFor(inspectorView);
  const diagramInspectorViews = secondaryInspectorViewsFor("diagram");
  const issueGroupCount = groupBpmnInspectionIssues(issues).length;
  const canAlignSelection = arrangeCapabilities.canAlign;
  const balanceSelectedBranches = async () => {
    const modeler = modelerRef.current;
    if (!modeler || !selected || balancingBranches || saveInFlightRef.current || saveState === "CONFLICT") return;
    const sequenceBefore = editSequenceRef.current;
    const gatewayId = selected.id;
    setBalancingBranches(true);
    try {
      const { xml: previousXml } = await modeler.saveXML({ format: true });
      if (!previousXml || modelerRef.current !== modeler || sequenceBefore !== editSequenceRef.current || saveInFlightRef.current) {
        setNotice("Sơ đồ vừa thay đổi. Hãy thử cân đối lại.");
        return;
      }
      try {
        const result = executeBpmnBranchBalance(
          getService(modeler, "commandStack"), getService(modeler, "elementRegistry"), gatewayId,
        );
        setNotice(!result.ok ? result.reason : result.moves.length
          ? `Đã cân đối ${result.branchCount} nhánh. Bạn có thể hoàn tác trong một lần.`
          : "Các nhánh đã cân đối, không cần thay đổi.");
      } catch {
        // Native compound commands do not roll back unexpected exceptions.
        // Restore the captured draft before any autosave can observe partial geometry.
        hydratingRef.current = true;
        if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
        if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
        projectionGateRef.current.invalidate();
        try {
          await modeler.importXML(previousXml);
          currentXmlRef.current = previousXml;
          await refreshProjection(modeler);
          setDirty(dirty);
          setSaveState(saveState);
          hydratingRef.current = false;
          if (dirty) scheduleAutosave();
          setNotice("Chưa thể cân đối. Đã khôi phục sơ đồ trước thao tác; lịch hoàn tác bắt đầu lại.");
        } catch {
          // Fail closed: never let a damaged canvas overwrite the last good draft.
          currentXmlRef.current = previousXml;
          setBranchRecoveryXml(previousXml);
          modelerRef.current = null;
          modeler.destroy();
          setReady(false);
          setSaveState("ERROR");
          setNotice("Vùng vẽ đã tạm dừng để bảo vệ bản nháp. Hãy tải bản khôi phục rồi mở lại trang.");
        }
      }
    } catch {
      setNotice("Chưa thể cân đối lúc này. Hãy tải bản nháp xuống trước khi thử lại.");
    } finally {
      setBalancingBranches(false);
    }
  };
  const canDistributeSelection = arrangeCapabilities.canDistribute;
  const arrangeSelection = (action: BpmnArrangeAction) => {
    const modeler = modelerRef.current;
    const allowed = action.startsWith("align-")
      ? canAlignSelection
      : canDistributeSelection;
    if (!modeler || !allowed) {
      setNotice("Hãy chọn đủ các thành phần phù hợp trước khi sắp xếp.");
      return;
    }
    const native = bpmnArrangeNativeCommand(action);
    const beforeSequence = editSequenceRef.current;
    getService(modeler, "editorActions").trigger(native.command, {
      type: native.type,
    });
    setNotice(
      editSequenceRef.current > beforeSequence
        ? "Đã sắp xếp các thành phần. Có thể hoàn tác trong một lần."
        : "Các thành phần đã ở đúng vị trí nên sơ đồ không thay đổi.",
    );
  };
  const focusInspectorPrimaryView = (view: InspectorPrimaryView) => {
    setInspectorView(inspectorViewForPrimary(view, inspectorView));
    window.requestAnimationFrame(() => {
      document.getElementById(`bpmn-inspector-${view}-tab`)?.focus();
    });
  };
  const focusInspectorDiagramView = (view: InspectorView) => {
    setInspectorView(view);
    window.requestAnimationFrame(() => {
      document.getElementById(`bpmn-inspector-${view}-subtab`)?.focus();
    });
  };

  return (
    <div className="bpmn-studio" inert={restoring} aria-busy={restoring}>
      <ModalDialog
        open={pendingNavigation !== null}
        role="alertdialog"
        className="bpmn-leave-dialog"
        aria-labelledby="bpmn-leave-title"
        aria-describedby="bpmn-leave-description"
        closeOnEscape={!savingBeforeLeave}
        onRequestClose={() => setPendingNavigation(null)}
      >
        <section>
          <h2 id="bpmn-leave-title">Lưu thay đổi trước khi rời trang?</h2>
          <p id="bpmn-leave-description">
            Sơ đồ có thay đổi chưa lưu xong. Lưu bản nháp để tiếp tục chỉnh sửa sau.
          </p>
          {leaveSaveError ? (
            <p role="alert">Chưa lưu xong. Bạn vẫn ở trang này và các thay đổi được giữ nguyên. Hãy kiểm tra trạng thái lưu rồi thử lại.</p>
          ) : null}
          <footer>
            <Button data-dialog-initial-focus variant="secondary" disabled={savingBeforeLeave} onClick={() => setPendingNavigation(null)}>Ở lại</Button>
            <Button variant="ghost" disabled={savingBeforeLeave} onClick={() => {
              if (!pendingNavigation) return;
              allowNavigationRef.current = true;
              window.location.assign(pendingNavigation);
            }}>Bỏ thay đổi và thoát</Button>
            <Button disabled={savingBeforeLeave || saveState === "SAVING" || saveState === "CONFLICT"} onClick={() => void saveAndLeave()}>
              {savingBeforeLeave ? "Đang lưu…" : "Lưu và thoát"}
            </Button>
          </footer>
        </section>
      </ModalDialog>
      <ModalDialog open={preparedFile !== null} closeOnEscape={!importing} onRequestClose={() => { if (!importCreateInFlightRef.current) setPreparedFile(null); }} className="bpmn-leave-dialog" aria-labelledby="bpmn-import-profile-title">
        <section>
          <h2 id="bpmn-import-profile-title">Mở tệp với khả năng BPMN phù hợp</h2>
          <p>Tệp đã qua kiểm tra an toàn và khả năng hiển thị. Studio sẽ tạo một sơ đồ riêng để giữ nguyên bản đang mở.</p>
          {preparedFile ? <><p>{preparedFile.title} · {profileStageLabel(preparedFile.profileId)}</p><ul>{preparedFile.notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul></> : null}
          {importCopyId ? <p>Đã lưu sơ đồ mới: <a href={`/studio/diagram/${encodeURIComponent(importCopyId)}`} target="_blank" rel="noopener noreferrer">Mở sơ đồ vừa nhập trong tab mới</a></p> : null}
          <footer>
            <Button data-dialog-initial-focus variant="secondary" disabled={importing} onClick={() => setPreparedFile(null)}>{importCopyId ? "Đóng" : "Hủy"}</Button>
            <Button disabled={importing || Boolean(importCopyId)} onClick={async () => {
              if (!preparedFile || importCreateInFlightRef.current) return;
              importCreateInFlightRef.current = true;
              setImporting(true);
              try {
                const opened = await persistence.createModel({ idempotencyKey: preparedFile.idempotencyKey, title: preparedFile.title, description: "", purpose: "REFERENCE", profileId: preparedFile.profileId, xml: preparedFile.xml });
                setImportCopyId(opened.modelId);
                setImportNotice("Đã lưu tệp nhập thành sơ đồ riêng; bản đang mở được giữ nguyên.");
              } catch { setImportNotice("Chưa xác nhận được sơ đồ mới. Hãy thử lại cùng tệp; bản đang mở vẫn được giữ."); }
              finally { importCreateInFlightRef.current = false; setImporting(false); }
            }}>{importing ? "Đang mở…" : "Mở thành sơ đồ mới"}</Button>
          </footer>
          {preparedFile && importNotice ? <p role="status">{importNotice}</p> : null}
        </section>
      </ModalDialog>
      <BpmnConflictDialog
        open={conflictDialogOpen}
        modelId={modelId}
        persistence={persistence}
        capture={async (): Promise<BpmnRecoverySnapshot> => {
          const sequence = editSequenceRef.current;
          const modeler = modelerRef.current;
          if (!modeler) throw new Error("Model unavailable");
          const { xml } = await modeler.saveXML({ format: true });
          if (!xml || sequence !== editSequenceRef.current) throw new Error("Diagram changed");
          return { sequence, title: titleRef.current, description: descriptionRef.current, purpose: purposeRef.current, profileId: profileIdRef.current, xml };
        }}
        isCurrent={(snapshot) => snapshot.sequence === editSequenceRef.current}
        download={(xml, title) => diagramExport.downloadBlob(new Blob([xml], { type: bpmnDiagramDownloadMimeTypes.bpmn }), safeBpmnDiagramFilename(title, "bpmn"))}
        onClose={() => setConflictDialogOpen(false)}
        onOpenServer={() => { allowNavigationRef.current = true; window.location.reload(); }}
      />
      <h1 className="sr-only">Trình thiết kế quy trình — {modelTitle}</h1>
      <header className="bpmn-studio__topbar">
        <div className="bpmn-studio__identity">
          <Link
            href="/studio/diagram"
            className="bpmn-icon-action"
            aria-label="Quay lại thư viện quy trình"
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </Link>
          <div>
            <span className="mono-label">
              Thiết kế quy trình · {profileStageLabel(modelProfileId)}
            </span>
            <input
              aria-label="Tên sơ đồ"
              maxLength={180}
              required
              disabled={saveState === "LOADING"}
              value={modelTitle}
              onChange={(event) => {
                titleRef.current = event.target.value;
                setModelTitle(event.target.value);
                editSequenceRef.current += 1;
                setDirty(true);
                setSaveState("DIRTY");
                scheduleAutosave();
              }}
              onBlur={() => {
                const normalized = modelTitle.trim();
                if (!normalized) {
                  setNotice(
                    "Tên sơ đồ cần từ 1 đến 180 ký tự; nội dung trống chưa được lưu.",
                  );
                  return;
                }
                titleRef.current = normalized;
                setModelTitle(normalized);
              }}
            />
          </div>
        </div>
        <div
          className="bpmn-studio__actions"
          role="toolbar"
          aria-label="Hành động với sơ đồ"
        >
          <Button
            variant="secondary"
            disabled={saveState === "LOADING" || saveState === "SAVING" || saveState === "CONFLICT" || !dirty}
            onClick={() => void persistCurrent()}
          >
            {saveState === "SAVING" ? "Đang lưu…" : "Lưu bản nháp"}
          </Button>
          <Button
            className="bpmn-desktop-mutation"
            variant="ghost"
            disabled={!history.canUndo}
            onClick={() =>
              getService(modelerRef.current!, "commandStack").undo()
            }
          >
            <Undo2 size={16} strokeWidth={1.5} /> Hoàn tác
          </Button>
          <Button
            className="bpmn-desktop-mutation"
            variant="ghost"
            disabled={!history.canRedo}
            onClick={() =>
              getService(modelerRef.current!, "commandStack").redo()
            }
          >
            <Redo2 size={16} strokeWidth={1.5} /> Làm lại
          </Button>
          <Button
            className="bpmn-desktop-mutation"
            variant="secondary"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} strokeWidth={1.5} /> Mở tệp
          </Button>
          <input
            ref={fileInputRef}
            className="sr-only bpmn-desktop-mutation"
            type="file"
            disabled={importing}
            accept=".bpmn,.xml,application/xml,text/xml"
            aria-label="Chọn tệp sơ đồ"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setInspectorView("navigation");
              setInspectorCollapsed(false);
              void runInspection();
            }}
          >
            <CheckCircle2 size={16} strokeWidth={1.5} /> Kiểm tra
          </Button>
          <Button
            className="bpmn-desktop-mutation"
            variant="secondary"
            aria-controls={
              inspectorCollapsed
                ? undefined
                : "bpmn-inspector-versions-panel"
            }
            aria-expanded={
              !inspectorCollapsed && inspectorView === "versions"
            }
            disabled={
              dirty ||
              saveState === "SAVING" ||
              versioning
            }
            onClick={openVersionComposer}
          >
            <GitCommitHorizontal size={16} strokeWidth={1.5} /> Lưu thành mốc
          </Button>
          <Button
            disabled={downloading || importing || saveState === "LOADING"}
            onClick={() => setDownloadDialogOpen(true)}
          >
            <Download size={16} strokeWidth={1.5} /> Tải tệp
          </Button>
        </div>
      </header>

      <div className="bpmn-studio__mobile-boundary">
        <Route size={22} strokeWidth={1.5} aria-hidden="true" />
        <strong>Chế độ xem trên màn hình nhỏ</strong>
        <span>
          Nên dùng màn hình rộng từ 768px để chỉnh sửa. Danh sách bước vẫn đọc
          được bên dưới.
        </span>
      </div>

      <nav
        className="bpmn-mobile-outline-shell bpmn-outline"
        aria-label="Danh sách bước trên màn hình nhỏ"
      >
        <strong>Danh sách bước</strong>
        {outline.length > 0 ? (
          <ol>
            {outline.map((item) => (
              <li key={item.id}>
                <button
                  className={
                    item.parentContainerId ?? item.parentId
                      ? `is-nested outline-depth-${outlineDepth(item)}`
                      : undefined
                  }
                  onClick={() => selectOutlineElement(item.id)}
                  aria-current={selected?.id === item.id ? "true" : undefined}
                  aria-label={`${bpmnOutlineTypeLabel(item, outlineById)} ${bpmnOutlinePrimaryLabel(item)}, cấp ${outlineDepth(item) + 1}`}
                >
                  <span>{bpmnOutlineTypeLabel(item, outlineById)}</span>
                  <strong>{bpmnOutlinePrimaryLabel(item)}</strong>
                  <small>
                    {bpmnOutlineAdvancedMetadata(item) ??
                      `vào ${item.incoming.length} · ra ${item.outgoing.length}`}
                  </small>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p role="status">Đang tải danh sách bước…</p>
        )}
      </nav>

      <div
        className={cn(
          "bpmn-studio__workspace",
          inspectorCollapsed && "is-inspector-collapsed",
        )}
      >

        <section
          className={cn(
            "bpmn-studio__canvas-region",
            connectArmed && "is-connecting",
            armedLauncherItem && "is-placing",
            `is-color-${colorMode.toLocaleLowerCase().replace("_", "-")}`,
          )}
          data-bpmn-color-mode={colorMode}
          aria-labelledby="bpmn-canvas-title"
          aria-describedby="bpmn-canvas-instructions"
        >
          <h2 id="bpmn-canvas-title" className="sr-only">
            Vùng vẽ quy trình
          </h2>
          <p id="bpmn-canvas-instructions" className="sr-only">
            Dùng nút Thành phần để chọn, sau đó nhấp vùng vẽ để đặt. Danh sách
            bước hỗ trợ điều hướng bằng văn bản.
          </p>
          <div className="bpmn-canvas-toolbar" aria-label="Công cụ vẽ sơ đồ">
            <BpmnComponentLauncher
              acknowledgedProfileId={acknowledgedProfileId}
              open={componentLauncherOpen}
              mode={componentLauncherMode}
              armedToolId={armedLauncherItem?.id ?? null}
              recentToolIds={toolPreferences.recentToolIds}
              favoriteToolIds={toolPreferences.favoriteToolIds}
              onToggleFavorite={toggleFavoriteTool}
              contextState={launcherContextState}
              onOpenChange={(open) => {
                if (
                  open &&
                  componentLauncherMode.kind === "append" &&
                  selected?.id !== componentLauncherMode.sourceId
                ) {
                  setComponentLauncherMode({ kind: "place" });
                }
                setComponentLauncherOpen(open);
                if (!open) setComponentLauncherMode({ kind: "place" });
              }}
              onToolIntent={handleLauncherToolIntent}
              onToolDragStart={(event, item) => {
                if (item.tool.kind !== "shape") return;
                if (item.preparation.kind === "ordered-profile-ack") {
                  event.preventDefault();
                  event.stopPropagation();
                  handleLauncherToolIntent(
                    item,
                    { kind: "place" },
                    event.nativeEvent,
                  );
                  return;
                }
                setArmedLauncherItem(null);
                pendingCreatedToolRef.current = item.id;
                let creationStarted = false;
                try {
                  creationStarted = startCreate(
                    event,
                    item.tool.type,
                    item.tool.recipe,
                    item.tool.participantExpanded,
                  );
                } finally {
                  if (!creationStarted) pendingCreatedToolRef.current = null;
                }
                if (!creationStarted) return;
                setComponentLauncherOpen(false);
                setComponentLauncherMode({ kind: "place" });
              }}
            />
            <BpmnArrangeMenu
              selectionCount={selectedElements.length}
              canAlign={canAlignSelection}
              canDistribute={canDistributeSelection}
              onArrange={arrangeSelection}
            />
            <span className="bpmn-canvas-toolbar__profile">
              {profileStageLabel(acknowledgedProfileId)}
            </span>
          </div>
          {armedLauncherItem ? (
            <div
              className="bpmn-placement-hud"
              role="status"
              aria-live="polite"
              data-bpmn-armed-tool={armedLauncherItem.id}
            >
              <MousePointer2 size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>{armedLauncherItem.tool.label}</strong>
                <small>Nhấp vùng vẽ để đặt một lần · Esc để hủy</small>
              </span>
              <button
                type="button"
                onClick={() => {
                  const modeler = modelerRef.current;
                  if (modeler) getService(modeler, "dragging").cancel();
                  pendingCreatedToolRef.current = null;
                  setArmedLauncherItem(null);
                  setNotice("Đã hủy đặt thành phần.");
                }}
              >
                Hủy <kbd>Esc</kbd>
              </button>
            </div>
          ) : null}
          {connectArmed ? (
            <div className="bpmn-connect-hud" role="status" aria-live="polite">
              <Route size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>
                  {connectKind === "message"
                    ? "Trao đổi thông điệp · giữa hai bên tham gia"
                    : connectKind === "association"
                      ? "Liên kết chú thích"
                      : "Đường thực hiện · trong cùng quy trình"}
                </strong>
                <small>
                  {connectSourceId
                    ? "Bước 2/2 · Chọn điểm đến trên vùng vẽ hoặc danh sách bước"
                    : "Bước 1/2 · Chọn điểm bắt đầu trên vùng vẽ hoặc danh sách bước"}
                </small>
              </span>
              <button
                type="button"
                onClick={() => activateConnect(connectKind)}
              >
                Hủy <kbd>Esc</kbd>
              </button>
            </div>
          ) : null}
          {!ready && (
            <div className="bpmn-canvas-loading">
              {branchRecoveryXml ? <div role="alert">
                <p>Vùng vẽ đã tạm dừng để bảo vệ bản nháp.</p>
                <Button onClick={() => diagramExport.downloadBlob(
                  new Blob([branchRecoveryXml], { type: bpmnDiagramDownloadMimeTypes.bpmn }),
                  safeBpmnDiagramFilename(`${modelTitle}-khoi-phuc`, "bpmn"),
                )}>Tải bản khôi phục</Button>
              </div> : "Đang mở sơ đồ…"}
            </div>
          )}
          <div
            ref={canvasRef}
            className="bpmn-modeler"
            data-testid="bpmn-modeler"
            onClickCapture={handleArmedCanvasClick}
          />
          <div
            className="bpmn-studio__zoom"
            role="group"
            aria-label="Điều khiển thu phóng"
          >
            <button onClick={() => changeZoom(-0.15)} aria-label="Thu nhỏ">
              <ZoomOut size={17} strokeWidth={1.5} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => changeZoom(0.15)} aria-label="Phóng to">
              <ZoomIn size={17} strokeWidth={1.5} />
            </button>
            <button onClick={fitSelection} disabled={!selectedElements.length} aria-label="Phóng vừa phần đã chọn" title="Phóng vừa phần đã chọn">
              <Maximize2 size={17} strokeWidth={1.5} />
            </button>
            <button onClick={fitCanvas} aria-label="Hiển thị vừa khung">
              <Maximize2 size={17} strokeWidth={1.5} />
            </button>
          </div>
        </section>

        <aside
          className={cn(
            "bpmn-studio__inspector",
            inspectorCollapsed && "is-collapsed",
          )}
          aria-label="Bảng chỉnh sửa và kiểm tra sơ đồ"
        >
          {inspectorCollapsed ? (
            <button
              id="bpmn-inspector-open-button"
              type="button"
              className="bpmn-panel-rail-button"
              aria-label="Mở bảng hỗ trợ"
              onClick={() => {
                setInspectorCollapsed(false);
                window.requestAnimationFrame(() => {
                  document
                    .getElementById("bpmn-inspector-collapse-button")
                    ?.focus();
                });
              }}
            >
              <PanelRightOpen size={18} />
              <span>Hỗ trợ</span>
            </button>
          ) : (
            <>
              <div className="bpmn-studio__inspector-header">
              <div className="bpmn-studio__panel-heading">
                <div>
                  <strong>Bảng hỗ trợ</strong>
                  <button
                    id="bpmn-inspector-collapse-button"
                    type="button"
                    aria-label="Thu gọn bảng hỗ trợ"
                    onClick={() => {
                      setInspectorCollapsed(true);
                      window.requestAnimationFrame(() => {
                        document
                          .getElementById("bpmn-inspector-open-button")
                          ?.focus();
                      });
                    }}
                  >
                    <PanelRightClose size={17} />
                  </button>
                </div>
                <small>
                  {inspectorView === "navigation"
                    ? issueGroupCount > 0
                      ? `${issueGroupCount} vấn đề · ${issues.length} vị trí cần xem`
                      : "Toàn bộ sơ đồ · không có vấn đề"
                    : selectedLabel(selected)}
                </small>
              </div>
              <div
                className="bpmn-studio__tabs bpmn-studio__tabs--primary"
                role="tablist"
                aria-label="Nội dung bảng hỗ trợ"
              >
                {inspectorPrimaryViewProjection.map((view) => {
                  const selectedPrimary =
                    activeInspectorPrimaryView === view.id;
                  const controlledView = inspectorViewForPrimary(
                    view.id,
                    inspectorView,
                  );
                  return (
                  <button
                    key={view.id}
                    id={`bpmn-inspector-${view.id}-tab`}
                    type="button"
                    role="tab"
                    aria-label={
                      view.id === "check" && issueGroupCount > 0
                        ? `${view.label}, ${issueGroupCount} vấn đề`
                        : view.label
                    }
                    aria-selected={selectedPrimary}
                    aria-controls={`bpmn-inspector-${controlledView}-panel`}
                    tabIndex={selectedPrimary ? 0 : -1}
                    onClick={() =>
                      setInspectorView(
                        inspectorViewForPrimary(view.id, inspectorView),
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight" ||
                        event.key === "Home" ||
                        event.key === "End"
                      ) {
                        event.preventDefault();
                        focusInspectorPrimaryView(
                          nextInspectorPrimaryView(
                            activeInspectorPrimaryView,
                            event.key,
                          ),
                        );
                      }
                    }}
                  >
                    {view.label}
                    {view.id === "check" && issueGroupCount > 0 ? (
                      <span aria-hidden="true">{issueGroupCount}</span>
                    ) : null}
                  </button>
                  );
                })}
              </div>
              <div
                className="bpmn-studio__subtabs"
                role="tablist"
                aria-label="Nội dung sơ đồ"
                hidden={activeInspectorPrimaryView !== "diagram"}
              >
                {diagramInspectorViews.map((item, index) => (
                  <button
                    key={item.view}
                    id={`bpmn-inspector-${item.view}-subtab`}
                    type="button"
                    role="tab"
                    aria-selected={inspectorView === item.view}
                    aria-controls={`bpmn-inspector-${item.view}-panel`}
                    tabIndex={inspectorView === item.view ? 0 : -1}
                    onClick={() => setInspectorView(item.view)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "ArrowLeft" &&
                        event.key !== "ArrowRight" &&
                        event.key !== "Home" &&
                        event.key !== "End"
                      ) {
                        return;
                      }
                      event.preventDefault();
                      const nextIndex =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? diagramInspectorViews.length - 1
                            : (index +
                                (event.key === "ArrowRight" ? 1 : -1) +
                                diagramInspectorViews.length) %
                              diagramInspectorViews.length;
                      focusInspectorDiagramView(
                        diagramInspectorViews[nextIndex]!.view,
                      );
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              </div>
              <section
                className="bpmn-model-metadata"
                id="bpmn-inspector-model-panel"
                role="tabpanel"
                aria-labelledby="bpmn-inspector-diagram-tab bpmn-inspector-model-subtab"
                hidden={inspectorView !== "model"}
              >
                <details className="bpmn-inspector-section bpmn-desktop-mutation">
                  <summary>
                    <span>Mô tả và mục đích</span>
                  </summary>
                  <div className="bpmn-inspector-section__body">
                <label className="bpmn-desktop-mutation">
                  <span>Mô tả</span>
                  <textarea
                    value={modelDescription}
                    maxLength={1_000}
                    rows={3}
                    onChange={(event) => {
                      descriptionRef.current = event.target.value;
                      setModelDescription(event.target.value);
                      editSequenceRef.current += 1;
                      setDirty(true);
                      setSaveState("DIRTY");
                      scheduleAutosave();
                    }}
                  />
                  <small>{modelDescription.length}/1000</small>
                </label>
                <div className="bpmn-model-field bpmn-desktop-mutation">
                  <span id="bpmn-model-purpose-label">Sơ đồ này dùng để</span>
                  <Select
                    id="bpmn-model-purpose"
                    value={modelPurpose}
                    options={modelPurposeOptions}
                    labelledBy="bpmn-model-purpose-label"
                    onValueChange={(value) => {
                      const purpose = value as typeof modelPurpose;
                      purposeRef.current = purpose;
                      setModelPurpose(purpose);
                      editSequenceRef.current += 1;
                      setDirty(true);
                      setSaveState("DIRTY");
                      scheduleAutosave();
                    }}
                  />
                </div>
                  </div>
                </details>
                <details
                  className="bpmn-message-registry bpmn-inspector-section bpmn-desktop-mutation"
                >
                  <summary id="bpmn-message-registry-title">
                    <span>Thông điệp dùng chung</span>
                    <small>{messageRegistry.length}</small>
                  </summary>
                  <div className="bpmn-inspector-section__body">
                  <p>
                    Đổi tên tại đây sẽ cập nhật mọi nơi đang dùng cùng thông
                    điệp.
                  </p>
                  <label>
                    <span>Tìm thông điệp</span>
                    <input
                      type="search"
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                    />
                  </label>
                  <ul>
                    {filteredMessages.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          aria-pressed={registryRenameId === entry.id}
                          onClick={() => {
                            setRegistryRenameId(entry.id);
                            setRegistryRenameName(entry.name);
                          }}
                        >
                          <span>
                            <strong>{entry.name || "Chưa đặt tên"}</strong>
                          </span>
                          <small>{messageOwnerImpactLabel(entry)}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {registryRenameId ? (
                    <>
                      <label>
                        <span>Tên thông điệp</span>
                        <input
                          value={registryRenameName}
                          maxLength={180}
                          onChange={(event) =>
                            setRegistryRenameName(event.target.value)
                          }
                        />
                      </label>
                      {duplicateRenameIds.length > 0 ? (
                        <small role="status" className="bpmn-routing-error">
                          Có thông điệp khác cùng tên. Ứng dụng vẫn giữ chúng tách
                          biệt.
                        </small>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={renameRegistryMessage}
                      >
                        Đổi tên thông điệp
                      </Button>
                    </>
                  ) : null}
                  <button
                    ref={cleanupTriggerRef}
                    type="button"
                    className="button button--secondary"
                    disabled={orphanMessageEntries(messageRegistry).length === 0}
                    onClick={openCleanupDialog}
                  >
                    Xoá thông điệp không dùng
                  </button>
                  <details className="bpmn-inspector-technical-details">
                    <summary>Chi tiết kỹ thuật</summary>
                    <ul>
                      {messageRegistry.map((entry) => (
                        <li key={entry.id}>
                          <code>{entry.id}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                  </div>
                </details>
                <details
                  className="bpmn-message-registry bpmn-datastore-registry bpmn-inspector-section"
                >
                  <summary id="bpmn-datastore-registry-title">
                    <span>Kho dữ liệu dùng chung</span>
                    <small>{dataStoreRegistry.length}</small>
                  </summary>
                  <div className="bpmn-inspector-section__body">
                  <p>
                    Các mục cùng tên vẫn được giữ riêng để tránh thay đổi nhầm
                    dữ liệu.
                  </p>
                  <ul>
                    {dataStoreRegistry.map((entry) => (
                      <li key={entry.dataStoreId}>
                        <div>
                          <span>
                            <strong>{entry.name || "Chưa đặt tên"}</strong>
                          </span>
                          <small>
                            {entry.referenceCount} nơi sử dụng
                            {entry.hasUnknownReferences
                              ? " · có nơi chưa được hỗ trợ"
                              : ""}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    ref={dataStoreCleanupTriggerRef}
                    type="button"
                    className="button button--secondary bpmn-desktop-mutation bpmn-lifecycle-destructive"
                    disabled={
                      dataStoreRegistry.filter(
                        (entry) =>
                          entry.referenceCount === 0 &&
                          !entry.hasUnknownReferences,
                      ).length === 0
                    }
                    onClick={(event) =>
                      openDataStoreCleanupDialog(event.currentTarget)
                    }
                  >
                    Xoá kho dữ liệu không dùng (
                    {
                      dataStoreRegistry.filter(
                        (entry) =>
                          entry.referenceCount === 0 &&
                          !entry.hasUnknownReferences,
                      ).length
                    }
                    )
                  </button>
                  <details className="bpmn-inspector-technical-details">
                    <summary>Chi tiết kỹ thuật</summary>
                    <ul>
                      {dataStoreRegistry.map((entry) => (
                        <li key={entry.dataStoreId}>
                          <code>{entry.dataStoreId}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                  </div>
                </details>
                <details className="bpmn-inspector-section">
                  <summary>
                    <span>Cách hiển thị</span>
                  </summary>
                  <div className="bpmn-inspector-section__body">
                <fieldset className="bpmn-presentation-settings">
                  <legend className="sr-only">Cách hiển thị sơ đồ</legend>
                  <small>
                    Chỉ đổi cách hiển thị trên thiết bị này; nội dung sơ đồ và
                    các bản đã lưu không đổi.
                  </small>
                  <div className="bpmn-presentation-mode-list">
                    {bpmnColorModes.map((mode) => (
                      <label key={mode.id}>
                        <input
                          type="radio"
                          name="bpmn-color-mode"
                          value={mode.id}
                          checked={colorMode === mode.id}
                          onChange={() => {
                            setColorMode(mode.id);
                            setNotice(
                              `Đã chuyển cách hiển thị sang ${mode.label}. Nội dung sơ đồ không thay đổi.`,
                            );
                          }}
                        />
                        <span>
                          <strong>{mode.label}</strong>
                          <small>{mode.hint}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div
                    className="bpmn-semantic-legend"
                    aria-label="Chú giải màu theo nhóm thành phần"
                  >
                    <strong>Chú giải · màu không phải tín hiệu duy nhất</strong>
                    <ul>
                      {bpmnSemanticLegend.map((item) => (
                        <li key={item.category}>
                          <i
                            className={`is-${item.category}`}
                            aria-hidden="true"
                          />
                          <span>
                            <b>{item.label}</b>
                            <small>{item.detail}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </fieldset>
                  </div>
                </details>
              </section>
              <div
                id="bpmn-inspector-properties-panel"
                role="tabpanel"
                aria-labelledby="bpmn-inspector-edit-tab"
                hidden={inspectorView !== "properties"}
              >
                <div className="bpmn-mobile-readonly">
                  <strong>{selectedLabel(selected)}</strong>
                  <small>
                    Chế độ xem trên màn hình nhỏ. Dùng màn hình rộng để chỉnh
                    sửa.
                  </small>
                </div>
                {selected ? (
                  <div className="bpmn-inspector-form bpmn-desktop-mutation">
                    {supportsEditableBpmnName(selected.type) ? (
                      <label>
                        <span>Tên hiển thị</span>
                        <input
                          value={elementName}
                          onChange={(event) =>
                            setElementName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") updateSelectedName();
                            if (event.key === "Escape") {
                              setElementName(
                                selected.businessObject?.name ?? "",
                              );
                            }
                          }}
                        />
                      </label>
                    ) : null}
                    {selected.type === "bpmn:TextAnnotation" ? (
                      <section
                        className="bpmn-artifact-editor"
                        aria-labelledby="bpmn-annotation-editor-title"
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault();
                            applyAnnotationText();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            const semanticText =
                              annotationTextSnapshotRef.current;
                            annotationTextDraftRef.current = semanticText;
                            setAnnotationText(semanticText);
                            setNotice(
                              "Đã hoàn nguyên nội dung chú thích chưa áp dụng.",
                            );
                          }
                        }}
                      >
                        <BpmnAnnotationTemplates value={annotationText} onAppend={(text, template) => { annotationTextDraftRef.current = text; setAnnotationText(text); setNotice(`Đã thêm mẫu ${template.label}. Sửa nội dung rồi áp dụng chú thích.`); }} />
                        <strong id="bpmn-annotation-editor-title">
                          Nội dung chú thích
                        </strong>
                        <div className="bpmn-artifact-editor__field">
                          <label htmlFor="bpmn-annotation-text">Nội dung</label>
                          <textarea
                            id="bpmn-annotation-text"
                            rows={5}
                            value={annotationText}
                            aria-invalid={annotationTextError ? "true" : undefined}
                            aria-describedby={[
                              "bpmn-annotation-text-help",
                              annotationTextError
                                ? "bpmn-annotation-text-error"
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onChange={(event) => {
                              annotationTextDraftRef.current = event.target.value;
                              setAnnotationText(event.target.value);
                            }}
                          />
                          <small id="bpmn-annotation-text-help">
                            {graphemeCount(annotationText)}/2000 · Ctrl/Cmd+Enter
                            để áp dụng
                          </small>
                          {annotationTextError ? (
                            <small
                              id="bpmn-annotation-text-error"
                              className="bpmn-routing-error"
                              role="alert"
                            >
                              {annotationTextError}
                            </small>
                          ) : null}
                        </div>
                        <Button
                          variant="secondary"
                          disabled={Boolean(annotationTextError)}
                          onClick={applyAnnotationText}
                        >
                          Áp dụng chú thích
                        </Button>
                      </section>
                    ) : null}
                    {selected.type === "bpmn:Group" ? (
                      <section
                        className="bpmn-artifact-editor"
                        aria-labelledby="bpmn-group-editor-title"
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault();
                            applyGroupTitle();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            const semanticTitle = groupTitleSnapshotRef.current;
                            groupTitleDraftRef.current = semanticTitle;
                            setGroupTitle(semanticTitle);
                          }
                        }}
                      >
                        <strong id="bpmn-group-editor-title">
                          Tiêu đề nhóm
                        </strong>
                        <div className="bpmn-artifact-editor__field">
                          <label htmlFor="bpmn-group-title">Tiêu đề</label>
                          <input
                            id="bpmn-group-title"
                            value={groupTitle}
                            aria-invalid={groupTitleError ? "true" : undefined}
                            aria-describedby={groupTitleDescriptionIds}
                            onChange={(event) => {
                              groupTitleDraftRef.current = event.target.value;
                              setGroupTitle(event.target.value);
                            }}
                          />
                          <small id="bpmn-group-title-help">
                            {graphemeCount(groupTitle.trim())}/120 · Nhóm này chỉ
                            dùng để làm rõ cách trình bày.
                          </small>
                          {groupTitleError ? (
                            <small
                              id="bpmn-group-title-error"
                              className="bpmn-routing-error"
                              role="alert"
                            >
                              {groupTitleError}
                            </small>
                          ) : null}
                          {selectedCategory &&
                          selectedCategory.referenceCount > 1 ? (
                            <small
                              id="bpmn-group-title-shared"
                              className="bpmn-routing-error"
                              role="status"
                            >
                              Tiêu đề này đang dùng cho{" "}
                              {selectedCategory.referenceCount} nhóm; áp dụng sẽ
                              đổi tất cả các nhóm đó.
                            </small>
                          ) : null}
                          {selectedCategory?.hasUnknownReferences ? (
                            <small
                              id="bpmn-group-title-ownership-error"
                              className="bpmn-routing-error"
                              role="alert"
                            >
                              Nhóm còn được dùng ở vị trí ứng dụng chưa hỗ trợ; chưa
                              thể đổi tên an toàn.
                            </small>
                          ) : null}
                        </div>
                        <Button
                          variant="secondary"
                          disabled={
                            Boolean(groupTitleError) ||
                            Boolean(selectedCategory?.hasUnknownReferences)
                          }
                          onClick={applyGroupTitle}
                        >
                          {selectedCategory &&
                          selectedCategory.referenceCount > 1
                            ? `Đổi tiêu đề cho ${selectedCategory.referenceCount} nhóm`
                            : "Áp dụng tiêu đề nhóm"}
                        </Button>
                      </section>
                    ) : null}
                    <details className="bpmn-inspector-disclosure">
                      <summary>Chi tiết kỹ thuật</summary>
                      <div>
                        <span>Loại chuẩn</span>
                        <code>{selected.type}</code>
                      </div>
                      <div>
                        <span>Mã phần tử</span>
                        <code>{selected.id}</code>
                      </div>
                    </details>
                    {selectedIsMessageReceiver ? (
                      <section
                        className="bpmn-event-property-editor"
                        aria-labelledby="bpmn-message-property-title"
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault();
                            applySelectedMessageReference();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setMessageName(messageNameSnapshotRef.current);
                          }
                        }}
                      >
                        <strong id="bpmn-message-property-title">
                          {selected.type === "bpmn:ReceiveTask"
                            ? "Công việc nhận thông điệp"
                            : selected.type === "bpmn:IntermediateThrowEvent"
                              ? "Gửi thông điệp"
                              : selected.type === "bpmn:BoundaryEvent"
                                ? "Thông điệp tại biên công việc"
                                : "Chờ thông điệp"}
                        </strong>
                        <fieldset className="bpmn-message-picker">
                          <legend>Thông điệp dùng chung</legend>
                          <label>
                            <span>Tìm thông điệp</span>
                            <input
                              type="search"
                              value={messageSearch}
                              onChange={(event) =>
                                setMessageSearch(event.target.value)
                              }
                            />
                          </label>
                          <div
                            className="bpmn-message-picker__results"
                            role="radiogroup"
                            aria-label="Thông điệp hiện có"
                          >
                            {filteredMessages.map((entry) => (
                              <label key={entry.id}>
                                <input
                                  type="radio"
                                  name="bpmn-message-reference"
                                  checked={
                                    messagePickerMode === "EXISTING" &&
                                    selectedMessageId === entry.id
                                  }
                                  aria-label={`${entry.name || "Chưa đặt tên"}, đang dùng tại ${entry.referenceCount} nơi`}
                                  onChange={() => {
                                    setMessagePickerMode("EXISTING");
                                    setSelectedMessageId(entry.id);
                                  }}
                                />
                                <span>
                                  <strong>{entry.name || "Chưa đặt tên"}</strong>
                                  <small>{messageOwnerImpactLabel(entry)}</small>
                                </span>
                              </label>
                            ))}
                          </div>
                          <label>
                            <input
                              type="radio"
                              name="bpmn-message-reference"
                              checked={messagePickerMode === "NEW"}
                              onChange={() => setMessagePickerMode("NEW")}
                            />
                            Tạo thông điệp mới
                          </label>
                        </fieldset>
                        {messagePickerMode === "NEW" ? <label>
                          <span>Tên thông điệp mới</span>
                          <input
                            value={messageName}
                            maxLength={180}
                            aria-invalid={messageError ? "true" : undefined}
                            onChange={(event) =>
                              setMessageName(event.target.value)
                            }
                          />
                          <small>
                            Thông điệp này chỉ mô tả việc gửi và nhận trong sơ
                            đồ; ứng dụng không gửi dữ liệu thật.
                          </small>
                        </label> : null}
                        {duplicateNewMessageIds.length > 0 ? (
                          <small className="bpmn-routing-error" role="status">
                            Có thông điệp khác cùng tên. Ứng dụng vẫn giữ chúng
                            tách biệt.
                          </small>
                        ) : null}
                        {messageError ? (
                          <small className="bpmn-routing-error" role="alert">
                            {messageError}
                          </small>
                        ) : null}
                        <Button
                          variant="secondary"
                          disabled={
                            Boolean(messageError) ||
                            (messagePickerMode === "EXISTING" &&
                              !selectedRegistryMessage)
                          }
                          onClick={applySelectedMessageReference}
                        >
                          {messagePickerMode === "NEW"
                            ? "Tạo thông điệp mới"
                            : "Áp dụng thông điệp"}
                        </Button>
                      </section>
                    ) : null}
                    {selectedIsTimerCatch ? (
                      <section
                        className="bpmn-event-property-editor"
                        aria-labelledby="bpmn-timer-property-title"
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault();
                            applySelectedTimer();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setTimerDraft(timerSnapshotRef.current);
                          }
                        }}
                      >
                        <strong id="bpmn-timer-property-title">
                          {selected.type === "bpmn:BoundaryEvent"
                            ? "Hẹn giờ tại biên công việc"
                            : "Chờ thời gian"}
                        </strong>
                        <fieldset>
                          <legend>Kiểu thời gian</legend>
                          <label>
                            <input
                              type="radio"
                              name="bpmn-timer-kind"
                              checked={timerDraft.kind === "DATE"}
                              onChange={() =>
                                setTimerDraft((current) => ({
                                  ...current,
                                  kind: "DATE",
                                }))
                              }
                            />
                            Mốc thời gian
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="bpmn-timer-kind"
                              checked={timerDraft.kind === "DURATION"}
                              onChange={() =>
                                setTimerDraft((current) => ({
                                  ...current,
                                  kind: "DURATION",
                                }))
                              }
                            />
                            Khoảng chờ
                          </label>
                        </fieldset>
                        <label>
                          <span>
                            {timerDraft.kind === "DATE"
                              ? "Thời điểm cụ thể có múi giờ"
                              : "Khoảng thời gian"}
                          </span>
                          <input
                            value={timerDraft.value}
                            maxLength={timerDraft.kind === "DATE" ? 64 : 32}
                            placeholder={
                              timerDraft.kind === "DATE"
                                ? "2026-08-15T09:00:00+07:00"
                                : "PT30M"
                            }
                            aria-invalid={timerError ? "true" : undefined}
                            onChange={(event) =>
                              setTimerDraft((current) => ({
                                ...current,
                                value: event.target.value,
                              }))
                            }
                          />
                          <small>
                            Ví dụ: 09:00 ngày 15/08/2026 theo giờ Việt Nam
                            (2026-08-15T09:00:00+07:00) hoặc 30 phút (PT30M).
                            Ứng dụng chỉ lưu mô tả, không tự chạy bộ hẹn giờ.
                          </small>
                        </label>
                        {timerError ? (
                          <small className="bpmn-routing-error" role="alert">
                            {timerError}
                          </small>
                        ) : null}
                        <Button
                          variant="secondary"
                          disabled={Boolean(timerError)}
                          onClick={applySelectedTimer}
                        >
                          Áp dụng thời gian
                        </Button>
                      </section>
                    ) : null}
                    {selected.type === "bpmn:EventBasedGateway" ? (
                      <section className="bpmn-event-property-editor">
                        <strong>Chờ sự kiện đầu tiên</strong>
                        <small>
                          Sự kiện đến trước thắng. Thêm ít nhất hai nhánh
                          chờ thông điệp, chờ thời gian hoặc nhận thông điệp.
                        </small>
                        <span>
                          {selected.incoming?.length ?? 0} đường vào ·{" "}
                          {selected.outgoing?.length ?? 0} đường ra
                        </span>
                      </section>
                    ) : null}
                    {isCollaborationBpmnProfileId(modelProfileId) &&
                    isParticipant(selected) ? (
                      <details className="bpmn-inspector-disclosure bpmn-role-inspector">
                        <summary>Bên tham gia và vùng vai trò</summary>
                        <small>
                          Mỗi bên tham gia có thể có quy trình riêng; các vùng
                          vai trò chia trách nhiệm bên trong quy trình đó.
                        </small>
                        <div>
                          <span>Loại bên tham gia</span>
                          <code>
                            {selected.businessObject?.processRef
                              ? "Có quy trình nội bộ"
                              : "Chỉ trao đổi thông điệp"}
                          </code>
                        </div>
                        {selected.businessObject?.processRef ? (
                          <>
                            <label>
                              <span>Tên quy trình</span>
                              <input
                                value={processName}
                                onChange={(event) =>
                                  setProcessName(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    updateSelectedProcessName();
                                  }
                                  if (event.key === "Escape") {
                                    setProcessName(
                                      selected.businessObject?.processRef
                                        ?.name ?? "",
                                    );
                                  }
                                }}
                              />
                            </label>
                            <div>
                              <span>Phạm vi trách nhiệm</span>
                              <code>
                                {selectedParticipantLanes.length} vai trò ·{" "}
                                {selectedParticipantNodes.length} bước phụ trách
                                nhiệm
                              </code>
                            </div>
                            <details className="bpmn-inspector-technical-details">
                              <summary>Chi tiết kỹ thuật</summary>
                              <code>{modelProfileId}</code>
                              <code>{selected.businessObject.processRef.id}</code>
                            </details>
                          </>
                        ) : null}
                        {selected.businessObject?.processRef ? (
                          <fieldset className="bpmn-add-next">
                            <legend>Thêm vùng vai trò</legend>
                            <code>
                              {isHorizontalSwimlane(selected)
                                ? "Ngang · vai trò xếp trên và dưới"
                                : "Dọc · vai trò xếp trái và phải"}
                            </code>
                            {isHorizontalSwimlane(selected) ? (
                              <>
                                <Button
                                  variant="secondary"
                                  onClick={() => addLane("top")}
                                >
                                  Thêm vai trò phía trên
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => addLane("bottom")}
                                >
                                  Thêm vai trò phía dưới
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  onClick={() => addLane("left")}
                                >
                                  Thêm vai trò bên trái
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => addLane("right")}
                                >
                                  Thêm vai trò bên phải
                                </Button>
                              </>
                            )}
                          </fieldset>
                        ) : (
                          <small>
                            Bên tham gia này không có quy trình nội bộ nên không
                            thể thêm vai trò.
                          </small>
                        )}
                        {modelProfileId === collaborationBpmnProfile.id ? (
                          <fieldset className="bpmn-add-next">
                            <legend>Vai trò con</legend>
                            <Button
                              variant="secondary"
                              disabled={saveState === "SAVING"}
                              onClick={() => void enableNestedProfile()}
                            >
                              Mở khả năng thêm vai trò con
                            </Button>
                            <small>
                              Các bản đã lưu trước đó vẫn được giữ nguyên.
                            </small>
                          </fieldset>
                        ) : null}
                      </details>
                    ) : null}
                    {isCollaborationBpmnProfileId(modelProfileId) &&
                    isLane(selected) ? (
                      <details className="bpmn-inspector-disclosure bpmn-role-inspector">
                        <summary>Phân vai trong quy trình</summary>
                        <strong>
                          {laneDepth(selected) === 0
                            ? "Nhóm chức năng"
                            : "Vai trò con"}
                        </strong>
                        <div>
                          <span>Bên tham gia</span>
                          <strong>
                            {selectedParticipant?.businessObject?.name ||
                              "Chưa đặt tên"}
                          </strong>
                        </div>
                        <div>
                          <span>Quy trình</span>
                          <strong>
                            {selectedParticipant?.businessObject?.processRef
                              ?.name ||
                              "Chưa đặt tên"}
                          </strong>
                        </div>
                        <div>
                          <span>Phân cấp vai trò</span>
                          <strong>
                            Cấp {laneDepth(selected) + 1}/2 · thuộc{" "}
                            {isLane(selected.parent)
                              ? selected.parent?.businessObject?.name ||
                                "vai trò chưa đặt tên"
                              : selectedParticipant?.businessObject?.name ||
                                "bên tham gia chưa đặt tên"}
                          </strong>
                        </div>
                        <div>
                          <span>Hướng phân vai</span>
                          <strong>
                            {isHorizontalSwimlane(selected)
                              ? "Ngang · trên/dưới"
                              : "Dọc · trái/phải"}
                          </strong>
                        </div>
                        <fieldset className="bpmn-add-next">
                          <legend>Thêm vai trò cùng cấp</legend>
                          {isHorizontalSwimlane(selected) ? (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => addLane("top")}
                              >
                                Thêm vai trò phía trên
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => addLane("bottom")}
                              >
                                Thêm vai trò phía dưới
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => addLane("left")}
                              >
                                Thêm vai trò bên trái
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => addLane("right")}
                              >
                                Thêm vai trò bên phải
                              </Button>
                            </>
                          )}
                        </fieldset>
                        <div>
                          <span>Nội dung đang phụ trách</span>
                          <code>
                            {selectedLaneChildren.length} vai trò con ·{" "}
                            {selectedLaneDirectNodes.length} bước trực tiếp
                          </code>
                        </div>
                        {supportsNestedLanes(modelProfileId) &&
                        nestedProfileAcknowledged &&
                        laneDepth(selected) === 0 ? (
                          <fieldset className="bpmn-add-next">
                            <legend>Vai trò con · có thể hoàn tác một lần</legend>
                            {selectedLaneChildren.length === 0 ? (
                              <button
                                ref={
                                  selectedLaneChildren.length === 0
                                    ? roleDialogTriggerRef
                                    : undefined
                                }
                                type="button"
                                className="button button--secondary"
                                data-testid="open-child-role-dialog"
                                onClick={(event) =>
                                  openRoleDialog(
                                    event.currentTarget,
                                    "CREATE_CHILDREN",
                                  )
                                }
                              >
                                Thêm vai trò con
                              </button>
                            ) : (
                              <button
                                ref={roleDialogTriggerRef}
                                type="button"
                                className="button button--secondary"
                                data-testid="open-child-role-dialog"
                                disabled={
                                  !canAddChildRole(
                                    selectedLaneChildren.length,
                                  )
                                }
                                onClick={(event) =>
                                  openRoleDialog(
                                    event.currentTarget,
                                    "ADD_CHILD",
                                  )
                                }
                              >
                                Thêm một vai trò
                              </button>
                            )}
                            {selectedLaneChildren.length >=
                            maxChildRoleLanes ? (
                              <small>
                                Nhóm đã đạt giới hạn 8 vai trò con của ứng dụng.
                              </small>
                            ) : null}
                          </fieldset>
                        ) : laneDepth(selected) >=
                          maxCollaborationLaneDepth ? (
                          <small>
                            Sơ đồ hiện hỗ trợ tối đa 2 cấp vai trò.
                          </small>
                        ) : supportsNestedLanes(modelProfileId) &&
                          !nestedProfileAcknowledged ? (
                          <small>
                            Vai trò con sẽ mở sau khi máy chủ xác nhận thay đổi.
                          </small>
                        ) : !supportsNestedLanes(modelProfileId) ? (
                          <small>
                            Mở khả năng vai trò con để tiếp tục.
                          </small>
                        ) : null}
                      </details>
                    ) : null}
                    {selected.type === "bpmn:SubProcess" ? (
                      <section className="bpmn-artifact-editor">
                        <strong>Quy trình con</strong>
                        {selected.businessObject?.triggeredByEvent !== true ? <Button variant="secondary" disabled={profileUpgradeBusy || saveState === "CONFLICT"} onClick={() => {
                          const definition = bpmnLauncherToolDefinitions(authoringProfileId).find((item) => item.id === "timer-boundary-event");
                          if (definition) handleLauncherToolIntent({ ...definition, actionability: "usable", stateLabel: "Hẹn giờ chung", preparation: { kind: "none" } }, { kind: "place" }, new KeyboardEvent("keydown"));
                        }}>Hẹn giờ chung cho quy trình con</Button> : null}
                        <small>
                          Chứa {(selected.children ?? []).filter(isFlowNode).length}{" "}
                          bước · hỗ trợ tối đa một cấp. Việc di chuyển khung không
                          tự nhận các bước ở bên ngoài.
                        </small>
                      </section>
                    ) : null}
                    {selected.type === "bpmn:CallActivity" ? (
                      <section className="bpmn-artifact-editor">
                        <strong>Dùng lại quy trình</strong>
                        <div className="bpmn-inspector-field">
                          <span id="bpmn-call-activity-process-label">
                            Quy trình được dùng
                          </span>
                          <Select
                            id="bpmn-call-activity-process"
                            className="bpmn-inspector-select"
                            value={calledElementId}
                            options={callableProcessOptions}
                            onValueChange={setCalledElementId}
                            labelledBy="bpmn-call-activity-process-label"
                            describedBy="bpmn-call-activity-process-help"
                            disabled={callableProcesses.length === 0}
                          />
                          <small id="bpmn-call-activity-process-help">
                            Chọn một quy trình dùng chung khác với quy trình đang
                            chỉnh sửa.
                          </small>
                        </div>
                        <Button
                          variant="secondary"
                          disabled={!calledElementId}
                          onClick={() => {
                            const modeler = modelerRef.current;
                            if (!modeler) return;
                            getService(modeler, "commandStack").execute(
                              "teb.advanced.configureCallActivity",
                              { element: selected, calledElement: calledElementId },
                            );
                            setNotice(
                              "Đã liên kết bước này với quy trình được chọn.",
                            );
                          }}
                        >
                          Áp dụng quy trình
                        </Button>
                      </section>
                    ) : null}
                    {isDataReference(selected) ? (
                      <section className="bpmn-artifact-editor">
                        <strong>Nguồn dữ liệu</strong>
                        <small>
                          Dùng đường dữ liệu để nối mục này với một công việc.
                        </small>
                        {selected.type === "bpmn:DataStoreReference" ? (
                          <>
                            <div className="bpmn-inspector-field">
                              <span id="bpmn-data-store-reference-label">
                                Dùng lại kho dữ liệu
                              </span>
                              <Select
                                id="bpmn-data-store-reference"
                                className="bpmn-inspector-select"
                                value={selectedDataStoreId}
                                options={dataStoreReferenceOptions}
                                onValueChange={setSelectedDataStoreId}
                                labelledBy="bpmn-data-store-reference-label"
                                describedBy="bpmn-data-store-reference-help"
                                disabled={dataStores.length === 0}
                              />
                              <small id="bpmn-data-store-reference-help">
                                Chọn kho dữ liệu dùng chung cho thành phần này.
                              </small>
                            </div>
                            <Button
                              variant="secondary"
                              disabled={!selectedDataStoreId}
                              onClick={() => {
                                const modeler = modelerRef.current;
                                if (!modeler) return;
                                const registry = getService(
                                  modeler,
                                  "elementRegistry",
                                );
                                const anchor = registry
                                  .getAll()
                                  .find((element) => element.businessObject);
                                const definitions = findDefinitions(
                                  anchor?.businessObject as
                                    | Record<string, unknown>
                                    | undefined,
                                );
                                const dataStore = (
                                  (definitions?.rootElements as
                                    | Record<string, unknown>[]
                                    | undefined) ?? []
                                ).find(
                                  (root) =>
                                    root.$type === "bpmn:DataStore" &&
                                    root.id === selectedDataStoreId,
                                );
                                if (!dataStore) {
                                  setNotice(
                                    "Kho dữ liệu đã thay đổi; hãy chọn lại.",
                                  );
                                  return;
                                }
                                getService(modeler, "commandStack").execute(
                                  "teb.advanced.reuseDataStore",
                                  { element: selected, dataStore },
                                );
                                setNotice(
                                  "Đã dùng lại kho dữ liệu được chọn.",
                                );
                              }}
                            >
                              Áp dụng kho dữ liệu
                            </Button>
                          </>
                        ) : null}
                      </section>
                    ) : null}
                    {selected.type === "bpmn:ComplexGateway" ? (
                      <section
                        className="bpmn-artifact-editor"
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault();
                            const error = complexActivationError(
                              activationCondition,
                              graphemeCount(activationCondition),
                            );
                            if (error) return setNotice(error);
                            const modeler = modelerRef.current;
                            if (!modeler) return;
                            getService(modeler, "commandStack").execute(
                              "teb.advanced.configureComplexJoin",
                              {
                                element: selected,
                                activationCondition: activationCondition.trim(),
                              },
                            );
                            activationSnapshotRef.current =
                              activationCondition.trim();
                            setNotice(
                              "Đã áp dụng điều kiện hợp nhánh.",
                            );
                          }
                          if (event.key === "Escape") {
                            setActivationCondition(
                              activationSnapshotRef.current,
                            );
                          }
                        }}
                      >
                        <strong>Hợp nhánh theo điều kiện</strong>
                        <small>
                          Hiện có {selected.incoming?.length ?? 0} đường vào và{" "}
                          {selected.outgoing?.length ?? 0} đường ra. Cần ít nhất
                          2 đường vào và đúng 1 đường ra.
                        </small>
                        <label>
                          <span>Điều kiện hợp nhánh</span>
                          <textarea
                            rows={4}
                            value={activationCondition}
                            aria-invalid={
                              complexActivationError(
                                activationCondition,
                                graphemeCount(activationCondition),
                              )
                                ? "true"
                                : undefined
                            }
                            onChange={(event) =>
                              setActivationCondition(event.target.value)
                            }
                          />
                          <small>
                            {graphemeCount(activationCondition)}/500 · Ứng dụng
                            chỉ lưu mô tả này, không tự chạy. Nhấn Ctrl/⌘ + Enter
                            để áp dụng.
                          </small>
                        </label>
                        <Button
                          variant="secondary"
                          disabled={Boolean(
                            complexActivationError(
                              activationCondition,
                              graphemeCount(activationCondition),
                            ),
                          ) || (selected.incoming?.length ?? 0) < 2 ||
                            (selected.outgoing?.length ?? 0) !== 1}
                          onClick={() => {
                            const error = complexActivationError(
                              activationCondition,
                              graphemeCount(activationCondition),
                            );
                            if (error) return setNotice(error);
                            const modeler = modelerRef.current;
                            if (!modeler) return;
                            getService(modeler, "commandStack").execute(
                              "teb.advanced.configureComplexJoin",
                              {
                                element: selected,
                                activationCondition: activationCondition.trim(),
                              },
                            );
                            activationSnapshotRef.current =
                              activationCondition.trim();
                          }}
                        >
                          Áp dụng điều kiện
                        </Button>
                      </section>
                    ) : null}
                    {selected.type === "bpmn:SequenceFlow" ? (
                      <section
                        className="bpmn-routing-editor"
                        aria-labelledby="bpmn-routing-editor-title"
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault();
                            applySelectedSequenceFlowRouting();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRoutingDraft(routingSnapshotRef.current);
                            setNotice(
                              "Đã hoàn nguyên thay đổi điều kiện chưa áp dụng.",
                            );
                          }
                        }}
                      >
                        <div>
                          <strong id="bpmn-routing-editor-title">
                            Định tuyến nhánh
                          </strong>
                          <small>
                            {selectedSequenceSource?.name ||
                              "Bước chưa đặt tên"}{" "}
                            →{" "}
                            {selectedSequenceTarget?.name ||
                              "Bước chưa đặt tên"}
                          </small>
                        </div>
                        {canEditSelectedSequenceRouting ? (
                          <>
                            <label>
                              <span>Điều kiện</span>
                              <textarea
                                value={routingDraft.condition}
                                maxLength={maxSequenceFlowConditionLength}
                                rows={3}
                                disabled={routingDraft.isDefault}
                                aria-describedby="bpmn-routing-condition-help bpmn-routing-condition-count"
                                aria-invalid={routingError ? "true" : undefined}
                                onChange={(event) =>
                                  setRoutingDraft((current) =>
                                    editSequenceFlowRouting(current, {
                                      kind: "condition",
                                      value: event.target.value,
                                    }),
                                  )
                                }
                              />
                              <small id="bpmn-routing-condition-help">
                                Nhập điều kiện bằng chữ. Ứng dụng lưu để mô tả,
                                không tự chạy điều kiện này.
                              </small>
                              <small id="bpmn-routing-condition-count">
                                {routingDraft.condition.length}/
                                {maxSequenceFlowConditionLength}
                              </small>
                            </label>
                            <label className="bpmn-routing-default">
                              <input
                                type="checkbox"
                                checked={routingDraft.isDefault}
                                onChange={(event) =>
                                  setRoutingDraft((current) =>
                                    editSequenceFlowRouting(current, {
                                      kind: "default",
                                      checked: event.target.checked,
                                    }),
                                  )
                                }
                              />
                              <span>
                                <strong>Đặt làm nhánh mặc định</strong>
                                <small>
                                  Dùng khi không điều kiện nào khác khớp.
                                </small>
                              </span>
                            </label>
                            {routingError ? (
                              <small
                                className="bpmn-routing-error"
                                role="alert"
                              >
                                {routingError}
                              </small>
                            ) : null}
                            <Button
                              variant="secondary"
                              disabled={
                                Boolean(routingError) || saveState === "SAVING"
                              }
                              onClick={applySelectedSequenceFlowRouting}
                            >
                              Áp dụng điều kiện
                            </Button>
                          </>
                        ) : (
                          <small>
                            Điều kiện chỉ dùng cho đường đi ra từ điểm chọn một
                            hướng hoặc chọn một hay nhiều hướng.
                          </small>
                        )}
                      </section>
                    ) : null}
                    {selectedConnectionPresentation ? (
                      <section
                        className="bpmn-inspector-reference-summary"
                        aria-labelledby="bpmn-connection-summary-title"
                      >
                        <strong id="bpmn-connection-summary-title">
                          {selectedConnectionPresentation.title}
                        </strong>
                        <small>{selectedConnectionPresentation.direction}</small>
                        <dl>
                          <div>
                            <dt>Điểm đầu</dt>
                            <dd>{selectedConnectionPresentation.source}</dd>
                          </div>
                          <div>
                            <dt>Điểm cuối</dt>
                            <dd>{selectedConnectionPresentation.target}</dd>
                          </div>
                        </dl>
                      </section>
                    ) : null}
                    {selected.type === "bpmn:BoundaryEvent" ? (
                      <section className="bpmn-boundary-inspector">
                        <fieldset>
                          <legend>Khi sự kiện tại biên xảy ra</legend>
                          <label>
                            <input
                              type="radio"
                              name="bpmn-boundary-interrupting"
                              checked={
                                selected.businessObject?.cancelActivity !== false
                              }
                              onChange={() => setBoundaryInterrupting(true)}
                            />
                            Dừng công việc đang chạy
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="bpmn-boundary-interrupting"
                              checked={
                                selected.businessObject?.cancelActivity === false
                              }
                              onChange={() => setBoundaryInterrupting(false)}
                            />
                            Không ngắt
                          </label>
                        </fieldset>
                        <Button
                          variant="secondary"
                          onClick={focusBoundaryHost}
                        >
                          Đi tới công việc
                        </Button>
                      </section>
                    ) : null}
                    {isFlowNode(selected) ? (
                      <>
                        {branchBalancePlan ? (
                          <section className="bpmn-inspector-reference-summary" aria-label="Bố cục nhánh">
                            <strong>Bố cục nhánh</strong>
                            <small>{branchBalancePlan.ok
                              ? "Tự xếp đều các bước sau điểm chia nhánh. Giữ nguyên nội dung và đường nối."
                              : branchBalancePlan.reason}</small>
                            <Button variant="secondary"
                              disabled={!branchBalancePlan.ok || balancingBranches || saveState === "SAVING" || saveState === "CONFLICT"}
                              onClick={balanceSelectedBranches}>
                              Cân đối nhánh
                            </Button>
                          </section>
                        ) : null}
                        {isBoundaryHost(selected) &&
                        boundaryEventsProfileAcknowledged ? (
                          <fieldset className="bpmn-boundary-attach">
                            <legend>Gắn sự kiện biên</legend>
                            {bpmnBoundaryAttachActions(authoringProfileId, { type: selected.type, triggeredByEvent: selected.businessObject?.triggeredByEvent }).map(
                              (action) => (
                                <Button
                                  key={action.id}
                                  variant="secondary"
                                  onClick={() =>
                                    createByKeyboard(
                                      action.type,
                                      action.recipe,
                                    )
                                  }
                                >
                                  {action.id === "message-boundary-event"
                                    ? "Thông điệp"
                                    : "Hẹn giờ"}
                                </Button>
                              ),
                            )}
                          </fieldset>
                        ) : null}
                        {selected.type !== "bpmn:EndEvent" ? (
                          <fieldset className="bpmn-add-next">
                            <legend>Thêm bước tiếp theo</legend>
                            {bpmnAppendActions(authoringProfileId)
                              .filter(
                                (action) =>
                                  selected.type !== "bpmn:EventBasedGateway" ||
                                  [
                                    "message-catch-event",
                                    "timer-catch-event",
                                    "receive-task",
                                  ].includes(action.id),
                              )
                              .map((action) => (
                                  <Button
                                    key={action.id}
                                    variant="secondary"
                                    disabled={
                                      action.type === "bpmn:ParallelGateway" &&
                                      !structuredProfileAcknowledged
                                    }
                                    title={action.hint}
                                    onClick={() => addNext(action)}
                                  >
                                    <BpmnToolPresentationIcon
                                      toolId={action.id}
                                      size={15}
                                    />
                                    {action.label}
                                  </Button>
                              ))}
                          </fieldset>
                        ) : null}
                        {supportsNodeVisual(selected.type) ? (
                          <details className="bpmn-inspector-disclosure">
                            <summary>Biểu tượng minh hoạ</summary>
                            <BpmnNodeIconPicker
                              key={selected.id}
                              value={selectedNodeIcon(selected)}
                              onChange={setSelectedIcon}
                            />
                          </details>
                        ) : null}
                      </>
                    ) : null}
                    {supportsFullAuthoring(modelProfileId) &&
                    supportsBpmnElementColor(selected.type) ? (
                      <fieldset className="bpmn-element-color-picker">
                        <legend>
                          <Palette size={16} strokeWidth={1.5} />
                          Màu thành phần{selectedElements.length > 1 ? ` (${bpmnColorTargets(selectedElements).length} đã chọn)` : ""}
                        </legend>
                        <small>
                          Màu chỉ thay đổi cách nhìn, không thay đổi luồng hay ý
                          nghĩa của thành phần.
                        </small>
                        <div
                          role="radiogroup"
                          aria-label="Màu thành phần"
                        >
                          {bpmnElementColorPalette.map((color, colorIndex) => {
                            const checked = selectedColorId === color.id;
                            const isFallbackTabStop =
                              selectedColorId === null && colorIndex === 0;
                            return (
                              <button
                                key={color.id}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                tabIndex={
                                  checked || isFallbackTabStop ? 0 : -1
                                }
                                data-bpmn-color-id={color.id}
                                className={checked ? "is-selected" : undefined}
                                style={{
                                  "--bpmn-swatch-fill": color.fill,
                                  "--bpmn-swatch-stroke": color.stroke,
                                } as CSSProperties}
                                onClick={() => applyElementColor(color.id)}
                                onKeyDown={(event) => {
                                  if (
                                    ![
                                      "ArrowLeft",
                                      "ArrowRight",
                                      "ArrowUp",
                                      "ArrowDown",
                                      "Home",
                                      "End",
                                    ].includes(event.key)
                                  ) {
                                    return;
                                  }
                                  event.preventDefault();
                                  const nextIndex = nextBpmnElementColorIndex(
                                    colorIndex,
                                    bpmnElementColorPalette.length,
                                    event.key as BpmnElementColorGridKey,
                                  );
                                  const nextColor =
                                    bpmnElementColorPalette[nextIndex];
                                  if (!nextColor) return;
                                  const group = event.currentTarget.closest(
                                    '[role="radiogroup"]',
                                  );
                                  const nextButton = group?.querySelector<HTMLButtonElement>(
                                    `[data-bpmn-color-id="${nextColor.id}"]`,
                                  );
                                  if (nextColor.id !== selectedColorId) {
                                    applyElementColor(nextColor.id);
                                  }
                                  window.requestAnimationFrame(() =>
                                    nextButton?.focus(),
                                  );
                                }}
                              >
                                <i aria-hidden="true" />
                                <span>{color.label}</span>
                                {checked ? (
                                  <Check
                                    size={15}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => applyElementColor(null)}
                        >
                          Dùng màu mặc định
                        </Button>
                      </fieldset>
                    ) : null}
                    {supportsEditableBpmnName(selected.type) ? (
                      <Button variant="secondary" onClick={updateSelectedName}>
                        Áp dụng tên phần tử
                      </Button>
                    ) : null}
                    {isReparentableFlowNode(selected) &&
                    activityContainersProfileAcknowledged ? (
                      <section className="bpmn-artifact-editor bpmn-desktop-mutation bpmn-lifecycle-destructive">
                        <strong>Vị trí hiện tại</strong>
                        <span>
                          {outlineById.get(
                            outlineById.get(selected.id)?.parentContainerId ??
                              selected.parent?.id ??
                              "",
                          )?.name || "Quy trình chính"}
                        </span>
                        <Button
                          variant="secondary"
                          onClick={(event) =>
                            openReparentDialog(event.currentTarget, selected)
                          }
                        >
                          Di chuyển phần tử
                        </Button>
                      </section>
                    ) : null}
                    <button
                      ref={cascadeTriggerRef}
                      type="button"
                      className="button button--ghost bpmn-desktop-mutation bpmn-lifecycle-destructive"
                      disabled={
                        isLane(selected) && selectedLaneChildren.length > 0
                      }
                      onClick={() => deleteSelected()}
                    >
                      <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                      Xoá phần tử
                    </button>
                  </div>
                ) : (
                  <div className="bpmn-inspector-empty">
                    <MousePointer2 size={22} strokeWidth={1.5} />
                    <p>
                      Chọn một thành phần hoặc đường nối để xem và chỉnh sửa.
                    </p>
                  </div>
                )}
              </div>

              <section
                className="bpmn-version-history"
                id="bpmn-inspector-versions-panel"
                role="tabpanel"
                aria-labelledby="bpmn-inspector-diagram-tab bpmn-inspector-versions-subtab"
                hidden={inspectorView !== "versions"}
              >
                <strong id="bpmn-version-history-title">Các bản đã lưu</strong>
                {mobileViewer ? (
                  <p className="bpmn-version-history__readonly">
                    Dùng màn hình rộng để lưu mốc mới. Bạn vẫn có thể xem các
                    bản đã lưu bên dưới.
                  </p>
                ) : (
                  <>
                    <label className="bpmn-version-note">
                      <span>Ghi chú cho bản mới</span>
                      <input
                        ref={versionNoteRef}
                        value={versionNote}
                        maxLength={240}
                        placeholder="Ví dụ: Luồng duyệt bài đã chốt"
                        disabled={dirty || saveState === "SAVING" || versioning}
                        onChange={(event) => setVersionNote(event.target.value)}
                      />
                    </label>
                    <div className="bpmn-version-note__actions">
                      <Button
                        disabled={
                          dirty ||
                          saveState === "SAVING" ||
                          versioning ||
                          versionNote.trim().length === 0
                        }
                        onClick={() => void createVersion()}
                      >
                        <GitCommitHorizontal size={16} strokeWidth={1.5} />
                        {versioning ? "Đang lưu mốc…" : "Xác nhận lưu mốc"}
                      </Button>
                    </div>
                  </>
                )}
                {versions.length > 0 ? (
                  <ol>
                    {versions.map((version) => (
                      <li key={version.id}>
                        <span>
                          <b>v{version.versionNumber}</b>
                          <small>{version.note || "Không có ghi chú"}</small>
                        </span>
                        <Button
                          variant="ghost"
                          disabled={
                            (dirty && pendingRestoreVersionId !== version.id) || saveState === "SAVING" || versioning
                          }
                          onClick={() => void restoreVersion(version)}
                        >
                          Khôi phục
                        </Button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <small>Chưa có bản lưu cố định.</small>
                )}
              </section>

              <nav
                id="bpmn-inspector-structure-panel"
                role="tabpanel"
                aria-labelledby="bpmn-inspector-diagram-tab bpmn-inspector-structure-subtab"
                className="bpmn-outline"
                aria-label="Sơ đồ dạng văn bản"
                hidden={inspectorView !== "structure"}
              >
                <ol>
                  {outline.map((item) => (
                    <li key={item.id}>
                      <button
                        className={
                          item.parentContainerId ?? item.parentId
                            ? `is-nested outline-depth-${outlineDepth(item)}`
                            : undefined
                        }
                        onClick={() => selectOutlineElement(item.id)}
                        aria-current={
                          selected?.id === item.id ? "true" : undefined
                        }
                        aria-label={`${bpmnOutlineTypeLabel(item, outlineById)} ${bpmnOutlinePrimaryLabel(item)}, cấp ${outlineDepth(item) + 1}${
                          outlineColorLabel(item.id)
                            ? `, ${outlineColorLabel(item.id)}`
                            : ""
                        }`}
                      >
                        <span>{bpmnOutlineTypeLabel(item, outlineById)}</span>
                        <strong>{bpmnOutlinePrimaryLabel(item)}</strong>
                        <small>
                          {bpmnOutlineAdvancedMetadata(item) ??
                            `vào ${item.incoming.length} · ra ${item.outgoing.length}`}
                        </small>
                        {outlineColorLabel(item.id) ? (
                          <small>{outlineColorLabel(item.id)}</small>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
              <div
                id="bpmn-inspector-navigation-panel"
                role="tabpanel"
                aria-labelledby="bpmn-inspector-check-tab"
                className="bpmn-issues"
                aria-label="Kết quả kiểm tra sơ đồ"
                hidden={inspectorView !== "navigation"}
              >
                <BpmnValidationInspector
                  issues={issues}
                  outline={outline}
                  onNavigate={focusInspectionElement}
                />
              </div>
            </>
          )}
        </aside>
      </div>

      <BpmnDownloadDialog
        open={downloadDialogOpen}
        busy={downloading}
        onClose={() => {
          if (!downloading) setDownloadDialogOpen(false);
        }}
        onDownload={(format) => void downloadDiagram(format)}
      />

      {!mobileViewer ? (
        <dialog
          ref={roleDialogRef}
          className="bpmn-confirm-dialog bpmn-role-dialog bpmn-desktop-mutation"
          data-testid="swimlane-role-dialog"
          aria-labelledby="bpmn-role-dialog-title"
          aria-describedby="bpmn-role-dialog-description"
          onClose={() => roleDialogTriggerRef.current?.focus()}
        >
        <h2 id="bpmn-role-dialog-title">
          {roleDialogMode === "CREATE_CHILDREN"
            ? "Thêm vai trò con"
            : "Thêm một vai trò"}
        </h2>
        <p id="bpmn-role-dialog-description">
          Nhóm chức năng{" "}
          <strong>
            {isLane(selected)
              ? selected.businessObject?.name || "vai trò đang chọn"
              : "nhóm chức năng đang chọn"}
          </strong>
          . Mỗi vai trò tạo một vùng riêng để sắp xếp công việc.
        </p>
        {roleDialogMode === "CREATE_CHILDREN" ? (
          <fieldset className="bpmn-role-count">
            <legend>Số vai trò ban đầu</legend>
            {[2, 3].map((count) => (
              <button
                key={count}
                type="button"
                data-testid={`role-count-${count}`}
                aria-pressed={roleCount === count}
                onClick={() => setRoleCount(count as 2 | 3)}
              >
                {count} vai trò
              </button>
            ))}
          </fieldset>
        ) : null}
        <div className="bpmn-role-name-list">
          {roleDialogNames.map((name, index) => {
            const assessment = roleDialogAssessments[index]!;
            const inputId =
              roleDialogMode === "ADD_CHILD"
                ? "new-role-name"
                : `role-name-${index}`;
            const error =
              assessment.error === "required"
                ? "Tên vai trò không được để trống."
                : assessment.error === "too_long"
                  ? "Tên vai trò tối đa 120 ký tự."
                  : null;
            return (
              <label key={inputId}>
                <span>
                  {roleDialogMode === "ADD_CHILD"
                    ? "Tên vai trò"
                    : `Tên vai trò ${index + 1}`}
                </span>
                <input
                  data-testid={inputId}
                  value={name}
                  maxLength={240}
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={`${inputId}-feedback`}
                  onChange={(event) =>
                    setRoleNames((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                <small
                  id={`${inputId}-feedback`}
                  className={error ? "bpmn-routing-error" : undefined}
                  role={error ? "alert" : "status"}
                >
                  {error ??
                    (assessment.warning === "duplicate"
                      ? "Tên có thể trùng, nhưng mỗi vai trò vẫn được lưu riêng."
                      : `${assessment.graphemeCount}/120 ký tự`)}
                </small>
              </label>
            );
          })}
        </div>
        <div>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => roleDialogRef.current?.close()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                roleDialogRef.current?.close();
              }
            }}
          >
            Huỷ
          </button>
          <button
            type="button"
            className="button button--primary"
            data-testid={
              roleDialogMode === "CREATE_CHILDREN"
                ? "create-child-roles"
                : "add-child-role"
            }
            disabled={roleDialogAssessments.some(
              (assessment) => assessment.error !== undefined,
            )}
            onClick={confirmRoleDialog}
          >
            {roleDialogMode === "CREATE_CHILDREN"
              ? "Tạo vai trò con"
              : "Thêm vai trò"}
          </button>
        </div>
        </dialog>
      ) : null}
      <BpmnSwimlaneConversionDialog
        open={Boolean(swimlaneConversion)}
        orientation={swimlaneConversion?.orientation ?? "horizontal"}
        state={
          swimlaneConversion?.dialogState ?? { kind: "confirming" }
        }
        onCancel={cancelSwimlaneConversion}
        onConfirm={() => void executeSwimlaneConversion()}
        onRetry={() => void executeSwimlaneConversion()}
        onClosed={restoreComponentLauncherFocus}
      />
      <dialog
        ref={profileUpgradeDialogRef}
        className="bpmn-confirm-dialog bpmn-profile-upgrade-dialog"
        aria-labelledby="bpmn-profile-upgrade-title"
        aria-describedby="bpmn-profile-upgrade-description"
        aria-busy={
          profileUpgradeBusy || profileUpgradeIntent?.status === "in-flight"
        }
        onCancel={(event) => {
          event.preventDefault();
          if (!profileUpgradeBusy && !profileUpgradeInFlightRef.current) {
            cancelProfileUpgrade();
          }
        }}
        onClose={() => {
          setComponentLauncherMode({ kind: "place" });
          restoreComponentLauncherFocus();
        }}
      >
        <span className="mono-label">Chuẩn bị công cụ</span>
        <h2 id="bpmn-profile-upgrade-title">
          Đang chuẩn bị {profileUpgradeItem?.item.tool.label ?? "thành phần"}
        </h2>
        <p id="bpmn-profile-upgrade-description">
          Ứng dụng đang kiểm tra để dùng được thành phần này. Thành phần chỉ được
          thêm sau khi mọi bước hoàn tất; nếu có lỗi, sơ đồ vẫn giữ nguyên.
        </p>
        {profileUpgradeIntent ? (
          <ol className="bpmn-profile-upgrade-dialog__path">
            <li className="is-acknowledged">
              <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>Hiện tại</strong>
                <small>Sơ đồ đã được máy chủ xác nhận</small>
              </span>
            </li>
            {profileUpgradeIntent.plannedSteps.map((profileId, index) => {
              const acknowledged =
                index < profileUpgradeIntent.acknowledgedSteps.length;
              const inFlight =
                profileUpgradeIntent.status === "in-flight" &&
                profileUpgradeIntent.pendingStep.targetProfileId === profileId;
              return (
                <li
                  key={profileId}
                  className={cn(
                    acknowledged && "is-acknowledged",
                    inFlight && "is-in-flight",
                  )}
                >
                  {acknowledged ? (
                    <CheckCircle2
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  ) : inFlight ? (
                    <Clock3 size={16} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Circle size={16} strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>
                    <strong>Bước {index + 1}</strong>
                    <small>
                      {index === profileUpgradeIntent.plannedSteps.length - 1
                        ? "Hoàn tất khả năng tương thích"
                        : "Chuẩn bị khả năng tương thích"}
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {profileUpgradeIntent?.status === "blocked" ? (
          <p className="bpmn-profile-upgrade-dialog__error" role="alert">
            {profileUpgradeIntent.recovery === "RETRY_SAME_STEP"
              ? "Kết nối bị gián đoạn. Bạn có thể thử lại từ bước chưa hoàn tất."
              : profileUpgradeIntent.recovery ===
                  "REAUTHENTICATE_AND_RETRY"
                ? "Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử lại."
                : profileUpgradeIntent.recovery === "RELOAD_AND_REPLAN"
                  ? "Sơ đồ trên máy chủ đã thay đổi. Hãy tải lại rồi chọn lại thành phần."
                  : "Máy chủ từ chối bước chuẩn bị. Hãy kiểm tra sơ đồ rồi chọn lại thành phần."}
          </p>
        ) : (
          <p
            className="bpmn-profile-upgrade-dialog__status"
            role="status"
            aria-live="polite"
          >
            {profileUpgradeIntent?.status === "in-flight"
              ? `Đang thực hiện bước ${profileUpgradeIntent.pendingStep.ordinal}/${profileUpgradeIntent.pendingStep.total}…`
              : "Đang bắt đầu…"}
          </p>
        )}
        {profileUpgradeIntent?.status === "blocked" ? (
          <div>
            <button
              type="button"
              className="button button--ghost"
              onClick={cancelProfileUpgrade}
            >
              Đóng
            </button>
            {[
              "RETRY_SAME_STEP",
              "REAUTHENTICATE_AND_RETRY",
            ].includes(profileUpgradeIntent.recovery) ? (
              <button
                type="button"
                className="button button--primary"
                onClick={() => void executeProfileUpgrade()}
              >
                Thử lại
              </button>
            ) : null}
          </div>
        ) : null}
      </dialog>
      <dialog
        ref={cleanupDialogRef}
        role="alertdialog"
        className="bpmn-confirm-dialog bpmn-message-cleanup-dialog"
        aria-labelledby="bpmn-cleanup-dialog-title"
        aria-describedby="bpmn-cleanup-dialog-description"
        onClose={() => cleanupTriggerRef.current?.focus()}
      >
        <h2 id="bpmn-cleanup-dialog-title">
          Xoá thông điệp không còn sử dụng
        </h2>
        <p id="bpmn-cleanup-dialog-description">
          Chỉ thông điệp không còn được phần tử nào sử dụng mới có thể xoá.
           Ứng dụng sẽ kiểm tra lại ngay trước khi thực hiện.
        </p>
        <ul>
          {cleanupSnapshot.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.name || "Chưa đặt tên"}</strong>
              <span>{entry.referenceCount} nơi đang dùng</span>
              <details>
                <summary>Xem mã thông điệp</summary>
                <code>{entry.id}</code>
              </details>
            </li>
          ))}
        </ul>
        <div>
          <button
            type="button"
            className="button button--ghost"
            autoFocus
            onClick={() => cleanupDialogRef.current?.close()}
          >
            Huỷ
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={confirmMessageCleanup}
          >
            Xoá thông điệp
          </button>
        </div>
      </dialog>
      <BpmnReparentDialog
        dialogRef={reparentDialogRef}
        sourceLabel={reparentSourceLabel}
        sourceContainerLabel={reparentSourceContainerLabel}
        targets={reparentTargets}
        targetId={reparentTargetId}
        laneTargets={reparentLaneTargets}
        targetLaneId={reparentTargetLaneId}
        impact={reparentImpact}
        blockers={reparentBlockers}
        onTargetChange={(id) => {
          setReparentTargetId(id);
          setReparentTargetLaneId("");
          if (reparentPreview) {
            evaluateReparentTarget(reparentPreview, id, "");
          }
        }}
        onTargetLaneChange={(id) => {
          setReparentTargetLaneId(id);
          if (reparentPreview) {
            evaluateReparentTarget(
              reparentPreview,
              reparentTargetId,
              id,
            );
          }
        }}
        onCancel={() => reparentDialogRef.current?.close()}
        onConfirm={() => void confirmReparent()}
        onClose={() => reparentTriggerRef.current?.focus()}
      />
      <BpmnDeleteImpactDialog
        dialogRef={deleteImpactDialogRef}
        subjectLabel={deleteImpactSubjectLabel}
        groups={deleteImpactGroups}
        retainedRootIds={
          deleteImpactSnapshot?.retainedRootRegistryIds ?? []
        }
        onCancel={() => deleteImpactDialogRef.current?.close()}
        onConfirm={() => void confirmDeleteImpact()}
        onClose={() => deleteImpactTriggerRef.current?.focus()}
      />
      <BpmnDataStoreCleanupDialog
        dialogRef={dataStoreCleanupDialogRef}
        stores={(dataStoreCleanupSnapshot?.entries ?? []).map((entry) => ({
          id: entry.dataStoreId,
          name: entry.name,
          referenceIds: entry.referenceIds,
        }))}
        onCancel={() => dataStoreCleanupDialogRef.current?.close()}
        onConfirm={() => void confirmDataStoreCleanup()}
        onClose={() => dataStoreCleanupTriggerRef.current?.focus()}
      />
      <footer className="bpmn-studio__status">
        <span
          className={cn("bpmn-status-dot", dirty && "is-dirty")}
          aria-hidden="true"
        />
        <strong>
          {saveState === "ACKNOWLEDGED"
            ? "Đã lưu máy chủ"
            : saveState === "SAVING"
              ? "Đang lưu"
              : saveState === "CONFLICT"
                ? "Có bản mới trên máy chủ"
                : saveState === "ERROR"
                  ? "Chưa thể lưu"
                  : saveState === "LOADING"
                    ? "Đang tải"
                    : "Có thay đổi chưa lưu"}
        </strong>
        <span>{profileStageLabel(modelProfileId)}</span>
        <span>{versionCount} bản đã lưu</span>
        <span>{selectedElements.length ? `Đã chọn ${selectedElements.length} thành phần` : "Chưa chọn thành phần"}</span>
        {saveState === "CONFLICT" ? (
          <span className="bpmn-studio__recovery-actions">
            <Button
              variant="secondary"
              onClick={() => setDownloadDialogOpen(true)}
            >
              <Download size={14} strokeWidth={1.5} /> Tải bản đang chỉnh sửa
            </Button>
            <Button variant="secondary" onClick={() => setConflictDialogOpen(true)}>
              Giữ cả hai bản
            </Button>
          </span>
        ) : null}
        {saveState === "ERROR" ? (
          <Button variant="secondary" onClick={() => void persistCurrent()}>
            Thử lưu lại
          </Button>
        ) : null}
        <span className="bpmn-studio__live" role="status" aria-live="polite">
          {notice}
        </span>
      </footer>
    </div>
  );
}
