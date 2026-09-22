import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coreActivityContainersBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreFullAuthoringBpmnProfile,
} from "../../domain/core-profile";
import {
  collaborationComplexRoutingBpmnProfile,
} from "../../domain/collaboration-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";

const advancedXml = readFileSync(
  resolve(
    process.cwd(),
    "tests/fixtures/bpmn-advanced-activities-data-complex.bpmn",
  ),
  "utf8",
);
const collaborationAdvancedXml = advancedXml
  .replace(
    '  <bpmn:process id="Process_Main"',
    `  <bpmn:collaboration id="Collaboration_Advanced">
    <bpmn:participant id="Participant_Main" name="Editorial" processRef="Process_Main" />
    <bpmn:participant id="Participant_External" name="External archive" />
    <bpmn:messageFlow id="MessageFlow_Archive" name="Archive notice" sourceRef="Call_Reused" targetRef="Participant_External" />
  </bpmn:collaboration>
  <bpmn:process id="Process_Main"`,
  )
  .replace('bpmnElement="Process_Main">', 'bpmnElement="Collaboration_Advanced">')
  .replace(
    '      <bpmndi:BPMNShape id="Shape_Start_Main"',
    '      <bpmndi:BPMNShape id="Shape_Participant_Main" bpmnElement="Participant_Main" isHorizontal="true"><dc:Bounds x="20" y="40" width="820" height="430" /></bpmndi:BPMNShape>\n' +
      '      <bpmndi:BPMNShape id="Shape_Participant_External" bpmnElement="Participant_External" isHorizontal="true"><dc:Bounds x="20" y="520" width="820" height="100" /></bpmndi:BPMNShape>\n' +
      '      <bpmndi:BPMNShape id="Shape_Start_Main"',
  )
  .replace(
    "    </bpmndi:BPMNPlane>",
    '      <bpmndi:BPMNEdge id="Edge_MessageFlow_Archive" bpmnElement="MessageFlow_Archive"><di:waypoint x="370" y="420" /><di:waypoint x="370" y="520" /></bpmndi:BPMNEdge>\n' +
      "    </bpmndi:BPMNPlane>",
  );

