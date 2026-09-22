import { bpmnElementColorPalette, bpmnElementUsesStrokeOnly, supportsBpmnElementColor, type BpmnElementColorId } from "./bpmn-element-colors";

export interface BpmnColorTarget {
  readonly id: string;
  readonly type: string;
  readonly labelTarget?: unknown;
  readonly di?: object;
}

interface ColorCommandStack {
  register(command: string, handler: { preExecute(context: Record<string, unknown>): void }): void;
  execute(command: string, context: Record<string, unknown>): void;
}

export const bpmnBulkColorCommand = "teb.presentation.applyColors";

export function bpmnColorTargets<T extends BpmnColorTarget>(selection: readonly T[]): T[] {
  const seen = new Set<string>();
  return selection.filter((element) => {
    if (seen.has(element.id) || element.labelTarget || !element.di || !supportsBpmnElementColor(element.type)) return false;
    seen.add(element.id);
    return true;
  });
}

/** Register once per modeler. Nested moddle commands share the parent undo frame. */
export function registerBpmnBulkColors<T extends BpmnColorTarget>(stack: ColorCommandStack, modeling: {
  updateModdleProperties(element: T, moddleElement: Record<string, unknown>, properties: Readonly<Record<string, unknown>>): void;
}): void {
  stack.register(bpmnBulkColorCommand, {
    preExecute(context) {
      const colorId = context.colorId as BpmnElementColorId | null;
      const color = bpmnElementColorPalette.find((item) => item.id === colorId);
      if (colorId !== null && !color) throw new Error("Unsupported BPMN color.");
      const targets = bpmnColorTargets(context.elements as readonly T[]);
      for (const element of targets) {
        modeling.updateModdleProperties(element, element.di as Record<string, unknown>, {
          "bioc:fill": color && !bpmnElementUsesStrokeOnly(element.type) ? color.fill : undefined,
          "bioc:stroke": color?.stroke,
          "color:background-color": undefined,
          "color:border-color": undefined,
        });
      }
    },
  });
}

export function applyBpmnBulkColor<T extends BpmnColorTarget>(stack: ColorCommandStack, elements: readonly T[], colorId: BpmnElementColorId | null): number {
  const targets = bpmnColorTargets(elements);
  if (targets.length) stack.execute(bpmnBulkColorCommand, { elements: targets, colorId });
  return targets.length;
}
