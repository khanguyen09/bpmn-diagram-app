import {
  canTransitionBpmnProfile,
  isCoreBpmnProfileId,
  supportedBpmnProfiles,
  type BpmnProfileId,
} from "../domain/core-profile";
import { isCollaborationBpmnProfileId } from "../domain/collaboration-profile";

export type ProfileUpgradePlan =
  | {
      readonly kind: "already-satisfied";
      readonly fromProfileId: BpmnProfileId;
      readonly minimumProfileId: BpmnProfileId;
      readonly steps: readonly [];
    }
  | {
      readonly kind: "upgrade-required";
      readonly fromProfileId: BpmnProfileId;
      readonly minimumProfileId: BpmnProfileId;
      readonly steps: readonly BpmnProfileId[];
    }
  | {
      readonly kind: "incompatible";
      readonly fromProfileId: BpmnProfileId;
      readonly minimumProfileId: BpmnProfileId;
      readonly reason: "CROSS_FAMILY" | "NO_FORWARD_PATH";
      readonly steps: readonly [];
    };

const supportedProfileIds = supportedBpmnProfiles.map((profile) => profile.id);

function belongsToSameFamily(
  left: BpmnProfileId,
  right: BpmnProfileId,
): boolean {
  return (
    (isCoreBpmnProfileId(left) && isCoreBpmnProfileId(right)) ||
    (isCollaborationBpmnProfileId(left) &&
      isCollaborationBpmnProfileId(right))
  );
}

/**
 * Finds the shortest legal forward path. The domain transition guard remains the
 * only lineage authority; this application module does not duplicate its edges.
 */
function findForwardPath(
  fromProfileId: BpmnProfileId,
  toProfileId: BpmnProfileId,
): readonly BpmnProfileId[] | null {
  if (fromProfileId === toProfileId) return [];

  const visited = new Set<BpmnProfileId>([fromProfileId]);
  const queue: Array<{
    readonly profileId: BpmnProfileId;
    readonly steps: readonly BpmnProfileId[];
  }> = [{ profileId: fromProfileId, steps: [] }];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    for (const candidate of supportedProfileIds) {
      if (
        candidate === current.profileId ||
        visited.has(candidate) ||
        !canTransitionBpmnProfile(current.profileId, candidate)
      ) {
        continue;
      }

      const steps = [...current.steps, candidate];
      if (candidate === toProfileId) return steps;
      visited.add(candidate);
      queue.push({ profileId: candidate, steps });
    }
  }

  return null;
}

/**
 * Plans how to satisfy a tool's minimum profile from the durable acknowledged
 * profile. A later profile already satisfies an earlier minimum and is never
 * interpreted as a request to downgrade.
 */
export function planBpmnProfileUpgrade(
  acknowledgedProfileId: BpmnProfileId,
  minimumProfileId: BpmnProfileId,
): ProfileUpgradePlan {
  if (!belongsToSameFamily(acknowledgedProfileId, minimumProfileId)) {
    return {
      kind: "incompatible",
      fromProfileId: acknowledgedProfileId,
      minimumProfileId,
      reason: "CROSS_FAMILY",
      steps: [],
    };
  }

  if (acknowledgedProfileId === minimumProfileId) {
    return {
      kind: "already-satisfied",
      fromProfileId: acknowledgedProfileId,
      minimumProfileId,
      steps: [],
    };
  }

  const forwardPath = findForwardPath(
    acknowledgedProfileId,
    minimumProfileId,
  );
  if (forwardPath) {
    return {
      kind: "upgrade-required",
      fromProfileId: acknowledgedProfileId,
      minimumProfileId,
      steps: forwardPath,
    };
  }

  const minimumToCurrentPath = findForwardPath(
    minimumProfileId,
    acknowledgedProfileId,
  );
  if (minimumToCurrentPath) {
    return {
      kind: "already-satisfied",
      fromProfileId: acknowledgedProfileId,
      minimumProfileId,
      steps: [],
    };
  }

  return {
    kind: "incompatible",
    fromProfileId: acknowledgedProfileId,
    minimumProfileId,
    reason: "NO_FORWARD_PATH",
    steps: [],
  };
}
