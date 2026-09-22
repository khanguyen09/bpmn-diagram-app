import type {
  BpmnInspectionIssue,
  CoreBpmnElement,
  CoreBpmnSnapshot,
} from "./core-profile";
import { countGraphemes } from "./swimlane-role-authoring";

export const bpmnIoColorNamespace =
  "http://bpmn.io/schema/bpmn/biocolor/1.0";

export const bpmnElementColorPalette = [
  { id: "violet", fill: "#F0EBFF", stroke: "#6F54E8" },
  { id: "blue", fill: "#E8F2FF", stroke: "#2863C7" },
  { id: "green", fill: "#E8F7EF", stroke: "#247A52" },
  { id: "amber", fill: "#FFF4D6", stroke: "#8A6200" },
  { id: "red", fill: "#FDEBEC", stroke: "#B23845" },
  { id: "gray", fill: "#F1F0EF", stroke: "#5E5965" },
] as const;

const allowedFillColors: ReadonlySet<string> = new Set(
  bpmnElementColorPalette.map((entry) => entry.fill),
);
const allowedStrokeColors: ReadonlySet<string> = new Set(
  bpmnElementColorPalette.map((entry) => entry.stroke),
);

export function isAllowedBpmnFillColor(value: unknown): value is string {
  return typeof value === "string" && allowedFillColors.has(value);
}

export function isAllowedBpmnStrokeColor(value: unknown): value is string {
  return typeof value === "string" && allowedStrokeColors.has(value);
}

function issue(
  ruleId: string,
  message: string,
  recovery: string,
  disposition: BpmnInspectionIssue["disposition"],
  elementId?: string,
): BpmnInspectionIssue {
  return {
    ruleId,
    severity: disposition === "fatal" ? "error" : "warning",
    disposition,
    elementId,
    message,
    recovery,
  };
}

export function containsUnsupportedBpmnPlainTextControl(
  value: string,
): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

export function isSupportedBpmnPlainText(value: string): boolean {
  return !containsUnsupportedBpmnPlainTextControl(value);
}

