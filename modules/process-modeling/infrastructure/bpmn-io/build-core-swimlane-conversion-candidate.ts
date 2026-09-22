import { BpmnModdle } from "bpmn-moddle";
import type {
  BaseElement,
  BPMNEdge,
  BPMNPlane,
  BPMNShape,
  Collaboration,
  Definitions,
  FlowNode,
  Lane,
  LaneSet,
  Participant,
  Process,
} from "bpmn-moddle";
import { tebModdleDescriptor } from "../../application/teb-moddle-contract";
import { collaborationConversionTarget } from "../../domain/bpmn-family-conversion";
import { coreBpmnProfile, type BpmnProfileId } from "../../domain/core-profile";

export type SwimlaneOrientation = "horizontal" | "vertical";

export type CoreSwimlaneConversionErrorCode =
  | "INVALID_ORIENTATION"
  | "INVALID_XML"
  | "MISSING_PRIMARY_PROCESS_PLANE"
  | "AMBIGUOUS_PRIMARY_PROCESS_PLANE"
  | "UNSUPPORTED_SOURCE_STRUCTURE"
  | "MISSING_DRAWABLE_DI"
  | "INVALID_DI_GEOMETRY"
  | "DETACHED_MODELER_UNAVAILABLE"
  | "CANDIDATE_REJECTED";

export class CoreSwimlaneConversionError extends Error {
  readonly code: CoreSwimlaneConversionErrorCode;

  constructor(code: CoreSwimlaneConversionErrorCode, message: string) {
    super(message);
    this.name = "CoreSwimlaneConversionError";
    this.code = code;
  }
}

export interface PreparedCoreSwimlaneConversion {
  readonly xml: string;
  readonly targetProfileId: ReturnType<typeof collaborationConversionTarget>;
}

interface DiagramBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface SwimlaneGeometry {
  readonly participant: Rectangle;
  readonly firstLane: Rectangle;
  readonly secondLane: Rectangle;
}

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const HEADER_SIZE = 30;
const CONTENT_PADDING = 60;
const MIN_HORIZONTAL_LANE_WIDTH = 320;
const MIN_HORIZONTAL_LANE_HEIGHT = 160;
const MIN_VERTICAL_LANE_WIDTH = 240;
const MIN_VERTICAL_LANE_HEIGHT = 240;

function isType(element: unknown, type: string): element is BaseElement {
  if (!element || typeof element !== "object") return false;
  const candidate = element as BaseElement & {
    $instanceOf?: (candidateType: string) => boolean;
  };
  return (
    candidate.$type === type ||
    candidate.$instanceOf?.(type) === true
  );
}

function reject(
  code: CoreSwimlaneConversionErrorCode,
  message: string,
): never {
  throw new CoreSwimlaneConversionError(code, message);
}

function finiteRectangle(bounds: Rectangle | undefined): bounds is Rectangle {
  return Boolean(
    bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.width > 0 &&
      bounds.height > 0,
  );
}

function extendRectangle(
  current: DiagramBounds | undefined,
  rectangle: Rectangle,
): DiagramBounds {
  const next = {
    minX: rectangle.x,
    minY: rectangle.y,
    maxX: rectangle.x + rectangle.width,
    maxY: rectangle.y + rectangle.height,
  };
  if (!current) return next;
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  };
}

function extendPoint(
  current: DiagramBounds | undefined,
  point: { readonly x: number; readonly y: number },
): DiagramBounds {
  if (!current) {
    return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
  }
  return {
    minX: Math.min(current.minX, point.x),
    minY: Math.min(current.minY, point.y),
    maxX: Math.max(current.maxX, point.x),
    maxY: Math.max(current.maxY, point.y),
  };
}