describe("Advanced activities, data and Complex routing XML contract", () => {
  const nativeInputXml = (xml: string) => xml
    .replace('<bpmn:dataInputAssociation id="DataInput_Draft">',
      '<bpmn:property id="Property_Input" name="__targetRef_placeholder" />\n<bpmn:dataInputAssociation id="DataInput_Draft">')
    .replace('</bpmn:dataInputAssociation>',
      '<bpmn:targetRef>Property_Input</bpmn:targetRef></bpmn:dataInputAssociation>');

  it.each([
    ["Core", advancedXml, coreComplexRoutingBpmnProfile.id],
    ["Collaboration", collaborationAdvancedXml, collaborationComplexRoutingBpmnProfile.id],
  ] as const)("round-trips native input target without adding a shape (%s)", async (_label, xml, profileId) => {
    const result = await inspectBpmnXml(nativeInputXml(xml), profileId);
    expect(result.safeToPersist).toBe(true);
    expect(result.canonicalXml).toContain('__targetRef_placeholder');
    expect(result.snapshot?.elements.some((element) => element.id === "Property_Input")).toBe(false);
    const second = await inspectBpmnXml(result.canonicalXml!, profileId);
    expect(second.safeToPersist).toBe(true);
    expect(second.canonicalXml).toBe(result.canonicalXml);
  });

  it.each([
    ["arbitrary name", (xml: string) => xml.replace('__targetRef_placeholder', 'Business variable')],
    ["orphan", (xml: string) => xml.replace('<bpmn:targetRef>Property_Input</bpmn:targetRef>', '')],
    ["id-less native name", (xml: string) => xml.replace('id="Property_Input" ', '').replace('<bpmn:targetRef>Property_Input</bpmn:targetRef>', '')],
    ["id-less arbitrary name", (xml: string) => xml.replace('id="Property_Input" ', '').replace('__targetRef_placeholder', 'Business variable').replace('<bpmn:targetRef>Property_Input</bpmn:targetRef>', '')],
    ["id-less metadata", (xml: string) => xml.replace('id="Property_Input" ', 'itemSubjectRef="Process_Main" ').replace('<bpmn:targetRef>Property_Input</bpmn:targetRef>', '')],
    ["execution metadata", (xml: string) => xml.replace('name="__targetRef_placeholder"', 'name="__targetRef_placeholder" itemSubjectRef="Process_Main"')],
    ["documentation", (xml: string) => xml.replace('name="__targetRef_placeholder" />', 'name="__targetRef_placeholder"><bpmn:documentation>custom</bpmn:documentation></bpmn:property>')],
    ["cross-owner reference", (xml: string) => xml.replace('<bpmn:task id="Task_Sub" name="Inspect">', '<bpmn:task id="Task_Sub" name="Inspect"><bpmn:dataInputAssociation id="Cross_Input"><bpmn:sourceRef>DataObjectRef_Draft</bpmn:sourceRef><bpmn:targetRef>Property_Input</bpmn:targetRef></bpmn:dataInputAssociation>')],
  ] as const)("rejects non-native input property: %s", async (_label, mutate) => {
    for (const [xml, profileId] of [
      [advancedXml, coreComplexRoutingBpmnProfile.id],
      [collaborationAdvancedXml, collaborationComplexRoutingBpmnProfile.id],
    ] as const) {
      const result = await inspectBpmnXml(mutate(nativeInputXml(xml)), profileId);
      expect(result.safeToPersist).toBe(false);
      expect(result.issues.map((issue) => issue.ruleId)).toContain("BPMN-PROFILE-003");
    }
  });
  it("round-trips exact hierarchy, references, direction, expression and DI", async () => {
    const first = await inspectBpmnXml(
      advancedXml,
      coreComplexRoutingBpmnProfile.id,
    );
    expect(first.issues).toEqual([]);
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: coreComplexRoutingBpmnProfile.id,
      dataStoreRegistry: [
        {
          dataStoreId: "DataStore_Archive",
          name: "Editorial archive",
          referenceIds: ["DataStoreRef_Archive"],
          referenceCount: 1,
          hasUnknownReferences: false,
        },
      ],
    });
    expect(first.snapshot?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "SubProcess_Review",
          parentContainerId: "Process_Main",
          triggeredByEvent: false,
        }),
        expect.objectContaining({
          id: "Task_Sub",
          parentContainerId: "SubProcess_Review",
        }),
        expect.objectContaining({
          id: "Call_Reused",
          calledElementId: "Process_Reused",
        }),
        expect.objectContaining({
          id: "DataObjectRef_Draft",
          dataObjectRefId: "DataObject_Draft",
        }),
        expect.objectContaining({
          id: "DataStoreRef_Archive",
          dataStoreRefId: "DataStore_Archive",
        }),
        expect.objectContaining({
          id: "DataInput_Draft",
          sourceId: "DataObjectRef_Draft",
          targetId: "Call_Reused",
          associationOwnerId: "Call_Reused",
        }),
        expect.objectContaining({
          id: "DataOutput_Archive",
          sourceId: "Call_Reused",
          targetId: "DataStoreRef_Archive",
          associationOwnerId: "Call_Reused",
        }),
        expect.objectContaining({
          id: "Gateway_Join",
          gatewayDirection: "Converging",
          activationCondition: "Both branches documented",
        }),
      ]),
    );
    expect(first.snapshot?.shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: "SubProcess_Review",
          isExpanded: true,
        }),
      ]),
    );
    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      coreComplexRoutingBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.dataStoreRegistry).toEqual(first.dataStoreRegistry);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it("projects the same advanced semantics inside one Collaboration white-box Pool", async () => {
    const first = await inspectBpmnXml(
      collaborationAdvancedXml,
      collaborationComplexRoutingBpmnProfile.id,
    );
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: collaborationComplexRoutingBpmnProfile.id,
    });
    expect(first.snapshot?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "SubProcess_Review",
          processId: "Process_Main",
          participantId: "Participant_Main",
          parentContainerId: "Process_Main",
        }),
        expect.objectContaining({
          id: "Task_Sub",
          parentContainerId: "SubProcess_Review",
        }),
        expect.objectContaining({
          id: "DataInput_Draft",
          associationOwnerId: "Call_Reused",
          participantId: "Participant_Main",
        }),
      ]),
    );
    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      collaborationComplexRoutingBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it.each([
    coreFullAuthoringBpmnProfile.id,
    coreActivityContainersBpmnProfile.id,
    coreDataAuthoringBpmnProfile.id,
  ])("keeps later semantics outside frozen profile %s", async (profileId) => {
    const result = await inspectBpmnXml(advancedXml, profileId);
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-PROFILE-003",
    );
  });

  it.each([
    [
      "nested SubProcess",
      advancedXml.replace(
        '<bpmn:task id="Task_Sub" name="Inspect">',
        '<bpmn:subProcess id="Nested_Sub" name="Nested" triggeredByEvent="false">',
      ).replace("</bpmn:task>", "</bpmn:subProcess>"),
      "BPMN-SUBPROCESS-001",
    ],
    [
      "external call target",
      advancedXml.replace(
        'calledElement="Process_Reused"',
        'calledElement="external:Process_Reused"',
      ),
      "BPMN-CALL-002",
    ],
    [
      "cross-scope data input",
      advancedXml.replace(
        "<bpmn:sourceRef>DataObjectRef_Draft</bpmn:sourceRef>",
        "<bpmn:sourceRef>DataObjectRef_Inner</bpmn:sourceRef>",
      ).replace(
        '<bpmn:startEvent id="Start_Sub">',
        '<bpmn:dataObject id="DataObject_Inner" isCollection="false" /><bpmn:dataObjectReference id="DataObjectRef_Inner" dataObjectRef="DataObject_Inner" /><bpmn:startEvent id="Start_Sub">',
      ),
      "BPMN-DATA-ASSOC-001",
    ],
    [
      "diverging Complex Gateway",
      advancedXml.replace(
        'gatewayDirection="Converging"',
        'gatewayDirection="Diverging"',
      ),
      "BPMN-COMPLEX-001",
    ],
    [
      "executable activation metadata",
      advancedXml.replace(
        '<bpmn:activationCondition xsi:type="bpmn:tFormalExpression">',
        '<bpmn:activationCondition xsi:type="bpmn:tFormalExpression" language="FEEL">',
      ),
      "BPMN-COMPLEX-005",
    ],
  ])("fail-closes malformed %s", async (_name, xml, ruleId) => {
    const result = await inspectBpmnXml(
      xml,
      coreComplexRoutingBpmnProfile.id,
    );
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(ruleId);
  });
});

