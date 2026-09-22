import type { BpmnProfileId } from "../domain/core-profile";

export type SwimlaneOrientation = "horizontal" | "vertical";

export interface PreparedBpmnSwimlaneConversion {
  readonly xml: string;
  readonly targetProfileId: BpmnProfileId;
}

export type BpmnSwimlaneConversionPreparer = (
  acknowledgedCoreXml: string,
  orientation: SwimlaneOrientation,
  sourceProfileId?: BpmnProfileId,
) => Promise<PreparedBpmnSwimlaneConversion>;

export function isBpmnSwimlanePreparationError(
  value: unknown,
): value is Error & { readonly code: string } {
  return (
    value instanceof Error &&
    "code" in value &&
    typeof value.code === "string" &&
    value.code.length > 0
  );
}
