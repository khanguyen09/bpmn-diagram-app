import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNEdge,
  BPMNPlane,
  BPMNShape,
  Collaboration,
  Definitions,
  Lane,
  Participant,
  Process,
} from "bpmn-moddle";
import { describe, expect, it } from "vitest";
import { tebModdleDescriptor } from "../../application/teb-moddle-contract";
import { collaborationSwimlaneLayoutsBpmnProfile } from "../../domain/collaboration-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";
import { starterBpmnXml } from "./starter-model";
import {
  buildCoreSwimlaneConversionCandidate,
  type SwimlaneOrientation,
} from "./build-core-swimlane-conversion-candidate";

async function parse(xml: string) {
  const moddle = new BpmnModdle({ teb: tebModdleDescriptor });
  const parsed = await moddle.fromXML(xml);
  return {
    definitions: parsed.rootElement as Definitions,
    elementsById: parsed.elementsById,
    moddle,
  };
}

function planeOf(definitions: Definitions): BPMNPlane {
  return definitions.diagrams[0]!.plane;
}

function diFingerprint(plane: BPMNPlane) {
  return (plane.planeElement ?? []).map((element) => {
    const common = {
      id: (element as { id?: string }).id,
      type: element.$type,
      elementId: (element as BPMNShape | BPMNEdge).bpmnElement?.id,
      attrs: (element as unknown as { $attrs?: Record<string, unknown> }).$attrs,
    };
    if (element.$type === "bpmndi:BPMNShape") {
      const shape = element as BPMNShape;
      return {
        ...common,
        bounds: { ...shape.bounds },
        isExpanded: shape.isExpanded,
        isHorizontal: shape.isHorizontal,
        isMarkerVisible: shape.isMarkerVisible,
      };
    }
    const edge = element as BPMNEdge;
    return {
      ...common,
      waypoints: edge.waypoint.map((point) => ({ x: point.x, y: point.y })),
    };
  });
}

function semanticFingerprint(process: Process) {
  return (process.flowElements ?? []).map((element) => ({
    id: element.id,
    type: element.$type,
    name: (element as { name?: string }).name,
    sourceId: (element as { sourceRef?: { id?: string } }).sourceRef?.id,
    targetId: (element as { targetRef?: { id?: string } }).targetRef?.id,
    calledElement: (element as { calledElement?: string }).calledElement,
    incoming: (element as { incoming?: { id: string }[] }).incoming?.map(
      (flow) => flow.id,
    ),
    outgoing: (element as { outgoing?: { id: string }[] }).outgoing?.map(
      (flow) => flow.id,
    ),
    attrs: element.$attrs,
  }));
}

