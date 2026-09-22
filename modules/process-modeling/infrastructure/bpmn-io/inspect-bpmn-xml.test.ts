import { describe, expect, it } from "vitest";
import { safeBpmnFilename } from "../../application/safe-bpmn-filename";
import { inspectBpmnXml } from "./inspect-bpmn-xml";
import { starterBpmnXml } from "./starter-model";
import { collaborationStarterBpmnXml } from "./collaboration-starter-model";
import {
  collaborationBpmnProfile,
  collaborationBoundaryEventsBpmnProfile,
  collaborationNestedBpmnProfile,
} from "../../domain/collaboration-profile";
import {
  coreBpmnProfile,
  coreBpmnVisualProfile,
} from "../../domain/core-profile";

describe("BPMN XML inspection boundary", () => {
  it("accepts and canonically round-trips the Core Starter fixture", async () => {
    const first = await inspectBpmnXml(starterBpmnXml);
    expect(first.accepted).toBe(true);
    expect(first.safeToPersist).toBe(true);
    expect(first.readyToSeal).toBe(true);
    expect(first.snapshot?.elements).toHaveLength(13);
    expect(first.canonicalXml).toContain("Process_Editorial_Review");

    const second = await inspectBpmnXml(first.canonicalXml ?? "");
    expect(second.accepted).toBe(true);
    expect(second.snapshot).toEqual(first.snapshot);
  });

  it("round-trips the declared Collaboration Pool/Lane/Message Flow subset", async () => {
    const first = await inspectBpmnXml(
      collaborationStarterBpmnXml,
      collaborationBpmnProfile.id,
    );
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: collaborationBpmnProfile.id,
    });
    expect(first.outline.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "bpmn:Participant",
        "bpmn:Lane",
        "bpmn:Task",
        "bpmn:MessageFlow",
      ]),
    );
    expect(
      first.outline.find((item) => item.id === "Participant_Editorial"),
    ).toMatchObject({
      processId: "Process_Editorial",
    });
    expect(
      first.outline.find((item) => item.id === "Participant_Audience"),
    ).toMatchObject({
      processId: undefined,
    });
    expect(first.canonicalXml).toContain(
      'bpmnElement="Collaboration_Editorial"',
    );

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      collaborationBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it("keeps Collaboration semantics outside both Core profiles", async () => {
    for (const profileId of [coreBpmnProfile.id, coreBpmnVisualProfile.id]) {
      const result = await inspectBpmnXml(
        collaborationStarterBpmnXml,
        profileId,
      );
      expect(result.accepted).toBe(false);
      expect(result.issues.map((issue) => issue.ruleId)).toContain(
        "BPMN-PROFILE-003",
      );
    }
  });

  it("keeps v1 flat while v2 recursively round-trips one Lane ownership chain", async () => {
    const nestedXml = collaborationStarterBpmnXml
      .replace(
        `<bpmn:lane id="Lane_Author" name="Author">
        <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
      </bpmn:lane>`,
        `<bpmn:lane id="Lane_Author" name="Author">
        <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
        <bpmn:childLaneSet id="LaneSet_Author_Roles">
          <bpmn:lane id="Lane_Writer" name="Writer">
            <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
            <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
          </bpmn:lane>
          <bpmn:lane id="Lane_Researcher" name="Researcher" />
        </bpmn:childLaneSet>
      </bpmn:lane>`,
      )
      .replace(
        `<bpmndi:BPMNShape id="Shape_Lane_Author" bpmnElement="Lane_Author" isHorizontal="true">
        <dc:Bounds x="110" y="80" width="870" height="150" />
      </bpmndi:BPMNShape>`,
        `<bpmndi:BPMNShape id="Shape_Lane_Author" bpmnElement="Lane_Author" isHorizontal="true">
        <dc:Bounds x="110" y="80" width="870" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Writer" bpmnElement="Lane_Writer" isHorizontal="true">
        <dc:Bounds x="140" y="80" width="840" height="110" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Researcher" bpmnElement="Lane_Researcher" isHorizontal="true">
        <dc:Bounds x="140" y="190" width="840" height="40" />
      </bpmndi:BPMNShape>`,
      );

    const v1 = await inspectBpmnXml(
      nestedXml,
      collaborationBpmnProfile.id,
    );
    expect(v1.safeToPersist).toBe(false);
    expect(v1.issues.map((issue) => issue.ruleId)).toContain("BPMN-LANE-005");

    const v2 = await inspectBpmnXml(
      nestedXml,
      collaborationNestedBpmnProfile.id,
    );
    expect(v2).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: collaborationNestedBpmnProfile.id,
    });
    const lanes = (
      v2.snapshot as {
        readonly lanes: readonly {
          readonly id: string;
          readonly parentLaneId?: string;
          readonly depth: number;
        }[];
      }
    ).lanes;
    expect(lanes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "Lane_Author", depth: 0 }),
        expect.objectContaining({
          id: "Lane_Writer",
          parentLaneId: "Lane_Author",
          depth: 1,
        }),
      ]),
    );
    expect(
      v2.outline.find((item) => item.id === "Start_Draft")?.parentId,
    ).toBe("Lane_Writer");

    const second = await inspectBpmnXml(
      v2.canonicalXml ?? "",
      collaborationNestedBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(v2.snapshot);
    expect(second.canonicalXml).toBe(v2.canonicalXml);

    const overlap = await inspectBpmnXml(
      nestedXml.replace(
        'bpmnElement="Lane_Researcher" isHorizontal="true">\n        <dc:Bounds x="140" y="190"',
        'bpmnElement="Lane_Researcher" isHorizontal="true">\n        <dc:Bounds x="140" y="170"',
      ),
      collaborationNestedBpmnProfile.id,
    );
    expect(overlap.safeToPersist).toBe(false);
    expect(overlap.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-LANE-DI-002",
    );
  });

  it("round-trips four named child roles in exact document/ref/DI order", async () => {
    const roleXml = collaborationStarterBpmnXml
      .replace(
        `<bpmn:lane id="Lane_Author" name="Author">
        <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
      </bpmn:lane>`,
        `<bpmn:lane id="Lane_Author" name="Content">
        <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
        <bpmn:childLaneSet id="LaneSet_Content_Roles">
          <bpmn:lane id="Lane_Researcher" name="Researcher" />
          <bpmn:lane id="Lane_Writer" name="Writer">
            <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
            <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
          </bpmn:lane>
          <bpmn:lane id="Lane_Reviewer" name="Reviewer" />
          <bpmn:lane id="Lane_Producer" name="Producer" />
        </bpmn:childLaneSet>
      </bpmn:lane>`,
      )
      .replace(
        `<bpmndi:BPMNShape id="Shape_Lane_Author" bpmnElement="Lane_Author" isHorizontal="true">
        <dc:Bounds x="110" y="80" width="870" height="150" />
      </bpmndi:BPMNShape>`,
        `<bpmndi:BPMNShape id="Shape_Lane_Author" bpmnElement="Lane_Author" isHorizontal="true">
        <dc:Bounds x="110" y="80" width="870" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Researcher" bpmnElement="Lane_Researcher" isHorizontal="true">
        <dc:Bounds x="140" y="80" width="840" height="40" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Writer" bpmnElement="Lane_Writer" isHorizontal="true">
        <dc:Bounds x="140" y="120" width="840" height="70" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Reviewer" bpmnElement="Lane_Reviewer" isHorizontal="true">
        <dc:Bounds x="140" y="190" width="840" height="20" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Producer" bpmnElement="Lane_Producer" isHorizontal="true">
        <dc:Bounds x="140" y="210" width="840" height="20" />
      </bpmndi:BPMNShape>`,
      );

    const first = await inspectBpmnXml(
      roleXml,
      collaborationBoundaryEventsBpmnProfile.id,
    );
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: collaborationBoundaryEventsBpmnProfile.id,
    });
    const snapshot = first.snapshot as {
      readonly lanes: readonly {
        readonly id: string;
        readonly name?: string;
        readonly parentLaneId?: string;
        readonly depth: number;
        readonly flowNodeIds: readonly string[];
      }[];
      readonly shapes: readonly {
        readonly elementId: string;
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      }[];
    };
    expect(
      snapshot.lanes
        .filter((lane) => lane.parentLaneId === "Lane_Author")
        .map((lane) => ({
          id: lane.id,
          name: lane.name,
          depth: lane.depth,
          flowNodeIds: lane.flowNodeIds,
        })),
    ).toEqual([
      {
        id: "Lane_Researcher",
        name: "Researcher",
        depth: 1,
        flowNodeIds: [],
      },
      {
        id: "Lane_Writer",
        name: "Writer",
        depth: 1,
        flowNodeIds: ["Start_Draft", "Task_Write"],
      },
      {
        id: "Lane_Reviewer",
        name: "Reviewer",
        depth: 1,
        flowNodeIds: [],
      },
      {
        id: "Lane_Producer",
        name: "Producer",
        depth: 1,
        flowNodeIds: [],
      },
    ]);
    expect(
      snapshot.shapes
        .filter((shape) =>
          [
            "Lane_Researcher",
            "Lane_Writer",
            "Lane_Reviewer",
            "Lane_Producer",
          ].includes(shape.elementId),
        )
        .map((shape) => ({
          elementId: shape.elementId,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        })),
    ).toEqual([
      {
        elementId: "Lane_Researcher",
        x: 140,
        y: 80,
        width: 840,
        height: 40,
      },
      {
        elementId: "Lane_Writer",
        x: 140,
        y: 120,
        width: 840,
        height: 70,
      },
      {
        elementId: "Lane_Reviewer",
        x: 140,
        y: 190,
        width: 840,
        height: 20,
      },
      {
        elementId: "Lane_Producer",
        x: 140,
        y: 210,
        width: 840,
        height: 20,
      },
    ]);
    expect(
      first.outline.find((item) => item.id === "Task_Write")?.parentId,
    ).toBe("Lane_Writer");

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      collaborationBoundaryEventsBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it.each([
    [
      "same-pool Message Flow",
      collaborationStarterBpmnXml.replace(
        'targetRef="Participant_Audience"',
        'targetRef="Task_Write"',
      ),
      "BPMN-MESSAGE-002",
    ],
    [
      "missing Message Flow DI",
      collaborationStarterBpmnXml.replace(
        /<bpmndi:BPMNEdge id="Edge_Message_Audience"[\s\S]*?<\/bpmndi:BPMNEdge>/,
        "",
      ),
      "BPMN-COLLAB-DI-003",
    ],
    [
      "wrong Collaboration plane",
      collaborationStarterBpmnXml.replace(
        'bpmnElement="Collaboration_Editorial"',
        'bpmnElement="Process_Editorial"',
      ),
      "BPMN-COLLAB-DI-001",
    ],
  ])("rejects Collaboration invariant: %s", async (_name, xml, ruleId) => {
    const result = await inspectBpmnXml(xml, collaborationBpmnProfile.id);
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(ruleId);
  });

  it("persists a recoverable incomplete Core draft but does not mark it ready", async () => {
    const result = await inspectBpmnXml(incompleteCoreDraftXml);

    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: false,
    });
    expect(result.canonicalXml).toContain("Task_Draft");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-CONNECT-001",
          disposition: "recoverable",
        }),
        expect.objectContaining({
          ruleId: "BPMN-CONNECT-002",
          disposition: "recoverable",
        }),
        expect.objectContaining({
          ruleId: "BPMN-NAME-001",
          disposition: "recoverable",
        }),
      ]),
    );
  });

  it("round-trips one allowlisted node visual only in Core v2", async () => {
    const xml = starterBpmnXml
      .replace(
        'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
        'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n  xmlns:teb="urn:the-experience-blogs:bpmn:extension:1"',
      )
      .replace(
        '<bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc">',
        '<bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc"><bpmn:extensionElements><teb:nodeVisual iconKey="review" /></bpmn:extensionElements>',
      );

    const v1 = await inspectBpmnXml(xml, coreBpmnProfile.id);
    expect(v1.issues.map((issue) => issue.ruleId)).toContain("BPMN-PROFILE-004");

    const v2 = await inspectBpmnXml(xml, coreBpmnVisualProfile.id);
    expect(v2.accepted).toBe(true);
    expect(v2.profileId).toBe(coreBpmnVisualProfile.id);
    expect(
      v2.snapshot?.elements.find((element) => element.id === "Task_Intake"),
    ).toMatchObject({ iconKey: "review" });
    expect(v2.canonicalXml).toContain('teb:nodeVisual iconKey="review"');
  });

  it.each([
    ['iconKey="https://example.com/icon.svg"', "BPMN-VISUAL-003"],
    ['iconKey="unknown"', "BPMN-VISUAL-005"],
    ['iconKey="review" onclick="alert(1)"', "BPMN-VISUAL-003"],
  ])("rejects unsafe node visual payload %s", async (attributes, ruleId) => {
    const xml = starterBpmnXml
      .replace(
        'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
        'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n  xmlns:teb="urn:the-experience-blogs:bpmn:extension:1"',
      )
      .replace(
        '<bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc">',
        `<bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc"><bpmn:extensionElements><teb:nodeVisual ${attributes} /></bpmn:extensionElements>`,
      );
    const result = await inspectBpmnXml(xml, coreBpmnVisualProfile.id);
    expect(result.accepted).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(ruleId);
  });

  it("rejects duplicate node visuals on one node", async () => {
    const xml = starterBpmnXml
      .replace(
        'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
        'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n  xmlns:teb="urn:the-experience-blogs:bpmn:extension:1"',
      )
      .replace(
        '<bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc">',
        '<bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc"><bpmn:extensionElements><teb:nodeVisual iconKey="review" /><teb:nodeVisual iconKey="approval" /></bpmn:extensionElements>',
      );
    const result = await inspectBpmnXml(xml, coreBpmnVisualProfile.id);
    expect(result.accepted).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-VISUAL-006",
    );
  });

  it.each([
    ["doctype", '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>', "BPMN-SEC-001"],
    ["xinclude", '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="https://example.com/x" />', "BPMN-SEC-001"],
    ["stylesheet", '<?xml-stylesheet href="https://example.com/x.xsl"?>', "BPMN-SEC-001"],
    [
      "external schema",
      starterBpmnXml.replace(
        "<bpmn:definitions",
        '<bpmn:definitions xsi:schemaLocation="https://example.com/schema.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      ),
      "BPMN-SEC-002",
    ],
    [
      "vendor namespace",
      starterBpmnXml.replace(
        "<bpmn:definitions",
        '<bpmn:definitions xmlns:vendor="https://vendor.example/bpmn"',
      ),
      "BPMN-PROFILE-004",
    ],
    ["malformed", "<bpmn:definitions>", "BPMN-XML-001"],
    [
      "unsupported",
      starterBpmnXml.replace(
        "</bpmn:process>",
        '<bpmn:serviceTask id="Service_Unsupported" /></bpmn:process>',
      ),
      "BPMN-PROFILE-003",
    ],
    [
      "duplicate ID",
      starterBpmnXml.replace(
        'id="Task_Revise"',
        'id="Task_Publish"',
      ),
      "BPMN-ID-001",
    ],
    [
      "missing DI",
      starterBpmnXml.replace(
        /<bpmndi:BPMNShape id="Shape_Revise"[\s\S]*?<\/bpmndi:BPMNShape>/,
        "",
      ),
      "BPMN-DI-001",
    ],
    [
      "non-finite DI",
      starterBpmnXml.replace('x="110" y="202"', 'x="1e309" y="202"'),
      "BPMN-DI-003",
    ],
    [
      "non-positive DI",
      starterBpmnXml.replace('width="36" height="36"', 'width="-36" height="0"'),
      "BPMN-DI-003",
    ],
    [
      "non-finite waypoint",
      starterBpmnXml.replace('x="146" y="220"', 'x="NaN" y="220"'),
      "BPMN-DI-004",
    ],
  ])("rejects %s without exposing raw XML", async (_name, xml, ruleId) => {
    const result = await inspectBpmnXml(xml);
    expect(result.accepted).toBe(false);
    expect(result.safeToPersist).toBe(false);
    expect(result.readyToSeal).toBe(false);
    expect(result.issues.map((item) => item.ruleId)).toContain(ruleId);
    expect(JSON.stringify(result.issues)).not.toContain("etc/passwd");
  });

  it("rejects size, depth and element-count complexity limits", async () => {
    const oversized = `${starterBpmnXml}${" ".repeat(1_048_577)}`;
    const tooDeep = starterBpmnXml.replace(
      "</bpmn:process>",
      `${"<x>".repeat(65)}${"</x>".repeat(65)}</bpmn:process>`,
    );
    const tooMany = starterBpmnXml.replace(
      "</bpmn:process>",
      `${"<x/>".repeat(10_001)}</bpmn:process>`,
    );

    await expect(inspectionRuleIds(oversized)).resolves.toContain(
      "BPMN-LIMIT-001",
    );
    await expect(inspectionRuleIds(tooDeep)).resolves.toContain(
      "BPMN-LIMIT-003",
    );
    await expect(inspectionRuleIds(tooMany)).resolves.toContain(
      "BPMN-LIMIT-002",
    );
  });

  it("produces a bounded safe export filename", () => {
    expect(safeBpmnFilename("Duyệt bài: As-Is / 2026")).toBe(
      "duyet-bai-as-is-2026.bpmn",
    );
    expect(safeBpmnFilename("💜")).toBe("so-do.bpmn");
  });
});

async function inspectionRuleIds(xml: string) {
  const result = await inspectBpmnXml(xml);
  return result.issues.map((item) => item.ruleId);
}

const incompleteCoreDraftXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_Draft" targetNamespace="https://the-experience.blog/bpmn">
  <bpmn:process id="Process_Draft" isExecutable="false">
    <bpmn:task id="Task_Draft" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Draft">
    <bpmndi:BPMNPlane id="Plane_Draft" bpmnElement="Process_Draft">
      <bpmndi:BPMNShape id="Shape_Draft" bpmnElement="Task_Draft">
        <dc:Bounds x="100" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
