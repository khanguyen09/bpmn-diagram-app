import { describe, expect, it } from "vitest";
import {
  planLowerBpmnParticipantReflow,
  resolveBpmnParticipantAtPoint,
  type BpmnParticipantFrame,
} from "./bpmn-swimlane-placement";

const whiteBox: BpmnParticipantFrame = {
  id: "Participant_Editorial",
  x: 80,
  y: 80,
  width: 900,
  height: 300,
  whiteBox: true,
};

describe("BPMN swimlane point placement", () => {
  it("resolves exactly one containing white-box Participant", () => {
    expect(
      resolveBpmnParticipantAtPoint({ x: 300, y: 180 }, [whiteBox]),
    ).toEqual({
      kind: "resolved",
      participantId: whiteBox.id,
    });
  });

  it("rejects outside, black-box, shared-border and invalid points", () => {
    const blackBox = {
      ...whiteBox,
      id: "Participant_Audience",
      y: 470,
      height: 100,
      whiteBox: false,
    };
    const adjacent = {
      ...whiteBox,
      id: "Participant_Adjacent",
      x: whiteBox.x + whiteBox.width,
    };

    expect(
      resolveBpmnParticipantAtPoint({ x: 40, y: 40 }, [whiteBox, blackBox]),
    ).toEqual({ kind: "rejected", reason: "OUTSIDE_PARTICIPANT" });
    expect(
      resolveBpmnParticipantAtPoint({ x: 300, y: 500 }, [whiteBox, blackBox]),
    ).toEqual({ kind: "rejected", reason: "BLACK_BOX" });
    expect(
      resolveBpmnParticipantAtPoint(
        { x: whiteBox.x + whiteBox.width, y: 180 },
        [whiteBox, adjacent],
      ),
    ).toEqual({ kind: "rejected", reason: "AMBIGUOUS" });
    expect(
      resolveBpmnParticipantAtPoint({ x: Number.NaN, y: 180 }, [whiteBox]),
    ).toEqual({ kind: "rejected", reason: "OUTSIDE_PARTICIPANT" });
  });
});

describe("BPMN lower-Participant reflow", () => {
  it("moves lower Pools in stable y/x/id order", () => {
    const participants: readonly BpmnParticipantFrame[] = [
      { ...whiteBox, height: 460 },
      {
        id: "Participant_Lower_B",
        x: 80,
        y: 470,
        width: 900,
        height: 100,
        whiteBox: false,
      },
      {
        id: "Participant_Lower_A",
        x: 80,
        y: 470,
        width: 900,
        height: 120,
        whiteBox: true,
      },
    ];

    expect(
      planLowerBpmnParticipantReflow(
        participants,
        "Participant_Editorial",
      ),
    ).toEqual([
      {
        participantId: "Participant_Lower_A",
        delta: { x: 0, y: 150 },
      },
      {
        participantId: "Participant_Lower_B",
        delta: { x: 0, y: 350 },
      },
    ]);
  });

  it("leaves Pools above the anchor and already-spaced lower Pools unchanged", () => {
    expect(
      planLowerBpmnParticipantReflow(
        [
          whiteBox,
          {
            id: "Participant_Far_Below",
            x: 80,
            y: 520,
            width: 900,
            height: 100,
            whiteBox: false,
          },
          {
            id: "Participant_Above",
            x: 80,
            y: -240,
            width: 300,
            height: 200,
            whiteBox: true,
          },
        ],
        whiteBox.id,
      ),
    ).toEqual([]);
  });

  it("leaves an independent lower column unchanged", () => {
    expect(
      planLowerBpmnParticipantReflow(
        [
          { ...whiteBox, height: 460 },
          {
            id: "Participant_Independent_Column",
            x: whiteBox.x + whiteBox.width + 120,
            y: 470,
            width: 500,
            height: 180,
            whiteBox: true,
          },
        ],
        whiteBox.id,
      ),
    ).toEqual([]);
  });

  it("fails closed for unknown anchors, invalid geometry and invalid gaps", () => {
    expect(planLowerBpmnParticipantReflow([whiteBox], "missing")).toEqual([]);
    expect(
      planLowerBpmnParticipantReflow(
        [{ ...whiteBox, width: Number.NaN }],
        whiteBox.id,
      ),
    ).toEqual([]);
    expect(
      planLowerBpmnParticipantReflow([whiteBox], whiteBox.id, -1),
    ).toEqual([]);
  });
});