async function assertCandidate(
  sourceXml: string,
  orientation: SwimlaneOrientation,
) {
  const source = await parse(sourceXml);
  const sourcePlane = planeOf(source.definitions);
  const sourceProcess = sourcePlane.bpmnElement as Process;
  const sourceDi = diFingerprint(sourcePlane);
  const sourceSemantics = semanticFingerprint(sourceProcess);
  const sourceIds = new Set(Object.keys(source.elementsById));

  const candidate = await buildCoreSwimlaneConversionCandidate(
    sourceXml,
    orientation,
  );
  expect(candidate.targetProfileId).toBe(
    collaborationSwimlaneLayoutsBpmnProfile.id,
  );

  const parsed = await parse(candidate.xml);
  const plane = planeOf(parsed.definitions);
  const collaborations = parsed.definitions.rootElements.filter(
    (element): element is Collaboration => element.$type === "bpmn:Collaboration",
  );
  const processes = parsed.definitions.rootElements.filter(
    (element): element is Process => element.$type === "bpmn:Process",
  );
  const process = processes.find((element) => element.id === sourceProcess.id)!;
  const collaboration = collaborations[0]!;
  const participant = collaboration.participants[0] as Participant;
  const lanes = process.laneSets[0]!.lanes as Lane[];
  const participantShape = plane.planeElement.find(
    (element) =>
      element.$type === "bpmndi:BPMNShape" &&
      (element as BPMNShape).bpmnElement?.id === participant.id,
  ) as BPMNShape;
  const laneShapes = lanes.map(
    (lane) =>
      plane.planeElement.find(
        (element) =>
          element.$type === "bpmndi:BPMNShape" &&
          (element as BPMNShape).bpmnElement?.id === lane.id,
      ) as BPMNShape,
  );

  expect(collaborations).toHaveLength(1);
  expect(plane.bpmnElement?.id).toBe(collaboration.id);
  expect(collaboration.participants).toHaveLength(1);
  expect(collaboration.messageFlows ?? []).toHaveLength(0);
  expect(participant.processRef.id).toBe(sourceProcess.id);
  expect(process.laneSets).toHaveLength(1);
  expect(lanes).toHaveLength(2);
  expect(lanes.map((lane) => lane.name)).toEqual(
    orientation === "horizontal"
      ? ["Vai trò trên", "Vai trò dưới"]
      : ["Vai trò trái", "Vai trò phải"],
  );
  expect(lanes[0]!.flowNodeRef.map((node) => node.id)).toEqual(
    (process.flowElements ?? [])
      .filter(
        (element) =>
          (element as unknown as { $instanceOf(type: string): boolean }).$instanceOf(
            "bpmn:FlowNode",
          ),
      )
      .map((element) => element.id),
  );
  expect(lanes[1]!.flowNodeRef ?? []).toHaveLength(0);
  expect(participantShape.isHorizontal).toBe(orientation === "horizontal");
  expect(laneShapes.map((shape) => shape.isHorizontal)).toEqual([
    orientation === "horizontal",
    orientation === "horizontal",
  ]);

  const preservedDi = plane.planeElement.filter((element) =>
    sourceIds.has((element as { id?: string }).id ?? ""),
  );
  expect(diFingerprint({ ...plane, planeElement: preservedDi } as BPMNPlane)).toEqual(
    sourceDi,
  );
  expect(semanticFingerprint(process)).toEqual(sourceSemantics);
  for (const id of sourceIds) expect(parsed.elementsById[id]).toBeDefined();

  const firstLane = laneShapes[0]!.bounds;
  for (const element of preservedDi) {
    if (element.$type !== "bpmndi:BPMNShape") continue;
    const bounds = (element as BPMNShape).bounds;
    expect(bounds.x).toBeGreaterThanOrEqual(firstLane.x);
    expect(bounds.y).toBeGreaterThanOrEqual(firstLane.y);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      firstLane.x + firstLane.width,
    );
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(
      firstLane.y + firstLane.height,
    );
  }

  if (orientation === "horizontal") {
    expect(laneShapes[0]!.bounds.x).toBe(laneShapes[1]!.bounds.x);
    expect(laneShapes[0]!.bounds.width).toBe(laneShapes[1]!.bounds.width);
    expect(laneShapes[0]!.bounds.y + laneShapes[0]!.bounds.height).toBe(
      laneShapes[1]!.bounds.y,
    );
  } else {
    expect(laneShapes[0]!.bounds.y).toBe(laneShapes[1]!.bounds.y);
    expect(laneShapes[0]!.bounds.height).toBe(laneShapes[1]!.bounds.height);
    expect(laneShapes[0]!.bounds.x + laneShapes[0]!.bounds.width).toBe(
      laneShapes[1]!.bounds.x,
    );
  }

  const inspection = await inspectBpmnXml(
    candidate.xml,
    candidate.targetProfileId,
  );
  expect(inspection.accepted).toBe(true);
  expect(inspection.safeToPersist).toBe(true);

  const roundTrip = await parsed.moddle.toXML(parsed.definitions, {
    format: true,
  });
  const roundTripInspection = await inspectBpmnXml(
    roundTrip.xml,
    candidate.targetProfileId,
  );
  expect(roundTripInspection.accepted).toBe(true);
  expect(roundTripInspection.safeToPersist).toBe(true);
}

