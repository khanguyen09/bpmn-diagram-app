import { describe, expect, it } from "vitest";
import {
  collaborationBoundaryEventsBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
} from "./collaboration-profile";
import {
  canTransitionBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreFullAuthoringBpmnProfile,
  supportsFullAuthoring,
  type CoreBpmnElement,
} from "./core-profile";
import {
  inspectCategoryRegistry,
  planCategoryCleanup,
  projectCategoryRegistry,
} from "./category-registry";
import {
  bpmnElementColorPalette,
  containsUnsupportedBpmnPlainTextControl,
  inspectFullAuthoringArtifacts,
  isSupportedBpmnPlainText,
  projectFullAuthoringOutlineArtifacts,
} from "./full-authoring";

const fullAuthoringDelta = [
  "bpmn:TextAnnotation",
  "bpmn:Association",
  "bpmn:Group",
  "bpmn:Category",
  "bpmn:CategoryValue",
] as const;

function inspectAnnotationText(text: string) {
  return inspectFullAuthoringArtifacts({
    elements: [
      {
        id: "Annotation_boundary",
        type: "bpmn:TextAnnotation",
        text,
        textFormat: "text/plain",
        incoming: [],
        outgoing: [],
      },
    ],
    shapes: [
      {
        elementId: "Annotation_boundary",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
      },
    ],
    edges: [],
  });
}

function inspectGroupTitle(value: string) {
  return inspectFullAuthoringArtifacts({
    elements: [
      {
        id: "Group_boundary",
        type: "bpmn:Group",
        categoryValueRefId: "CategoryValue_boundary",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Category_boundary",
        type: "bpmn:Category",
        categoryValueIds: ["CategoryValue_boundary"],
        incoming: [],
        outgoing: [],
      },
      {
        id: "CategoryValue_boundary",
        type: "bpmn:CategoryValue",
        parentId: "Category_boundary",
        value,
        incoming: [],
        outgoing: [],
      },
    ],
    shapes: [
      {
        elementId: "Group_boundary",
        x: 0,
        y: 0,
        width: 240,
        height: 120,
      },
    ],
    edges: [],
  });
}