export function inspectFullAuthoringArtifacts(
  snapshot: Pick<CoreBpmnSnapshot, "elements" | "shapes" | "edges">,
  participants: readonly {
    readonly id: string;
    readonly processId?: string;
  }[] = [],
): readonly BpmnInspectionIssue[] {
  const issues: BpmnInspectionIssue[] = [];
  const elementsById = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const shapeById = new Map(
    snapshot.shapes.map((shape) => [shape.elementId, shape] as const),
  );
  const edgeIds = new Set(snapshot.edges.map((edge) => edge.elementId));

  for (const annotation of snapshot.elements.filter(
    (element) => element.type === "bpmn:TextAnnotation",
  )) {
    const text = annotation.text ?? "";
    if (annotation.textFormat !== "text/plain") {
      issues.push(issue(
        "BPMN-ANNOTATION-001",
        "Text Annotation phải dùng text/plain.",
        "Bỏ rich text và đặt textFormat=text/plain.",
        "fatal",
        annotation.id,
      ));
    }
    if (!isSupportedBpmnPlainText(text) || countGraphemes(text) > 2_000) {
      issues.push(issue(
        "BPMN-ANNOTATION-002",
        "Nội dung chú thích vượt bounded plain-text contract.",
        "Dùng text thuần tối đa 2.000 grapheme.",
        "fatal",
        annotation.id,
      ));
    } else if (!text.trim()) {
      issues.push(issue(
        "BPMN-ANNOTATION-003",
        "Text Annotation chưa có nội dung.",
        "Nhập nội dung chú thích trước khi seal.",
        "recoverable",
        annotation.id,
      ));
    }
    if (!shapeById.has(annotation.id)) {
      issues.push(issue(
        "BPMN-ANNOTATION-DI-001",
        "Text Annotation thiếu BPMNShape.",
        "Bổ sung bounds hữu hạn cho chú thích.",
        "fatal",
        annotation.id,
      ));
    }
  }

  for (const association of snapshot.elements.filter(
    (element) => element.type === "bpmn:Association",
  )) {
    const source = association.sourceId
      ? elementsById.get(association.sourceId)
      : undefined;
    const target = association.targetId
      ? elementsById.get(association.targetId)
      : undefined;
    const annotationEndpoints = [source, target].filter(
      (element) => element?.type === "bpmn:TextAnnotation",
    ).length;
    const other = source?.type === "bpmn:TextAnnotation" ? target : source;
    if (
      !source ||
      !target ||
      annotationEndpoints !== 1 ||
      !other ||
      !shapeById.has(other.id)
    ) {
      issues.push(issue(
        "BPMN-ASSOCIATION-001",
        "Association phải nối đúng một Text Annotation với một shape cùng diagram.",
        "Chọn một chú thích và một BPMN shape hợp lệ.",
        "fatal",
        association.id,
      ));
    }
    if (
      association.associationDirection !== undefined &&
      association.associationDirection !== "None"
    ) {
      issues.push(issue(
        "BPMN-ASSOCIATION-002",
        "Full Authoring v1 chỉ hỗ trợ Association không hướng.",
        "Đặt associationDirection=None.",
        "fatal",
        association.id,
      ));
    }
    if (!edgeIds.has(association.id)) {
      issues.push(issue(
        "BPMN-ASSOCIATION-DI-001",
        "Association thiếu BPMNEdge.",
        "Bổ sung ít nhất hai waypoint hữu hạn.",
        "fatal",
        association.id,
      ));
    }
  }

  for (const group of snapshot.elements.filter(
    (element) => element.type === "bpmn:Group",
  )) {
    const categoryValue = group.categoryValueRefId
      ? elementsById.get(group.categoryValueRefId)
      : undefined;
    if (!categoryValue || categoryValue.type !== "bpmn:CategoryValue") {
      issues.push(issue(
        "BPMN-GROUP-001",
        "Group thiếu CategoryValue title hợp lệ.",
        "Gắn Group với một Definitions-root CategoryValue.",
        "fatal",
        group.id,
      ));
    }
    const title = categoryValue?.value ?? "";
    if (
      !title.trim() ||
      !isSupportedBpmnPlainText(title) ||
      countGraphemes(title) > 120
    ) {
      issues.push(issue(
        "BPMN-GROUP-002",
        "Tiêu đề Group phải là plain text 1..120 grapheme.",
        "Đặt CategoryValue.value hợp lệ.",
        title.trim() ? "fatal" : "recoverable",
        group.id,
      ));
    }
    const groupShape = shapeById.get(group.id);
    if (!groupShape) {
      issues.push(issue(
        "BPMN-GROUP-DI-001",
        "Group thiếu BPMNShape.",
        "Bổ sung bounds hữu hạn cho vùng trực quan.",
        "fatal",
        group.id,
      ));
    } else if (participants.length > 0) {
      const containingWhiteBoxes = participants.filter((participant) => {
        if (!participant.processId) return false;
        const participantShape = shapeById.get(participant.id);
        return Boolean(
          participantShape &&
          groupShape.x >= participantShape.x &&
          groupShape.y >= participantShape.y &&
          groupShape.x + groupShape.width <=
            participantShape.x + participantShape.width &&
          groupShape.y + groupShape.height <=
            participantShape.y + participantShape.height,
        );
      });
      if (containingWhiteBoxes.length !== 1) {
        issues.push(issue(
          "BPMN-GROUP-DI-002",
          "Collaboration Group phải nằm trọn trong đúng một white-box Pool.",
          "Resize hoặc di chuyển Group vào một Pool có Process.",
          "fatal",
          group.id,
        ));
      }
    }
  }

  for (const categoryValue of snapshot.elements.filter(
    (element) => element.type === "bpmn:CategoryValue",
  )) {
    const category = categoryValue.parentId
      ? elementsById.get(categoryValue.parentId)
      : undefined;
    if (!category || category.type !== "bpmn:Category") {
      issues.push(issue(
        "BPMN-CATEGORY-001",
        "CategoryValue không thuộc Category root hợp lệ.",
        "Đặt CategoryValue trong đúng một bpmn:Category.",
        "fatal",
        categoryValue.id,
      ));
    }
  }

  for (const shape of snapshot.shapes) {
    const semanticType = elementsById.get(shape.elementId)?.type;
    if (shape.fill !== undefined && !isAllowedBpmnFillColor(shape.fill)) {
      issues.push(issue(
        "BPMN-COLOR-001",
        "Màu nền của thành phần chưa được hỗ trợ.",
        "Chọn lại màu nền trong bộ màu của ứng dụng.",
        "fatal",
        shape.elementId,
      ));
    }
    if (shape.stroke !== undefined && !isAllowedBpmnStrokeColor(shape.stroke)) {
      issues.push(issue(
        "BPMN-COLOR-001",
        "Màu viền của thành phần chưa được hỗ trợ.",
        "Chọn lại màu viền trong bộ màu của ứng dụng.",
        "fatal",
        shape.elementId,
      ));
    }
    if (semanticType === "bpmn:Group" && shape.fill !== undefined) {
      issues.push(issue(
        "BPMN-COLOR-002",
        "Khung nhóm chỉ dùng màu viền để không che nội dung.",
        "Bỏ màu nền khỏi khung nhóm.",
        "fatal",
        shape.elementId,
      ));
    }
  }
  for (const edge of snapshot.edges) {
    if (edge.fill !== undefined) {
      issues.push(issue(
        "BPMN-COLOR-002",
        "Đường nối chỉ dùng màu viền.",
        "Bỏ màu nền khỏi đường nối.",
        "fatal",
        edge.elementId,
      ));
    }
    if (edge.stroke !== undefined && !isAllowedBpmnStrokeColor(edge.stroke)) {
      issues.push(issue(
        "BPMN-COLOR-001",
        "Màu đường nối chưa được hỗ trợ.",
        "Chọn lại màu đường nối trong bộ màu của ứng dụng.",
        "fatal",
        edge.elementId,
      ));
    }
  }
  return issues;
}

