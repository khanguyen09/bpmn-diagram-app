import { describe, expect, it, vi } from "vitest";
import { coreBpmnProfile } from "../domain/core-profile";
import {
  preflightProcessModelVersionSeal,
} from "./model-lifecycle-service";
import type {
  ProcessModelDraftProjection,
  ProcessModelRepository,
} from "./ports/process-model-repository";

const draft: ProcessModelDraftProjection = {
  modelId: "model-1",
  revisionId: "revision-2",
  revisionNumber: 2,
  title: "Editorial review",
  description: "",
  purpose: "AS_IS",
  profileId: coreBpmnProfile.id,
  canonicalXml: "<canonical />",
  xmlChecksum: "a".repeat(64),
  updatedAt: new Date("2026-07-30T00:00:00.000Z"),
};

describe("process model version seal preflight", () => {
  it("rejects a recoverable exact revision with bounded rule IDs", async () => {
    const inspect = vi.fn().mockResolvedValue({
      accepted: true,
      safeToPersist: true,
      readyToSeal: false,
      profileId: coreBpmnProfile.id,
      issues: [
        {
          ruleId: "BPMN-CONNECT-001",
          severity: "error",
          disposition: "recoverable",
          message: "Incomplete.",
          recovery: "Complete the flow.",
        },
        {
          ruleId: "BPMN-CONNECT-001",
          severity: "error",
          disposition: "recoverable",
          message: "Duplicate.",
          recovery: "Complete the flow.",
        },
      ],
      outline: [],
      canonicalXml: "<canonical />",
    });

    await expect(preflightProcessModelVersionSeal(
      repositoryWithDraft(draft),
      inspect,
      {
        ownerId: "owner-1",
        modelId: draft.modelId,
        expectedRevisionToken: "bpmn-revision-2",
      },
    )).resolves.toEqual({
      kind: "not-ready",
      ruleIds: ["BPMN-CONNECT-001"],
    });
    expect(inspect).toHaveBeenCalledWith(
      draft.canonicalXml,
      coreBpmnProfile.id,
    );
    const input = { ownerId: "owner-1", modelId: draft.modelId, expectedRevisionToken: "bpmn-revision-2" };
    await expect(preflightProcessModelVersionSeal(repositoryWithDraft(draft), inspect, input, "illustration")).resolves.toEqual({ kind: "ready" });
    const inspection = await inspect();
    inspect.mockResolvedValue({ ...inspection, safeToPersist: false });
    await expect(preflightProcessModelVersionSeal(repositoryWithDraft(draft), inspect, input, "illustration")).resolves.toMatchObject({ kind: "not-ready" });
  });

  it("does not inspect a stale or unavailable revision", async () => {
    const inspect = vi.fn();
    await expect(preflightProcessModelVersionSeal(
      repositoryWithDraft(draft),
      inspect,
      {
        ownerId: "owner-1",
        modelId: draft.modelId,
        expectedRevisionToken: "bpmn-revision-1",
      },
    )).resolves.toEqual({
      kind: "conflict",
      currentRevisionToken: "bpmn-revision-2",
    });
    await expect(preflightProcessModelVersionSeal(
      repositoryWithDraft(null),
      inspect,
      {
        ownerId: "owner-1",
        modelId: "missing",
        expectedRevisionToken: "bpmn-revision-1",
      },
    )).resolves.toEqual({ kind: "not-found" });
    expect(inspect).not.toHaveBeenCalled();
  });
});

function repositoryWithDraft(
  value: ProcessModelDraftProjection | null,
): Pick<ProcessModelRepository, "getDraft"> {
  return { getDraft: vi.fn().mockResolvedValue(value) };
}
