import {
  planDataStoreCleanup,
  type DataStoreCleanupIntent,
  type DataStoreCleanupPlan,
  type DataStoreRegistryEntry,
} from "../domain/data-authoring";
import {
  planFlowNodeReparent,
  planSubProcessDelete,
  type ReparentIntent,
  type ReparentPlan,
  type SubProcessDeleteIntent,
  type SubProcessDeletePlan,
  type SubProcessLifecycleSnapshot,
} from "../domain/subprocess-lifecycle";

export interface DataStoreCleanupCommandIntent extends DataStoreCleanupIntent {
  readonly action: "CANCEL" | "DELETE";
  readonly expectedRevisionToken: string;
  readonly currentRevisionToken: string;
}

export type DataStoreCleanupCommandPlan =
  | {
      readonly accepted: true;
      readonly deleteDataStoreIds: readonly string[];
      readonly commandCount: 1;
    }
  | {
      readonly accepted: false;
      readonly reason:
        | "CANCELLED"
        | "STALE_REVISION"
        | Exclude<
            Extract<DataStoreCleanupPlan, { accepted: false }>["reason"],
            never
          >;
      readonly dataStoreId?: string;
      readonly deleteDataStoreIds: readonly [];
      readonly commandCount: 0;
    };

/**
 * Application boundary for execution-time DataStore re-scan. Callers must pass
 * the freshly projected live registry, never the dialog's cached projection.
 */
export function planDataStoreCleanupCommand(
  currentRegistry: readonly DataStoreRegistryEntry[],
  intent: DataStoreCleanupCommandIntent,
): DataStoreCleanupCommandPlan {
  if (intent.action === "CANCEL") {
    return {
      accepted: false,
      reason: "CANCELLED",
      deleteDataStoreIds: [],
      commandCount: 0,
    };
  }
  if (intent.expectedRevisionToken !== intent.currentRevisionToken) {
    return {
      accepted: false,
      reason: "STALE_REVISION",
      deleteDataStoreIds: [],
      commandCount: 0,
    };
  }
  const plan = planDataStoreCleanup(currentRegistry, intent);
  if (!plan.accepted) {
    return { ...plan, commandCount: 0 };
  }
  return { ...plan, commandCount: 1 };
}

export function planFlowNodeReparentCommand(
  currentSnapshot: SubProcessLifecycleSnapshot,
  intent: ReparentIntent,
): ReparentPlan {
  return planFlowNodeReparent(currentSnapshot, intent);
}

export function planSubProcessDeleteCommand(
  currentSnapshot: SubProcessLifecycleSnapshot,
  intent: SubProcessDeleteIntent,
): SubProcessDeletePlan {
  return planSubProcessDelete(currentSnapshot, intent);
}
