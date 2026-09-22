"use client";

import { tebModdleDescriptor } from "../../application/teb-moddle-contract";
import { bpmnTextRendererConfig, prepareBpmnFont } from "./bpmn-typography";

export async function preflightBpmnRender(xml: string) {
  const { default: BpmnModeler } = await import("bpmn-js/lib/Modeler");
  await prepareBpmnFont();
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-10000px;top:-10000px;width:800px;height:600px;visibility:hidden";
  document.body.appendChild(container);
  const modeler = new BpmnModeler({
    container,
    textRenderer: bpmnTextRendererConfig(),
    moddleExtensions: { teb: tebModdleDescriptor },
  });

  try {
    await modeler.importXML(xml);
  } finally {
    modeler.destroy();
    container.remove();
  }
}
