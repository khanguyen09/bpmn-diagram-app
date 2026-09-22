import { createHash } from "node:crypto";

export type BpmnPerformanceFixtureSize = "Small" | "Medium" | "Large";

export type BpmnPerformanceFixture = {
  readonly size: BpmnPerformanceFixtureSize;
  readonly nodeCount: number;
  readonly connectorCount: number;
  readonly profileId: "teb-core-full-authoring@1";
  readonly processId: string;
  readonly xml: string;
  readonly sha256: string;
};

const fixtureTargets: Readonly<
  Record<
    BpmnPerformanceFixtureSize,
    { readonly nodeCount: number; readonly connectorCount: number }
  >
> = {
  Small: { nodeCount: 50, connectorCount: 75 },
  Medium: { nodeCount: 200, connectorCount: 300 },
  Large: { nodeCount: 500, connectorCount: 700 },
};

type PositionedNode = {
  readonly id: string;
  readonly type: "startEvent" | "task" | "endEvent";
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

function padded(value: number): string {
  return String(value).padStart(4, "0");
}

function xmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function nodeId(index: number, count: number): string {
  if (index === 0) return "Perf_Start_0001";
  if (index === count - 1) return `Perf_End_${padded(count)}`;
  return `Perf_Task_${padded(index + 1)}`;
}

function positionedNodes(count: number): readonly PositionedNode[] {
  const columns = 25;
  return Array.from({ length: count }, (_, index) => {
    const type =
      index === 0
        ? "startEvent"
        : index === count - 1
          ? "endEvent"
          : "task";
    const circular = type !== "task";
    return {
      id: nodeId(index, count),
      type,
      name:
        type === "startEvent"
          ? "Bắt đầu"
          : type === "endEvent"
            ? "Hoàn tất"
            : `Bước ${padded(index)}`,
      x: 100 + (index % columns) * 150,
      y: 100 + Math.floor(index / columns) * 120,
      width: circular ? 36 : 100,
      height: circular ? 36 : 80,
    } satisfies PositionedNode;
  });
}

function nodeSemanticXml(
  node: PositionedNode,
  index: number,
  nodes: readonly PositionedNode[],
  extraFlows: readonly { id: string; sourceIndex: number; targetIndex: number }[],
): string {
  const incoming = index > 0 ? `Flow_${padded(index)}` : null;
  const outgoing =
    index < nodes.length - 1 ? `Flow_${padded(index + 1)}` : null;
  const body = [
    incoming ? `      <bpmn:incoming>${incoming}</bpmn:incoming>` : null,
    ...extraFlows.filter((flow) => flow.targetIndex === index).map((flow) => `      <bpmn:incoming>${flow.id}</bpmn:incoming>`),
    outgoing ? `      <bpmn:outgoing>${outgoing}</bpmn:outgoing>` : null,
    ...extraFlows.filter((flow) => flow.sourceIndex === index).map((flow) => `      <bpmn:outgoing>${flow.id}</bpmn:outgoing>`),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  return [
    `    <bpmn:${node.type} id="${node.id}" name="${xmlAttribute(node.name)}">`,
    body,
    `    </bpmn:${node.type}>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function center(node: PositionedNode): { readonly x: number; readonly y: number } {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function edgeDiXml(
  id: string,
  source: PositionedNode,
  target: PositionedNode,
): string {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  return [
    `      <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">`,
    `        <di:waypoint x="${sourceCenter.x}" y="${sourceCenter.y}" />`,
    `        <di:waypoint x="${targetCenter.x}" y="${targetCenter.y}" />`,
    "      </bpmndi:BPMNEdge>",
  ].join("\n");
}

export function buildBpmnPerformanceFixture(
  size: BpmnPerformanceFixtureSize,
): BpmnPerformanceFixture {
  const target = fixtureTargets[size];
  const nodes = positionedNodes(target.nodeCount);
  const processId = `Perf_Process_${size}`;
  const sequenceFlowCount = target.nodeCount - 1;
  const extraFlowCount = target.connectorCount - sequenceFlowCount;

  const extraFlows = Array.from({ length: extraFlowCount }, (_, index) => {
    const sourceIndex = 1 + ((index * 17) % (nodes.length - 2));
    let targetIndex = 1 + ((sourceIndex + 7 + index * 11) % (nodes.length - 2));
    if (targetIndex === sourceIndex) targetIndex = 1 + (targetIndex % (nodes.length - 2));
    return { id: `ExtraFlow_${padded(index + 1)}`, sourceIndex, targetIndex };
  });
  const nodeXml = nodes.map((node, index) => nodeSemanticXml(node, index, nodes, extraFlows)).join("\n");
  const sequenceFlowXml = Array.from(
    { length: sequenceFlowCount },
    (_, index) =>
      `    <bpmn:sequenceFlow id="Flow_${padded(index + 1)}" sourceRef="${nodes[index]!.id}" targetRef="${nodes[index + 1]!.id}" />`,
  ).join("\n");
  const extraFlowXml = extraFlows.map(({ id, sourceIndex, targetIndex }) => {
    return `    <bpmn:sequenceFlow id="${id}" sourceRef="${nodes[sourceIndex]!.id}" targetRef="${nodes[targetIndex]!.id}" />`;
  }).join("\n");

  const shapeDiXml = nodes
    .map(
      (node) =>
        `      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}"><dc:Bounds x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" /></bpmndi:BPMNShape>`,
    )
    .join("\n");
  const sequenceDiXml = Array.from(
    { length: sequenceFlowCount },
    (_, index) =>
      edgeDiXml(
        `Flow_${padded(index + 1)}`,
        nodes[index]!,
        nodes[index + 1]!,
      ),
  ).join("\n");
  const extraFlowDiXml = extraFlows.map(
    ({ id, sourceIndex, targetIndex }) => {
      return edgeDiXml(
        id,
        nodes[sourceIndex]!,
        nodes[targetIndex]!,
      );
    },
  ).join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Perf_Definitions" targetNamespace="https://the-experience.blog/bpmn/performance">',
    `  <bpmn:process id="${processId}" name="Hiệu năng ${size}" isExecutable="false">`,
    nodeXml,
    sequenceFlowXml,
    extraFlowXml,
    "  </bpmn:process>",
    `  <bpmndi:BPMNDiagram id="Perf_Diagram_${size}">`,
    `    <bpmndi:BPMNPlane id="Perf_Plane_${size}" bpmnElement="${processId}">`,
    shapeDiXml,
    sequenceDiXml,
    extraFlowDiXml,
    "    </bpmndi:BPMNPlane>",
    "  </bpmndi:BPMNDiagram>",
    "</bpmn:definitions>",
  ].join("\n");

  return {
    size,
    nodeCount: target.nodeCount,
    connectorCount: target.connectorCount,
    profileId: "teb-core-full-authoring@1",
    processId,
    xml,
    sha256: createHash("sha256").update(xml, "utf8").digest("hex"),
  };
}

export const bpmnPerformanceFixtures = ([
  "Small",
  "Medium",
  "Large",
] as const).map(buildBpmnPerformanceFixture);
