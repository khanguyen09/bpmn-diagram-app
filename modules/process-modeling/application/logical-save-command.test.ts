import { describe, expect, it, vi } from "vitest";
import {
  retainOrCaptureLogicalSave,
  type LogicalProcessModelSaveCommand,
} from "./logical-save-command";

describe("logical process model save command", () => {
  it("captures the immutable Conditional and Event Routing discriminators", () => {
    for (const profileId of [
      "teb-core-conditional@1",
      "teb-core-catching-events@1",
      "teb-core-event-routing@1",
      "teb-core-task-types@1",
      "teb-core-intermediate-events@1",
      "teb-core-boundary-events@1",
      "teb-collaboration-conditional@1",
      "teb-collaboration-catching-events@1",
      "teb-collaboration-event-routing@1",
      "teb-collaboration-task-types@1",
      "teb-collaboration-intermediate-events@1",
      "teb-collaboration-boundary-events@1",
    ] as const) {
      const command = {
        sequence: 1,
        idempotencyKey: `conditional:${profileId}`,
        revisionToken: "revision-1",
        title: "Conditional",
        description: "",
        purpose: "TO_BE",
        profileId,
        xml: "<definitions />",
        source: "EDITED",
      } satisfies LogicalProcessModelSaveCommand;
      expect(retainOrCaptureLogicalSave(null, () => command)).toBe(command);
    }
  });
  it("retains key, base token and captured payload until the ambiguous command resolves", () => {
    const pending = {
      sequence: 4,
      idempotencyKey: "save-model:stable",
      revisionToken: "bpmn-revision-3",
      title: "Captured title",
      description: "",
      purpose: "AS_IS" as const,
      profileId: "teb-core-starter@1" as const,
      xml: "<captured />",
      source: "IMPORTED" as const,
    };
    const captureNewerEdit = vi.fn(() => ({
      ...pending,
      sequence: 5,
      idempotencyKey: "save-model:new",
      title: "Newer local edit",
    }));

    expect(retainOrCaptureLogicalSave(pending, captureNewerEdit)).toBe(pending);
    expect(captureNewerEdit).not.toHaveBeenCalled();
  });
});
