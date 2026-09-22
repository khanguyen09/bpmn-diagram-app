import type { BpmnLibraryItem } from "./bpmn-node-library-catalogue";

export type BpmnToolId = BpmnLibraryItem["id"];

export interface BpmnToolPresentationPreferences {
  readonly version: 1;
  readonly recentToolIds: readonly BpmnToolId[];
  readonly favoriteToolIds: readonly BpmnToolId[];
}

export const bpmnToolPreferencesStorageKey =
  "teb:bpmn-tool-presentation-preferences@1";
export const maxRecentBpmnTools = 8;
export const maxFavoriteBpmnTools = 12;
export const maxBpmnToolPreferencesSerializedLength = 4_096;

export const emptyBpmnToolPreferences: BpmnToolPresentationPreferences = {
  version: 1,
  recentToolIds: [],
  favoriteToolIds: [],
};

function uniqueToolIds(
  value: unknown,
  knownToolIds: ReadonlySet<BpmnToolId>,
  maximum: number,
): readonly BpmnToolId[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const unique: BpmnToolId[] = [];
  const seen = new Set<BpmnToolId>();
  for (const candidate of value) {
    if (typeof candidate !== "string") return null;
    const toolId = candidate as BpmnToolId;
    if (!knownToolIds.has(toolId)) return null;
    if (!seen.has(toolId)) {
      seen.add(toolId);
      unique.push(toolId);
    }
  }
  return unique;
}

export function parseBpmnToolPreferences(
  serialized: string | null,
  knownToolIds: ReadonlySet<BpmnToolId>,
): BpmnToolPresentationPreferences {
  if (
    !serialized ||
    serialized.length > maxBpmnToolPreferencesSerializedLength
  ) {
    return emptyBpmnToolPreferences;
  }
  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    if (!value || value.version !== 1) return emptyBpmnToolPreferences;
    const recentToolIds = uniqueToolIds(
      value.recentToolIds,
      knownToolIds,
      maxRecentBpmnTools,
    );
    const favoriteToolIds = uniqueToolIds(
      value.favoriteToolIds,
      knownToolIds,
      maxFavoriteBpmnTools,
    );
    if (!recentToolIds || !favoriteToolIds) return emptyBpmnToolPreferences;
    return { version: 1, recentToolIds, favoriteToolIds };
  } catch {
    return emptyBpmnToolPreferences;
  }
}

export function loadBpmnToolPreferences(
  storage: Pick<Storage, "getItem">,
  knownToolIds: ReadonlySet<BpmnToolId>,
): BpmnToolPresentationPreferences {
  try {
    return parseBpmnToolPreferences(
      storage.getItem(bpmnToolPreferencesStorageKey),
      knownToolIds,
    );
  } catch {
    return emptyBpmnToolPreferences;
  }
}

export function saveBpmnToolPreferences(
  storage: Pick<Storage, "setItem">,
  preferences: BpmnToolPresentationPreferences,
): boolean {
  try {
    storage.setItem(bpmnToolPreferencesStorageKey, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function recordRecentBpmnTool(
  preferences: BpmnToolPresentationPreferences,
  toolId: BpmnToolId,
  knownToolIds: ReadonlySet<BpmnToolId>,
): BpmnToolPresentationPreferences {
  if (!knownToolIds.has(toolId)) return preferences;
  return {
    ...preferences,
    recentToolIds: [
      toolId,
      ...preferences.recentToolIds.filter((candidate) => candidate !== toolId),
    ].slice(0, maxRecentBpmnTools),
  };
}

export function toggleFavoriteBpmnTool(
  preferences: BpmnToolPresentationPreferences,
  toolId: BpmnToolId,
  knownToolIds: ReadonlySet<BpmnToolId>,
): BpmnToolPresentationPreferences {
  if (!knownToolIds.has(toolId)) return preferences;
  if (preferences.favoriteToolIds.includes(toolId)) {
    return {
      ...preferences,
      favoriteToolIds: preferences.favoriteToolIds.filter(
        (candidate) => candidate !== toolId,
      ),
    };
  }
  if (preferences.favoriteToolIds.length >= maxFavoriteBpmnTools) {
    return preferences;
  }
  return {
    ...preferences,
    favoriteToolIds: [...preferences.favoriteToolIds, toolId],
  };
}
