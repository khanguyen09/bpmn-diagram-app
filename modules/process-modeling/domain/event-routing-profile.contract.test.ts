import { describe, expect, it } from "vitest";
import {
  canTransitionBpmnProfile,
  coreCatchingEventsBpmnProfile,
  coreConditionalBpmnProfile,
  coreEventRoutingBpmnProfile,
  isBpmnProfileId,
  supportsCatchingEvents,
  supportsConditionalRouting,
  supportsEventRouting,
  supportsStructuredRouting,
} from "./core-profile";
import {
  collaborationCatchingEventsBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationEventRoutingBpmnProfile,
} from "./collaboration-profile";
import {
  inspectEventRouting,
  validTimerDate,
  validTimerDuration,
} from "./event-routing";
import type { CoreBpmnElement } from "./core-profile";

describe("Catching Events and Event Routing profiles", () => {
  it("registers immutable profile gates and inherited capabilities", () => {
    expect(isBpmnProfileId(coreCatchingEventsBpmnProfile.id)).toBe(true);
    expect(isBpmnProfileId(coreEventRoutingBpmnProfile.id)).toBe(true);
    expect(
      isBpmnProfileId(collaborationCatchingEventsBpmnProfile.id),
    ).toBe(true);
    expect(isBpmnProfileId(collaborationEventRoutingBpmnProfile.id)).toBe(
      true,
    );
    expect(supportsCatchingEvents(coreCatchingEventsBpmnProfile.id)).toBe(true);
    expect(supportsCatchingEvents(coreEventRoutingBpmnProfile.id)).toBe(true);
    expect(supportsEventRouting(coreCatchingEventsBpmnProfile.id)).toBe(false);
    expect(supportsEventRouting(coreEventRoutingBpmnProfile.id)).toBe(true);
    expect(supportsConditionalRouting(coreEventRoutingBpmnProfile.id)).toBe(
      true,
    );
    expect(supportsStructuredRouting(coreEventRoutingBpmnProfile.id)).toBe(
      true,
    );
  });

  it("allows only adjacent same-family transitions", () => {
    expect(
      canTransitionBpmnProfile(
        coreConditionalBpmnProfile.id,
        coreCatchingEventsBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        coreCatchingEventsBpmnProfile.id,
        coreEventRoutingBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationConditionalBpmnProfile.id,
        collaborationCatchingEventsBpmnProfile.id,
      ),
    ).toBe(true);
    expect(
      canTransitionBpmnProfile(
        collaborationCatchingEventsBpmnProfile.id,
        collaborationEventRoutingBpmnProfile.id,
      ),
    ).toBe(true);
    for (const [from, to] of [
      [coreConditionalBpmnProfile.id, coreEventRoutingBpmnProfile.id],
      [coreEventRoutingBpmnProfile.id, coreCatchingEventsBpmnProfile.id],
      [
        collaborationConditionalBpmnProfile.id,
        collaborationEventRoutingBpmnProfile.id,
      ],
      [
        coreCatchingEventsBpmnProfile.id,
        collaborationEventRoutingBpmnProfile.id,
      ],
    ] as const) {
      expect(canTransitionBpmnProfile(from, to)).toBe(false);
    }
  });

  it.each([
    ["2028-02-29T23:59:59Z", true],
    ["2028-02-29T23:59+07:00", true],
    ["2027-02-29T10:00:00Z", false],
    ["2028-02-30T10:00:00Z", false],
    ["2028-01-01T24:00:00Z", false],
    ["2028-01-01T10:00:00+14:01", false],
    ["2028-01-01T10:00:00", false],
  ])("validates real RFC3339 timer date %s", (value, expected) => {
    expect(validTimerDate(value)).toBe(expected);
  });

  it.each([
    ["PT1S", true],
    ["PT15M", true],
    ["P365D", true],
    ["PT8760H", true],
    ["PT0S", false],
    ["P0D", false],
    ["P365DT1S", false],
    ["PT8761H", false],
    ["P", false],
    ["P1Y", false],
  ])("bounds timer duration %s to 1s..365d", (value, expected) => {
    expect(validTimerDuration(value)).toBe(expected);
  });

  it("fail-closes cross-process and duplicate-target event branches", () => {
    const elements: CoreBpmnElement[] = [
      {
        id: "Message_1",
        type: "bpmn:Message",
        name: "Reply",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Gateway_1",
        type: "bpmn:EventBasedGateway",
        processId: "Process_A",
        eventGatewayType: "Exclusive",
        instantiate: false,
        incoming: ["Flow_In"],
        outgoing: ["Flow_A", "Flow_B"],
      },
      {
        id: "Catch_1",
        type: "bpmn:IntermediateCatchEvent",
        processId: "Process_B",
        eventDefinition: {
          id: "Definition_1",
          kind: "MESSAGE",
          messageRefId: "Message_1",
        },
        incoming: ["Flow_A", "Flow_B"],
        outgoing: ["Flow_Out"],
      },
      {
        id: "Flow_A",
        type: "bpmn:SequenceFlow",
        sourceId: "Gateway_1",
        targetId: "Catch_1",
        incoming: [],
        outgoing: [],
      },
      {
        id: "Flow_B",
        type: "bpmn:SequenceFlow",
        sourceId: "Gateway_1",
        targetId: "Catch_1",
        incoming: [],
        outgoing: [],
      },
    ];

    expect(inspectEventRouting(elements, true, true)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-EVG-001",
          disposition: "fatal",
        }),
      ]),
    );
  });

  it("warns when otherwise-valid branches wait for the same trigger", () => {
    const message: CoreBpmnElement = {
      id: "Message_1",
      type: "bpmn:Message",
      name: "Reply",
      incoming: [],
      outgoing: [],
    };
    const gateway: CoreBpmnElement = {
      id: "Gateway_1",
      type: "bpmn:EventBasedGateway",
      processId: "Process_A",
      eventGatewayType: "Exclusive",
      instantiate: false,
      incoming: ["Flow_In"],
      outgoing: ["Flow_A", "Flow_B"],
    };
    const catches = ["A", "B"].map((suffix): CoreBpmnElement => ({
      id: `Catch_${suffix}`,
      type: "bpmn:IntermediateCatchEvent",
      processId: "Process_A",
      eventDefinition: {
        id: `Definition_${suffix}`,
        kind: "MESSAGE",
        messageRefId: message.id,
      },
      incoming: [`Flow_${suffix}`],
      outgoing: [`Flow_${suffix}_Out`],
    }));
    const flows = ["A", "B"].map((suffix): CoreBpmnElement => ({
      id: `Flow_${suffix}`,
      type: "bpmn:SequenceFlow",
      sourceId: gateway.id,
      targetId: `Catch_${suffix}`,
      incoming: [],
      outgoing: [],
    }));

    expect(
      inspectEventRouting([message, gateway, ...catches, ...flows], true, true),
    ).toEqual([
      expect.objectContaining({
        ruleId: "BPMN-EVG-002",
        disposition: "recoverable",
        elementId: "Catch_B",
      }),
    ]);
  });
});
