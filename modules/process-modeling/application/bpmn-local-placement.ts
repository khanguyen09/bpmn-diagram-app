export interface PlacementRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlacementPoint {
  readonly x: number;
  readonly y: number;
}

export interface PlacementSize {
  readonly width: number;
  readonly height: number;
}

const DEFAULT_GAP = 30;
const MAX_RINGS = 24;

function intersectsWithGap(
  candidate: PlacementRect,
  occupied: PlacementRect,
  gap: number,
) {
  return !(
    candidate.x + candidate.width + gap <= occupied.x ||
    occupied.x + occupied.width + gap <= candidate.x ||
    candidate.y + candidate.height + gap <= occupied.y ||
    occupied.y + occupied.height + gap <= candidate.y
  );
}

function rectAtCenter(
  center: PlacementPoint,
  size: PlacementSize,
): PlacementRect {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/**
 * Finds the nearest deterministic free center around a preferred position.
 * Existing rectangles are read-only and are never globally rearranged.
 */
export function findNonOverlappingPlacement(
  occupied: readonly PlacementRect[],
  size: PlacementSize,
  preferred: PlacementPoint,
  gap = DEFAULT_GAP,
): PlacementPoint {
  const stepX = size.width + gap;
  const stepY = size.height + gap;
  const candidates: PlacementPoint[] = [preferred];

  for (let ring = 1; ring <= MAX_RINGS; ring += 1) {
    candidates.push(
      { x: preferred.x, y: preferred.y + ring * stepY },
      { x: preferred.x, y: preferred.y - ring * stepY },
      { x: preferred.x + ring * stepX, y: preferred.y },
      { x: preferred.x + ring * stepX, y: preferred.y + ring * stepY },
      { x: preferred.x + ring * stepX, y: preferred.y - ring * stepY },
    );
  }

  return (
    candidates.find((candidate) => {
      const candidateRect = rectAtCenter(candidate, size);
      return occupied.every(
        (existing) => !intersectsWithGap(candidateRect, existing, gap),
      );
    }) ?? candidates[candidates.length - 1]
  );
}
