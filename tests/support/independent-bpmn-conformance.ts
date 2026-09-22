import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  ParseOption,
  XmlAttribute,
  XmlBufferInputProvider,
  XmlCData,
  XmlDocument,
  XmlElement,
  XmlText,
  XmlValidateError,
  XsdValidator,
  xmlCleanupInputProvider,
  xmlRegisterInputProvider,
} from "libxml2-wasm";
import { z } from "zod";

const MAX_XML_BYTES = 1024 * 1024;
const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";
const BPMN_OWNER_NAMESPACES = new Set([
  "http://www.omg.org/spec/BPMN/20100524/MODEL",
  "http://www.omg.org/spec/BPMN/20100524/DI",
  "http://www.omg.org/spec/DD/20100524/DI",
  "http://www.omg.org/spec/DD/20100524/DC",
]);
const SAFE_PARSE_OPTIONS =
  ParseOption.XML_PARSE_NONET |
  ParseOption.XML_PARSE_NO_XXE |
  ParseOption.XML_PARSE_NO_SYS_CATALOG;

const trustedSchemaFiles = [
  { name: "BPMN20.xsd", bytes: 1905, sha256: "4c5e3d2c8e14c9e51cd0fc9f857ab9f53d761d04ba405be0e652efe8953204a7", targetNamespace: "http://www.omg.org/spec/BPMN/20100524/MODEL", dependencies: ["BPMNDI.xsd", "Semantic.xsd"] },
  { name: "Semantic.xsd", bytes: 60946, sha256: "aa37542753e49d53838fc91da3581cf2de28dabd0244ce71ace1baaa707fdadc", targetNamespace: "http://www.omg.org/spec/BPMN/20100524/MODEL", dependencies: [] },
  { name: "BPMNDI.xsd", bytes: 3910, sha256: "1bfaab6a1e3b4184055100b15d1404e3414601fd47768feb7e932b4cd49fe77f", targetNamespace: "http://www.omg.org/spec/BPMN/20100524/DI", dependencies: ["DC.xsd", "DI.xsd"] },
  { name: "DI.xsd", bytes: 3370, sha256: "62fa0d89138ac5de62152061be07c899a74e7b983c0486dc6803113e1a5f94a2", targetNamespace: "http://www.omg.org/spec/DD/20100524/DI", dependencies: ["DC.xsd"] },
  { name: "DC.xsd", bytes: 1295, sha256: "b325cd3c0d03628d5a4e10f78a1e8816b4344a2b35c459b4f5ca1a9c71097590", targetNamespace: "http://www.omg.org/spec/DD/20100524/DC", dependencies: [] },
] as const;

const schemaFile = z.object({
  name: z.enum(["BPMN20.xsd", "Semantic.xsd", "BPMNDI.xsd", "DI.xsd", "DC.xsd"]),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  targetNamespace: z.url(),
  dependencies: z.array(z.string()).max(2),
}).strict();

const schemaManifest = z.object({
  schemaVersion: z.literal(1),
  artifactRole: z.literal("offline-test-schema-bundle"),
  specification: z.literal("BPMN 2.0.2"),
  officialSource: z.literal("https://www.omg.org/spec/BPMN/2.0.2/"),
  package: z.object({
    name: z.literal("bpmn-moddle"),
    version: z.literal("10.1.0"),
    repository: z.literal("https://github.com/bpmn-io/bpmn-moddle"),
    commit: z.literal("7e78c8c669d37d9296254dd357d37bfeda6cab6b"),
    integrity: z.literal("sha512-k9Vl97hiFwlr4bJTQ5+pZp21bmrQwil5jnMQ30wF8vney2/WnIcJmWwYzRTAKFVoViTGowtDfbO5rGEF4viO0w=="),
    license: z.literal("MIT"),
  }).strict(),
  root: z.literal("BPMN20.xsd"),
  files: z.array(schemaFile).length(5),
  claimBoundary: z.string().min(1),
}).strict();

const preservationManifest = z.object({
  schemaVersion: z.literal(1),
  artifactRole: z.literal("vendor-extension-preservation-observation"),
  fixture: z.string().endsWith(".bpmn"),
  sourceClaimId: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  parser: z.literal("libxml2-wasm@0.7.1"),
  transform: z.literal("bpmn-moddle@10.1.0:raw-parse-serialize"),
  namespaces: z.array(z.url()).min(1),
  expectedProjectionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  throughTeb: z.literal("not-applicable"),
  claimBoundary: z.string().min(1),
}).strict();

