import { buildCoreSwimlaneConversionCandidate } from "../../modules/process-modeling/infrastructure/bpmn-io/build-core-swimlane-conversion-candidate";
import { inspectCoreToCollaborationSwimlaneConversion } from "../../modules/process-modeling/domain/bpmn-family-conversion";
import type { CoreBpmnSnapshot } from "../../modules/process-modeling/domain/core-profile";
import type { CollaborationBpmnSnapshot } from "../../modules/process-modeling/domain/collaboration-profile";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectBpmnXml } from "../../modules/process-modeling/infrastructure/bpmn-io/inspect-bpmn-xml";
import { validateAgainstOfflineBpmnXsd } from "../support/independent-bpmn-conformance";

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
    const xsd = validateAgainstOfflineBpmnXsd(new TextEncoder().encode(first.canonicalXml!));
    expect(xsd.omgCoreXsdValid, JSON.stringify(xsd)).toBe(true);
    expect(first.snapshot?.elements.find((element) => element.id === "Deadline")).toMatchObject({ attachedToId: "SubProcess_Review", parentContainerId: "Process_Main" });
    expect((await inspectBpmnXml(first.canonicalXml!, profileId)).snapshot).toEqual(first.snapshot);
  });
  it("preserves an attached shared timer when converting Core to swimlanes", async () => {
    const sourceProfileId = "teb-core-subprocess-timers@1";
    const source = await inspectBpmnXml(withTimer(advancedXml), sourceProfileId);
    const prepared = await buildCoreSwimlaneConversionCandidate(source.canonicalXml!, "horizontal", sourceProfileId);
    expect(prepared.targetProfileId).toBe("teb-collaboration-subprocess-timers@1");
    const candidate = await inspectBpmnXml(prepared.xml, prepared.targetProfileId);
    expect(candidate.safeToPersist).toBe(true);
    expect(candidate.snapshot?.elements.find(element => element.id === "Deadline")).toMatchObject({ attachedToId: "SubProcess_Review", parentContainerId: "Process_Main", eventDefinition: { kind: "TIMER", expression: "PT10M" } });
    expect(inspectCoreToCollaborationSwimlaneConversion({
      sourceProfileId, targetProfileId: prepared.targetProfileId, orientation: "horizontal",
      sourceSnapshot: source.snapshot as CoreBpmnSnapshot,
      candidateSnapshot: candidate.snapshot as CollaborationBpmnSnapshot,
    }).accepted).toBe(true);
    expect((await inspectBpmnXml(candidate.canonicalXml!, prepared.targetProfileId)).snapshot).toEqual(candidate.snapshot);
  });

});
