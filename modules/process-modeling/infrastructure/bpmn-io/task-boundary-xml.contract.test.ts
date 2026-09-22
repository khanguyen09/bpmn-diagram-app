import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coreBoundaryEventsBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreTaskTypesBpmnProfile,
} from "../../domain/core-profile";
import {
  collaborationBoundaryEventsBpmnProfile,
} from "../../domain/collaboration-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";

const advancedXml = readFileSync(
  resolve(
    process.cwd(),
    "tests/fixtures/task-intermediate-boundary-events.bpmn",
  ),
  "utf8",
);
const eventRoutingXml = readFileSync(
  resolve(process.cwd(), "tests/fixtures/event-routing.bpmn"),
  "utf8",
);

describe("Task, Intermediate and Boundary XML contract", () => {
  it("round-trips exact attachment, behavior, definitions, registry and DI", async () => {
    const first = await inspectBpmnXml(
      advancedXml,
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: coreBoundaryEventsBpmnProfile.id,
      messageRegistry: [
        {
          id: "Message_Shared",
          referenceCount: 2,
          hasUnknownReferences: false,
        },
        {
          id: "Message_Cancel",
          referenceCount: 2,
          hasUnknownReferences: false,
        },
      ],
    });
    expect(first.snapshot?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "User_Review", type: "bpmn:UserTask" }),
        expect.objectContaining({
          id: "Service_Check",
          type: "bpmn:ServiceTask",
        }),
        expect.objectContaining({
          id: "Manual_File",
          type: "bpmn:ManualTask",
        }),
        expect.objectContaining({
          id: "Throw_Message",
          type: "bpmn:IntermediateThrowEvent",
          eventDefinition: {
            id: "MessageDefinition_Throw",
            kind: "MESSAGE",
            messageRefId: "Message_Shared",
          },
        }),
        expect.objectContaining({
          id: "Boundary_Timer",
          attachedToId: "User_Review",
          cancelActivity: false,
          eventDefinition: expect.objectContaining({
            kind: "TIMER",
            expression: "PT30M",
          }),
        }),
        expect.objectContaining({
          id: "Boundary_Message",
          attachedToId: "Service_Check",
          cancelActivity: true,
          eventDefinition: expect.objectContaining({
            kind: "MESSAGE",
            messageRefId: "Message_Cancel",
          }),
        }),
      ]),
    );
    expect(
      first.snapshot?.elements.some((element) =>
        element.type.endsWith("EventDefinition"),
      ),
    ).toBe(false);
    expect(
      first.outline.some(
        (element) =>
          element.type === "bpmn:Message" ||
          element.type.endsWith("EventDefinition"),
      ),
    ).toBe(false);
    expect(
      first.issues.some((issue) => issue.ruleId === "BPMN-CONNECT-003"),
    ).toBe(false);
    expect(first.snapshot?.shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: "Boundary_Timer",
          width: 36,
          height: 36,
        }),
      ]),
    );

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.messageRegistry).toEqual(first.messageRegistry);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it.each([
    coreEventRoutingBpmnProfile.id,
    coreTaskTypesBpmnProfile.id,
    coreIntermediateEventsBpmnProfile.id,
  ])("keeps later semantic types outside frozen profile %s", async (profileId) => {
    const result = await inspectBpmnXml(advancedXml, profileId);
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-PROFILE-003",
    );
  });

  it("accepts specialized Tasks at the Task Types gate", async () => {
    const taskXml = eventRoutingXml
      .replace(
        "<bpmn:outgoing>Flow_Start_Gateway</bpmn:outgoing>",
        "<bpmn:outgoing>Flow_Start_User</bpmn:outgoing>",
      )
      .replace(
        '    <bpmn:eventBasedGateway id="Gateway_Event"',
        '    <bpmn:userTask id="User_1" name="Review"><bpmn:incoming>Flow_Start_User</bpmn:incoming><bpmn:outgoing>Flow_User_Service</bpmn:outgoing></bpmn:userTask>\n' +
          '    <bpmn:serviceTask id="Service_1" name="Check"><bpmn:incoming>Flow_User_Service</bpmn:incoming><bpmn:outgoing>Flow_Service_Manual</bpmn:outgoing></bpmn:serviceTask>\n' +
          '    <bpmn:manualTask id="Manual_1" name="File"><bpmn:incoming>Flow_Service_Manual</bpmn:incoming><bpmn:outgoing>Flow_Start_Gateway</bpmn:outgoing></bpmn:manualTask>\n' +
          '    <bpmn:eventBasedGateway id="Gateway_Event"',
      )
      .replace(
        '    <bpmn:sequenceFlow id="Flow_Start_Gateway" sourceRef="Start_1"',
        '    <bpmn:sequenceFlow id="Flow_Start_User" sourceRef="Start_1" targetRef="User_1" />\n' +
          '    <bpmn:sequenceFlow id="Flow_User_Service" sourceRef="User_1" targetRef="Service_1" />\n' +
          '    <bpmn:sequenceFlow id="Flow_Service_Manual" sourceRef="Service_1" targetRef="Manual_1" />\n' +
          '    <bpmn:sequenceFlow id="Flow_Start_Gateway" sourceRef="Manual_1"',
      )
      .replace(
        '      <bpmndi:BPMNShape id="Shape_Gateway"',
        '      <bpmndi:BPMNShape id="Shape_User_1" bpmnElement="User_1"><dc:Bounds x="120" y="440" width="100" height="80" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Service_1" bpmnElement="Service_1"><dc:Bounds x="260" y="440" width="100" height="80" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Manual_1" bpmnElement="Manual_1"><dc:Bounds x="400" y="440" width="100" height="80" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Gateway"',
      )
      .replace(
        '      <bpmndi:BPMNEdge id="Edge_Start_Gateway"',
        '      <bpmndi:BPMNEdge id="Edge_Start_User" bpmnElement="Flow_Start_User"><di:waypoint x="98" y="268" /><di:waypoint x="170" y="440" /></bpmndi:BPMNEdge>\n' +
          '      <bpmndi:BPMNEdge id="Edge_User_Service" bpmnElement="Flow_User_Service"><di:waypoint x="220" y="480" /><di:waypoint x="260" y="480" /></bpmndi:BPMNEdge>\n' +
          '      <bpmndi:BPMNEdge id="Edge_Service_Manual" bpmnElement="Flow_Service_Manual"><di:waypoint x="360" y="480" /><di:waypoint x="400" y="480" /></bpmndi:BPMNEdge>\n' +
          '      <bpmndi:BPMNEdge id="Edge_Start_Gateway"',
      );
    const result = await inspectBpmnXml(
      taskXml,
      coreTaskTypesBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
  });

  it("projects the same attachment and owners for Collaboration", async () => {
    const collaborationXml = advancedXml
      .replace(
        '  <bpmn:process id="Process_AdvancedEvents"',
        '  <bpmn:collaboration id="Collaboration_AdvancedEvents">\n' +
          '    <bpmn:participant id="Participant_Whitebox" name="Operations" processRef="Process_AdvancedEvents" />\n' +
          '    <bpmn:participant id="Participant_Blackbox" name="Customer" />\n' +
          '    <bpmn:messageFlow id="MessageFlow_Status" name="Status update" sourceRef="Throw_Message" targetRef="Participant_Blackbox" />\n' +
          "  </bpmn:collaboration>\n" +
          '  <bpmn:process id="Process_AdvancedEvents"',
      )
      .replace(
        'bpmnElement="Process_AdvancedEvents">',
        'bpmnElement="Collaboration_AdvancedEvents">',
      )
      .replace(
        '      <bpmndi:BPMNShape id="Shape_Start"',
        '      <bpmndi:BPMNShape id="Shape_Whitebox" bpmnElement="Participant_Whitebox" isHorizontal="true"><dc:Bounds x="20" y="50" width="920" height="400" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Blackbox" bpmnElement="Participant_Blackbox" isHorizontal="true"><dc:Bounds x="20" y="500" width="920" height="100" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Start"',
      )
      .replace(
        "    </bpmndi:BPMNPlane>",
        '      <bpmndi:BPMNEdge id="Edge_MessageFlow_Status" bpmnElement="MessageFlow_Status"><di:waypoint x="548" y="278" /><di:waypoint x="548" y="500" /></bpmndi:BPMNEdge>\n' +
          "    </bpmndi:BPMNPlane>",
      );
    const result = await inspectBpmnXml(
      collaborationXml,
      collaborationBoundaryEventsBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
    expect(
      result.snapshot?.elements.find(
        (element) => element.id === "Boundary_Message",
      ),
    ).toEqual(
      expect.objectContaining({
        processId: "Process_AdvancedEvents",
        participantId: "Participant_Whitebox",
        attachedToId: "Service_Check",
        cancelActivity: true,
      }),
    );
  });

  it("persists an explicit orphan as recoverable but blocks seal", async () => {
    const xml = advancedXml.replace(
      '  <bpmn:message id="Message_Shared"',
      '  <bpmn:message id="Message_Orphan" name="Unused registry entry" />\n' +
        '  <bpmn:message id="Message_Shared"',
    );
    const result = await inspectBpmnXml(
      xml,
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: false,
    });
    expect(result.messageRegistry?.[0]).toMatchObject({
      id: "Message_Orphan",
      referenceCount: 0,
      hasUnknownReferences: false,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-MSG-005",
          elementId: "Message_Orphan",
          disposition: "recoverable",
        }),
      ]),
    );
  });

  it("accepts a None Intermediate Throw with zero event definitions", async () => {
    const xml = advancedXml.replace(
      '      <bpmn:messageEventDefinition id="MessageDefinition_Throw" messageRef="Message_Shared" />\n',
      "",
    );
    const result = await inspectBpmnXml(
      xml,
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
    expect(
      result.snapshot?.elements.find(
        (element) => element.id === "Throw_Message",
      ),
    ).toEqual(
      expect.not.objectContaining({ eventDefinition: expect.anything() }),
    );
  });

  it("marks unsupported inbound refs unknown so cleanup cannot delete", async () => {
    const xml = advancedXml.replace(
      "</bpmn:process>",
      "</bpmn:process>\n" +
        '<bpmn:collaboration id="Collab_Hidden"><bpmn:participant id="P1" processRef="Process_AdvancedEvents" /><bpmn:participant id="P2" /><bpmn:messageFlow id="MF_Hidden" sourceRef="P1" targetRef="P2" messageRef="Message_Shared" /></bpmn:collaboration>',
    );
    const result = await inspectBpmnXml(
      xml,
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(result.safeToPersist).toBe(false);
    expect(
      result.messageRegistry?.find((entry) => entry.id === "Message_Shared"),
    ).toMatchObject({
      referenceCount: 3,
      hasUnknownReferences: true,
    });
    expect(result.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-MSG-008",
    );
  });

  it.each([
    [
      "task execution metadata",
      advancedXml.replace(
        'id="Service_Check" name="System checks"',
        'id="Service_Check" name="System checks" implementation="worker"',
      ),
      "BPMN-TASK-002",
    ],
    [
      "cross-process or dangling boundary host",
      advancedXml.replace(
        'attachedToRef="User_Review"',
        'attachedToRef="Missing_Task"',
      ),
      "BPMN-XML-002",
    ],
    [
      "unsupported Timer Throw",
      advancedXml
        .replace(
          '<bpmn:messageEventDefinition id="MessageDefinition_Throw" messageRef="Message_Shared" />',
          '<bpmn:timerEventDefinition id="MessageDefinition_Throw"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT1M</bpmn:timeDuration></bpmn:timerEventDefinition>',
        ),
      "BPMN-THROW-001",
    ],
  ])("fail-closes %s", async (_name, xml, ruleId) => {
    const result = await inspectBpmnXml(
      xml,
      coreBoundaryEventsBpmnProfile.id,
    );
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(ruleId);
  });
});
