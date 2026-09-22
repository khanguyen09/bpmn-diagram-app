"use client";

import {
  Ban,
  Search,
  Shapes,
  Star,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  supportedCollaborationBpmnProfiles,
  isCollaborationBpmnProfileId,
} from "../domain/collaboration-profile";
import {
  supportedCoreBpmnProfiles,
  type BpmnProfileId,
} from "../domain/core-profile";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  bpmnNodeLibraryGroups,
  normalizeLibraryQuery,
  type BpmnLibraryGroup,
  type BpmnLibraryItem,
} from "./bpmn-node-library-catalogue";
import {
  BpmnToolPresentationIcon,
  bpmnToolPresentation,
  type BpmnToolPresentationKey,
} from "./bpmn-tool-presentation";

export type BpmnLauncherGroupId =
  | "connections"
  | "events"
  | "activities"
  | "gateways"
  | "data-artifacts"
  | "collaboration";

export type BpmnLauncherActionability = "usable" | "context-incompatible";

export type BpmnLauncherPreparation =
  | { readonly kind: "none" }
  | {
      readonly kind: "ordered-profile-ack";
      readonly minimumProfileId: BpmnProfileId;
      readonly minimumProfileLabel: string;
    }
  | {
      readonly kind: "in-place-swimlane-conversion";
      readonly minimumProfileId: BpmnProfileId;
      readonly minimumProfileLabel: string;
      readonly orientation: "horizontal" | "vertical";
    };

export type BpmnLauncherMode =
  | { readonly kind: "place" }
  | {
      readonly kind: "append";
      readonly sourceId: string;
      readonly sourceLabel: string;
    };

export interface BpmnLauncherContextState {
  readonly state: "context-incompatible";
  readonly reason: string;
}

export interface BpmnToolDefinition {
  readonly id: BpmnLibraryItem["id"];
  readonly tool: BpmnLibraryItem;
  readonly iconKey: BpmnToolPresentationKey;
  readonly groupId: BpmnLauncherGroupId;
  readonly groupLabel: string;
  readonly minimumProfileId: BpmnProfileId;
  readonly minimumProfileLabel: string;
  readonly placementMode: "connect" | "place" | "attach";
  readonly supportsDrag: boolean;
}

export interface BpmnLauncherItem extends BpmnToolDefinition {
  readonly actionability: BpmnLauncherActionability;
  readonly preparation: BpmnLauncherPreparation;
  readonly stateLabel: string;
}

export interface BpmnLauncherGroup {
  readonly id: BpmnLauncherGroupId;
  readonly label: string;
  readonly items: readonly BpmnLauncherItem[];
}

export interface BpmnComponentLauncherProps {
  readonly acknowledgedProfileId: BpmnProfileId;
  readonly open: boolean;
  readonly mode?: BpmnLauncherMode;
  readonly armedToolId?: BpmnLibraryItem["id"] | null;
  readonly contextState?: ReadonlyMap<
    BpmnLibraryItem["id"],
    BpmnLauncherContextState
  >;
  readonly onOpenChange: (open: boolean) => void;
  readonly onToolIntent: (
    item: BpmnLauncherItem,
    mode: BpmnLauncherMode,
    nativeEvent?: Event,
  ) => void;
  readonly onToolDragStart?: (
    event: ReactDragEvent<HTMLButtonElement>,
    item: BpmnLauncherItem,
  ) => void;
  readonly recentToolIds?: readonly BpmnLibraryItem["id"][];
  readonly favoriteToolIds?: readonly BpmnLibraryItem["id"][];
  readonly onToggleFavorite?: (toolId: BpmnLibraryItem["id"]) => void;
  readonly className?: string;
}

type BpmnLauncherView = "all" | "recent" | "favorites";

interface BpmnProfileSummary {
  readonly id: BpmnProfileId;
  readonly label: string;
}

interface RenderedLauncherTile {
  readonly key: string;
  readonly item: BpmnLauncherItem;
}

const launcherGroupOrder: readonly BpmnLauncherGroupId[] = [
  "connections",
  "events",
  "activities",
  "gateways",
  "data-artifacts",
  "collaboration",
];

const launcherGroupLabels: Readonly<Record<BpmnLauncherGroupId, string>> = {
  connections: "Kết nối",
  events: "Sự kiện",
  activities: "Hoạt động",
  gateways: "Điểm quyết định",
  "data-artifacts": "Dữ liệu & chú thích",
  collaboration: "Cộng tác & phân vai",
};

