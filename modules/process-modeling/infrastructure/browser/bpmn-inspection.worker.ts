import { inspectBpmnXml, inspectBpmnFileImport } from "../bpmn-io/inspect-bpmn-xml";
import type { BpmnProfileId } from "../../domain/core-profile";

interface InspectionWorkerScope {
  onmessage: ((event: MessageEvent<{
    readonly xml: string;
    readonly profileId?: BpmnProfileId;
    readonly options?: { readonly fileImport: true; readonly inferProfile?: boolean };
  }>) => void) | null;
  postMessage(message: unknown): void;
}

const workerScope = self as unknown as InspectionWorkerScope;

workerScope.onmessage = async (event) => {
  const result = event.data.options?.fileImport
    ? await inspectBpmnFileImport(event.data.xml, event.data.profileId, event.data.options.inferProfile)
    : await inspectBpmnXml(event.data.xml, event.data.profileId);
  workerScope.postMessage(result);
};

export {};
