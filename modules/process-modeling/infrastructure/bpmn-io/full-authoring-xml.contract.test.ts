import { describe, expect, it } from "vitest";
import {
  coreBoundaryEventsBpmnProfile,
  coreFullAuthoringBpmnProfile,
} from "../../domain/core-profile";
import { bpmnElementColorPalette } from "../../domain/full-authoring";
import { inspectBpmnXml, prepareBpmnFileImport } from "./inspect-bpmn-xml";
import { starterBpmnXml } from "./starter-model";

const fullAuthoringXml = starterBpmnXml
  .replace(
    '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"',
    '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n' +
      '  xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"',
  )
  .replace(
    '<bpmn:exclusiveGateway id="Gateway_Ready" name="Đủ điều kiện?">',
    '<bpmn:exclusiveGateway id="Gateway_Ready" name="Đủ điều kiện?" default="Flow_Revise">',
  )
  .replace(
    '<bpmn:sequenceFlow id="Flow_Ready_Publish" name="Có" sourceRef="Gateway_Ready" targetRef="Task_Publish" />',
    '<bpmn:sequenceFlow id="Flow_Ready_Publish" name="Có" sourceRef="Gateway_Ready" targetRef="Task_Publish"><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">ready = true</bpmn:conditionExpression></bpmn:sequenceFlow>',
  )
  .replace(
    "  </bpmn:process>",
    `    <bpmn:textAnnotation id="Annotation_Context" textFormat="text/plain">
      <bpmn:text>Explain the editorial intake.</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:association id="Association_Context" associationDirection="None" sourceRef="Task_Intake" targetRef="Annotation_Context" />
    <bpmn:group id="Group_Review" categoryValueRef="CategoryValue_Review" />
  </bpmn:process>
  <bpmn:category id="Category_Review">
    <bpmn:categoryValue id="CategoryValue_Review" value="Review boundary" />
  </bpmn:category>`,
  )
  .replace(
    '      <bpmndi:BPMNShape id="Shape_Start"',
    '      <bpmndi:BPMNShape id="Shape_Annotation_Context" bpmnElement="Annotation_Context"><dc:Bounds x="200" y="360" width="180" height="80" /></bpmndi:BPMNShape>\n' +
      '      <bpmndi:BPMNShape id="Shape_Group_Review" bpmnElement="Group_Review" bioc:stroke="#6F54E8"><dc:Bounds x="180" y="100" width="480" height="250" /></bpmndi:BPMNShape>\n' +
      '      <bpmndi:BPMNShape id="Shape_Start"',
  )
  .replace(
    '<bpmndi:BPMNShape id="Shape_Intake" bpmnElement="Task_Intake">',
    '<bpmndi:BPMNShape id="Shape_Intake" bpmnElement="Task_Intake" bioc:fill="#E8F2FF" bioc:stroke="#2863C7">',
  )
  .replace(
    "    </bpmndi:BPMNPlane>",
    '      <bpmndi:BPMNEdge id="Edge_Association_Context" bpmnElement="Association_Context" bioc:stroke="#5E5965"><di:waypoint x="260" y="260" /><di:waypoint x="260" y="360" /></bpmndi:BPMNEdge>\n' +
      "    </bpmndi:BPMNPlane>",
  );