export const commonBpmnLauncherToolIds = [
  "start-event",
  "end-event",
  "task",
  "exclusive-gateway",
  "sequence-flow",
] as const satisfies readonly BpmnLibraryItem["id"][];

const recipesWithoutDrag = new Set([
  "titled-group",
  "expanded-subprocess-starter",
  "call-activity",
  "data-object",
  "data-store",
  "swimlane-frame",
]);

const defaultLauncherMode: BpmnLauncherMode = { kind: "place" };

function bpmnLauncherPreparationLabel(
  preparation: BpmnLauncherPreparation,
): string {
  if (preparation.kind === "ordered-profile-ack") {
    return "Có thể dùng ngay; hệ thống sẽ tự chuẩn bị khi bạn chọn.";
  }
  if (preparation.kind === "in-place-swimlane-conversion") {
    return "Có thể dùng trong sơ đồ này sau một bước chuẩn bị.";
  }
  return "Sẵn sàng sử dụng";
}

function launcherGroupFor(
  sourceGroupId: BpmnLibraryGroup["id"],
  item: BpmnLibraryItem,
): BpmnLauncherGroupId {
  if (item.kind === "connector") return "connections";
  if (sourceGroupId === "events") return "events";
  if (sourceGroupId === "activities" || sourceGroupId === "structure-reuse") {
    return "activities";
  }
  if (sourceGroupId === "gateways" || sourceGroupId === "advanced-routing") {
    return "gateways";
  }
  if (sourceGroupId === "collaboration") return "collaboration";
  return "data-artifacts";
}

function profileContainsTool(
  profileId: BpmnProfileId,
  toolId: BpmnLibraryItem["id"],
): boolean {
  return bpmnNodeLibraryGroups(profileId).some((group) =>
    group.items.some((item) => item.id === toolId),
  );
}

export function bpmnLauncherItemSupportsDrag(item: BpmnLibraryItem): boolean {
  return item.kind === "shape" && !recipesWithoutDrag.has(item.recipe.kind);
}

function placementMode(item: BpmnLibraryItem): BpmnToolDefinition["placementMode"] {
  if (item.kind === "connector") return "connect";
  return item.recipe.kind === "boundary-event" ? "attach" : "place";
}

function buildFamilyToolDefinitions(
  profiles: readonly BpmnProfileSummary[],
): readonly BpmnToolDefinition[] {
  const latestProfile = profiles.at(-1);
  if (!latestProfile) return [];

  const seen = new Set<BpmnLibraryItem["id"]>();
  const definitions: BpmnToolDefinition[] = [];
  for (const sourceGroup of bpmnNodeLibraryGroups(latestProfile.id)) {
    for (const tool of sourceGroup.items) {
      if (seen.has(tool.id)) continue;
      seen.add(tool.id);
      const minimumProfile =
        profiles.find((profile) => profileContainsTool(profile.id, tool.id)) ??
        latestProfile;
      const groupId = launcherGroupFor(sourceGroup.id, tool);
      definitions.push({
        id: tool.id,
        tool,
        iconKey: bpmnToolPresentation(tool.id).key,
        groupId,
        groupLabel: launcherGroupLabels[groupId],
        minimumProfileId: minimumProfile.id,
        minimumProfileLabel: minimumProfile.label,
        placementMode: placementMode(tool),
        supportsDrag: bpmnLauncherItemSupportsDrag(tool),
      });
    }
  }
  return definitions;
}

const coreToolDefinitions = buildFamilyToolDefinitions(
  supportedCoreBpmnProfiles as readonly BpmnProfileSummary[],
);
const collaborationToolDefinitions = buildFamilyToolDefinitions(
  supportedCollaborationBpmnProfiles as readonly BpmnProfileSummary[],
);

const coreSwimlaneBridgePresentations = [
  {
    id: "horizontal-swimlane-frame",
    orientation: "horizontal",
    label: "Phân vai ngang · 2 vai trò",
    hint: "Chia quy trình hiện tại thành hai vai trò xếp trên và dưới.",
    aliases: [
      "swimlane ngang",
      "vai tro ngang",
      "horizontal swimlane",
      "horizontal lanes",
      "horizontal roles",
      "row roles",
    ],
  },
  {
    id: "vertical-swimlane-frame",
    orientation: "vertical",
    label: "Phân vai dọc · 2 vai trò",
    hint: "Chia quy trình hiện tại thành hai vai trò xếp trái và phải.",
    aliases: [
      "swimlane doc",
      "vai tro doc",
      "vertical swimlane",
      "vertical lanes",
      "vertical roles",
      "column roles",
    ],
  },
] as const satisfies readonly {
  readonly id: BpmnLibraryItem["id"];
  readonly orientation: "horizontal" | "vertical";
  readonly label: string;
  readonly hint: string;
  readonly aliases: readonly string[];
}[];

