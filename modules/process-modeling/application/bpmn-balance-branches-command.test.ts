import { describe, expect, it, vi } from "vitest";
import type { BpmnBranchElement } from "./bpmn-balance-branches";
import { balanceBranchesCommand, executeBpmnBranchBalance, registerBpmnBranchBalanceCommand } from "./bpmn-balance-branches-command";

describe("SDD57 native branch command adapter", () => {
  function setup() {
    type Element = { -readonly [K in keyof BpmnBranchElement]: BpmnBranchElement[K] };
    const parent: Element = { id: "Process", type: "bpmn:Process" };
    const gateway: Element = { id: "Split", type: "bpmn:ParallelGateway", x: 300, y: 400, width: 50, height: 50, parent };
    const targets: Element[] = [0, 1].map((index) => ({
      id: `Task_${index}`, type: "bpmn:Task", x: 620, y: 230 + index * 160,
      width: 100, height: 80, parent, outgoing: [],
    }));
    const connections: Element[] = targets.map((target, index) => {
      const flow: Element = { id: `Flow_${index}`, type: "bpmn:SequenceFlow", source: gateway, target, parent, waypoints: [] };
      target.incoming = [flow]; return flow;
    });
    gateway.outgoing = connections;
    const fixture = { parent, gateway, targets, elements: [parent, gateway, ...targets, ...connections] };
    let handler: { preExecute(context: Record<string, unknown>): void };
    const stack = {
      register: vi.fn((_name: string, value: typeof handler) => { handler = value; }),
      execute: vi.fn((_name: string, context: Record<string, unknown>) => handler.preExecute(context)),
    };
    const registry = { get: (id: string) => fixture.elements.find((element) => element.id === id), getAll: () => fixture.elements };
    const modeling = { moveElements: vi.fn() };
    registerBpmnBranchBalanceCommand(stack, registry, modeling);
    return { ...fixture, stack, registry, modeling, handler: () => handler };
  }
  it("executes all moves inside one registered native parent command", () => {
    const { stack, registry, modeling, gateway, targets, parent } = setup();
    const result = executeBpmnBranchBalance(stack, registry, gateway.id, "horizontal");
    expect(result.ok).toBe(true);
    expect(stack.execute).toHaveBeenCalledTimes(1);
    expect(stack.execute.mock.calls[0][0]).toBe(balanceBranchesCommand);
    expect(modeling.moveElements).toHaveBeenCalledTimes(2);
    expect(modeling.moveElements.mock.calls[0][0]).toEqual([targets[0]]);
    expect(modeling.moveElements.mock.calls[0][2]).toBe(parent);
    expect(modeling.moveElements.mock.calls[0][3]).toEqual({ autoResize: false });
  });
  it("does not add a command for refusal", () => {
    const { stack, registry, modeling } = setup();
    expect(executeBpmnBranchBalance(stack, registry, "missing").ok).toBe(false);
    expect(stack.execute).not.toHaveBeenCalled();
    expect(modeling.moveElements).not.toHaveBeenCalled();
  });
  it("revalidates live topology before any movement", () => {
    const { handler, modeling, targets, gateway } = setup();
    targets[1].parent = { id: "Other" };
    const context: Record<string, unknown> = { gatewayId: gateway.id };
    handler().preExecute(context);
    expect(context.result).toMatchObject({ ok: false });
    expect(modeling.moveElements).not.toHaveBeenCalled();
  });
  it("does not add an undo entry when already balanced", () => {
    const { stack, registry, modeling, targets, gateway } = setup();
    Object.assign(targets[0], { x: 490, y: 305 });
    Object.assign(targets[1], { x: 490, y: 465 });
    const result = executeBpmnBranchBalance(stack, registry, gateway.id, "horizontal");
    expect(result.ok && result.moves).toEqual([]);
    expect(stack.execute).not.toHaveBeenCalled();
    expect(modeling.moveElements).not.toHaveBeenCalled();
  });
});
