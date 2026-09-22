"use client";

import { coreBpmnProfile, type BpmnProfileId } from "../../domain/core-profile";
import { inspectBpmnXml } from "../bpmn-io/inspect-bpmn-xml";
import { bpmnTextRendererConfig, prepareBpmnFont } from "./bpmn-typography";
import {
  buildCoreSwimlaneConversionCandidate,
  CoreSwimlaneConversionError,
  type PreparedCoreSwimlaneConversion,
  type SwimlaneOrientation,
} from "../bpmn-io/build-core-swimlane-conversion-candidate";

export {
  CoreSwimlaneConversionError,
  type CoreSwimlaneConversionErrorCode,
  type PreparedCoreSwimlaneConversion,
  type SwimlaneOrientation,
} from "../bpmn-io/build-core-swimlane-conversion-candidate";

async function roundTripWithDetachedModeler(candidateXml: string): Promise<string> {
  if (
    typeof document === "undefined" ||
    !document.body ||
    typeof document.createElement !== "function"
  ) {
    throw new CoreSwimlaneConversionError(
      "DETACHED_MODELER_UNAVAILABLE",
      "A browser document is required to prepare the swimlane candidate.",
    );
  }

  let BpmnModeler: typeof import("bpmn-js/lib/Modeler").default;
  try {
    ({ default: BpmnModeler } = await import("bpmn-js/lib/Modeler"));
  } catch {
    throw new CoreSwimlaneConversionError(
      "DETACHED_MODELER_UNAVAILABLE",
      "The detached BPMN modeler could not be loaded.",
    );
  }

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText =
    "position:fixed;left:-10000px;top:-10000px;width:1200px;height:800px;visibility:hidden;pointer-events:none";
  document.body.appendChild(container);

  let modeler: InstanceType<typeof BpmnModeler> | undefined;
  try {
    await prepareBpmnFont();
    modeler = new BpmnModeler({
      container,
      textRenderer: bpmnTextRendererConfig(),
      moddleExtensions: {
        teb: (await import("../../application/teb-moddle-contract"))
          .tebModdleDescriptor,
      },
    });
    const imported = await modeler.importXML(candidateXml);
    if (imported.warnings.length > 0) {
      throw new CoreSwimlaneConversionError(
        "CANDIDATE_REJECTED",
        "The detached BPMN modeler reported candidate import warnings.",
      );
    }
    const saved = await modeler.saveXML({ format: true });
    if (!saved.xml?.trim()) {
      throw new CoreSwimlaneConversionError(
        "CANDIDATE_REJECTED",
        "The detached BPMN modeler returned an empty candidate.",
      );
    }
    return saved.xml;
  } catch (error) {
    if (error instanceof CoreSwimlaneConversionError) throw error;
    throw new CoreSwimlaneConversionError(
      "CANDIDATE_REJECTED",
      "The detached BPMN modeler rejected the swimlane candidate.",
    );
  } finally {
    try {
      modeler?.destroy();
    } finally {
      container.remove();
    }
  }
}

export async function prepareCoreSwimlaneConversion(
  acknowledgedCoreXml: string,
  orientation: SwimlaneOrientation,
  sourceProfileId: BpmnProfileId = coreBpmnProfile.id,
): Promise<PreparedCoreSwimlaneConversion> {
  const candidate = await buildCoreSwimlaneConversionCandidate(
    acknowledgedCoreXml,
    orientation,
    sourceProfileId,
  );
  const xml = await roundTripWithDetachedModeler(candidate.xml);
  const inspection = await inspectBpmnXml(xml, candidate.targetProfileId);
  if (!inspection.accepted || !inspection.safeToPersist) {
    throw new CoreSwimlaneConversionError(
      "CANDIDATE_REJECTED",
      "The detached swimlane candidate did not pass the target profile inspection.",
    );
  }
  return { xml, targetProfileId: candidate.targetProfileId };
}
