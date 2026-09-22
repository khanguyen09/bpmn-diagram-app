import { describe, expect, it } from "vitest";
import { planBpmnBranchBalance, type BpmnBranchElement } from "./bpmn-balance-branches";

type Element = { -readonly [K in keyof BpmnBranchElement]: BpmnBranchElement[K] };
function branchFixture(count = 2) {
  const parent: Element = { id: "Process", type: "bpmn:Process" };
  const gateway: Element = { id: "Split", type: "bpmn:ParallelGateway", x: 300, y: 400, width: 50, height: 50, parent, incoming: [] };
  const targets: Element[] = Array.from({ length: count }, (_, index) => ({
    id: `Task_${index}`, type: "bpmn:Task", x: 620 + index * 30, y: 230 + index * 160,
    width: 100, height: 80, parent, incoming: [], outgoing: [],
  }));
  const connections: Element[] = targets.map((target, index) => {
    const connection: Element = { id: `Flow_${index}`, type: "bpmn:SequenceFlow", source: gateway, target, parent, waypoints: [] };
    target.incoming = [connection];
    return connection;
  });
  gateway.outgoing = connections;
  return { parent, gateway, targets, connections, elements: [parent, gateway, ...targets, ...connections] };
}

describe("SDD57 bounded branch balance", () => {
  it.each([2, 3, 8])("centers %i horizontal branches around the split with equal spacing", (count) => {
    const { gateway, elements } = branchFixture(count);
    const plan = planBpmnBranchBalance(gateway, elements, "horizontal");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.branchCount).toBe(count);
    expect(new Set(plan.moves.map((move) => move.to.x)).size).toBe(1);
    expect((plan.moves[0].to.y + plan.moves.at(-1)!.to.y) / 2 + 40).toBe(425);
    for (let index = 1; index < plan.moves.length; index++) {
      expect(plan.moves[index].to.y - plan.moves[index - 1].to.y).toBe(160);
    }
  });
  it("supports top-to-bottom and infers orientation", () => {
    const { gateway, targets, elements } = branchFixture();
    targets[0].x = 200; targets[1].x = 400;
    targets[0].y = targets[1].y = 800;
    const plan = planBpmnBranchBalance(gateway, elements);
    expect(plan.ok && plan.orientation).toBe("vertical");
    if (!plan.ok) return;
    expect(plan.moves[0].to.y).toBe(plan.moves[1].to.y);
    expect((plan.moves[0].to.x + plan.moves[1].to.x) / 2 + 50).toBe(325);
  });
  it("centers different-size targets, is deterministic and idempotent without input mutation", () => {
    const { gateway, targets, elements } = branchFixture(3);
    targets[1].height = 130; targets[1].width = 160;
    const original = targets.map(({ x, y }) => ({ x, y }));
    const plan = planBpmnBranchBalance(gateway, elements, "horizontal");
    expect(plan).toEqual(planBpmnBranchBalance(gateway, [...elements].reverse(), "horizontal"));
    expect(targets.map(({ x, y }) => ({ x, y }))).toEqual(original);
    if (!plan.ok) throw new Error("Expected plan");
    for (const move of plan.moves) Object.assign(targets.find((target) => target.id === move.id)!, move.to);
    const repeated = planBpmnBranchBalance(gateway, elements, "horizontal");
    expect(repeated.ok && repeated.moves).toEqual([]);
  });
  it("allows a common unchanged join", () => {
    const fixture = branchFixture();
    const join: Element = { id: "Join", type: "bpmn:ParallelGateway", x: 900, y: 400, width: 50, height: 50, parent: fixture.parent };
    const following = fixture.targets.map((target, index) => {
      const flow: Element = { id: `JoinFlow_${index}`, type: "bpmn:SequenceFlow", source: target, target: join, waypoints: [] };
      target.outgoing = [flow]; return flow;
    });
    join.incoming = following;
    fixture.elements.push(join, ...following);
    const plan = planBpmnBranchBalance(fixture.gateway, fixture.elements, "horizontal");
    expect(plan.ok).toBe(true);
    expect(plan.ok && plan.moves.some((move) => move.id === "Join")).toBe(false);
    expect(join.x).toBe(900);
  });
  it("uses available room before a common end rather than a fixed wide gap", () => {
    const fixture = branchFixture();
    const end: Element = { id: "End", type: "bpmn:EndEvent", x: 630, y: 400, width: 36, height: 36, parent: fixture.parent };
    const following = fixture.targets.map((target, index) => {
      const flow: Element = { id: `EndFlow_${index}`, type: "bpmn:SequenceFlow", source: target, target: end, waypoints: [] };
      target.outgoing = [flow]; return flow;
    });
    end.incoming = following;
    fixture.elements.push(end, ...following);
    const plan = planBpmnBranchBalance(fixture.gateway, fixture.elements, "horizontal");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.moves.every((move) => move.to.x === 470)).toBe(true);
    expect(end.x).toBe(630);
    end.x = 500;
    expect(planBpmnBranchBalance(fixture.gateway, fixture.elements, "horizontal").ok).toBe(false);
  });
  it.each([1, 9])("refuses %i branches", (count) => {
    const { gateway, elements } = branchFixture(count);
    expect(planBpmnBranchBalance(gateway, elements).ok).toBe(false);
  });
  it.each([
    ["cross-container", (f: ReturnType<typeof branchFixture>) => { f.targets[0].parent = { id: "Other" }; }],
    ["extra incoming", (f: ReturnType<typeof branchFixture>) => { f.targets[0].incoming = [...f.targets[0].incoming!, { id: "Extra" }]; }],
    ["attached event", (f: ReturnType<typeof branchFixture>) => { f.targets[0].attachers = [{ id: "Boundary" }]; }],
    ["nested activity", (f: ReturnType<typeof branchFixture>) => { f.targets[0].type = "bpmn:SubProcess"; }],
    ["invalid geometry", (f: ReturnType<typeof branchFixture>) => { f.targets[0].x = NaN; }],
    ["non sequence connection", (f: ReturnType<typeof branchFixture>) => { f.connections[0].type = "bpmn:MessageFlow"; }],
    ["mixed join and split", (f: ReturnType<typeof branchFixture>) => { f.gateway.incoming = [{ id: "A" }, { id: "B" }]; }],
    ["cycle", (f: ReturnType<typeof branchFixture>) => { f.targets[0].outgoing = [{ id: "Back", type: "bpmn:SequenceFlow", source: f.targets[0], target: f.gateway }]; }],
    ["chain", (f: ReturnType<typeof branchFixture>) => { f.targets[0].outgoing = [{ id: "Next", target: { id: "NextTask", type: "bpmn:Task" } }]; }],
  ] as const)("refuses %s without moving anything", (_, mutate) => {
    const fixture = branchFixture(); mutate(fixture);
    const original = fixture.targets.map(({ x, y }) => ({ x, y }));
    expect(planBpmnBranchBalance(fixture.gateway, fixture.elements).ok).toBe(false);
    expect(fixture.targets.map(({ x, y }) => ({ x, y }))).toEqual(original);
  });
  it("refuses collisions but ignores affected labels and distant peers", () => {
    const { gateway, parent, elements } = branchFixture();
    const obstacle: Element = { id: "Peer", type: "bpmn:Task", x: 490, y: 300, width: 100, height: 80, parent };
    elements.push(obstacle);
    expect(planBpmnBranchBalance(gateway, elements, "horizontal").ok).toBe(false);
    obstacle.x = 2000;
    expect(planBpmnBranchBalance(gateway, elements, "horizontal").ok).toBe(true);
  });
  it("refuses overflow of an existing lane without expanding or reparenting it", () => {
    const { gateway, parent, elements } = branchFixture();
    Object.assign(parent, { type: "bpmn:Lane", x: 200, y: 350, width: 700, height: 150 });
    const plan = planBpmnBranchBalance(gateway, elements, "horizontal");
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.reason).toContain("nới vùng chứa");
    expect(parent.height).toBe(150);
  });
  it("refuses sibling lanes because native moves recompute role membership", () => {
    const { gateway, parent, elements } = branchFixture();
    elements.push({ id: "Lane", type: "bpmn:Lane", parent, x: 0, y: 0, width: 1200, height: 700 });
    const plan = planBpmnBranchBalance(gateway, elements);
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.reason).toContain("vai trò");
  });
});