function inspectExistingDiagram(plane: BPMNPlane): DiagramBounds {
  const existing = plane.planeElement ?? [];
  if (existing.length === 0) {
    reject(
      "MISSING_DRAWABLE_DI",
      "The primary process plane has no drawable BPMN DI elements.",
    );
  }

  let bounds: DiagramBounds | undefined;
  let shapeCount = 0;

  for (const diagramElement of existing) {
    const id = (diagramElement as { id?: unknown }).id;
    const semanticTarget = (diagramElement as BPMNShape | BPMNEdge).bpmnElement;
    if (typeof id !== "string" || !id || !semanticTarget?.id) {
      reject(
        "INVALID_DI_GEOMETRY",
        "Every existing BPMN DI element must have an ID and semantic target.",
      );
    }

    if (isType(diagramElement, "bpmndi:BPMNShape")) {
      const shape = diagramElement as BPMNShape;
      if (!finiteRectangle(shape.bounds)) {
        reject(
          "INVALID_DI_GEOMETRY",
          `BPMN shape ${id} has non-finite or non-positive bounds.`,
        );
      }
      shapeCount += 1;
      bounds = extendRectangle(bounds, shape.bounds);
      if (shape.label?.bounds) {
        if (!finiteRectangle(shape.label.bounds)) {
          reject(
            "INVALID_DI_GEOMETRY",
            `BPMN shape label ${id} has non-finite or non-positive bounds.`,
          );
        }
        bounds = extendRectangle(bounds, shape.label.bounds);
      }
      continue;
    }

    if (isType(diagramElement, "bpmndi:BPMNEdge")) {
      const edge = diagramElement as BPMNEdge;
      const waypoints = edge.waypoint ?? [];
      if (
        waypoints.length < 2 ||
        waypoints.some(
          (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
        )
      ) {
        reject(
          "INVALID_DI_GEOMETRY",
          `BPMN edge ${id} needs at least two finite waypoints.`,
        );
      }
      for (const point of waypoints) bounds = extendPoint(bounds, point);
      if (edge.label?.bounds) {
        if (!finiteRectangle(edge.label.bounds)) {
          reject(
            "INVALID_DI_GEOMETRY",
            `BPMN edge label ${id} has non-finite or non-positive bounds.`,
          );
        }
        bounds = extendRectangle(bounds, edge.label.bounds);
      }
      continue;
    }

    reject(
      "INVALID_DI_GEOMETRY",
      `Unsupported diagram element ${id} exists on the primary process plane.`,
    );
  }

  if (shapeCount === 0 || !bounds) {
    reject(
      "MISSING_DRAWABLE_DI",
      "The primary process plane must contain at least one existing BPMN shape.",
    );
  }
  return bounds;
}

function computeSwimlaneGeometry(
  existing: DiagramBounds,
  orientation: SwimlaneOrientation,
): SwimlaneGeometry {
  const contentWidth = existing.maxX - existing.minX + CONTENT_PADDING * 2;
  const contentHeight = existing.maxY - existing.minY + CONTENT_PADDING * 2;
  const laneX = existing.minX - CONTENT_PADDING;
  const laneY = existing.minY - CONTENT_PADDING;

  if (orientation === "horizontal") {
    const width = Math.max(contentWidth, MIN_HORIZONTAL_LANE_WIDTH);
    const height = Math.max(contentHeight, MIN_HORIZONTAL_LANE_HEIGHT);
    return {
      participant: {
        x: laneX - HEADER_SIZE,
        y: laneY,
        width: width + HEADER_SIZE,
        height: height * 2,
      },
      firstLane: { x: laneX, y: laneY, width, height },
      secondLane: { x: laneX, y: laneY + height, width, height },
    };
  }

  const width = Math.max(contentWidth, MIN_VERTICAL_LANE_WIDTH);
  const height = Math.max(contentHeight, MIN_VERTICAL_LANE_HEIGHT);
  return {
    participant: {
      x: laneX,
      y: laneY - HEADER_SIZE,
      width: width * 2,
      height: height + HEADER_SIZE,
    },
    firstLane: { x: laneX, y: laneY, width, height },
    secondLane: { x: laneX + width, y: laneY, width, height },
  };
}

function safeIdFragment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_.-]/g, "_");
  if (!cleaned) return "Process";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `Process_${cleaned}`;
}

