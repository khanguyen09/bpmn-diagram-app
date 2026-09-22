/** Presentation-only input: the planner never reads or writes BPMN business objects. */
export interface BpmnBranchElement {
  readonly id: string;
  readonly type?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly parent?: BpmnBranchElement;
  readonly incoming?: readonly BpmnBranchElement[];
  readonly outgoing?: readonly BpmnBranchElement[];
  readonly source?: BpmnBranchElement;
  readonly target?: BpmnBranchElement;
  readonly attachers?: readonly BpmnBranchElement[];
  readonly host?: BpmnBranchElement;
  readonly children?: readonly BpmnBranchElement[];
  readonly labelTarget?: BpmnBranchElement;
  readonly waypoints?: readonly unknown[];
}

export type BpmnBranchOrientation = "horizontal" | "vertical";
export interface BpmnBranchMove {
  readonly id: string;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}
export type BpmnBranchPlan =
  | { readonly ok: false; readonly reason: string }
  | {
      readonly ok: true;
      readonly gatewayId: string;
      readonly orientation: BpmnBranchOrientation;
      readonly branchCount: number;
      readonly moves: readonly BpmnBranchMove[];
    };

type Box = { x: number; y: number; width: number; height: number };
const splitTypes = new Set([
  "bpmn:ParallelGateway", "bpmn:ExclusiveGateway", "bpmn:InclusiveGateway",
  "bpmn:EventBasedGateway", "bpmn:ComplexGateway",
]);
const targetTypes = new Set([
  "bpmn:Task", "bpmn:UserTask", "bpmn:ServiceTask", "bpmn:ManualTask",
  "bpmn:ReceiveTask", "bpmn:SendTask", "bpmn:ScriptTask", "bpmn:BusinessRuleTask",
  "bpmn:CallActivity", "bpmn:IntermediateCatchEvent", "bpmn:IntermediateThrowEvent",
  "bpmn:EndEvent",
]);
function bounds(element: BpmnBranchElement): Box | undefined {
  const { x, y, width, height } = element;
  return typeof x === "number" && typeof y === "number" &&
    typeof width === "number" && typeof height === "number" &&
    [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
    ? { x, y, width, height } : undefined;
}
function overlaps(a: Box, b: Box, gap = 24): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
function center(box: Box, vertical: boolean): number {
  return vertical ? box.x + box.width / 2 : box.y + box.height / 2;
}
const refuse = (reason: string): BpmnBranchPlan => ({ ok: false, reason });

/** Bounded split layout, not a whole-graph layout or a process repair operation. */
export function planBpmnBranchBalance(
  gateway: BpmnBranchElement | undefined,
  elements: readonly BpmnBranchElement[],
  requestedOrientation?: BpmnBranchOrientation,
): BpmnBranchPlan {
  if (!gateway || !splitTypes.has(gateway.type ?? "") || !gateway.parent || !bounds(gateway)) {
    return refuse("Chọn một điểm chia nhánh để cân đối các bước phía sau.");
  }
  // bpmn-js can parent tasks and lanes to the same participant. A move may then
  // silently recompute business lane membership even without reparenting a shape.
  if (elements.some((element) => element.type === "bpmn:Lane" && element.parent === gateway.parent)) {
    return refuse("Các nhánh nằm trong vùng phân vai. Hãy sắp xếp riêng để không thay đổi vai trò.");
  }
  const outgoing = gateway.outgoing ?? [];
  if (outgoing.length < 2 || outgoing.length > 8 || (gateway.incoming?.length ?? 0) > 1) {
    return refuse("Có thể cân đối từ 2 đến 8 nhánh của một điểm chia riêng biệt.");
  }
  const targets: BpmnBranchElement[] = [];
  for (const connection of outgoing) {
    const target = connection.target;
    if (connection.type !== "bpmn:SequenceFlow" || connection.source !== gateway ||
      !target || !targetTypes.has(target.type ?? "") || !bounds(target) ||
      target.parent !== gateway.parent || target.host || target.attachers?.length ||
      target.children?.some((child) => child.type !== "label") ||
      target.incoming?.length !== 1 || target.incoming[0] !== connection ||
      targets.includes(target)) {
      return refuse("Các nhánh cần nằm cùng một vùng, không có bước dùng chung hoặc sự kiện gắn kèm.");
    }
    targets.push(target);
  }
  // Only leaves or one shared downstream join are bounded enough to move safely.
  const following = targets.flatMap((target) => target.outgoing ?? []);
  let join: BpmnBranchElement | undefined;
  if (following.length) {
    join = following[0]?.target;
    if (!join || join === gateway || !(splitTypes.has(join.type ?? "") || join.type === "bpmn:EndEvent") ||
      join.parent !== gateway.parent || !bounds(join) ||
      targets.some((target) => target.outgoing?.length !== 1 ||
        target.outgoing[0].source !== target || target.outgoing[0].target !== join ||
        target.outgoing[0].type !== "bpmn:SequenceFlow") ||
      join.incoming?.length !== targets.length ||
      join.incoming.some((connection) => !following.includes(connection))) {
      return refuse("Hiện hỗ trợ các bước cuối nhánh hoặc các bước cùng đi tới một điểm gộp. Chuỗi nhánh phức tạp cần sắp xếp riêng.");
    }
    const visited = new Set<BpmnBranchElement>();
    const pending = [join];
    while (pending.length) {
      const next = pending.pop()!;
      if (next === gateway || targets.includes(next)) {
        return refuse("Nhánh có đường quay lại. Hãy sắp xếp riêng để giữ bố cục vòng lặp.");
      }
      if (visited.has(next)) continue;
      visited.add(next);
      for (const edge of next.outgoing ?? []) {
        if (edge.type === "bpmn:SequenceFlow" && edge.target) pending.push(edge.target);
      }
    }
  }
  const gatewayBox = bounds(gateway)!;
  const averageX = targets.reduce((sum, target) => sum + target.x! + target.width! / 2, 0) / targets.length;
  const averageY = targets.reduce((sum, target) => sum + target.y! + target.height! / 2, 0) / targets.length;
  const orientation = requestedOrientation ?? (
    Math.abs(averageY - gatewayBox.y - gatewayBox.height / 2) >
    Math.abs(averageX - gatewayBox.x - gatewayBox.width / 2) ? "vertical" : "horizontal"
  );
  const vertical = orientation === "vertical";
  const ordered = [...targets].sort((a, b) =>
    center(bounds(a)!, vertical) - center(bounds(b)!, vertical) || a.id.localeCompare(b.id));
  const crossSize = Math.max(...ordered.map((target) => vertical ? target.width! : target.height!));
  const mainSize = Math.max(...ordered.map((target) => vertical ? target.height! : target.width!));
  const crossCenter = center(gatewayBox, vertical);
  const gatewayEnd = vertical ? gatewayBox.y + gatewayBox.height : gatewayBox.x + gatewayBox.width;
  const minimumCenter = gatewayEnd + 70 + mainSize / 2;
  const maximumCenter = join ? (vertical ? join.y! : join.x!) - 60 - mainSize / 2 : Infinity;
  if (maximumCenter < minimumCenter) {
    return refuse("Điểm gộp đang quá gần các nhánh. Hãy đưa điểm gộp ra xa hơn rồi thử lại.");
  }
  const mainCenter = Math.min(gatewayEnd + 140 + mainSize / 2, maximumCenter);
  const firstCenter = crossCenter - ((ordered.length - 1) * (crossSize + 80)) / 2;
  const placements = ordered.map((target, index) => {
    const cross = firstCenter + index * (crossSize + 80);
    const box: Box = {
      x: (vertical ? cross : mainCenter) - target.width! / 2,
      y: (vertical ? mainCenter : cross) - target.height! / 2,
      width: target.width!, height: target.height!,
    };
    return { target, box };
  });
  const parentBox = bounds(gateway.parent);
  if (parentBox && gateway.parent.type !== "bpmn:Process" &&
    placements.some(({ box }) => box.x < parentBox.x + 40 || box.y < parentBox.y + 40 ||
      box.x + box.width > parentBox.x + parentBox.width - 40 ||
      box.y + box.height > parentBox.y + parentBox.height - 40)) {
    return refuse("Vùng chứa chưa đủ chỗ. Hãy nới vùng chứa rồi cân đối lại.");
  }
  const affected = new Set<BpmnBranchElement>([gateway, ...targets, ...outgoing, ...following]);
  const obstacles = elements.filter((element) => element.parent === gateway.parent &&
    !affected.has(element) && !element.waypoints &&
    !(element.labelTarget && affected.has(element.labelTarget)) &&
    element.type !== "bpmn:Group" && bounds(element));
  if (placements.some(({ box }) => obstacles.some((obstacle) => overlaps(box, bounds(obstacle)!)))) {
    return refuse("Vị trí cân đối đang có thành phần khác. Hãy tạo thêm khoảng trống rồi thử lại.");
  }
  return {
    ok: true, gatewayId: gateway.id, orientation, branchCount: targets.length,
    moves: placements.filter(({ target, box }) => Math.abs(target.x! - box.x) > 0.01 || Math.abs(target.y! - box.y) > 0.01)
      .map(({ target, box }) => ({ id: target.id, from: { x: target.x!, y: target.y! }, to: { x: box.x, y: box.y } })),
  };
}