const parserManifest = z.object({
  schemaVersion: z.literal(1),
  artifactRole: z.literal("independent-test-parser-toolchain"),
  package: z.literal("libxml2-wasm"),
  version: z.literal("0.7.1"),
  npmIntegrity: z.literal("sha512-aZpJJL/j6T3D+5TmhG4D0ylR3mN6UzmqmBjyb/p+zEAaouG6GpfHiUNUzKR3vKCEoJt/Z2L15XPDCVPuFJIQhg=="),
  repository: z.literal("https://github.com/jameslan/libxml2-wasm"),
  tag: z.literal("v0.7.1"),
  commit: z.literal("bd487390c5378e63085cf1993905eccd73d37395"),
  license: z.literal("MIT"),
  engine: z.object({
    name: z.literal("libxml2"),
    version: z.literal("2.15.1"),
    repository: z.literal("https://github.com/jameslan/libxml2"),
    commit: z.literal("f52e859efe97cf3f0b78d731976402748878529a"),
    license: z.literal("MIT"),
    licenseSource: z.literal("https://github.com/jameslan/libxml2/blob/f52e859efe97cf3f0b78d731976402748878529a/Copyright"),
  }).strict(),
  embeddedRuntime: z.object({
    path: z.literal("lib/libxml2raw.mjs"),
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  independenceBasis: z.string().min(1),
  claimBoundary: z.string().min(1),
}).strict();

export type VendorExtensionProjection = {
  readonly kind: "attribute" | "element";
  readonly ownerId: string;
  readonly namespaceUri: string;
  readonly localName: string;
  readonly structuralPath: string;
  readonly attributes: readonly {
    readonly expandedName: string;
    readonly value: string;
  }[];
  readonly textSegments: readonly string[];
};

export type SchemaAudit = {
  readonly root: string;
  readonly buffers: Readonly<Record<string, Uint8Array>>;
};

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function assertBoundedXml(source: Uint8Array) {
  if (source.byteLength === 0 || source.byteLength > MAX_XML_BYTES) {
    throw new Error("BIXP_INPUT_SIZE");
  }
  const lexical = new TextDecoder("utf-8", { fatal: true }).decode(source);
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(lexical)) {
    throw new Error("BIXP_DTD_ENTITY_FORBIDDEN");
  }
  if (/<(?:[A-Za-z_][\w.-]*:)?include\b[^>]*\b(?:href|xpointer)\s*=|http:\/\/www\.w3\.org\/2001\/XInclude/i.test(lexical)) {
    throw new Error("BIXP_XINCLUDE_FORBIDDEN");
  }
}

function parse(source: Uint8Array, url = "memory:///fixture.bpmn") {
  assertBoundedXml(source);
  try {
    return XmlDocument.fromBuffer(source, { option: SAFE_PARSE_OPTIONS, url });
  } catch (cause) {
    throw new Error("BIXP_XML_INVALID", { cause });
  }
}

function normalizedText(value: string) {
  return value.trim();
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function hasPinnedPackageIntegrity(
  lockfile: string,
  coordinate: string,
  integrity: string,
) {
  const normalized = lockfile.replace(/\r\n?/g, "\n");
  return normalized.includes(`${coordinate}:\n    resolution: {integrity: ${integrity}}`);
}

function findOwner(node: XmlAttribute | XmlElement) {
  let owner = node instanceof XmlAttribute ? node.parent : node.parent;
  while (owner) {
    const id = owner.attr("id")?.value;
    if (id && BPMN_OWNER_NAMESPACES.has(owner.namespaceUri)) {
      return { element: owner, id };
    }
    owner = owner.parent;
  }
  return { element: null, id: "<definitions-without-id>" };
}

function elementSegment(element: XmlElement) {
  let ordinal = 1;
  let sibling = element.parent?.firstChild ?? null;
  while (sibling && sibling !== element) {
    if (
      sibling instanceof XmlElement &&
      sibling.namespaceUri === element.namespaceUri &&
      sibling.name === element.name
    ) {
      ordinal += 1;
    }
    sibling = sibling.next;
  }
  return `{${element.namespaceUri}}${element.name}[${ordinal}]`;
}

function structuralPath(node: XmlAttribute | XmlElement, owner: XmlElement | null) {
  let current = node instanceof XmlAttribute ? node.parent : node;
  const segments: string[] = [];
  while (current && current !== owner) {
    segments.unshift(elementSegment(current));
    current = current.parent;
  }
  return segments.length > 0 ? segments.join("/") : ".";
}

function directTextSegments(element: XmlElement) {
  const segments: string[] = [];
  let child = element.firstChild;
  while (child) {
    if (child instanceof XmlText || child instanceof XmlCData) {
      const text = normalizedText(child.content);
      if (text) segments.push(text);
    }
    child = child.next;
  }
  return segments;
}

function xpathString(value: string) {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  throw new Error("BIXP_NAMESPACE_QUOTE_FORBIDDEN");
}

export function projectVendorExtensions(
  source: Uint8Array,
  namespaces: readonly string[],
): readonly VendorExtensionProjection[] {
  if (new Set(namespaces).size !== namespaces.length) {
    throw new Error("BIXP_DUPLICATE_VENDOR_NAMESPACE");
  }
  const document = parse(source);
  try {
    const namespacePredicate = namespaces
      .map((namespace) => `namespace-uri()=${xpathString(namespace)}`)
      .join(" or ");
    const nodes = document.find(`//*[${namespacePredicate}] | //@*[${namespacePredicate}]`);
    const projection: VendorExtensionProjection[] = nodes.map((node) => {
      if (!(node instanceof XmlElement) && !(node instanceof XmlAttribute)) {
        throw new Error("BIXP_UNEXPECTED_PROJECTION_NODE");
      }
      const isElement = node instanceof XmlElement;
      const owner = findOwner(node);
      return {
        kind: isElement ? "element" : "attribute",
        ownerId: owner.id,
        namespaceUri: node.namespaceUri,
        localName: node.name,
        structuralPath: structuralPath(node, owner.element),
        attributes: isElement
          ? node.attrs
              .map((attribute) => ({
                expandedName: `{${attribute.namespaceUri}}${attribute.name}`,
                value: attribute.value,
              }))
              .sort((left, right) => compareCodeUnits(left.expandedName, right.expandedName))
          : [],
        textSegments: isElement ? directTextSegments(node) : [node.value],
      };
    });
    const elements = projection.filter((node) => node.kind === "element");
    const attributes = projection
      .filter((node) => node.kind === "attribute")
      .sort((left, right) => {
        const leftKey = [
          left.ownerId,
          left.structuralPath,
          left.namespaceUri,
          left.localName,
          ...left.textSegments,
        ].join("\u0000");
        const rightKey = [
          right.ownerId,
          right.structuralPath,
          right.namespaceUri,
          right.localName,
          ...right.textSegments,
        ].join("\u0000");
        return compareCodeUnits(leftKey, rightKey);
      });
    return [...elements, ...attributes];
  } finally {
    document.dispose();
  }
}

export function projectionSha256(projection: readonly VendorExtensionProjection[]) {
  return sha256(JSON.stringify(projection));
}

export function parseIndependently(source: Uint8Array) {
  const document = parse(source);
  try {
    return {
      independentXmlParse: true as const,
      canonicalSha256: sha256(document.canonicalizeToString()),
    };
  } finally {
    document.dispose();
  }
}

export function auditIndependentParserSupplyChain() {
  const manifestPath = resolve(process.cwd(), "tests/fixtures/bpmn-xsd/libxml2-wasm-0.7.1.provenance.json");
  const manifest = parserManifest.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
  const packageRoot = resolve(process.cwd(), "node_modules/libxml2-wasm");
  const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
    license?: string;
  };
  const embeddedRuntime = readFileSync(resolve(packageRoot, manifest.embeddedRuntime.path));
  const lockfile = readFileSync(resolve(process.cwd(), "pnpm-lock.yaml"), "utf8");
  if (
    packageJson.name !== manifest.package ||
    packageJson.version !== manifest.version ||
    packageJson.license !== manifest.license ||
    embeddedRuntime.byteLength !== manifest.embeddedRuntime.bytes ||
    sha256(embeddedRuntime) !== manifest.embeddedRuntime.sha256 ||
    !hasPinnedPackageIntegrity(
      lockfile,
      `libxml2-wasm@${manifest.version}`,
      manifest.npmIntegrity,
    )
  ) {
    throw new Error("BIXP_PARSER_SUPPLY_CHAIN_DRIFT");
  }
  return manifest;
}

export function auditOfflineBpmnSchemaBundle(options: {
  readonly manifest?: unknown;
  readonly bufferOverrides?: Readonly<Record<string, Uint8Array>>;
} = {}): SchemaAudit {
  const manifestPath = resolve(process.cwd(), "tests/fixtures/bpmn-xsd/omg-bpmn-2.0.2.provenance.json");
  const manifest = schemaManifest.parse(
    options.manifest ?? JSON.parse(readFileSync(manifestPath, "utf8")),
  );
  if (JSON.stringify(manifest.files) !== JSON.stringify(trustedSchemaFiles)) {
    throw new Error("BIXP_SCHEMA_TRUST_ANCHOR");
  }
  const schemaDirectory = resolve(process.cwd(), "node_modules/bpmn-moddle/resources/bpmn/xsd");
  const installedPackage = JSON.parse(
    readFileSync(resolve(process.cwd(), "node_modules/bpmn-moddle/package.json"), "utf8"),
  ) as { name?: string; version?: string; license?: string };
  const lockfile = readFileSync(resolve(process.cwd(), "pnpm-lock.yaml"), "utf8");
  if (
    installedPackage.name !== manifest.package.name ||
    installedPackage.version !== manifest.package.version ||
    installedPackage.license !== manifest.package.license ||
    !hasPinnedPackageIntegrity(
      lockfile,
      `bpmn-moddle@${manifest.package.version}`,
      manifest.package.integrity,
    )
  ) {
    throw new Error("BIXP_SCHEMA_PACKAGE_DRIFT");
  }
  const names = manifest.files.map(({ name }) => name);
  const nameSet = new Set<string>(names);
  if (new Set(names).size !== names.length || !names.includes(manifest.root)) {
    throw new Error("BIXP_SCHEMA_MEMBERSHIP");
  }
  const buffers: Record<string, Uint8Array> = {};
  for (const file of manifest.files) {
    if (file.dependencies.some((dependency) => !nameSet.has(dependency) || basename(dependency) !== dependency)) {
      throw new Error("BIXP_SCHEMA_IMPORT_CLOSURE");
    }
    const bytes = options.bufferOverrides?.[file.name] ?? readFileSync(resolve(schemaDirectory, file.name));
    if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(`BIXP_SCHEMA_INTEGRITY:${file.name}`);
    }
    const schema = parse(bytes, file.name);
    try {
      const root = schema.get("/xsd:schema", { xsd: XSD_NAMESPACE });
      if (!(root instanceof XmlElement) || root.attr("targetNamespace")?.value !== file.targetNamespace) {
        throw new Error(`BIXP_SCHEMA_NAMESPACE:${file.name}`);
      }
      const declaredDependencies = schema
        .find("/xsd:schema/xsd:import/@schemaLocation | /xsd:schema/xsd:include/@schemaLocation", { xsd: XSD_NAMESPACE })
        .map((node) => node.content)
        .sort();
      if (JSON.stringify(declaredDependencies) !== JSON.stringify([...file.dependencies].sort())) {
        throw new Error(`BIXP_SCHEMA_IMPORT_GRAPH:${file.name}`);
      }
    } finally {
      schema.dispose();
    }
    buffers[file.name] = bytes;
  }
  return { root: manifest.root, buffers };
}