describe("ordinary subprocess deadline import", () => {
  const withTimer = (xml: string) => xml
    .replace('<bpmn:dataInputAssociation id="DataInput_Draft">', '<bpmn:property id="TimerInput" name="__targetRef_placeholder" /><bpmn:dataInputAssociation id="DataInput_Draft">')
    .replace('</bpmn:dataInputAssociation>', '<bpmn:targetRef>TimerInput</bpmn:targetRef></bpmn:dataInputAssociation>')
    .replace('<bpmn:endEvent id="End_Main"', '<bpmn:boundaryEvent id="Deadline" attachedToRef="SubProcess_Review"><bpmn:outgoing>DeadlineFlow</bpmn:outgoing><bpmn:timerEventDefinition id="DeadlineDef"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT10M</bpmn:timeDuration></bpmn:timerEventDefinition></bpmn:boundaryEvent><bpmn:sequenceFlow id="DeadlineFlow" sourceRef="Deadline" targetRef="End_Main" /><bpmn:endEvent id="End_Main"')
    .replace('<bpmn:incoming>Flow_End</bpmn:incoming>', '<bpmn:incoming>Flow_End</bpmn:incoming><bpmn:incoming>DeadlineFlow</bpmn:incoming>')
    .replace('</bpmndi:BPMNPlane>', '<bpmndi:BPMNShape id="DeadlineShape" bpmnElement="Deadline"><dc:Bounds x="280" y="250" width="36" height="36" /></bpmndi:BPMNShape><bpmndi:BPMNEdge id="DeadlineEdge" bpmnElement="DeadlineFlow"><di:waypoint x="298" y="286" /><di:waypoint x="700" y="286" /></bpmndi:BPMNEdge></bpmndi:BPMNPlane>');
  it.each([
    [advancedXml, "teb-core-subprocess-timers@1"],
    [collaborationAdvancedXml, "teb-collaboration-subprocess-timers@1"],
  ] as const)("round-trips deadline and attachment in successor %#", async (xml, profileId) => {
    const first = await inspectBpmnXml(withTimer(xml), profileId);
    expect(first.issues.filter((issue) => issue.disposition === "fatal")).toEqual([]);
    expect(first.safeToPersist).toBe(true);
    expect(first.snapshot?.elements.find((element) => element.id === "Deadline")).toMatchObject({ attachedToId: "SubProcess_Review", parentContainerId: "Process_Main" });
    expect((await inspectBpmnXml(first.canonicalXml!, profileId)).snapshot).toEqual(first.snapshot);
  });
});
