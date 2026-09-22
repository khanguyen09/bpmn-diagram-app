"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  emptyBpmnToolPreferences,
  loadBpmnToolPreferences,
  recordRecentBpmnTool,
  saveBpmnToolPreferences,
  toggleFavoriteBpmnTool,
  type BpmnToolId,
} from "./bpmn-tool-preferences";

export function useBpmnToolPreferences(
  knownIds: readonly BpmnToolId[],
) {
  const knownIdsSignature = knownIds.join("\u0000");
  const knownToolIds = useMemo(
    () =>
      new Set(
        knownIdsSignature
          ? (knownIdsSignature.split("\u0000") as BpmnToolId[])
          : [],
      ),
    [knownIdsSignature],
  );
  // Equal, newly-created arrays reuse the same set, so effects cannot loop.
  // The stored preference remains browser-local and device-global.
  const [preferences, setPreferences] = useState(() => {
    try {
      return typeof window === "undefined"
        ? emptyBpmnToolPreferences
        : loadBpmnToolPreferences(window.localStorage, knownToolIds);
    } catch {
      return emptyBpmnToolPreferences;
    }
  });

  useEffect(() => {
    try {
      saveBpmnToolPreferences(window.localStorage, preferences);
    } catch {
      // The browser may deny access to the storage property itself.
      // Editing and in-memory preferences remain available.
    }
  }, [preferences]);

  const recordRecent = useCallback(
    (toolId: BpmnToolId) => {
      setPreferences((current) =>
        recordRecentBpmnTool(current, toolId, knownToolIds),
      );
    },
    [knownToolIds],
  );

  const toggleFavorite = useCallback(
    (toolId: BpmnToolId) => {
      setPreferences((current) =>
        toggleFavoriteBpmnTool(current, toolId, knownToolIds),
      );
    },
    [knownToolIds],
  );

  return { preferences, recordRecent, toggleFavorite } as const;
}
