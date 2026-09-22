import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { BpmnModdle } from "bpmn-moddle";
import { describe, expect, it } from "vitest";
import {
  auditOfflineBpmnSchemaBundle,
  auditIndependentParserSupplyChain,
  hasPinnedPackageIntegrity,
  loadPreservationManifest,
  parseIndependently,
  projectionSha256,
  projectVendorExtensions,
  validateAgainstOfflineBpmnXsd,
} from "../support/independent-bpmn-conformance";

const externalDirectory = resolve(process.cwd(), "tests/fixtures/external");
const fixtureNames = readdirSync(externalDirectory)
  .filter((name) => name.endsWith(".bpmn"))
  .sort();

const expectedConformance: Readonly<Record<string, { parse: boolean; xsd: boolean | null }>> = {
  "bpmn-js-call-activity.bpmn": { parse: true, xsd: true },
  "bpmn-js-complex-gateway.bpmn": { parse: true, xsd: false },
  "bpmn-js-data-object.bpmn": { parse: true, xsd: false },
  "bpmn-js-data-store.bpmn": { parse: true, xsd: true },
  "bpmn-js-expanded-subprocess.bpmn": { parse: true, xsd: true },
  "bpmn-js-timer-catch.bpmn": { parse: false, xsd: null },
  "camunda-modeler-collaboration.bpmn": { parse: true, xsd: true },
  "camunda-modeler-message-catch.bpmn": { parse: true, xsd: true },
  "camunda-modeler-timer-boundary.bpmn": { parse: true, xsd: true },
  "miwg-reference-call-activity-local.bpmn": { parse: true, xsd: true },
  "miwg-signavio-message-catch.bpmn": { parse: true, xsd: true },
};

const trustedPreservationEvidence = {
  "miwg-signavio-message-catch.preservation.json": {
    fixture: "miwg-signavio-message-catch.bpmn",
    sourceClaimId: "miwg-signavio-message-catch-19-9-0",
    sourceSha256: "1efecf52906a7d3598ee49e0929133ed46bd76bbd83ec71290948c1ada44e02b",
    namespaces: ["http://www.signavio.com"],
    expectedProjectionSha256: "dba62fa391a0148040214dd5410703f36874dd3bdeadde1e6cab46cc165ff910",
    claimBoundary: "Exact namespace-aware Signavio extension projection across the named raw transform only; no vendor-schema, TEB canonical or universal-interoperability claim.",
  },
  "miwg-reference-call-activity-local.preservation.json": {
    fixture: "miwg-reference-call-activity-local.bpmn",
    sourceClaimId: "miwg-reference-call-activity-local-c5",
    sourceSha256: "f8c125a7c492d218d1f6962fe03920bec4b1e4a9c2efae0746926667a67f44cc",
    namespaces: [
      "http://www.omg.org/spec/BPMN/non-normative/color/1.0",
      "http://www.trisotech.com/2014/triso/bpmn",
      "http://www.trisotech.com/2015/triso/modeling",
    ],
    expectedProjectionSha256: "3c153fe2a66f78f7c81c8e2059d88a5cafe1814e6e28b57e93e55a84bbb48eaa",
    claimBoundary: "Exact namespace-aware Trisotech/MIWG extension-attribute projection across the named raw transform only; no vendor-schema, TEB canonical or universal-interoperability claim.",
  },
} as const;

async function rawRoundTrip(source: Uint8Array) {
  const moddle = new BpmnModdle();
  const parsed = await moddle.fromXML(new TextDecoder().decode(source));
  return new TextEncoder().encode((await moddle.toXML(parsed.rootElement, { format: true })).xml);
}