const coreSwimlaneBridgeDefinitions = coreSwimlaneBridgePresentations.flatMap(
  (presentation) => {
    const definition = collaborationToolDefinitions.find(
      (candidate) => candidate.id === presentation.id,
    );
    if (!definition) return [];
    return [
      {
        ...definition,
        tool: {
          ...definition.tool,
          label: presentation.label,
          hint: presentation.hint,
          aliases: [...definition.tool.aliases, ...presentation.aliases],
        },
        supportsDrag: false,
      } satisfies BpmnToolDefinition,
    ];
  },
);

export const allBpmnLauncherToolIds = Array.from(
  new Set(
    [...coreToolDefinitions, ...collaborationToolDefinitions].map(
      (definition) => definition.id,
    ),
  ),
) as readonly BpmnLibraryItem["id"][];

function coreSwimlaneBridgeOrientation(
  toolId: BpmnLibraryItem["id"],
): "horizontal" | "vertical" | null {
  return (
    coreSwimlaneBridgePresentations.find(
      (presentation) => presentation.id === toolId,
    )?.orientation ?? null
  );
}

export function bpmnLauncherToolDefinitions(
  acknowledgedProfileId: BpmnProfileId,
): readonly BpmnToolDefinition[] {
  return isCollaborationBpmnProfileId(acknowledgedProfileId)
    ? collaborationToolDefinitions
    : coreToolDefinitions;
}

