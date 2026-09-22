"use client";

import type {
  BpmnInspectionResult,
  BpmnProfileId,
} from "../../domain/core-profile";

export function inspectBpmnXmlInWorker(
  xml: string,
  profileOrTimeout?: BpmnProfileId | number,
  timeoutOverride?: number | { readonly fileImport: true; readonly inferProfile?: boolean },
): Promise<BpmnInspectionResult> {
  const profileId =
    typeof profileOrTimeout === "string" ? profileOrTimeout : undefined;
  const timeoutMs =
    typeof profileOrTimeout === "number"
      ? profileOrTimeout
      : (typeof timeoutOverride === "number" ? timeoutOverride : 2_000);
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./bpmn-inspection.worker.ts", import.meta.url),
      { type: "module", name: "bpmn-import-inspection" },
    );
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("BPMN inspection timed out."));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<BpmnInspectionResult>) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error("BPMN inspection worker failed."));
    };
    worker.postMessage({ xml, profileId, ...(typeof timeoutOverride === "object" ? { options: timeoutOverride } : {}) });
  });
}