export function validateAgainstOfflineBpmnXsd(source: Uint8Array) {
  assertBoundedXml(source);
  const bundle = auditOfflineBpmnSchemaBundle();
  const provider = new XmlBufferInputProvider(bundle.buffers);
  if (!xmlRegisterInputProvider(provider)) {
    throw new Error("BIXP_SCHEMA_PROVIDER_REGISTRATION");
  }
  let schemaDocument: XmlDocument | undefined;
  let validator: XsdValidator | undefined;
  let sourceDocument: XmlDocument | undefined;
  try {
    schemaDocument = XmlDocument.fromBuffer(bundle.buffers[bundle.root], {
      option: SAFE_PARSE_OPTIONS,
      url: bundle.root,
    });
    validator = XsdValidator.fromDoc(schemaDocument);
    sourceDocument = parse(source);
    validator.validate(sourceDocument);
    return { independentXmlParse: true as const, omgCoreXsdValid: true as const };
  } catch (error) {
    if (sourceDocument && error instanceof XmlValidateError) {
      return {
        independentXmlParse: true as const,
        omgCoreXsdValid: false as const,
        category: "xsd-invalid" as const,
        diagnostic: error instanceof Error ? error.message : "XSD validation failed",
      };
    }
    throw error;
  } finally {
    sourceDocument?.dispose();
    validator?.dispose();
    schemaDocument?.dispose();
    xmlCleanupInputProvider();
  }
}