export function filterBpmnLauncherGroups(
  groups: readonly BpmnLauncherGroup[],
  query: string,
): readonly BpmnLauncherGroup[] {
  const normalizedQuery = normalizeLibraryQuery(query);
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    const items = group.items.filter((item) => {
      const semanticName =
        item.tool.kind === "shape" ? item.tool.type : item.tool.connector;
      return normalizeLibraryQuery(
        [
          item.id,
          item.tool.label,
          item.tool.hint,
          semanticName,
          item.groupLabel,
          item.minimumProfileLabel,
          bpmnLauncherPreparationLabel(item.preparation),
          item.stateLabel,
          ...item.tool.aliases,
        ].join(" "),
      ).includes(normalizedQuery);
    });
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function projectBpmnLauncherGroups({
  acknowledgedProfileId,
  query = "",
  contextState,
}: {
  readonly acknowledgedProfileId: BpmnProfileId;
  readonly query?: string;
  readonly contextState?: ReadonlyMap<
    BpmnLibraryItem["id"],
    BpmnLauncherContextState
  >;
}): readonly BpmnLauncherGroup[] {
  const acknowledgedToolIds = new Set(
    bpmnNodeLibraryGroups(acknowledgedProfileId).flatMap((group) =>
      group.items.map((item) => item.id),
    ),
  );
  const grouped = new Map<BpmnLauncherGroupId, BpmnLauncherItem[]>();
  const coreSwimlaneBridgeEnabled = !isCollaborationBpmnProfileId(
    acknowledgedProfileId,
  );
  const definitions = coreSwimlaneBridgeEnabled
    ? [
        ...bpmnLauncherToolDefinitions(acknowledgedProfileId),
        ...coreSwimlaneBridgeDefinitions,
      ]
    : bpmnLauncherToolDefinitions(acknowledgedProfileId);

  for (const definition of definitions) {
    const context = contextState?.get(definition.id);
    const swimlaneOrientation = coreSwimlaneBridgeEnabled
      ? coreSwimlaneBridgeOrientation(definition.id)
      : null;
    const preparation: BpmnLauncherPreparation = swimlaneOrientation
      ? {
          kind: "in-place-swimlane-conversion",
          minimumProfileId: definition.minimumProfileId,
          minimumProfileLabel: definition.minimumProfileLabel,
          orientation: swimlaneOrientation,
        }
      : acknowledgedToolIds.has(definition.id)
        ? { kind: "none" }
        : {
            kind: "ordered-profile-ack",
            minimumProfileId: definition.minimumProfileId,
            minimumProfileLabel: definition.minimumProfileLabel,
          };
    const item: BpmnLauncherItem = {
      ...definition,
      actionability: context ? "context-incompatible" : "usable",
      preparation,
      stateLabel: context
        ? context.reason.trim() || "Không phù hợp với ngữ cảnh hiện tại"
        : bpmnLauncherPreparationLabel(preparation),
    };
    const items = grouped.get(definition.groupId) ?? [];
    items.push(item);
    grouped.set(definition.groupId, items);
  }

  const groups = launcherGroupOrder.flatMap((id) => {
    const items = grouped.get(id) ?? [];
    return items.length > 0
      ? [{ id, label: launcherGroupLabels[id], items } satisfies BpmnLauncherGroup]
      : [];
  });
  return filterBpmnLauncherGroups(groups, query);
}

export function flattenBpmnLauncherItems(
  groups: readonly BpmnLauncherGroup[],
): readonly BpmnLauncherItem[] {
  return groups.flatMap((group) => group.items);
}

export type BpmnLauncherGridKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End";

export function nextBpmnLauncherGridIndex(
  currentIndex: number,
  itemCount: number,
  key: BpmnLauncherGridKey,
  columns = 5,
): number {
  if (itemCount <= 0) return -1;
  const lastIndex = itemCount - 1;
  const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
  const safeColumns = Math.max(1, Math.floor(columns));
  if (key === "Home") return 0;
  if (key === "End") return lastIndex;
  if (key === "ArrowLeft") return Math.max(0, safeIndex - 1);
  if (key === "ArrowRight") return Math.min(lastIndex, safeIndex + 1);
  if (key === "ArrowUp") return Math.max(0, safeIndex - safeColumns);
  return Math.min(lastIndex, safeIndex + safeColumns);
}

function BpmnComponentTile({
  renderKey,
  item,
  mode,
  armed,
  active,
  setButtonRef,
  onFocus,
  onPreview,
  onNavigate,
  onIntent,
  onDragStart,
}: {
  readonly renderKey: string;
  readonly item: BpmnLauncherItem;
  readonly mode: BpmnLauncherMode;
  readonly armed: boolean;
  readonly active: boolean;
  readonly setButtonRef: (key: string, node: HTMLButtonElement | null) => void;
  readonly onFocus: (key: string) => void;
  readonly onPreview: (key: string | null) => void;
  readonly onNavigate: (key: string, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  readonly onIntent: (item: BpmnLauncherItem, nativeEvent: Event) => void;
  readonly onDragStart?: (
    event: ReactDragEvent<HTMLButtonElement>,
    item: BpmnLauncherItem,
  ) => void;
}) {
  const suppressKeyboardClickRef = useRef(false);
  const draggable =
    item.actionability === "usable" && item.supportsDrag && Boolean(onDragStart);
  const accessibleName = [
    item.tool.label,
    item.tool.hint,
    item.stateLabel,
    mode.kind === "append" ? `Nối sau ${mode.sourceLabel}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .map((part) => {
      const sentence = part.trim().replace(/\.+$/u, "");
      return sentence ? `${sentence}.` : "";
    })
    .filter(Boolean)
    .join(" ");

  const activateFromKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    suppressKeyboardClickRef.current = true;
    onIntent(item, event.nativeEvent);
  };

  return (
    <div className="bpmn-component-tile" role="listitem">
      <button
        ref={(node) => setButtonRef(renderKey, node)}
        type="button"
        className={cn(
          "bpmn-component-tile__button",
          armed && "is-armed",
          item.actionability === "context-incompatible" &&
            "is-context-incompatible",
        )}
        data-bpmn-tool-id={item.id}
        data-bpmn-tool-icon={item.iconKey}
        data-bpmn-tool-group={item.groupId}
        data-bpmn-tool-actionability={item.actionability}
        data-bpmn-tool-preparation={item.preparation.kind}
        aria-label={accessibleName}
        aria-pressed={item.actionability === "usable" ? armed : undefined}
        tabIndex={active ? 0 : -1}
        draggable={draggable}
        onFocus={() => onFocus(renderKey)}
        onPointerEnter={() => onPreview(renderKey)}
        onPointerLeave={() => onPreview(null)}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          if (suppressKeyboardClickRef.current) {
            suppressKeyboardClickRef.current = false;
            return;
          }
          onIntent(item, event.nativeEvent);
        }}
        onKeyDown={(event) => {
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
              event.key,
            )
          ) {
            onNavigate(renderKey, event);
            return;
          }
          activateFromKeyboard(event);
        }}
        onKeyUp={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          window.queueMicrotask(() => {
            suppressKeyboardClickRef.current = false;
          });
        }}
        onDragStart={
          draggable ? (event) => onDragStart?.(event, item) : undefined
        }
      >
        <span className="bpmn-component-tile__glyph" aria-hidden="true">
          <BpmnToolPresentationIcon toolId={item.id} />
        </span>
        <span className="sr-only">{item.tool.label}</span>
        {item.actionability === "context-incompatible" ? (
          <Badge
            className="bpmn-component-tile__state"
            tone="neutral"
            aria-hidden="true"
          >
            <Ban size={12} strokeWidth={1.5} />
          </Badge>
        ) : null}
      </button>
    </div>
  );
}

export function BpmnComponentLauncher({
  acknowledgedProfileId,
  open,
  mode = defaultLauncherMode,
  armedToolId = null,
  contextState,
  onOpenChange,
  onToolIntent,
  onToolDragStart,
  recentToolIds = [],
  favoriteToolIds = [],
  onToggleFavorite,
  className,
}: BpmnComponentLauncherProps) {
  const panelId = useId();
  const headingId = `${panelId}-heading`;
  const statusId = `${panelId}-status`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const wasOpenRef = useRef(false);
  const restoreTriggerFocusRef = useRef(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<BpmnLauncherView>("all");
  const [activeTileKey, setActiveTileKey] = useState<string | null>(null);
  const [previewTileKey, setPreviewTileKey] = useState<string | null>(null);

  const catalogGroups = useMemo(
    () =>
      projectBpmnLauncherGroups({
        acknowledgedProfileId,
        contextState,
      }),
    [acknowledgedProfileId, contextState],
  );
  const catalogItems = useMemo(
    () => flattenBpmnLauncherItems(catalogGroups),
    [catalogGroups],
  );
  const searchedGroups = useMemo(
    () => filterBpmnLauncherGroups(catalogGroups, query),
    [catalogGroups, query],
  );
  const normalizedQuery = normalizeLibraryQuery(query);
  const commonItems = useMemo(() => {
    if (normalizedQuery || view !== "all") return [];
    const itemsById = new Map(catalogItems.map((item) => [item.id, item]));
    return commonBpmnLauncherToolIds.flatMap((id) => {
      const item = itemsById.get(id);
      return item ? [item] : [];
    });
  }, [catalogItems, normalizedQuery, view]);
  const preferenceItems = useMemo(() => {
    if (normalizedQuery || view === "all") return [];
    const itemsById = new Map(catalogItems.map((item) => [item.id, item]));
    const requestedIds = view === "recent" ? recentToolIds : favoriteToolIds;
    return requestedIds.flatMap((id) => {
      const item = itemsById.get(id);
      return item ? [item] : [];
    });
  }, [catalogItems, favoriteToolIds, normalizedQuery, recentToolIds, view]);
  const featuredItems = view === "all" ? commonItems : preferenceItems;
  const featuredLabel =
    view === "recent"
      ? "Gần đây"
      : view === "favorites"
        ? "Yêu thích"
        : "Thường dùng";
  const categorizedGroups = useMemo(() => {
    if (normalizedQuery) return searchedGroups;
    if (view !== "all") return [];
    if (commonItems.length === 0) return catalogGroups;
    const commonIds = new Set(commonItems.map((item) => item.id));
    return catalogGroups.flatMap((group) => {
      const items = group.items.filter((item) => !commonIds.has(item.id));
      return items.length > 0 ? [{ ...group, items }] : [];
    });
  }, [catalogGroups, commonItems, normalizedQuery, searchedGroups, view]);
  const renderedTiles = useMemo<readonly RenderedLauncherTile[]>(
    () => [
      ...featuredItems.map((item) => ({ key: `${view}-${item.id}`, item })),
      ...categorizedGroups.flatMap((group) =>
        group.items.map((item) => ({ key: `${group.id}-${item.id}`, item })),
      ),
    ],
    [categorizedGroups, featuredItems, view],
  );
  const visibleItemCount = renderedTiles.length;

  useEffect(() => {
    if (open) {
      restoreTriggerFocusRef.current = true;
      const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
      wasOpenRef.current = true;
      return () => window.cancelAnimationFrame(frame);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const shouldRestoreFocus = restoreTriggerFocusRef.current;
      restoreTriggerFocusRef.current = true;
      if (shouldRestoreFocus) {
        const frame = window.requestAnimationFrame(() => triggerRef.current?.focus());
        return () => window.cancelAnimationFrame(frame);
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        restoreTriggerFocusRef.current = false;
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [onOpenChange, open]);

  const resolvedActiveTileKey = renderedTiles.some(
    (tile) => tile.key === activeTileKey,
  )
    ? activeTileKey
    : (renderedTiles[0]?.key ?? null);
  const resolvedPreviewTile =
    renderedTiles.find((tile) => tile.key === previewTileKey) ??
    renderedTiles.find((tile) => tile.key === resolvedActiveTileKey);

  const setButtonRef = (key: string, node: HTMLButtonElement | null) => {
    if (node) tileRefs.current.set(key, node);
    else tileRefs.current.delete(key);
  };

  const focusTile = (index: number) => {
    const tile = renderedTiles[index];
    if (!tile) return;
    setActiveTileKey(tile.key);
    tileRefs.current.get(tile.key)?.focus();
  };

  const navigateTile = (
    renderKey: string,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    const key = event.key as BpmnLauncherGridKey;
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
        key,
      )
    ) {
      return;
    }
    event.preventDefault();
    const currentIndex = renderedTiles.findIndex((tile) => tile.key === renderKey);
    focusTile(
      nextBpmnLauncherGridIndex(currentIndex, renderedTiles.length, key),
    );
  };

  const emitIntent = (item: BpmnLauncherItem, nativeEvent: Event) => {
    onToolIntent(item, mode, nativeEvent);
    if (item.actionability === "usable") {
      restoreTriggerFocusRef.current = true;
      onOpenChange(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("bpmn-component-launcher", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="button button--secondary bpmn-component-launcher__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          restoreTriggerFocusRef.current = true;
          onOpenChange(!open);
        }}
      >
        <Shapes size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Thành phần</span>
      </button>

      {open ? (
        <section
          id={panelId}
          className={cn(
            "bpmn-component-launcher__panel",
            mode.kind === "append" && "is-append",
          )}
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          aria-describedby={statusId}
          onKeyDownCapture={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            restoreTriggerFocusRef.current = true;
            onOpenChange(false);
          }}
        >
          <header className="bpmn-component-launcher__header">
            <div>
              <span className="mono-label">Thư viện thành phần</span>
              <h2 id={headingId}>Chọn thành phần</h2>
            </div>
            <Button
              variant="ghost"
              className="bpmn-component-launcher__close"
              aria-label="Đóng thư viện thành phần"
              onClick={() => {
                restoreTriggerFocusRef.current = true;
                onOpenChange(false);
              }}
            >
              <X size={17} strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </header>

          {mode.kind === "append" ? (
            <p className="bpmn-component-launcher__context">
              Thêm sau <strong>{mode.sourceLabel}</strong>
            </p>
          ) : null}

          <label className="bpmn-component-launcher__search">
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">
              Tìm thành phần theo tên hoặc công dụng
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Tìm công việc, điểm quyết định, dữ liệu…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" || renderedTiles.length === 0) return;
                event.preventDefault();
                focusTile(0);
              }}
            />
          </label>
          <p id={statusId} role="status" aria-live="polite">
            {visibleItemCount} thành phần phù hợp
          </p>

          <div
            className="bpmn-component-launcher__views"
            role="group"
            aria-label="Cách xem thành phần"
          >
            {(
              [
                ["all", "Tất cả"],
                ["recent", "Gần đây"],
                ["favorites", "Yêu thích"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => {
                  setView(id);
                  setActiveTileKey(null);
                  setPreviewTileKey(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <small className="bpmn-component-launcher__preference-note">
            Gần đây và Yêu thích chỉ lưu trên trình duyệt này.
          </small>

          <div
            className="bpmn-component-launcher__preview"
            data-bpmn-tool-group={resolvedPreviewTile?.item.groupId}
            aria-label="Mô tả thành phần đang xem"
            aria-live="polite"
            aria-atomic="true"
          >
            {resolvedPreviewTile ? (
              <>
                <span
                  className="bpmn-component-launcher__preview-glyph"
                  aria-hidden="true"
                >
                  <BpmnToolPresentationIcon
                    toolId={resolvedPreviewTile.item.id}
                  />
                </span>
                <span>
                  <strong>{resolvedPreviewTile.item.tool.label}</strong>
                  <small>{resolvedPreviewTile.item.tool.hint}</small>
                </span>
                <em>{resolvedPreviewTile.item.stateLabel}</em>
                {onToggleFavorite ? (
                  <button
                    type="button"
                    className="bpmn-component-launcher__favorite"
                    aria-label={`${
                      favoriteToolIds.includes(resolvedPreviewTile.item.id)
                        ? "Bỏ khỏi"
                        : "Thêm vào"
                    } mục yêu thích: ${resolvedPreviewTile.item.tool.label}`}
                    aria-pressed={favoriteToolIds.includes(
                      resolvedPreviewTile.item.id,
                    )}
                    onClick={() => onToggleFavorite(resolvedPreviewTile.item.id)}
                  >
                    <Star
                      size={16}
                      fill={
                        favoriteToolIds.includes(resolvedPreviewTile.item.id)
                          ? "currentColor"
                          : "none"
                      }
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span>Yêu thích</span>
                  </button>
                ) : null}
              </>
            ) : (
              <span>
                <strong>Chọn một thành phần</strong>
                <small>Dùng phím mũi tên hoặc rê chuột để xem mô tả.</small>
              </span>
            )}
          </div>

          <div className="bpmn-component-launcher__scroll">
            {featuredItems.length > 0 ? (
              <section className="bpmn-component-launcher__group">
                <div className="bpmn-component-launcher__group-heading">
                  <h3>{featuredLabel}</h3>
                  <span>{featuredItems.length}</span>
                </div>
                <div
                  className="bpmn-component-launcher__grid"
                  role="list"
                  aria-label={`Thành phần ${featuredLabel.toLocaleLowerCase()}`}
                >
                  {featuredItems.map((item) => {
                    const renderKey = `${view}-${item.id}`;
                    return (
                      <BpmnComponentTile
                        key={renderKey}
                        renderKey={renderKey}
                        item={item}
                        mode={mode}
                        armed={armedToolId === item.id}
                        active={resolvedActiveTileKey === renderKey}
                        setButtonRef={setButtonRef}
                        onFocus={(key) => {
                          setPreviewTileKey(null);
                          setActiveTileKey(key);
                        }}
                        onPreview={setPreviewTileKey}
                        onNavigate={navigateTile}
                        onIntent={emitIntent}
                        onDragStart={onToolDragStart}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            {categorizedGroups.map((group) => (
              <section key={group.id} className="bpmn-component-launcher__group">
                <div className="bpmn-component-launcher__group-heading">
                  <h3>{group.label}</h3>
                  <span>{group.items.length}</span>
                </div>
                <div
                  className="bpmn-component-launcher__grid"
                  role="list"
                  aria-label={group.label}
                >
                  {group.items.map((item) => {
                    const renderKey = `${group.id}-${item.id}`;
                    return (
                      <BpmnComponentTile
                        key={renderKey}
                        renderKey={renderKey}
                        item={item}
                        mode={mode}
                        armed={armedToolId === item.id}
                        active={resolvedActiveTileKey === renderKey}
                        setButtonRef={setButtonRef}
                        onFocus={(key) => {
                          setPreviewTileKey(null);
                          setActiveTileKey(key);
                        }}
                        onPreview={setPreviewTileKey}
                        onNavigate={navigateTile}
                        onIntent={emitIntent}
                        onDragStart={onToolDragStart}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            {categorizedGroups.length === 0 && featuredItems.length === 0 ? (
              <div className="bpmn-component-launcher__empty">
                <Search size={20} strokeWidth={1.5} aria-hidden="true" />
                <strong>
                  {normalizedQuery
                    ? "Không tìm thấy thành phần"
                    : view === "recent"
                      ? "Chưa có thành phần gần đây"
                      : "Chưa có thành phần yêu thích"}
                </strong>
                <small>
                  {normalizedQuery
                    ? "Thử “công việc”, “quyết định”, “bên tham gia” hoặc “thông điệp”."
                    : view === "recent"
                      ? "Thành phần sẽ xuất hiện ở đây sau khi được đặt thành công."
                      : "Mở Tất cả rồi đánh dấu thành phần bạn muốn dùng lại."}
                </small>
              </div>
            ) : null}
          </div>

        </section>
      ) : null}
    </div>
  );
}
