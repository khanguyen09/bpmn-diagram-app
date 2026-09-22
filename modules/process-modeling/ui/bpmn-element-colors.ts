import { bpmnElementColorPalette as canonicalBpmnElementColorPalette } from "../domain/full-authoring";

type CanonicalBpmnElementColorId =
  (typeof canonicalBpmnElementColorPalette)[number]["id"];

const bpmnElementColorLabels = {
  violet: "Tím",
  blue: "Xanh dương",
  green: "Xanh lá",
  amber: "Vàng",
  red: "Đỏ",
  gray: "Xám",
} as const satisfies Record<CanonicalBpmnElementColorId, string>;

export const bpmnElementColorPalette = canonicalBpmnElementColorPalette.map(
  (color) => ({
    ...color,
    label: bpmnElementColorLabels[color.id],
  }),
);

export type BpmnElementColorId =
  (typeof bpmnElementColorPalette)[number]["id"];

export type BpmnElementColorGridKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End";

export function nextBpmnElementColorIndex(
  currentIndex: number,
  itemCount: number,
  key: BpmnElementColorGridKey,
  columns = 2,
): number {
  if (itemCount <= 0) return -1;
  const lastIndex = itemCount - 1;
  const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
  const safeColumns = Math.max(1, Math.floor(columns));
  if (key === "Home") return 0;
  if (key === "End") return lastIndex;
  const delta =
    key === "ArrowLeft"
      ? -1
      : key === "ArrowRight"
        ? 1
        : key === "ArrowUp"
          ? -safeColumns
          : safeColumns;
  return (safeIndex + delta + itemCount) % itemCount;
}

export function bpmnElementColorSelection(
  fill: unknown,
  stroke: unknown,
): BpmnElementColorId | null {
  const match = bpmnElementColorPalette.find(
    (item) => item.fill === fill && item.stroke === stroke,
  );
  return match?.id ?? null;
}

export function bpmnElementUsesStrokeOnly(type: string): boolean {
  return (
    type === "bpmn:Group" ||
    type === "bpmn:Association" ||
    type === "bpmn:SequenceFlow" ||
    type === "bpmn:MessageFlow"
  );
}

export function supportsBpmnElementColor(type: string): boolean {
  return (
    type.startsWith("bpmn:") &&
    !["bpmn:Process", "bpmn:Collaboration", "bpmn:LaneSet"].includes(type)
  );
}