export function loadPreservationManifest(path: string) {
  const manifest = preservationManifest.parse(JSON.parse(readFileSync(path, "utf8")));
  if (basename(manifest.fixture) !== manifest.fixture) {
    throw new Error("BIXP_PRESERVATION_FIXTURE_PATH");
  }
  const fixturePath = resolve(path, "..", manifest.fixture);
  const fixture = readFileSync(fixturePath);
  if (sha256(fixture) !== manifest.sourceSha256) {
    throw new Error("BIXP_PRESERVATION_SOURCE_INTEGRITY");
  }
  const provenance = JSON.parse(
    readFileSync(fixturePath.replace(/\.bpmn$/, ".provenance.json"), "utf8"),
  ) as { integrity?: { value?: string }; claimBoundary?: { id?: string } };
  if (
    provenance.integrity?.value !== manifest.sourceSha256 ||
    provenance.claimBoundary?.id !== manifest.sourceClaimId
  ) {
    throw new Error("BIXP_PRESERVATION_PROVENANCE_BINDING");
  }
  const projection = projectVendorExtensions(fixture, manifest.namespaces);
  if (projection.length === 0 || projectionSha256(projection) !== manifest.expectedProjectionSha256) {
    throw new Error(`BIXP_PRESERVATION_PROJECTION_DRIFT:${projection.length}:${projectionSha256(projection)}`);
  }
  return { fixture, manifest, projection };
}
