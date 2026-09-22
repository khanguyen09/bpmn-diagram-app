import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collaborationBpmnProfile,
  collaborationNestedBpmnProfile,
} from "../../domain/collaboration-profile";
import {
  coreBpmnProfile,
  coreBpmnVisualProfile,
  coreStructuredBpmnProfile,
} from "../../domain/core-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";

const parallelRoutingXml = readFileSync(
  resolve(process.cwd(), "tests/fixtures/structured-parallel-routing.bpmn"),
  "utf8",
);

describe("Structured Routing BPMN XML boundary", () => {
  it.each([
    coreBpmnProfile.id,
    coreBpmnVisualProfile.id,
    collaborationBpmnProfile.id,
    collaborationNestedBpmnProfile.id,
  ])("keeps Parallel Gateway outside frozen profile %s", async (profileId) => {
    const result = await inspectBpmnXml(parallelRoutingXml, profileId);

    expect(result).toMatchObject({
      accepted: false,
      safeToPersist: false,
      readyToSeal: false,
      profileId,
    });
    expect(result.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-PROFILE-003",
    );
  });

  it("canonically round-trips a complete Parallel split and join", async () => {
    const first = await inspectBpmnXml(
      parallelRoutingXml,
      coreStructuredBpmnProfile.id,
    );

    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
      profileId: coreStructuredBpmnProfile.id,
    });
    expect(
      first.snapshot?.elements.filter(
        (element) => element.type === "bpmn:ParallelGateway",
      ),
    ).toEqual([
      expect.objectContaining({
        id: "Gateway_Parallel_Split",
        incoming: ["Flow_Start_Split"],
        outgoing: ["Flow_Split_Copy", "Flow_Split_Legal"],
      }),
      expect.objectContaining({
        id: "Gateway_Parallel_Join",
        incoming: ["Flow_Copy_Join", "Flow_Legal_Join"],
        outgoing: ["Flow_Join_End"],
      }),
    ]);
    expect(first.snapshot?.shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: "Gateway_Parallel_Split",
          width: 50,
          height: 50,
        }),
        expect.objectContaining({
          elementId: "Gateway_Parallel_Join",
          width: 50,
          height: 50,
        }),
      ]),
    );
    expect(
      first.snapshot?.edges.find(
        (edge) => edge.elementId === "Flow_Split_Legal",
      )?.waypoints,
    ).toHaveLength(3);

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      coreStructuredBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it("persists one-in/one-out Parallel gateways as recoverable only", async () => {
    const incomplete = parallelRoutingXml
      .replace(
        "      <bpmn:outgoing>Flow_Split_Legal</bpmn:outgoing>\n",
        "",
      )
      .replace(
        /    <bpmn:task id="Task_Legal"[\s\S]*?    <\/bpmn:task>\n/,
        "",
      )
      .replace(
        "      <bpmn:incoming>Flow_Legal_Join</bpmn:incoming>\n",
        "",
      )
      .replace(
        /    <bpmn:sequenceFlow id="Flow_Split_Legal"[^>]*\/>\n/,
        "",
      )
      .replace(
        /    <bpmn:sequenceFlow id="Flow_Legal_Join"[^>]*\/>\n/,
        "",
      )
      .replace(
        /      <bpmndi:BPMNShape id="Shape_Task_Legal"[\s\S]*?      <\/bpmndi:BPMNShape>\n/,
        "",
      )
      .replace(
        /      <bpmndi:BPMNEdge id="Edge_Split_Legal"[\s\S]*?      <\/bpmndi:BPMNEdge>\n/,
        "",
      )
      .replace(
        /      <bpmndi:BPMNEdge id="Edge_Legal_Join"[\s\S]*?      <\/bpmndi:BPMNEdge>\n/,
        "",
      );

    const result = await inspectBpmnXml(
      incomplete,
      coreStructuredBpmnProfile.id,
    );

    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: false,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: expect.stringMatching(/^BPMN-PAR-/),
          disposition: "recoverable",
        }),
      ]),
    );
  });

  it("rejects a mixed many-in/many-out Parallel gateway", async () => {
    const mixed = parallelRoutingXml
      .replace(
        "      <bpmn:incoming>Flow_Start_Split</bpmn:incoming>",
        "      <bpmn:incoming>Flow_Start_Split</bpmn:incoming>\n" +
          "      <bpmn:incoming>Flow_Copy_Split_Mixed</bpmn:incoming>",
      )
      .replace(
        "      <bpmn:outgoing>Flow_Copy_Join</bpmn:outgoing>",
        "      <bpmn:outgoing>Flow_Copy_Join</bpmn:outgoing>\n" +
          "      <bpmn:outgoing>Flow_Copy_Split_Mixed</bpmn:outgoing>",
      )
      .replace(
        '    <bpmn:sequenceFlow id="Flow_Join_End"',
        '    <bpmn:sequenceFlow id="Flow_Copy_Split_Mixed" sourceRef="Task_Copy" targetRef="Gateway_Parallel_Split" />\n' +
          '    <bpmn:sequenceFlow id="Flow_Join_End"',
      )
      .replace(
        '      <bpmndi:BPMNEdge id="Edge_Join_End"',
        '      <bpmndi:BPMNEdge id="Edge_Copy_Split_Mixed" bpmnElement="Flow_Copy_Split_Mixed">\n' +
          '        <di:waypoint x="370" y="120" />\n' +
          '        <di:waypoint x="370" y="80" />\n' +
          '        <di:waypoint x="215" y="80" />\n' +
          '        <di:waypoint x="215" y="215" />\n' +
          "      </bpmndi:BPMNEdge>\n" +
          '      <bpmndi:BPMNEdge id="Edge_Join_End"',
      );

    const result = await inspectBpmnXml(
      mixed,
      coreStructuredBpmnProfile.id,
    );

    expect(result).toMatchObject({
      accepted: false,
      safeToPersist: false,
      readyToSeal: false,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: expect.stringMatching(/^BPMN-PAR-/),
          disposition: "fatal",
          elementId: "Gateway_Parallel_Split",
        }),
      ]),
    );
  });
});
