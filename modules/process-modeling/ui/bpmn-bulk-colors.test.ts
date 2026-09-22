import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { applyBpmnBulkColor, bpmnBulkColorCommand, bpmnColorTargets, registerBpmnBulkColors } from "./bpmn-bulk-colors";

const task = { id: "task", type: "bpmn:Task", di: {} };
const group = { id: "group", type: "bpmn:Group", di: {} };
const flow = { id: "flow", type: "bpmn:SequenceFlow", di: {} };

describe("BPMN bulk colors", () => {
  it("filters labels, semantic roots, missing DI and duplicate IDs", () => {
    expect(bpmnColorTargets([task, task, group, { id: "label", type: "bpmn:Task", di: {}, labelTarget: task }, { id: "root", type: "bpmn:Process", di: {} }, { id: "missing", type: "bpmn:Task" }])).toEqual([task, group]);
  });
  it("dispatches one parent command for the complete selection, none for empty selection", () => {
    const stack = { register: vi.fn(), execute: vi.fn() };
    expect(applyBpmnBulkColor(stack, [task, group, flow], "blue")).toBe(3);
    expect(stack.execute).toHaveBeenCalledExactlyOnceWith(bpmnBulkColorCommand, { elements: [task, group, flow], colorId: "blue" });
    expect(applyBpmnBulkColor(stack, [], null)).toBe(0);
    expect(stack.execute).toHaveBeenCalledTimes(1);
  });
  it("writes only canonical colors, keeps stroke-only fills clear, and supports reset", () => {
    const stack = { register: vi.fn(), execute: vi.fn() };
    const modeling = { updateModdleProperties: vi.fn() };
    registerBpmnBulkColors(stack, modeling);
    const handler = stack.register.mock.calls[0][1];
    handler.preExecute({ elements: [task, group, flow], colorId: "blue" });
    const changes = modeling.updateModdleProperties.mock.calls;
    expect(changes[0][2]["bioc:fill"]).toBe("#E8F2FF");
    for (const change of changes.slice(1)) expect(change[2]["bioc:fill"]).toBeUndefined();
    for (const change of changes) {
      expect(change[2]["bioc:stroke"]).toBe("#2863C7");
      expect(change[2]["color:border-color"]).toBeUndefined();
      expect(change[2]["color:background-color"]).toBeUndefined();
    }
    modeling.updateModdleProperties.mockClear();
    handler.preExecute({ elements: [task, group], colorId: null });
    for (const change of modeling.updateModdleProperties.mock.calls) expect(Object.values(change[2]).every((value) => value === undefined)).toBe(true);
    expect(() => handler.preExecute({ elements: [task], colorId: "invalid" })).toThrow();
  });
});

// Exercise the installed engine's actual undo grouping, without a DOM/modeler.
it("undoes and redoes mixed-target color edits as one native command-stack frame", async () => {
  const require = createRequire(import.meta.url);
  const bpmnRequire = createRequire(require.resolve("bpmn-js/package.json"));
  const commandPath = pathToFileURL(bpmnRequire.resolve("diagram-js/lib/command/CommandStack.js")).href;
  const eventBusPath = pathToFileURL(bpmnRequire.resolve("diagram-js/lib/core/EventBus.js")).href;
  const { default: CommandStack } = await import(/* @vite-ignore */ commandPath);
  const { default: EventBus } = await import(/* @vite-ignore */ eventBusPath);
  const stack = new CommandStack(new EventBus(), {});
  type Target = { id: string; type: string; di: Record<string, unknown> };
  type Context = { element: Target; properties: Record<string, unknown>; previous?: Record<string, unknown> };
  stack.register("test.updateDi", {
    execute(context: Context) {
      context.previous = { ...context.element.di };
      Object.assign(context.element.di, context.properties);
      return context.element;
    },
    revert(context: Context) {
      for (const key of Object.keys(context.element.di)) delete context.element.di[key];
      Object.assign(context.element.di, context.previous);
      return context.element;
    },
  });
  const modeling = {
    updateModdleProperties(element: Target, _di: Record<string, unknown>, properties: Readonly<Record<string, unknown>>) {
      stack.execute("test.updateDi", { element, properties });
    },
  };
  const targets: Target[] = [
    { id: "a", type: "bpmn:Task", di: { "bioc:fill": "#FFF4D6", "bioc:stroke": "#8A6200" } },
    { id: "b", type: "bpmn:Group", di: {} },
  ];
  const original = targets.map((item) => ({ ...item.di }));
  registerBpmnBulkColors(stack, modeling);
  applyBpmnBulkColor(stack, targets, "blue");
  expect(targets.map((item) => item.di["bioc:stroke"])).toEqual(["#2863C7", "#2863C7"]);
  stack.undo();
  expect(targets.map((item) => item.di)).toEqual(original);
  expect(stack.canUndo()).toBe(false);
  stack.redo();
  expect(targets.map((item) => item.di["bioc:stroke"])).toEqual(["#2863C7", "#2863C7"]);
  expect(targets[1].di["bioc:fill"]).toBeUndefined();
});
