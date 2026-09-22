"use client";

import { inspectBpmnXmlInWorker } from "./infrastructure/browser/inspect-in-worker";
import { preflightBpmnRender } from "./infrastructure/browser/preflight-bpmn-render";
import { prepareCoreSwimlaneConversion } from "./infrastructure/browser/prepare-core-swimlane-conversion";
import { starterBpmnXml } from "./infrastructure/bpmn-io/starter-model";
import { collaborationStarterBpmnXml } from "./infrastructure/bpmn-io/collaboration-starter-model";
import { httpProcessModelPersistence } from "./infrastructure/browser/http-process-model-persistence";
import { browserBpmnDiagramExport } from "./infrastructure/browser/export-bpmn-diagram";
import { BpmnModelLibrary } from "./ui/bpmn-model-library";
import { BpmnStudio } from "./ui/bpmn-studio";
import { browserBpmnTypography } from "./infrastructure/browser/bpmn-typography";

export function BpmnModelLibraryExperience({
  initialCreateIntent = null,
}: {
  readonly initialCreateIntent?: "swimlane" | null;
} = {}) {
  return (
    <BpmnModelLibrary
      persistence={httpProcessModelPersistence}
      starterXml={starterBpmnXml}
      collaborationStarterXml={collaborationStarterBpmnXml}
      initialCreateIntent={initialCreateIntent}
    />
  );
}

export function BpmnStudioExperience({ modelId }: { readonly modelId: string }) {
  return (
    <BpmnStudio
      modelId={modelId}
      initialXml={starterBpmnXml}
      inspectXml={inspectBpmnXmlInWorker}
      preflightXml={preflightBpmnRender}
      prepareSwimlaneConversion={prepareCoreSwimlaneConversion}
      persistence={httpProcessModelPersistence}
      diagramExport={browserBpmnDiagramExport}
      typography={browserBpmnTypography}
    />
  );
}
