import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collaborationConditionalBpmnProfile,
  collaborationStructuredBpmnProfile,
} from "../../domain/collaboration-profile";
import {
  coreBpmnProfile,
  coreConditionalBpmnProfile,
  coreStructuredBpmnProfile,
} from "../../domain/core-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";
import { starterBpmnXml } from "./starter-model";
import { collaborationStarterBpmnXml } from "./collaboration-starter-model";

const parallelRoutingXml = readFileSync(
  resolve(process.cwd(), "tests/fixtures/structured-parallel-routing.bpmn"),
  "utf8",
);

const xorConditionalXml = starterBpmnXml
  .replace(
    '<bpmn:exclusiveGateway id="Gateway_Ready" name="Đủ điều kiện?">',
    '<bpmn:exclusiveGateway id="Gateway_Ready" name="Đủ điều kiện?" default="Flow_Revise">',
  )
  .replace(
    '<bpmn:sequenceFlow id="Flow_Ready_Publish" name="Có" sourceRef="Gateway_Ready" targetRef="Task_Publish" />',
    '<bpmn:sequenceFlow id="Flow_Ready_Publish" name="Có" sourceRef="Gateway_Ready" targetRef="Task_Publish"><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">score &gt;= 80</bpmn:conditionExpression></bpmn:sequenceFlow>',
  );

const inclusiveRoutingXml = parallelRoutingXml
  .replaceAll("parallelGateway", "inclusiveGateway")
  .replace(
    '<bpmn:inclusiveGateway id="Gateway_Parallel_Split" name="Review in parallel">',
    '<bpmn:inclusiveGateway id="Gateway_Parallel_Split" name="Review one or more" default="Flow_Split_Legal">',
  )
  .replace(
    '<bpmn:sequenceFlow id="Flow_Split_Copy" sourceRef="Gateway_Parallel_Split" targetRef="Task_Copy" />',
    '<bpmn:sequenceFlow id="Flow_Split_Copy" sourceRef="Gateway_Parallel_Split" targetRef="Task_Copy"><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">needs copy review</bpmn:conditionExpression></bpmn:sequenceFlow>',
  );

const collaborationConditionalXml = collaborationStarterBpmnXml
  .replace(
    '<bpmn:task id="Task_Write" name="Refine story">',
    '<bpmn:inclusiveGateway id="Task_Write" name="Choose review" default="Flow_Write_End">',
  )
  .replace("</bpmn:task>\n    <bpmn:task id=\"Task_Publish\"", "</bpmn:inclusiveGateway>\n    <bpmn:task id=\"Task_Publish\"")
  .replace(
    "      <bpmn:outgoing>Flow_Write_Publish</bpmn:outgoing>",
    "      <bpmn:outgoing>Flow_Write_Publish</bpmn:outgoing>\n      <bpmn:outgoing>Flow_Write_End</bpmn:outgoing>",
  )
  .replace(
    "      <bpmn:incoming>Flow_Publish_End</bpmn:incoming>",
    "      <bpmn:incoming>Flow_Publish_End</bpmn:incoming>\n      <bpmn:incoming>Flow_Write_End</bpmn:incoming>",
  )
  .replace(
    '<bpmn:sequenceFlow id="Flow_Write_Publish" sourceRef="Task_Write" targetRef="Task_Publish" />',
    '<bpmn:sequenceFlow id="Flow_Write_Publish" sourceRef="Task_Write" targetRef="Task_Publish"><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">editor approves</bpmn:conditionExpression></bpmn:sequenceFlow>\n    <bpmn:sequenceFlow id="Flow_Write_End" sourceRef="Task_Write" targetRef="End_Published" />',
  )
  .replace(
    '      <bpmndi:BPMNEdge id="Edge_Publish_End"',
    '      <bpmndi:BPMNEdge id="Edge_Write_End" bpmnElement="Flow_Write_End"><di:waypoint x="390" y="155" /><di:waypoint x="778" y="155" /><di:waypoint x="778" y="287" /></bpmndi:BPMNEdge>\n      <bpmndi:BPMNEdge id="Edge_Publish_End"',
  );