describe("Full Authoring BPMN XML contract", () => {
  it.each(bpmnElementColorPalette)(
    "round-trips the canonical $id fill and stroke",
    async ({ fill, stroke }) => {
      const coloredXml = fullAuthoringXml.replace(
        'bioc:fill="#E8F2FF" bioc:stroke="#2863C7"',
        `bioc:fill="${fill}" bioc:stroke="${stroke}"`,
      );
      const first = await inspectBpmnXml(
        coloredXml,
        coreFullAuthoringBpmnProfile.id,
      );

      expect(first.safeToPersist).toBe(true);
      expect(first.snapshot?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            elementId: "Task_Intake",
            fill,
            stroke,
          }),
        ]),
      );

      const second = await inspectBpmnXml(
        first.canonicalXml ?? "",
        coreFullAuthoringBpmnProfile.id,
      );
      expect(second.snapshot).toEqual(first.snapshot);
      expect(second.canonicalXml).toBe(first.canonicalXml);
    },
  );

  it("round-trips artifacts, category ownership and canonical bioc colors", async () => {
    const first = await inspectBpmnXml(
      fullAuthoringXml,
      coreFullAuthoringBpmnProfile.id,
    );
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: coreFullAuthoringBpmnProfile.id,
      categoryRegistry: [
        {
          categoryId: "Category_Review",
          categoryValueId: "CategoryValue_Review",
          title: "Review boundary",
          ownerGroupIds: ["Group_Review"],
          referenceCount: 1,
          hasUnknownReferences: false,
        },
      ],
    });
    expect(first.snapshot?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "Annotation_Context",
          type: "bpmn:TextAnnotation",
          text: "Explain the editorial intake.",
          textFormat: "text/plain",
        }),
        expect.objectContaining({
          id: "Association_Context",
          sourceId: "Task_Intake",
          targetId: "Annotation_Context",
          associationDirection: "None",
        }),
        expect.objectContaining({
          id: "Group_Review",
          categoryValueRefId: "CategoryValue_Review",
        }),
        expect.objectContaining({
          id: "CategoryValue_Review",
          parentId: "Category_Review",
          value: "Review boundary",
        }),
      ]),
    );
    expect(first.snapshot?.shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: "Task_Intake",
          fill: "#E8F2FF",
          stroke: "#2863C7",
        }),
        expect.objectContaining({
          elementId: "Group_Review",
          stroke: "#6F54E8",
        }),
      ]),
    );
    expect(first.snapshot?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: "Association_Context",
          stroke: "#5E5965",
        }),
      ]),
    );
    expect(first.outline.map((element) => element.id)).toEqual(
      expect.arrayContaining([
        "Annotation_Context",
        "Association_Context",
        "Group_Review",
      ]),
    );
    expect(first.outline.map((element) => element.id)).not.toContain(
      "CategoryValue_Review",
    );

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      coreFullAuthoringBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.categoryRegistry).toEqual(first.categoryRegistry);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it("keeps Full Authoring semantics and bioc outside the frozen predecessor", async () => {
    const result = await inspectBpmnXml(
      fullAuthoringXml,
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(
      expect.arrayContaining(["BPMN-PROFILE-004", "BPMN-COLOR-001"]),
    );
  });

  it("rejects non-canonical colors and edge fill", async () => {
    const unsafeColor = await inspectBpmnXml(
      fullAuthoringXml.replace("#E8F2FF", "#e8f2ff"),
      coreFullAuthoringBpmnProfile.id,
    );
    expect(unsafeColor.safeToPersist).toBe(false);
    expect(unsafeColor.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-COLOR-001",
    );

    const edgeFill = await inspectBpmnXml(
      fullAuthoringXml.replace(
        'bpmnElement="Association_Context" bioc:stroke',
        'bpmnElement="Association_Context" bioc:fill="#F1F0EF" bioc:stroke',
      ),
      coreFullAuthoringBpmnProfile.id,
    );
    expect(edgeFill.safeToPersist).toBe(false);
    expect(edgeFill.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-COLOR-001",
    );
  });
});

describe("explicit compatible color import", () => {
  const compatible = fullAuthoringXml
    .replaceAll("http://bpmn.io/schema/bpmn/biocolor/1.0", "http://www.omg.org/spec/BPMN/non-normative/color/1.0")
    .replaceAll("xmlns:bioc", "xmlns:paint")
    .replaceAll("bioc:fill", "paint:background-color")
    .replaceAll("bioc:stroke", "paint:border-color");
  it("preserves colors through explicit adapter without widening stored profiles", async () => {
    expect((await inspectBpmnXml(compatible, coreFullAuthoringBpmnProfile.id)).safeToPersist).toBe(false);
    const result = await prepareBpmnFileImport(compatible, coreFullAuthoringBpmnProfile.id);
    expect(result.inspection.safeToPersist).toBe(true);
    expect(result.notices).toHaveLength(1);
    expect(result.inspection.canonicalXml).not.toContain("non-normative/color");
    expect(result.inspection.snapshot).toEqual((await inspectBpmnXml(fullAuthoringXml, coreFullAuthoringBpmnProfile.id)).snapshot);
    const second = await prepareBpmnFileImport(result.inspection.canonicalXml!, coreFullAuthoringBpmnProfile.id);
    expect(second.inspection.snapshot).toEqual(result.inspection.snapshot);
    expect(second.notices).toEqual([]);
  });
  it("rejects contradictory canonical and imported colors", async () => {
    const conflict = compatible.replace('xmlns:paint=', 'xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" xmlns:paint=')
      .replace('paint:border-color="#2863C7"', 'bioc:stroke="#B23845" paint:border-color="#2863C7"');
    expect((await prepareBpmnFileImport(conflict, coreFullAuthoringBpmnProfile.id)).inspection.safeToPersist).toBe(false);
  });
  it.each([
    ['paint:border-color="#2863C7"', 'paint:border-color="url(https://evil.test)"'],
    ['paint:border-color="#2863C7"', 'paint:unknown="#2863C7"'],
    ['paint:border-color="#2863C7"', 'paint:color="#2863C7"'],
    ['paint:border-color="#2863C7"', 'paint:border-color="#123456"'],
    ['<bpmn:task id="Task_Intake"', '<bpmn:task paint:border-color="#2863C7" id="Task_Intake"'],
    ['<bpmn:definitions', '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "https://evil.test">]><bpmn:definitions'],
  ])("rejects unsafe/unsupported color input %s", async (from, to) => {
    expect(compatible).toContain(from);
    expect((await prepareBpmnFileImport(compatible.replace(from, to), coreFullAuthoringBpmnProfile.id)).inspection.safeToPersist).toBe(false);
  });
});

it("infers a validated Core profile without adding collaboration pools", async () => {
  const { inspectBpmnFileImport } = await import("./inspect-bpmn-xml");
  const result = await inspectBpmnFileImport(fullAuthoringXml, "teb-collaboration-swimlane-layouts@1", true);
  expect(result.safeToPersist).toBe(true);
  expect(result.profileId).toBe(coreFullAuthoringBpmnProfile.id);
  expect(result.canonicalXml).not.toContain("bpmn:participant");
  expect(result.importNotices).toHaveLength(1);
});
