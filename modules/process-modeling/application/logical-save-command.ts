import type { BpmnProfileId } from "../domain/core-profile";

export interface LogicalProcessModelSaveCommand {
  readonly sequence: number;
  readonly idempotencyKey: string;
  readonly revisionToken: string;
  readonly title: string;
  readonly description: string;
  readonly purpose: "AS_IS" | "TO_BE" | "REFERENCE";
  readonly profileId: BpmnProfileId;
  readonly xml: string;
  readonly source: "EDITED" | "IMPORTED";
}

export function retainOrCaptureLogicalSave(
  pending: LogicalProcessModelSaveCommand | null,
  capture: () => LogicalProcessModelSaveCommand,
) {
  return pending ?? capture();
}