describe("Conditional Routing BPMN XML boundary", () => {
  it("keeps conditional metadata outside frozen and Structured profiles", async () => {
    for (const profileId of [
      coreBpmnProfile.id,
      coreStructuredBpmnProfile.id,
    ]) {
      const result = await inspectBpmnXml(xorConditionalXml, profileId);
      expect(result.safeToPersist).toBe(false);
      expect(result.issues.map((issue) => issue.ruleId)).toContain(
        "BPMN-PROFILE-005",
      );
    }
    const inclusive = await inspectBpmnXml(
      inclusiveRoutingXml,
      coreStructuredBpmnProfile.id,
    );
    expect(inclusive.safeToPersist).toBe(false);
    expect(inclusive.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-PROFILE-003",
    );
  });

  it("round-trips XOR condition/default and exact finite DI", async () => {
    const first = await inspectBpmnXml(
      xorConditionalXml,
      coreConditionalBpmnProfile.id,
    );
    expect(first).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
    expect(
      first.snapshot?.elements.find(
        (element) => element.id === "Gateway_Ready",
      ),
    ).toMatchObject({ defaultFlowId: "Flow_Revise" });
    expect(
      first.snapshot?.elements.find(
        (element) => element.id === "Flow_Ready_Publish",
      ),
    ).toMatchObject({ conditionExpression: "score >= 80" });
    expect(
      first.snapshot?.edges.find(
        (edge) => edge.elementId === "Flow_Ready_Publish",
      )?.waypoints,
    ).toHaveLength(3);

    const second = await inspectBpmnXml(
      first.canonicalXml ?? "",
      coreConditionalBpmnProfile.id,
    );
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.canonicalXml).toBe(first.canonicalXml);
  });

  it("accepts structural Inclusive split/join without matched-token claims", async () => {
    const result = await inspectBpmnXml(
      inclusiveRoutingXml,
      coreConditionalBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
    expect(
      result.snapshot?.elements.filter(
        (element) => element.type === "bpmn:InclusiveGateway",
      ),
    ).toEqual([
      expect.objectContaining({
        id: "Gateway_Parallel_Split",
        defaultFlowId: "Flow_Split_Legal",
      }),
      expect.objectContaining({
        id: "Gateway_Parallel_Join",
        incoming: ["Flow_Copy_Join", "Flow_Legal_Join"],
        outgoing: ["Flow_Join_End"],
      }),
    ]);
  });

  it("persists incomplete XOR as not-ready but rejects an invalid default reference", async () => {
    const incomplete = await inspectBpmnXml(
      xorConditionalXml.replace(' default="Flow_Revise"', ""),
      coreConditionalBpmnProfile.id,
    );
    expect(incomplete).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: false,
    });
    expect(incomplete.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-XOR-001",
          disposition: "recoverable",
          elementId: "Gateway_Ready",
        }),
      ]),
    );

    const dangling = await inspectBpmnXml(
      xorConditionalXml.replace(
        'default="Flow_Revise"',
        'default="Flow_Start_Intake"',
      ),
      coreConditionalBpmnProfile.id,
    );
    expect(dangling.safeToPersist).toBe(false);
    expect(dangling.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "BPMN-DEFAULT-001",
          disposition: "fatal",
          elementId: "Gateway_Ready",
        }),
      ]),
    );
  });

  it("projects the same conditional contract inside Collaboration ownership", async () => {
    const frozen = await inspectBpmnXml(
      collaborationConditionalXml,
      collaborationStructuredBpmnProfile.id,
    );
    expect(frozen.safeToPersist).toBe(false);

    const result = await inspectBpmnXml(
      collaborationConditionalXml,
      collaborationConditionalBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: true,
      safeToPersist: true,
      readyToSeal: true,
    });
    expect(
      result.snapshot?.elements.find((element) => element.id === "Task_Write"),
    ).toMatchObject({
      type: "bpmn:InclusiveGateway",
      defaultFlowId: "Flow_Write_End",
      participantId: "Participant_Editorial",
    });
    expect(
      result.snapshot?.elements.find(
        (element) => element.id === "Flow_Write_Publish",
      ),
    ).toMatchObject({
      conditionExpression: "editor approves",
      processId: "Process_Editorial",
    });
  });

  it.each([
    [
      "language attribute",
      xorConditionalXml.replace(
        'xsi:type="bpmn:tFormalExpression"',
        'xsi:type="bpmn:tFormalExpression" language="javascript"',
      ),
    ],
    [
      "over 500 characters",
      xorConditionalXml.replace(
        "score &gt;= 80",
        "x".repeat(501),
      ),
    ],
  ])("rejects non-inert FormalExpression contract: %s", async (_name, xml) => {
    const result = await inspectBpmnXml(
      xml,
      coreConditionalBpmnProfile.id,
    );
    expect(result).toMatchObject({
      accepted: false,
      safeToPersist: false,
      readyToSeal: false,
    });
    expect(result.issues.map((issue) => issue.ruleId)).toContain(
      "BPMN-COND-002",
    );
  });
});
