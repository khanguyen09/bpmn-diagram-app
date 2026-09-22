import { BpmnModdle } from "bpmn-moddle";
import type {
  BPMNEdge,
  BPMNPlane,
  BPMNShape,
  Definitions,
  Process,
} from "bpmn-moddle";
import { describe, expect, it } from "vitest";
import { inspectBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/inspect-bpmn-xml";
import {
  bpmnPerformanceFixtures,
  buildBpmnPerformanceFixture,
} from "./performance-fixtures";

describe("BPMN performance fixtures", () => {
  it("generates deterministic Small Medium and Large BPMN fixtures", async () => {
    expect(
      bpmnPerformanceFixtures.map((fixture) => ({
        size: fixture.size,
        nodes: fixture.nodeCount,
        connectors: fixture.connectorCount,
      })),
    ).toEqual([
      { size: "Small", nodes: 50, connectors: 75 },
      { size: "Medium", nodes: 200, connectors: 300 },
      { size: "Large", nodes: 500, connectors: 700 },
    ]);

    for (const fixture of bpmnPerformanceFixtures) {
      const rebuilt = buildBpmnPerformanceFixture(fixture.size);
      expect(rebuilt.xml).toBe(fixture.xml);
      expect(rebuilt.sha256).toBe(fixture.sha256);
      expect(fixture.sha256).toMatch(/^[a-f0-9]{64}$/u);

      const moddle = new BpmnModdle();
      const parsed = await moddle.fromXML(fixture.xml);
      const definitions = parsed.rootElement as Definitions;
      const process = definitions.rootElements.find(
        (element): element is Process => element.$type === "bpmn:Process",
      );
      expect(process?.id).toBe(fixture.processId);
      const flowElements = process?.flowElements ?? [];
      expect(
        flowElements.filter((element) =>
          ["bpmn:StartEvent", "bpmn:Task", "bpmn:EndEvent"].includes(
            element.$type,
          ),
        ),
      ).toHaveLength(fixture.nodeCount);
      expect(
        flowElements.filter((element) => element.$type === "bpmn:SequenceFlow"),
      ).toHaveLength(fixture.connectorCount);
      const inspection = await inspectBpmnXml(fixture.xml, fixture.profileId);
      expect(inspection.safeToPersist, JSON.stringify(inspection.issues)).toBe(true);

      const plane = definitions.diagrams[0]?.plane as BPMNPlane | undefined;
      const planeElements = plane?.planeElement ?? [];
      expect(
        planeElements.filter(
          (element): element is BPMNShape =>
            element.$type === "bpmndi:BPMNShape",
        ),
      ).toHaveLength(fixture.nodeCount);
      expect(
        planeElements.filter(
          (element): element is BPMNEdge =>
            element.$type === "bpmndi:BPMNEdge",
        ),
      ).toHaveLength(fixture.connectorCount);
    }
  });

  it("uses bounded inert XML without executable or foreign content", () => {
    for (const fixture of bpmnPerformanceFixtures) {
      expect(fixture.xml).not.toMatch(
        /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:javascript|data):/iu,
      );
      expect(fixture.xml).toContain('isExecutable="false"');
      expect(fixture.xml).toContain(
        'targetNamespace="https://the-experience.blog/bpmn/performance"',
      );
    }
  });
});
