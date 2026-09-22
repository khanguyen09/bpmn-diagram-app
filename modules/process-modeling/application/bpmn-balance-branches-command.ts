import {
  planBpmnBranchBalance,
  type BpmnBranchElement,
  type BpmnBranchOrientation,
  type BpmnBranchPlan,
} from "./bpmn-balance-branches";

export const balanceBranchesCommand = "teb.layout.balanceBranches";

interface BranchRegistry<E extends BpmnBranchElement> {
  get(id: string): E | undefined;
  getAll(): readonly E[];
}
interface BranchCommandStack {
  register(command: string, handler: { preExecute(context: Record<string, unknown>): void }): void;
  execute(command: string, context: Record<string, unknown>): void;
}
interface BranchModeling<E extends BpmnBranchElement> {
  moveElements(elements: readonly E[], delta: { x: number; y: number }, target?: E, hints?: Readonly<Record<string, unknown>>): void;
}

/** Native child commands own movement, DI updates, edge routing, and undo/redo. */
export function registerBpmnBranchBalanceCommand<E extends BpmnBranchElement>(
  commandStack: BranchCommandStack,
  registry: BranchRegistry<E>,
  modeling: BranchModeling<E>,
): void {
  commandStack.register(balanceBranchesCommand, {
    preExecute(context) {
      const gateway = typeof context.gatewayId === "string" ? registry.get(context.gatewayId) : undefined;
      const orientation = context.orientation === "horizontal" || context.orientation === "vertical"
        ? context.orientation : undefined;
      // Recompute against live elements, not a stale UI preview. Resolve every move before mutation.
      const plan = planBpmnBranchBalance(gateway, registry.getAll(), orientation);
      context.result = plan;
      if (!plan.ok) return;
      const resolved = plan.moves.map((move) => ({ move, element: registry.get(move.id) }));
      if (!gateway?.parent || resolved.some(({ element }) => !element || element.parent !== gateway.parent)) {
        context.result = { ok: false, reason: "Sơ đồ vừa thay đổi. Hãy chọn lại điểm chia nhánh." } satisfies BpmnBranchPlan;
        return;
      }
      for (const { move, element } of resolved) {
        modeling.moveElements([element!], {
          x: move.to.x - move.from.x, y: move.to.y - move.from.y,
        }, element!.parent as E, { autoResize: false });
      }
    },
  });
}

export function executeBpmnBranchBalance<E extends BpmnBranchElement>(
  commandStack: BranchCommandStack,
  registry: BranchRegistry<E>,
  gatewayId: string,
  orientation?: BpmnBranchOrientation,
): BpmnBranchPlan {
  const plan = planBpmnBranchBalance(registry.get(gatewayId), registry.getAll(), orientation);
  // Do not add an undo entry or dirty the diagram for refusals or already-balanced branches.
  if (!plan.ok || !plan.moves.length) return plan;
  const context: Record<string, unknown> = { gatewayId, orientation: plan.orientation };
  commandStack.execute(balanceBranchesCommand, context);
  return context.result as BpmnBranchPlan;
}
