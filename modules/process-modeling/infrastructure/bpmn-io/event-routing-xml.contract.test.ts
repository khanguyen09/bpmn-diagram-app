import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coreCatchingEventsBpmnProfile,
  coreConditionalBpmnProfile,
  coreEventRoutingBpmnProfile,
} from "../../domain/core-profile";
import {
  collaborationEventRoutingBpmnProfile,
} from "../../domain/collaboration-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";

const eventRoutingXml = readFileSync(
  resolve(process.cwd(), "tests/fixtures/event-routing.bpmn"),
  "utf8",
);

describe("Event Routing BPMN XML boundary", () => {
  it("canonically projects nested definitions without graph-node duplication", async () => {
    const first = await inspectBpmnXml(
      eventRoutingXml,
      coreEventRoutingBpmnProfile.id,
    );

    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: coreEventRoutingBpmnProfile.id,
    });
    expect(first.snapshot?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "Catch_Message",
          eventDefinition: {
            id: "MessageEventDefinition_Approved",
            kind: "MESSAGE",
            messageRefId: "Message_Approved",
          },
        }),
        expect.objectContaining({
          id: "Catch_Timer",
          eventDefinition: {
            id: "TimerEventDefinition_Timeout",
            kind: "TIMER",
            timerKind: "DURATION",
            expression: "PT15M",
          },
        }),
        expect.objectContaining({
          id: "Receive_Cancel",
          messageRefId: "Message_Cancelled",
          instantiate: false,
        }),
        expect.objectContaining({
          id: "Gateway_Event",
          eventGatewayType: "Exclusive",
          instantiate: false,
        }),
        expect.objectContaining({
          id: "Message_Approved",
          type: "bpmn:Message",
          name: "Approval received",
        }),
      ]),
    );
    expect(
      first.snapshot?.elements.some((element) =>
        element.type.endsWith("EventDefinition")
      ),
    ).toBe(false);

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      coreEventRoutingBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it("keeps Event-Based Gateway outside Catching and all event metadata outside Conditional", async () => {
    const catching = await inspectBpmnXml(
      eventRoutingXml,
      coreCatchingEventsBpmnProfile.id,
    );
    expect(catching.safeToPersist).toBe(false);
    expect(catching.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-PROFILE-003",
          elementId: "Gateway_Event",
        }),
        expect.objectContaining({
          ruleId: "BPMN-PROFILE-006",
          elementId: "Gateway_Event",
        }),
      ]),
    );

    const conditional = await inspectBpmnXml(
      eventRoutingXml,
      coreConditionalBpmnProfile.id,
    );
    expect(conditional.safeToPersist).toBe(false);
    expect(conditional.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-PROFILE-006",
    );
  });

  it.each([
    [
      "event definition",
      eventRoutingXml.replace(
        '      <bpmn:messageEventDefinition id="MessageEventDefinition_Approved" messageRef="Message_Approved" />\n',
        "",
      ),
      "BPMN-EVT-001",
    ],
    [
      "message reference",
      eventRoutingXml.replace(' messageRef="Message_Approved"', ""),
      "BPMN-MSG-004",
    ],
  ])("persists incomplete %s but blocks seal", async (_name, xml, ruleId) => {
    const result = await inspectBpmnXml(
      xml,
      coreEventRoutingBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: false,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId,
          disposition: "recoverable",
        }),
      ]),
    );
  });

  it("projects the same event contract for Collaboration profiles", async () => {
    const collaborationXml = eventRoutingXml
      .replace(
        '  <bpmn:process id="Process_EventRouting"',
        '  <bpmn:collaboration id="Collaboration_EventRouting">\n' +
          '    <bpmn:participant id="Participant_Whitebox" name="Operations" processRef="Process_EventRouting" />\n' +
          '    <bpmn:participant id="Participant_Blackbox" name="External customer" />\n' +
          '    <bpmn:messageFlow id="MessageFlow_Cancel" name="Cancellation notice" sourceRef="Receive_Cancel" targetRef="Participant_Blackbox" />\n' +
          "  </bpmn:collaboration>\n" +
          '  <bpmn:process id="Process_EventRouting"',
      )
      .replace(
        'bpmnElement="Process_EventRouting">',
        'bpmnElement="Collaboration_EventRouting">',
      )
      .replace(
        '      <bpmndi:BPMNShape id="Shape_Start"',
        '      <bpmndi:BPMNShape id="Shape_Whitebox" bpmnElement="Participant_Whitebox" isHorizontal="true"><dc:Bounds x="40" y="50" width="560" height="430" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Blackbox" bpmnElement="Participant_Blackbox" isHorizontal="true"><dc:Bounds x="40" y="520" width="560" height="100" /></bpmndi:BPMNShape>\n' +
          '      <bpmndi:BPMNShape id="Shape_Start"',
      )
      .replace(
        "    </bpmndi:BPMNPlane>",
        '      <bpmndi:BPMNEdge id="Edge_MessageFlow_Cancel" bpmnElement="MessageFlow_Cancel"><di:waypoint x="330" y="430" /><di:waypoint x="330" y="520" /></bpmndi:BPMNEdge>\n' +
          "    </bpmndi:BPMNPlane>",
      );

    const result = await inspectBpmnXml(
      collaborationXml,
      collaborationEventRoutingBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
    expect(
      result.snapshot?.elements.find((element) => element.id === "Catch_Timer"),
    ).toEqual(
      expect.objectContaining({
        processId: "Process_EventRouting",
        participantId: "Participant_Whitebox",
        eventDefinition: expect.objectContaining({
          kind: "TIMER",
          expression: "PT15M",
        }),
      }),
    );
  });

  it.each([
    [
      "dangling messageRef",
      eventRoutingXml.replace(
        'messageRef="Message_Approved"',
        'messageRef="Message_Unknown"',
      ),
      "BPMN-MSG-004",
    ],
    [
      "timeCycle",
      eventRoutingXml
        .replace("bpmn:timeDuration", "bpmn:timeCycle")
        .replace("/bpmn:timeDuration", "/bpmn:timeCycle"),
      "BPMN-TIMER-001",
    ],
    [
      "definition without ID",
      eventRoutingXml.replace(
        ' id="MessageEventDefinition_Approved"',
        "",
      ),
      "BPMN-EVT-001",
    ],
    [
      "zero duration",
      eventRoutingXml.replace(">PT15M<", ">PT0S<"),
      "BPMN-TIMER-001",
    ],
    [
      "instantiating receive",
      eventRoutingXml.replace(
        'id="Receive_Cancel" name="Cancellation" messageRef="Message_Cancelled" instantiate="false"',
        'id="Receive_Cancel" name="Cancellation" messageRef="Message_Cancelled" instantiate="true"',
      ),
      "BPMN-RECEIVE-001",
    ],
    [
      "non-exclusive gateway",
      eventRoutingXml.replace(
        'eventGatewayType="Exclusive"',
        'eventGatewayType="Parallel"',
      ),
      "BPMN-EVG-001",
    ],
  ])("fail-closes %s", async (_name, xml, ruleId) => {
    const result = await inspectBpmnXml(
      xml,
      coreEventRoutingBpmnProfile.id,
    );
    expect(result.safeToPersist).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain(ruleId);
  });
});