function collectUsedIds(xml: string, parsedIds: readonly string[]): Set<string> {
  const ids = new Set(parsedIds);
  for (const match of xml.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)) {
    if (match[1]) ids.add(match[1]);
  }
  return ids;
}

function createIdAllocator(ids: Set<string>) {
  return (base: string): string => {
    let candidate = base;
    let suffix = 2;
    while (ids.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    ids.add(candidate);
    return candidate;
  };
}

function topLevelFlowNodes(process: Process): FlowNode[] {
  return (process.flowElements ?? []).filter(
    (element): element is FlowNode => isType(element, "bpmn:FlowNode"),
  );
}

function createShape(
  moddle: InstanceType<typeof BpmnModdle>,
  id: string,
  element: BaseElement,
  bounds: Rectangle,
  isHorizontal: boolean,
  parent: BPMNPlane,
): BPMNShape {
  const rectangle = moddle.create("dc:Bounds", { ...bounds });
  const shape = moddle.create("bpmndi:BPMNShape", {
    id,
    bpmnElement: element,
    bounds: rectangle,
    isHorizontal,
  }) as BPMNShape;
  shape.$parent = parent;
  rectangle.$parent = shape;
  return shape;
}

export async function buildCoreSwimlaneConversionCandidate(
  acknowledgedCoreXml: string,
  orientation: SwimlaneOrientation,
  sourceProfileId: BpmnProfileId = coreBpmnProfile.id,
): Promise<PreparedCoreSwimlaneConversion> {
  if (orientation !== "horizontal" && orientation !== "vertical") {
    reject("INVALID_ORIENTATION", "Unsupported swimlane orientation.");
  }
  if (!acknowledgedCoreXml.trim()) {
    reject("INVALID_XML", "Acknowledged Core XML is empty.");
  }

  const moddle = new BpmnModdle({ teb: tebModdleDescriptor });
  let parsed: Awaited<ReturnType<typeof moddle.fromXML>>;
  try {
    parsed = await moddle.fromXML(acknowledgedCoreXml);
  } catch {
    reject("INVALID_XML", "Acknowledged Core XML cannot be parsed as BPMN 2.0.");
  }

  const definitions = parsed.rootElement as Definitions;
  if (definitions.$type !== "bpmn:Definitions" || parsed.warnings.length > 0) {
    reject(
      "INVALID_XML",
      "Acknowledged Core XML is not a warning-free BPMN Definitions document.",
    );
  }

  const diagrams = definitions.diagrams ?? [];
  const primaryProcessPlanes = diagrams
    .map((diagram) => diagram.plane)
    .filter(
      (plane): plane is BPMNPlane & { bpmnElement: Process } =>
        Boolean(plane && isType(plane.bpmnElement, "bpmn:Process")),
    );
  if (primaryProcessPlanes.length === 0) {
    reject(
      "MISSING_PRIMARY_PROCESS_PLANE",
      "The source needs one BPMN plane owned by its primary Process.",
    );
  }
  if (primaryProcessPlanes.length > 1) {
    reject(
      "AMBIGUOUS_PRIMARY_PROCESS_PLANE",
      "More than one Process-owned BPMN plane makes the primary Process ambiguous.",
    );
  }
  if (diagrams.length !== 1) {
    reject(
      "UNSUPPORTED_SOURCE_STRUCTURE",
      "The source must contain exactly one BPMN diagram.",
    );
  }

  const primaryPlane = primaryProcessPlanes[0]!;
  const process = primaryPlane.bpmnElement;
  const plane: BPMNPlane = primaryPlane;
  const roots = definitions.rootElements ?? [];
  if (
    !process.id ||
    !roots.includes(process) ||
    roots.some((root) => isType(root, "bpmn:Collaboration")) ||
    (process.laneSets?.length ?? 0) > 0 ||
    Object.values(parsed.elementsById).some(
      (element) =>
        isType(element, "bpmn:Participant") || isType(element, "bpmn:Lane"),
    )
  ) {
    reject(
      "UNSUPPORTED_SOURCE_STRUCTURE",
      "The source is not an unwrapped primary Core Process.",
    );
  }

  const existingBounds = inspectExistingDiagram(plane);
  const geometry = computeSwimlaneGeometry(existingBounds, orientation);
  const allocateId = createIdAllocator(
    collectUsedIds(acknowledgedCoreXml, Object.keys(parsed.elementsById)),
  );
  const fragment = safeIdFragment(process.id);
  const collaborationId = allocateId(`Collaboration_${fragment}_Swimlane`);
  const participantId = allocateId(`Participant_${fragment}_Swimlane`);
  const laneSetId = allocateId(`LaneSet_${fragment}_Swimlane`);
  const firstLaneId = allocateId(`Lane_${fragment}_Primary`);
  const secondLaneId = allocateId(`Lane_${fragment}_Secondary`);
  const participantShapeId = allocateId(`Shape_${participantId}`);
  const firstLaneShapeId = allocateId(`Shape_${firstLaneId}`);
  const secondLaneShapeId = allocateId(`Shape_${secondLaneId}`);
  const isHorizontal = orientation === "horizontal";

  const collaboration = moddle.create("bpmn:Collaboration", {
    id: collaborationId,
    name: orientation === "horizontal" ? "Quy trình theo vai trò" : "Quy trình theo cột",
    participants: [],
    messageFlows: [],
  }) as Collaboration;
  const participant = moddle.create("bpmn:Participant", {
    id: participantId,
    name: orientation === "horizontal" ? "Quy trình theo vai trò" : "Quy trình theo cột",
    processRef: process,
  }) as Participant;
  const laneSet = moddle.create("bpmn:LaneSet", {
    id: laneSetId,
    lanes: [],
  }) as LaneSet;
  const firstLane = moddle.create("bpmn:Lane", {
    id: firstLaneId,
    name: isHorizontal ? "Vai trò trên" : "Vai trò trái",
    flowNodeRef: topLevelFlowNodes(process),
  }) as Lane;
  const secondLane = moddle.create("bpmn:Lane", {
    id: secondLaneId,
    name: isHorizontal ? "Vai trò dưới" : "Vai trò phải",
    flowNodeRef: [],
  }) as Lane;

  collaboration.$parent = definitions;
  participant.$parent = collaboration;
  laneSet.$parent = process;
  firstLane.$parent = laneSet;
  secondLane.$parent = laneSet;
  collaboration.participants = [participant];
  laneSet.lanes = [firstLane, secondLane];
  process.laneSets = [laneSet];
  definitions.rootElements = [...roots, collaboration];
  plane.bpmnElement = collaboration;

  const participantShape = createShape(
    moddle,
    participantShapeId,
    participant,
    geometry.participant,
    isHorizontal,
    plane,
  );
  const firstLaneShape = createShape(
    moddle,
    firstLaneShapeId,
    firstLane,
    geometry.firstLane,
    isHorizontal,
    plane,
  );
  const secondLaneShape = createShape(
    moddle,
    secondLaneShapeId,
    secondLane,
    geometry.secondLane,
    isHorizontal,
    plane,
  );
  plane.planeElement = [
    participantShape,
    firstLaneShape,
    secondLaneShape,
    ...(plane.planeElement ?? []),
  ];

  try {
    const { xml } = await moddle.toXML(definitions, {
      format: true,
      preamble: true,
    });
    if (!xml.trim()) reject("CANDIDATE_REJECTED", "Candidate serialization was empty.");
    return {
      xml,
      targetProfileId: collaborationConversionTarget(sourceProfileId),
    };
  } catch (error) {
    if (error instanceof CoreSwimlaneConversionError) throw error;
    reject("CANDIDATE_REJECTED", "The swimlane candidate could not be serialized.");
  }
}