describe("Full Authoring profile contract", () => {
  it("freezes the exact semantic delta and adjacent family transitions", () => {
    expect(
      coreFullAuthoringBpmnProfile.semanticTypes.filter(
        (type) =>
          !coreBoundaryEventsBpmnProfile.semanticTypes.includes(type as never),
      ),
    ).toEqual(fullAuthoringDelta);
    expect(
      collaborationFullAuthoringBpmnProfile.semanticTypes.filter(
        (type) =>
          !collaborationBoundaryEventsBpmnProfile.semanticTypes.includes(
            type as never,
          ),
      ),
    ).toEqual(fullAuthoringDelta);
    expect(
      canTransitionBpmnProfile(
        coreBoundaryEventsBpmnProfile.id,
        coreFullAuthoringBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationBoundaryEventsBpmnProfile.id,
        collaborationFullAuthoringBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        coreBoundaryEventsBpmnProfile.id,
        collaborationFullAuthoringBpmnProfile.id,
      ),
    ).toBe(false);
    expect(supportsFullAuthoring(coreFullAuthoringBpmnProfile.id)).toBe(true);
    expect(
      supportsFullAuthoring(collaborationFullAuthoringBpmnProfile.id),
    ).toBe(true);
    expect(supportsFullAuthoring(coreBoundaryEventsBpmnProfile.id)).toBe(false);
  });

  it("accepts the canonical artifact, title, DI and color policy", () => {
    const elements: CoreBpmnElement[] = [
      {
        id: "Task_1",
        type: "bpmn:Task",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Annotation_1",
        type: "bpmn:TextAnnotation",
        text: "Explain why this step exists.",
        textFormat: "text/plain",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Association_1",
        type: "bpmn:Association",
        sourceId: "Task_1",
        targetId: "Annotation_1",
        associationDirection: "None",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Group_1",
        type: "bpmn:Group",
        categoryValueRefId: "CategoryValue_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Category_1",
        type: "bpmn:Category",
        categoryValueIds: ["CategoryValue_1"],
        incoming: [],
        outgoing: [],
      },
      {
        id: "CategoryValue_1",
        type: "bpmn:CategoryValue",
        parentId: "Category_1",
        value: "Review boundary",
        incoming: [],
        outgoing: [],
      },
    ];
    expect(
      inspectFullAuthoringArtifacts({
        elements,
        shapes: [
          {
            elementId: "Task_1",
            x: 10,
            y: 20,
            width: 100,
            height: 80,
            ...bpmnElementColorPalette[1],
          },
          {
            elementId: "Annotation_1",
            x: 130,
            y: 20,
            width: 120,
            height: 80,
          },
          {
            elementId: "Group_1",
            x: 5,
            y: 5,
            width: 260,
            height: 110,
            stroke: bpmnElementColorPalette[0].stroke,
          },
        ],
        edges: [
          {
            elementId: "Association_1",
            waypoints: [
              { x: 110, y: 60 },
              { x: 130, y: 60 },
            ],
            stroke: bpmnElementColorPalette[5].stroke,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("fail-closes unsafe artifact topology and non-canonical colors", () => {
    const issues = inspectFullAuthoringArtifacts({
      elements: [
        {
          id: "Annotation_1",
          type: "bpmn:TextAnnotation",
          text: "x",
          textFormat: "text/html",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Association_1",
          type: "bpmn:Association",
          sourceId: "Annotation_1",
          targetId: "Missing",
          associationDirection: "One",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Group_1",
          type: "bpmn:Group",
          incoming: [],
          outgoing: [],
        },
      ],
      shapes: [
        {
          elementId: "Annotation_1",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          fill: "#ffffff",
        },
        {
          elementId: "Group_1",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          fill: bpmnElementColorPalette[0].fill,
        },
      ],
      edges: [],
    });
    expect(issues.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        "BPMN-ANNOTATION-001",
        "BPMN-ASSOCIATION-001",
        "BPMN-ASSOCIATION-002",
        "BPMN-ASSOCIATION-DI-001",
        "BPMN-GROUP-001",
        "BPMN-COLOR-001",
        "BPMN-COLOR-002",
      ]),
    );
    expect(issues.some((item) => item.disposition === "fatal")).toBe(true);
  });

  it("shares the exact plain-text control boundary with the authoring UI", () => {
    expect(isSupportedBpmnPlainText("Dòng một\tDòng hai\nDòng ba\r🙂"))
      .toBe(true);
    expect(containsUnsupportedBpmnPlainTextControl("Nội dung hợp lệ"))
      .toBe(false);

    for (const control of [
      "\u0000",
      "\u0008",
      "\u000B",
      "\u000C",
      "\u000E",
      "\u001F",
      "\u007F",
    ]) {
      expect(containsUnsupportedBpmnPlainTextControl(control)).toBe(true);
      expect(isSupportedBpmnPlainText(`trước${control}sau`)).toBe(false);
    }
  });

  it("accepts annotation 2,000 graphemes and rejects 2,001 before sealing", () => {
    expect(inspectAnnotationText("🙂".repeat(2_000))).toEqual([]);
    expect(inspectAnnotationText("🙂".repeat(2_001))).toContainEqual(
      expect.objectContaining({
        ruleId: "BPMN-ANNOTATION-002",
        disposition: "fatal",
      }),
    );
    expect(inspectAnnotationText("hợp lệ\u000Bkhông hợp lệ")).toContainEqual(
      expect.objectContaining({
        ruleId: "BPMN-ANNOTATION-002",
        disposition: "fatal",
      }),
    );
  });

  it("keeps an empty annotation recoverable", () => {
    const issues = inspectAnnotationText(" \n\t ");

    expect(issues).toContainEqual(
      expect.objectContaining({
        ruleId: "BPMN-ANNOTATION-003",
        disposition: "recoverable",
      }),
    );
    expect(issues.some((item) => item.ruleId === "BPMN-ANNOTATION-002"))
      .toBe(false);
  });

  it("accepts a 120-grapheme title and rejects empty, 121 or hidden-control titles", () => {
    expect(inspectGroupTitle("ê".repeat(120))).toEqual([]);
    expect(inspectGroupTitle("ê".repeat(121))).toContainEqual(
      expect.objectContaining({
        ruleId: "BPMN-GROUP-002",
        disposition: "fatal",
      }),
    );
    expect(inspectGroupTitle("Tiêu đề\u000Bẩn")).toContainEqual(
      expect.objectContaining({
        ruleId: "BPMN-GROUP-002",
        disposition: "fatal",
      }),
    );
    expect(inspectGroupTitle(" \n ")).toContainEqual(
      expect.objectContaining({
        ruleId: "BPMN-GROUP-002",
        disposition: "recoverable",
      }),
    );
  });

  it("projects reference ownership and requires exact, unreferenced cleanup", () => {
    const elements: CoreBpmnElement[] = [
      {
        id: "Category_1",
        type: "bpmn:Category",
        categoryValueIds: ["Value_Used", "Value_Orphan"],
        incoming: [],
        outgoing: [],
      },
      {
        id: "Value_Used",
        type: "bpmn:CategoryValue",
        parentId: "Category_1",
        value: "Used",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Value_Orphan",
        type: "bpmn:CategoryValue",
        parentId: "Category_1",
        value: "Orphan",
        incoming: [],
        outgoing: [],
      },
    ];
    const registry = projectCategoryRegistry(elements, [
      {
        categoryValueId: "Value_Used",
        ownerId: "Group_1",
        ownerType: "bpmn:Group",
        property: "Group.categoryValueRef",
        supported: true,
      },
    ]);
    expect(registry).toEqual([
      expect.objectContaining({
        categoryValueId: "Value_Used",
        ownerGroupIds: ["Group_1"],
        referenceCount: 1,
      }),
      expect.objectContaining({
        categoryValueId: "Value_Orphan",
        ownerGroupIds: [],
        referenceCount: 0,
      }),
    ]);
    expect(inspectCategoryRegistry(registry)).toEqual([
      expect.objectContaining({
        ruleId: "BPMN-CATEGORY-002",
        elementId: "Value_Orphan",
        disposition: "recoverable",
      }),
    ]);
    expect(
      planCategoryCleanup(registry, elements, {
        candidateValueIds: ["Value_Used"],
        expectedReferenceCounts: { Value_Used: 1 },
      }),
    ).toMatchObject({ accepted: false, reason: "REFERENCED" });
    expect(
      planCategoryCleanup(registry, elements, {
        candidateValueIds: ["Value_Orphan"],
        expectedReferenceCounts: { Value_Orphan: 1 },
      }),
    ).toMatchObject({ accepted: false, reason: "STALE_REFERENCE_COUNT" });
    expect(
      planCategoryCleanup(registry, elements, {
        candidateValueIds: ["Value_Orphan"],
        expectedReferenceCounts: { Value_Orphan: 0 },
      }),
    ).toEqual({
      accepted: true,
      deleteCategoryValueIds: ["Value_Orphan"],
      deleteCategoryIds: [],
    });
  });

  it("projects authored artifact labels, roles, endpoints and colors for UI", () => {
    const outline = projectFullAuthoringOutlineArtifacts({
      elements: [
        {
          id: "Annotation_1",
          type: "bpmn:TextAnnotation",
          text: "Why this matters",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Association_1",
          type: "bpmn:Association",
          sourceId: "Task_1",
          targetId: "Annotation_1",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Group_1",
          type: "bpmn:Group",
          categoryValueRefId: "Value_1",
          incoming: [],
          outgoing: [],
        },
        {
          id: "Value_1",
          type: "bpmn:CategoryValue",
          value: "Review area",
          incoming: [],
          outgoing: [],
        },
      ],
      shapes: [
        {
          elementId: "Annotation_1",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          fill: "#E8F2FF",
          stroke: "#2863C7",
        },
        {
          elementId: "Group_1",
          x: 0,
          y: 0,
          width: 200,
          height: 120,
          stroke: "#6F54E8",
        },
      ],
      edges: [
        {
          elementId: "Association_1",
          waypoints: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          stroke: "#5E5965",
        },
      ],
    });
    expect(outline).toEqual([
      expect.objectContaining({
        id: "Annotation_1",
        displayLabel: "Why this matters",
        authoringRole: "ANNOTATION",
        authoredColor: { fill: "#E8F2FF", stroke: "#2863C7" },
      }),
      expect.objectContaining({
        id: "Association_1",
        sourceId: "Task_1",
        targetId: "Annotation_1",
        displayLabel: "Task_1 ↔ Annotation_1",
        authoringRole: "ASSOCIATION",
        authoredColor: { stroke: "#5E5965" },
      }),
      expect.objectContaining({
        id: "Group_1",
        displayLabel: "Review area",
        authoringRole: "VISUAL_ONLY_GROUP",
        authoredColor: { stroke: "#6F54E8" },
      }),
    ]);
  });

  it("preserves a long multiline annotation in the outline projection", () => {
    const authoredText = `Lý do cần bước này\n${"👩🏽‍💻".repeat(80)}`;
    const outline = projectFullAuthoringOutlineArtifacts({
      elements: [
        {
          id: "Annotation_long",
          type: "bpmn:TextAnnotation",
          text: authoredText,
          incoming: [],
          outgoing: [],
        },
      ],
      shapes: [
        {
          elementId: "Annotation_long",
          x: 0,
          y: 0,
          width: 120,
          height: 80,
        },
      ],
      edges: [],
    });

    expect(outline).toEqual([
      expect.objectContaining({
        id: "Annotation_long",
        displayLabel: authoredText,
      }),
    ]);
  });
});