describe("SDD39 independent BPMN conformance evidence", () => {
  it("audits the exact offline five-schema import closure", () => {
    expect(auditIndependentParserSupplyChain()).toMatchObject({
      package: "libxml2-wasm",
      version: "0.7.1",
      license: "MIT",
    });
    const bundle = auditOfflineBpmnSchemaBundle();
    expect(bundle.root).toBe("BPMN20.xsd");
    expect(Object.keys(bundle.buffers).sort()).toEqual([
      "BPMN20.xsd",
      "BPMNDI.xsd",
      "DC.xsd",
      "DI.xsd",
      "Semantic.xsd",
    ]);
  });

  it("recognizes pinned lock integrity with LF or CRLF line endings", () => {
    const lockfile = "libxml2-wasm@0.7.1:\n    resolution: {integrity: sha512-example}\n";
    expect(hasPinnedPackageIntegrity(lockfile, "libxml2-wasm@0.7.1", "sha512-example")).toBe(true);
    expect(hasPinnedPackageIntegrity(lockfile.replaceAll("\n", "\r\n"), "libxml2-wasm@0.7.1", "sha512-example"))
      .toBe(true);
  });

  it("fails closed when schema provenance, bytes or import closure drift", () => {
    const path = resolve(process.cwd(), "tests/fixtures/bpmn-xsd/omg-bpmn-2.0.2.provenance.json");
    const manifest = JSON.parse(readFileSync(path, "utf8")) as {
      files: { name: string; sha256: string; dependencies: string[] }[];
    };
    const changedHash = structuredClone(manifest);
    changedHash.files[0].sha256 = "0".repeat(64);
    expect(() => auditOfflineBpmnSchemaBundle({ manifest: changedHash })).toThrow("BIXP_SCHEMA_TRUST_ANCHOR");

    const changedImport = structuredClone(manifest);
    changedImport.files[0].dependencies = ["../outside.xsd"];
    expect(() => auditOfflineBpmnSchemaBundle({ manifest: changedImport })).toThrow("BIXP_SCHEMA_TRUST_ANCHOR");

    const original = readFileSync(resolve(process.cwd(), "node_modules/bpmn-moddle/resources/bpmn/xsd/DC.xsd"));
    const tampered = new Uint8Array(original);
    tampered[tampered.length - 2] ^= 1;
    expect(() => auditOfflineBpmnSchemaBundle({ bufferOverrides: { "DC.xsd": tampered } }))
      .toThrow("BIXP_SCHEMA_INTEGRITY:DC.xsd");
  });

  it("independently parses all immutable fixtures and freezes XSD outcomes", () => {
    expect(fixtureNames).toEqual(Object.keys(expectedConformance).sort());
    const outcomes = fixtureNames.map((fixture) => {
      const source = readFileSync(resolve(externalDirectory, fixture));
      const expected = expectedConformance[fixture];
      if (!expected.parse) {
        expect(() => parseIndependently(source), fixture).toThrow("BIXP_XML_INVALID");
        return { parse: false, xsd: null };
      }
      expect(parseIndependently(source).independentXmlParse).toBe(true);
      const result = validateAgainstOfflineBpmnXsd(source);
      expect(result.independentXmlParse).toBe(true);
      expect(result.omgCoreXsdValid, fixture).toBe(expected.xsd);
      return { parse: true, xsd: result.omgCoreXsdValid };
    });
    expect(outcomes.filter(({ parse }) => parse)).toHaveLength(10);
    expect(outcomes.filter(({ xsd }) => xsd === true)).toHaveLength(8);
    expect(outcomes.filter(({ xsd }) => xsd === false)).toHaveLength(2);
    expect(outcomes.filter(({ xsd }) => xsd === null)).toHaveLength(1);
  });

  it("preserves two independently sourced vendor projections across the named raw transform", async () => {
    for (const name of Object.keys(trustedPreservationEvidence) as (keyof typeof trustedPreservationEvidence)[]) {
      const evidence = loadPreservationManifest(resolve(externalDirectory, name));
      expect(evidence.manifest).toMatchObject({
        ...trustedPreservationEvidence[name],
        parser: "libxml2-wasm@0.7.1",
        transform: "bpmn-moddle@10.1.0:raw-parse-serialize",
        throughTeb: "not-applicable",
      });
      const output = await rawRoundTrip(evidence.fixture);
      expect(projectVendorExtensions(output, evidence.manifest.namespaces)).toEqual(evidence.projection);
    }
  });

  it("detects extension drop, mutation, owner movement and namespace spoofing", () => {
    const evidence = loadPreservationManifest(
      resolve(externalDirectory, "miwg-signavio-message-catch.preservation.json"),
    );
    const source = new TextDecoder().decode(evidence.fixture);
    const dropped = source.replace(/<signavio:signavioMetaData[^>]*\/>/, "");
    const mutated = source.replace('metaValue="#ffffff"', 'metaValue="#fffffe"');
    const moved = source.replace(
      'id="sid-3BFA33E9-2A04-4FEE-A2BB-1007EB9FCF9E"',
      'id="sid-OWNER-MOVED"',
    );
    const spoofed = source.replace("http://www.signavio.com", "https://example.invalid/signavio");
    for (const changed of [dropped, mutated, moved, spoofed]) {
      expect(projectionSha256(projectVendorExtensions(new TextEncoder().encode(changed), evidence.manifest.namespaces)))
        .not.toBe(evidence.manifest.expectedProjectionSha256);
    }
  });

  it("detects same-owner structural reparenting and significant text changes", () => {
    const original = new TextEncoder().encode(`
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:v="https://vendor.example/schema" id="D">
        <process id="P"><extensionElements>
          <v:group kind="first"><v:value>a b</v:value></v:group>
          <v:group kind="second" />
        </extensionElements></process>
      </definitions>`);
    const moved = new TextEncoder().encode(`
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:v="https://vendor.example/schema" id="D">
        <process id="P"><extensionElements>
          <v:group kind="first" />
          <v:group kind="second"><v:value>a b</v:value></v:group>
        </extensionElements></process>
      </definitions>`);
    const changedText = new TextEncoder().encode(new TextDecoder().decode(original).replace("a b", "a  b"));
    const namespaces = ["https://vendor.example/schema"];
    const digest = projectionSha256(projectVendorExtensions(original, namespaces));
    expect(projectionSha256(projectVendorExtensions(moved, namespaces))).not.toBe(digest);
    expect(projectionSha256(projectVendorExtensions(changedText, namespaces))).not.toBe(digest);
  });

  it("keeps BPMN ownership when an identified vendor subtree moves", () => {
    const document = (owner: "Task_A" | "Task_B") => new TextEncoder().encode(`
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:v="https://vendor.example/schema" id="D">
        <process id="P">
          <task id="Task_A">${owner === "Task_A" ? '<extensionElements><v:group id="Vendor_1"><v:value>kept</v:value></v:group></extensionElements>' : ""}</task>
          <task id="Task_B">${owner === "Task_B" ? '<extensionElements><v:group id="Vendor_1"><v:value>kept</v:value></v:group></extensionElements>' : ""}</task>
        </process>
      </definitions>`);
    const namespaces = ["https://vendor.example/schema"];
    const before = projectVendorExtensions(document("Task_A"), namespaces);
    const after = projectVendorExtensions(document("Task_B"), namespaces);
    expect(before.map(({ ownerId }) => ownerId)).toEqual(["Task_A", "Task_A"]);
    expect(after.map(({ ownerId }) => ownerId)).toEqual(["Task_B", "Task_B"]);
    expect(projectionSha256(after)).not.toBe(projectionSha256(before));
  });

  it("is prefix and attribute-order insensitive within its explicit projection", () => {
    const evidence = loadPreservationManifest(
      resolve(externalDirectory, "miwg-signavio-message-catch.preservation.json"),
    );
    const source = new TextDecoder().decode(evidence.fixture);
    const renamedPrefix = source
      .replace('xmlns:signavio="http://www.signavio.com"', 'xmlns:vendor="http://www.signavio.com"')
      .replaceAll("signavio:", "vendor:");
    const reordered = source.replace(
      /metaKey="([^"]*)" metaValue="([^"]*)"/g,
      'metaValue="$2" metaKey="$1"',
    );
    expect(projectVendorExtensions(new TextEncoder().encode(renamedPrefix), evidence.manifest.namespaces))
      .toEqual(evidence.projection);
    expect(projectVendorExtensions(new TextEncoder().encode(reordered), evidence.manifest.namespaces))
      .toEqual(evidence.projection);
  });

  it("fails closed on hostile XML constructs and malformed or oversized input", () => {
    const encode = (value: string) => new TextEncoder().encode(value);
    for (const hostile of [
      '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>',
      '<x xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd"/></x>',
      "<x>",
      "<x>" + "a".repeat(1024 * 1024) + "</x>",
    ]) {
      expect(() => parseIndependently(encode(hostile))).toThrow();
    }
  });

  it("treats hostile instance schemaLocation as inert data", () => {
    const source = new TextEncoder().encode(`<?xml version="1.0"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL http://127.0.0.1:9/hostile.xsd"
        id="Definitions_1" targetNamespace="https://example.test/bpmn">
        <process id="Process_1" isExecutable="false" />
      </definitions>`);
    expect(validateAgainstOfflineBpmnXsd(source).omgCoreXsdValid).toBe(true);
  });

  it("keeps the independent harness unreachable from production sources", () => {
    const roots = ["app", "modules", "platform", "shared"];
    const queue = roots.map((root) => resolve(process.cwd(), root));
    const offenders: string[] = [];
    while (queue.length > 0) {
      const current = queue.pop()!;
      let entries;
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const path = resolve(current, entry.name);
        if (entry.isDirectory()) queue.push(path);
        if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
          const source = readFileSync(path, "utf8");
          if (source.includes("libxml2-wasm") || source.includes("independent-bpmn-conformance")) {
            offenders.push(path);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
