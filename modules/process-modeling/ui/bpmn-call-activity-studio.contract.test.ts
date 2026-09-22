import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const studioSource = readFileSync(
  join(process.cwd(), "modules/process-modeling/ui/bpmn-studio.tsx"),
  "utf8",
);

describe("Call Activity starter aggregate", () => {
  it("creates a reusable root process before the Call Activity in one command", () => {
    const starterBlock = studioSource.slice(
      studioSource.indexOf(
        'commandStack.register("teb.advanced.createCallActivityStarter"',
      ),
      studioSource.indexOf(
        'commandStack.register("teb.advanced.configureComplexJoin"',
      ),
    );

    expect(studioSource).toContain(
      'commandStack.register("teb.advanced.createCallActivityStarter"',
    );
    expect(studioSource).toContain(
      'const bpmnFactory = getService(modeler!, "bpmnFactory")',
    );
    expect(studioSource).toContain('bpmnFactory.create("bpmn:Process"');
    expect(studioSource).toContain("isExecutable: false");
    expect(studioSource).toContain("rootElements: [");
    expect(studioSource).toContain('type: "bpmn:CallActivity"');
    expect(studioSource).toContain(
      'businessObject: bpmnFactory.create("bpmn:CallActivity"',
    );
    expect(studioSource).toContain("calledElement: calledProcess.id");
    expect(studioSource).not.toContain("Process_Reused_");
    expect(studioSource).toContain(
      '"teb.advanced.createCallActivityStarter",\n        context,',
    );
    expect(studioSource).toContain("context.created = modeling.createShape(");
    expect(starterBlock).not.toContain("moddle.create");
    expect(starterBlock).not.toMatch(/\bid\s*:/u);
  });

  it("keeps the aggregate on click and keyboard placement without drag", () => {
    expect(studioSource).toContain('if (recipe.kind === "call-activity")');
    expect(studioSource).toContain(
      "Có thể hoàn tác cả hai trong một lần.",
    );
  });

  it("preserves the schema-required input-association target placeholder", () => {
    const associationBlock = studioSource.slice(
      studioSource.indexOf(
        'commandStack.register("teb.advanced.createDataAssociation"',
      ),
      studioSource.indexOf(
        'commandStack.register("teb.advanced.createDataArtifact"',
      ),
    );

    expect(associationBlock).toContain('"bpmn:DataInputAssociation"');
    expect(associationBlock).not.toContain("__targetRef_placeholder");
    expect(associationBlock).not.toMatch(/targetRef\s*:\s*undefined/u);
  });
});
