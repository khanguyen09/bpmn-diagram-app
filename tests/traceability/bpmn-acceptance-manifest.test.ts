import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bpmnAcceptanceManifest,
  bpmnExternalEvidence,
  inheritedBpmnCompletionIds,
  sdd56AcceptanceIds,
} from "./bpmn-acceptance-manifest";

const repositoryRoot = process.cwd();

describe("BPMN acceptance manifest", () => {
  it("maps every SDD56 and inherited completion gate exactly once", () => {
    const ids = bpmnAcceptanceManifest.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    const current = bpmnAcceptanceManifest
      .filter((entry) => entry.source === "SDD56")
      .map((entry) => entry.id);
    expect(current).toEqual(sdd56AcceptanceIds);

    const inherited = bpmnAcceptanceManifest
      .filter((entry) => entry.inherited)
      .map((entry) => entry.id);
    expect(inherited).toEqual(inheritedBpmnCompletionIds);
  });

  it("keeps every automated evidence reference resolvable", () => {
    for (const entry of bpmnAcceptanceManifest) {
      expect(entry.summary.trim().length).toBeGreaterThan(0);
      expect(
        entry.automatedEvidence.length + entry.externalEvidence.length,
        `${entry.id} must map to at least one evidence boundary`,
      ).toBeGreaterThan(0);

      for (const evidence of entry.automatedEvidence) {
        expect(evidence.file).not.toMatch(/^\//u);
        expect(evidence.file).not.toContain("..");
        const absolutePath = resolve(repositoryRoot, evidence.file);
        expect(
          existsSync(absolutePath),
          `${entry.id} references missing evidence file ${evidence.file}`,
        ).toBe(true);
        if (evidence.availability === "implemented") {
          expect(evidence.testTitle?.trim().length ?? 0).toBeGreaterThan(0);
          const content = readFileSync(absolutePath, "utf8");
          const title = evidence.testTitle!;
          const orientationTitle = title.match(/^converts the same Core model to a (horizontal|vertical) Collaboration swimlane$/u);
          if (orientationTitle) {
            expect(content).toContain('["horizontal", "vertical"] as const');
            expect(content).toContain('test(`converts the same Core model to a ${orientation} Collaboration swimlane`');
          } else {
            expect(content).toContain(title);
          }
        }
      }
    }
  });

  it("contains no planned automation for the completed SDD56 gates", () => {
    const currentEvidence = bpmnAcceptanceManifest
      .filter((entry) => entry.source === "SDD56")
      .flatMap((entry) => entry.automatedEvidence);
    expect(currentEvidence).not.toContainEqual(
      expect.objectContaining({ availability: "planned" }),
    );
  });

  it("preserves actual zoom live AT and human sessions as separate NOT_RUN gates", () => {
    expect(bpmnExternalEvidence.map((entry) => entry.id)).toEqual([
      "actual-browser-zoom-200",
      "live-assistive-technology",
      "representative-authors-6-8",
    ]);
    for (const evidence of bpmnExternalEvidence) {
      expect(evidence.status).toBe("NOT_RUN");
      expect(evidence.completedSessions).toBe(0);
      expect(evidence.requiredSessions.trim().length).toBeGreaterThan(0);
    }

    const humanStatus = bpmnExternalEvidence.find(
      (entry) => entry.id === "representative-authors-6-8",
    );
    expect(humanStatus?.requiredSessions).toContain("6-8");
    expect(humanStatus?.recordPath).toBe(
      "tests/benchmarks/bpmn-component-launcher/STATUS.md",
    );
    expect(
      readFileSync(resolve(repositoryRoot, humanStatus!.recordPath!), "utf8"),
    ).toContain("NOT_RUN");
  });
});