describe("buildCoreSwimlaneConversionCandidate", () => {
  it.each(["horizontal", "vertical"] as const)(
    "wraps the current primary Process in a native %s two-lane layout without changing existing IDs or DI",
    async (orientation) => {
      await assertCandidate(starterBpmnXml, orientation);
    },
  );

  it("keeps an additional callable Process and calledElement reference while allocating collision-free IDs", async () => {
    const withCallableAndCollision = starterBpmnXml
      .replace(
        'id="Definitions_Core_Starter"',
        'id="Collaboration_Process_Editorial_Review_Swimlane"',
      )
      .replaceAll("bpmn:task id=\"Task_Publish\"", "bpmn:callActivity id=\"Task_Publish\" calledElement=\"Process_Callable\"")
      .replaceAll("</bpmn:task>", (closing, offset, source) => {
        const before = source.slice(0, offset);
        return before.lastIndexOf('id="Task_Publish"') > before.lastIndexOf("<bpmn:task")
          ? "</bpmn:callActivity>"
          : closing;
      })
      .replace(
        "  <bpmndi:BPMNDiagram",
        '  <bpmn:process id="Process_Callable" name="Quy trình dùng lại" isExecutable="false"><bpmn:task id="Task_Callable" name="Tác vụ dùng lại" /></bpmn:process>\n  <bpmndi:BPMNDiagram',
      );

    const candidate = await buildCoreSwimlaneConversionCandidate(
      withCallableAndCollision,
      "horizontal",
    );
    const parsed = await parse(candidate.xml);
    const collaboration = parsed.definitions.rootElements.find(
      (element) => element.$type === "bpmn:Collaboration",
    ) as Collaboration;
    const callable = parsed.elementsById.Process_Callable as Process;
    const callActivity = parsed.elementsById.Task_Publish as unknown as {
      $type: string;
      calledElement: string;
    };

    expect(collaboration.id).toBe(
      "Collaboration_Process_Editorial_Review_Swimlane_2",
    );
    expect(callable.$type).toBe("bpmn:Process");
    expect(callable.flowElements.map((element) => element.id)).toEqual([
      "Task_Callable",
    ]);
    expect(callActivity.$type).toBe("bpmn:CallActivity");
    expect(callActivity.calledElement).toBe("Process_Callable");
    expect(collaboration.participants[0]!.processRef.id).toBe(
      "Process_Editorial_Review",
    );
  });

  it.each([
    ["empty XML", "", "INVALID_XML"],
    [
      "missing Process plane",
      starterBpmnXml.replace(/\s*<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/, ""),
      "MISSING_PRIMARY_PROCESS_PLANE",
    ],
    [
      "ambiguous Process planes",
      starterBpmnXml.replace(
        "</bpmn:definitions>",
        '<bpmndi:BPMNDiagram id="Diagram_Second"><bpmndi:BPMNPlane id="Plane_Second" bpmnElement="Process_Editorial_Review"><bpmndi:BPMNShape id="Shape_Second" bpmnElement="Start_Submitted"><dc:Bounds x="0" y="0" width="36" height="36" /></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
      ),
      "AMBIGUOUS_PRIMARY_PROCESS_PLANE",
    ],
    [
      "already wrapped source",
      starterBpmnXml.replace(
        "  <bpmn:process",
        '  <bpmn:collaboration id="Collaboration_Existing" />\n  <bpmn:process',
      ),
      "UNSUPPORTED_SOURCE_STRUCTURE",
    ],
    [
      "existing lanes",
      starterBpmnXml.replace(
        "    <bpmn:startEvent",
        '    <bpmn:laneSet id="LaneSet_Existing"><bpmn:lane id="Lane_Existing" /></bpmn:laneSet>\n    <bpmn:startEvent',
      ),
      "UNSUPPORTED_SOURCE_STRUCTURE",
    ],
    [
      "empty DI plane",
      starterBpmnXml.replace(
        /(<bpmndi:BPMNPlane[^>]*>)[\s\S]*?(<\/bpmndi:BPMNPlane>)/,
        "$1$2",
      ),
      "MISSING_DRAWABLE_DI",
    ],
    [
      "non-finite bounds",
      starterBpmnXml.replace('x="110"', 'x="NaN"'),
      "INVALID_DI_GEOMETRY",
    ],
    [
      "invalid edge",
      starterBpmnXml.replace(
        '<di:waypoint x="146" y="220" /><di:waypoint x="200" y="220" />',
        '<di:waypoint x="146" y="220" />',
      ),
      "INVALID_DI_GEOMETRY",
    ],
  ])("fails closed for %s", async (_label, xml, code) => {
    await expect(
      buildCoreSwimlaneConversionCandidate(xml, "horizontal"),
    ).rejects.toMatchObject({ code });
  });
});