export function visibleFullAuthoringArtifacts(
  elements: readonly CoreBpmnElement[],
): readonly CoreBpmnElement[] {
  return elements.filter((element) =>
    ["bpmn:TextAnnotation", "bpmn:Association", "bpmn:Group"].includes(
      element.type,
    ),
  );
}

/**
 * Builds the Full Authoring outline read model without mutating BPMN
 * semantics. In particular, Group remains a visual-only overlay and resolves
 * its display title through CategoryValue rather than duplicating the title.
 */
export function projectFullAuthoringOutlineArtifacts(
  snapshot: Pick<CoreBpmnSnapshot, "elements" | "shapes" | "edges">,
): readonly CoreBpmnElement[] {
  const elementsById = new Map(
    snapshot.elements.map((element) => [element.id, element] as const),
  );
  const shapeByElementId = new Map(
    snapshot.shapes.map((shape) => [shape.elementId, shape] as const),
  );
  const edgeByElementId = new Map(
    snapshot.edges.map((edge) => [edge.elementId, edge] as const),
  );
  const authoredColor = (elementId: string) => {
    const colored =
      shapeByElementId.get(elementId) ?? edgeByElementId.get(elementId);
    if (!colored || (colored.fill === undefined && colored.stroke === undefined)) {
      return undefined;
    }
    return {
      ...(colored.fill !== undefined ? { fill: colored.fill } : {}),
      ...(colored.stroke !== undefined ? { stroke: colored.stroke } : {}),
    };
  };

  return visibleFullAuthoringArtifacts(snapshot.elements).map((artifact) => {
    const color = authoredColor(artifact.id);
    if (artifact.type === "bpmn:TextAnnotation") {
      return {
        ...artifact,
        displayLabel: artifact.text ?? "",
        authoringRole: "ANNOTATION",
        ...(color ? { authoredColor: color } : {}),
      };
    }
    if (artifact.type === "bpmn:Group") {
      const title = artifact.categoryValueRefId
        ? elementsById.get(artifact.categoryValueRefId)?.value
        : undefined;
      return {
        ...artifact,
        displayLabel: title ?? "",
        authoringRole: "VISUAL_ONLY_GROUP",
        ...(color ? { authoredColor: color } : {}),
      };
    }
    return {
      ...artifact,
      displayLabel:
        artifact.sourceId && artifact.targetId
          ? `${artifact.sourceId} ↔ ${artifact.targetId}`
          : "",
      authoringRole: "ASSOCIATION",
      ...(color ? { authoredColor: color } : {}),
    };
  });
}
