export interface BpmnCanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface BpmnParticipantFrame {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly whiteBox: boolean;
}

export type BpmnParticipantPlacementResolution =
  | {
      readonly kind: "resolved";
      readonly participantId: string;
    }
  | {
      readonly kind: "rejected";
      readonly reason: "OUTSIDE_PARTICIPANT" | "BLACK_BOX" | "AMBIGUOUS";
    };

export interface BpmnParticipantReflowMove {
  readonly participantId: string;
  readonly delta: {
    readonly x: 0;
    readonly y: number;
  };
}

function hasFiniteBounds(frame: BpmnParticipantFrame): boolean {
  return (
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    Number.isFinite(frame.width) &&
    Number.isFinite(frame.height) &&
    frame.width > 0 &&
    frame.height > 0
  );
}

function containsPoint(
  frame: BpmnParticipantFrame,
  point: BpmnCanvasPoint,
): boolean {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height
  );
}

function overlapsHorizontally(
  left: BpmnParticipantFrame,
  right: BpmnParticipantFrame,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width;
}

/**
 * Resolves point placement only when the pointer belongs to one unambiguous
 * white-box Participant. Shared borders and overlapping Pools intentionally
 * reject instead of guessing an owner.
 */
export function resolveBpmnParticipantAtPoint(
  point: BpmnCanvasPoint,
  participants: readonly BpmnParticipantFrame[],
): BpmnParticipantPlacementResolution {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { kind: "rejected", reason: "OUTSIDE_PARTICIPANT" };
  }

  const containing = participants.filter(
    (participant) =>
      hasFiniteBounds(participant) && containsPoint(participant, point),
  );
  if (containing.length === 0) {
    return { kind: "rejected", reason: "OUTSIDE_PARTICIPANT" };
  }
  if (containing.length !== 1) {
    return { kind: "rejected", reason: "AMBIGUOUS" };
  }
  if (!containing[0]!.whiteBox) {
    return { kind: "rejected", reason: "BLACK_BOX" };
  }
  return { kind: "resolved", participantId: containing[0]!.id };
}

function compareParticipantIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Builds a stable, downward-only reflow plan after one Participant expands.
 * Lower Pools retain a deterministic y/x/id order and the requested vertical
 * gap, matching the editor's single vertical collaboration stack.
 */
export function planLowerBpmnParticipantReflow(
  participants: readonly BpmnParticipantFrame[],
  expandedParticipantId: string,
  gap = 80,
): readonly BpmnParticipantReflowMove[] {
  if (!Number.isFinite(gap) || gap < 0) return [];

  const validParticipants = participants.filter(hasFiniteBounds);
  const expanded = validParticipants.find(
    (participant) => participant.id === expandedParticipantId,
  );
  if (!expanded) return [];

  const lower = validParticipants
    .filter(
      (participant) =>
        participant.id !== expanded.id &&
        participant.y >= expanded.y &&
        overlapsHorizontally(expanded, participant),
    )
    .sort(
      (left, right) =>
        left.y - right.y ||
        left.x - right.x ||
        compareParticipantIds(left.id, right.id),
    );
  const moves: BpmnParticipantReflowMove[] = [];
  let nextY = expanded.y + expanded.height + gap;

  for (const participant of lower) {
    const projectedY = Math.max(participant.y, nextY);
    const deltaY = projectedY - participant.y;
    nextY = projectedY + participant.height + gap;
    if (deltaY <= 0) continue;
    moves.push({
      participantId: participant.id,
      delta: { x: 0, y: deltaY },
    });
  }

  return moves;
}
