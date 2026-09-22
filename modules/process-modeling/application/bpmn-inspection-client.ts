import type {
  BpmnInspectionResult,
  BpmnProfileId,
} from "../domain/core-profile";

export type BpmnInspectionClient = (
  xml: string,
  profileId?: BpmnProfileId,
  options?: { readonly fileImport: true; readonly inferProfile?: boolean },
) => Promise<BpmnInspectionResult & { readonly importNotices?: readonly string[] }>;
