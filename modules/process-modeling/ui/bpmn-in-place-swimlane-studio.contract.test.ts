import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./bpmn-studio.tsx", import.meta.url),
  "utf8",
);

function conversionBody() {
  const start = source.indexOf("const executeSwimlaneConversion = async");
  const end = source.indexOf("const cancelProfileUpgrade", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("BPMN in-place swimlane Studio orchestration", () => {
  it("keeps candidate work detached and imports only after a durable acknowledgement", () => {
    const body = conversionBody();
    const prepare = body.indexOf("await prepareSwimlaneConversion");
    const persist = body.indexOf("await persistence.convertCoreToCollaboration");
    const successGuard = body.indexOf(
      'result.kind !== "acknowledged" && result.kind !== "idempotent"',
    );
    const hydrate = body.indexOf("hydratingRef.current = true", successGuard);
    const liveImport = body.indexOf(
      "await modeler.importXML(result.canonicalXml)",
      hydrate,
    );

    expect(prepare).toBeGreaterThan(-1);
    expect(persist).toBeGreaterThan(prepare);
    expect(successGuard).toBeGreaterThan(persist);
    expect(hydrate).toBeGreaterThan(successGuard);
    expect(liveImport).toBeGreaterThan(hydrate);
    expect(body).not.toContain("persistence.createModel");
  });

  it("retains one conversion command for retries and suppresses import autosave", () => {
    const body = conversionBody();

    expect(body).toContain("swimlaneConversionCommandRef.current = command");
    expect(body).toContain("idempotencyKey: command.idempotencyKey");
    expect(body).toContain("sourceRevisionToken: durable.revisionToken");
    expect(body).toContain("if (autosaveTimerRef.current !== null)");
    expect(body).toContain("pendingSaveCommandRef.current = null");
    expect(body).toContain("hydratingRef.current = false");
  });

  it("routes Core bridge intents to conversion instead of the generic profile facade", () => {
    const conversionBranch = source.indexOf(
      'item.preparation.kind === "in-place-swimlane-conversion"',
    );
    const genericBranch = source.indexOf(
      'item.preparation.kind === "none"',
      conversionBranch,
    );

    expect(conversionBranch).toBeGreaterThan(-1);
    expect(genericBranch).toBeGreaterThan(conversionBranch);
    expect(
      source.slice(conversionBranch, genericBranch),
    ).toContain("setSwimlaneConversion");
  });
});
