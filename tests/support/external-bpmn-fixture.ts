import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { isBpmnProfileId, type BpmnProfileId } from "../../modules/process-modeling/domain/core-profile";

const immutableCommit = z.string().regex(/^[a-f0-9]{40}$/);
const nonEmpty = z.string().min(1);
const exclusionSchema = z.enum([
  "full-bpmn-2.0-conformance",
  "workflow-engine-execution",
  "universal-interoperability",
  "vendor-extension-preservation",
]);

const semanticAssertionSchema = z.object({
  id: nonEmpty,
  type: nonEmpty,
  parentId: nonEmpty.optional(),
}).strict();
const propertyAssertionSchema = z.object({
  elementId: nonEmpty,
  property: nonEmpty,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  valueSource: z.enum([
    "explicit",
    "effective-bpmn-default",
    "absent",
  ]).optional(),
}).strict();
const referenceAssertionSchema = z.object({
  elementId: nonEmpty,
  property: nonEmpty,
  targetIds: z.array(nonEmpty).min(1),
}).strict();
const shapeAssertionSchema = z.object({
  id: nonEmpty,
  elementId: nonEmpty,
  isExpanded: z.boolean().optional(),
}).strict();
const edgeAssertionSchema = z.object({
  id: nonEmpty,
  elementId: nonEmpty,
  minimumWaypoints: z.number().int().min(2),
}).strict();

const eventDefinitionAssertionSchema = z.discriminatedUnion("kind", [
  z.object({
    ownerId: nonEmpty,
    definitionId: nonEmpty.nullable(),
    kind: z.literal("MESSAGE"),
    messageRefId: nonEmpty.nullable(),
  }).strict(),
  z.object({
    ownerId: nonEmpty,
    definitionId: nonEmpty.nullable(),
    kind: z.literal("TIMER"),
    timerKind: z.enum(["DATE", "DURATION"]).nullable(),
    expression: z.string().nullable(),
  }).strict(),
]);

const comparisonEvidenceSchema = z.object({
  cohortId: nonEmpty,
  producerFamily: nonEmpty,
  modelerFamily: nonEmpty,
  scope: nonEmpty,
}).strict();

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  fixture: nonEmpty,
  artifactRole: z.literal("immutable-upstream-fixture"),
  source: z.object({
    organization: nonEmpty,
    repository: z.url(),
    commit: immutableCommit,
    officialSource: z.url(),
    rawSource: z.url(),
    retrievedAt: z.iso.datetime(),
  }).strict(),
  producerEvidence: z.object({
    tool: nonEmpty,
    version: z.string().min(1).nullable(),
    releaseEvidence: z.url().nullable(),
    evidence: z.enum([
      "xml-metadata",
      "pinned-upstream-repository",
      "upstream-path",
    ]),
    unknownFields: z.array(nonEmpty),
    note: nonEmpty,
  }).strict(),
  license: z.object({
    spdx: z.enum(["MIT", "LicenseRef-bpmn-io", "CC-BY-3.0"]),
    source: z.url(),
  }).strict(),
  integrity: z.object({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  namespaces: z.array(z.url()).min(1),
  independenceBasis: nonEmpty,
  comparisonEvidence: comparisonEvidenceSchema.nullable().optional(),
  claimBoundary: z.object({
    id: nonEmpty,
    feature: z.enum([
      "collaboration",
      "expanded-subprocess",
      "call-activity",
      "data-object",
      "data-store",
      "complex-gateway",
      "message-catch-event",
      "timer-catch-event",
      "boundary-event",
      "call-activity-local-target",
    ]),
    minimumTebProfile: nonEmpty,
    semanticAssertions: z.array(semanticAssertionSchema).min(1),
    propertyAssertions: z.array(propertyAssertionSchema),
    referenceAssertions: z.array(referenceAssertionSchema),
    eventDefinitionAssertions: z.array(eventDefinitionAssertionSchema).optional(),
    di: z.object({
      shapes: z.array(shapeAssertionSchema),
      edges: z.array(edgeAssertionSchema),
    }).strict(),
    expectedTeb: z.object({
      accepted: z.boolean(),
      safeToPersist: z.boolean(),
      readyToSeal: z.boolean(),
      ruleIds: z.array(nonEmpty),
    }).strict(),
    exclusions: z.array(exclusionSchema).length(4),
    statement: nonEmpty,
  }).strict(),
}).strict();

export type ExternalBpmnFixtureManifest = z.infer<typeof manifestSchema> & {
  readonly claimBoundary: z.infer<typeof manifestSchema>["claimBoundary"] & {
    readonly minimumTebProfile: BpmnProfileId;
  };
};

const featureClaimPolicy = {
  collaboration: {
    requiredType: "bpmn:Collaboration",
    semanticTypes: ["bpmn:Collaboration", "bpmn:Participant", "bpmn:Process", "bpmn:StartEvent"],
    properties: [],
    references: ["processRef"],
  },
  "expanded-subprocess": {
    requiredType: "bpmn:SubProcess",
    semanticTypes: ["bpmn:SubProcess", "bpmn:StartEvent", "bpmn:Task", "bpmn:SequenceFlow"],
    properties: [],
    references: ["sourceRef", "targetRef"],
  },
  "call-activity": {
    requiredType: "bpmn:CallActivity",
    semanticTypes: ["bpmn:CallActivity"],
    properties: ["name"],
    references: ["calledElement"],
  },
  "data-object": {
    requiredType: "bpmn:DataObject",
    semanticTypes: ["bpmn:DataObject", "bpmn:DataObjectReference", "bpmn:DataInputAssociation", "bpmn:DataOutputAssociation"],
    properties: [],
    references: ["dataObjectRef", "sourceRef", "targetRef"],
  },
  "data-store": {
    requiredType: "bpmn:DataStore",
    semanticTypes: ["bpmn:DataStore", "bpmn:DataStoreReference"],
    properties: ["name"],
    references: ["dataStoreRef"],
  },
  "complex-gateway": {
    requiredType: "bpmn:ComplexGateway",
    semanticTypes: ["bpmn:ComplexGateway", "bpmn:SequenceFlow"],
    properties: ["gatewayDirection", "activationCondition"],
    references: ["default", "incoming", "outgoing", "sourceRef", "targetRef"],
  },
  "message-catch-event": {
    requiredType: "bpmn:IntermediateCatchEvent",
    semanticTypes: [
      "bpmn:Message",
      "bpmn:IntermediateCatchEvent",
      "bpmn:MessageEventDefinition",
    ],
    properties: ["name"],
    references: ["messageRef"],
  },
  "timer-catch-event": {
    requiredType: "bpmn:IntermediateCatchEvent",
    semanticTypes: [
      "bpmn:IntermediateCatchEvent",
      "bpmn:TimerEventDefinition",
    ],
    properties: ["name"],
    references: [],
  },
  "boundary-event": {
    requiredType: "bpmn:BoundaryEvent",
    semanticTypes: [
      "bpmn:BoundaryEvent",
      "bpmn:Task",
      "bpmn:UserTask",
      "bpmn:ServiceTask",
      "bpmn:ManualTask",
      "bpmn:ReceiveTask",
      "bpmn:Message",
      "bpmn:MessageEventDefinition",
      "bpmn:TimerEventDefinition",
    ],
    properties: ["name", "cancelActivity"],
    references: ["attachedToRef", "messageRef"],
  },
  "call-activity-local-target": {
    requiredType: "bpmn:CallActivity",
    semanticTypes: ["bpmn:Process", "bpmn:CallActivity"],
    properties: ["name", "isExecutable"],
    references: ["calledElement"],
  },
} as const;

function secureUrl(value: string, label: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be an immutable credential-free HTTPS URL`);
  }
  return url;
}

function assertSourceTopology(manifest: z.infer<typeof manifestSchema>) {
  const { commit } = manifest.source;
  const repository = secureUrl(manifest.source.repository, "Repository");
  const official = secureUrl(manifest.source.officialSource, "Official source");
  const raw = secureUrl(manifest.source.rawSource, "Raw source");
  const license = secureUrl(manifest.license.source, "License source");
  const repositoryMatch = repository.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/u);
  const officialMatch = official.pathname.match(
    /^\/([^/]+)\/([^/]+)\/blob\/([a-f0-9]{40})\/(.+)$/u,
  );
  const rawMatch = raw.pathname.match(
    /^\/([^/]+)\/([^/]+)\/([a-f0-9]{40})\/(.+)$/u,
  );
  const licenseMatch = license.pathname.match(
    /^\/([^/]+)\/([^/]+)\/blob\/([a-f0-9]{40})\/(.+)$/u,
  );
  if (
    repository.hostname !== "github.com" ||
    official.hostname !== "github.com" ||
    raw.hostname !== "raw.githubusercontent.com" ||
    license.hostname !== "github.com" ||
    !repositoryMatch ||
    !officialMatch ||
    !rawMatch ||
    !licenseMatch
  ) {
    throw new Error("Provenance URLs must use pinned GitHub source topology");
  }
  const identity = repositoryMatch.slice(1, 3).join("/");
  if (
    officialMatch.slice(1, 3).join("/") !== identity ||
    rawMatch.slice(1, 3).join("/") !== identity ||
    licenseMatch.slice(1, 3).join("/") !== identity ||
    officialMatch[3] !== commit ||
    rawMatch[3] !== commit ||
    licenseMatch[3] !== commit ||
    officialMatch[4] !== rawMatch[4]
  ) {
    throw new Error("Provenance URLs must pin the same repository, commit and source path");
  }
  if (manifest.producerEvidence.releaseEvidence) {
    secureUrl(manifest.producerEvidence.releaseEvidence, "Release evidence");
  }
}

function assertFeatureClaimBoundary(manifest: z.infer<typeof manifestSchema>) {
  const claim = manifest.claimBoundary;
  const policy = featureClaimPolicy[claim.feature];
  const eventAssertions = claim.eventDefinitionAssertions ?? [];
  const types = claim.semanticAssertions.map((assertion) => assertion.type);
  if (!types.includes(policy.requiredType)) {
    throw new Error(`Claim boundary must include ${policy.requiredType}`);
  }
  if (types.some((type) => !(policy.semanticTypes as readonly string[]).includes(type))) {
    throw new Error("Claim boundary semantic type exceeds the feature allowlist");
  }
  if (
    claim.propertyAssertions.some(
      (assertion) => !(policy.properties as readonly string[]).includes(assertion.property),
    )
  ) {
    throw new Error("Claim boundary property exceeds the feature allowlist");
  }
  if (
    claim.referenceAssertions.some(
      (assertion) => !(policy.references as readonly string[]).includes(assertion.property),
    )
  ) {
    throw new Error("Claim boundary reference exceeds the feature allowlist");
  }
  if (
    claim.propertyAssertions.some(
      (assertion) =>
        (assertion.valueSource === "absent" && assertion.value !== null) ||
        (assertion.valueSource !== "absent" && assertion.value === null),
    )
  ) {
    throw new Error("Property assertion value must match its declared value source");
  }
  const keys = [
    ...claim.semanticAssertions.map((item) => `semantic:${item.id}`),
    ...claim.propertyAssertions.map((item) => `property:${item.elementId}:${item.property}`),
    ...claim.referenceAssertions.map((item) => `reference:${item.elementId}:${item.property}`),
    ...eventAssertions.map((item) => `event:${item.ownerId}:${item.definitionId ?? "<absent>"}`),
    ...claim.di.shapes.map((item) => `shape:${item.id}`),
    ...claim.di.edges.map((item) => `edge:${item.id}`),
  ];
  if (new Set(keys).size !== keys.length) {
    throw new Error("Claim boundary assertions must be unique");
  }
  const semanticIds = new Set(
    claim.semanticAssertions.map((assertion) => assertion.id),
  );
  const semanticTypesById = new Map(
    claim.semanticAssertions.map((assertion) => [assertion.id, assertion.type]),
  );
  if (
    claim.propertyAssertions.some(
      (assertion) => !semanticIds.has(assertion.elementId),
    ) ||
    claim.referenceAssertions.some(
      (assertion) =>
        !semanticIds.has(assertion.elementId) ||
        assertion.targetIds.some((targetId) => !semanticIds.has(targetId)),
    ) ||
    claim.di.shapes.some((shape) => !semanticIds.has(shape.elementId)) ||
    claim.di.edges.some((edge) => !semanticIds.has(edge.elementId)) ||
    eventAssertions.some(
      (assertion) =>
        !semanticIds.has(assertion.ownerId) ||
        (assertion.definitionId !== null &&
          !semanticIds.has(assertion.definitionId)) ||
        (assertion.kind === "MESSAGE" &&
          assertion.messageRefId !== null &&
          !semanticIds.has(assertion.messageRefId)),
    )
  ) {
    throw new Error("Claim assertions must remain inside declared semantic IDs");
  }
  for (const assertion of eventAssertions) {
    const expectedDefinitionType = assertion.kind === "MESSAGE"
      ? "bpmn:MessageEventDefinition"
      : "bpmn:TimerEventDefinition";
    if (
      (assertion.definitionId !== null &&
        semanticTypesById.get(assertion.definitionId) !== expectedDefinitionType) ||
      (assertion.kind === "MESSAGE" &&
        assertion.messageRefId !== null &&
        semanticTypesById.get(assertion.messageRefId) !== "bpmn:Message") ||
      (assertion.kind === "TIMER" &&
        ((assertion.timerKind === null) !== (assertion.expression === null)))
    ) {
      throw new Error("Event definition assertion types must match declared semantics");
    }
  }

  const eventFeature = claim.feature === "message-catch-event" ||
    claim.feature === "timer-catch-event" ||
    claim.feature === "boundary-event";
  if (eventFeature && eventAssertions.length !== 1) {
    throw new Error("Event fixture claims must declare exactly one event definition");
  }
  if (
    claim.feature === "message-catch-event" &&
    eventAssertions[0]?.kind !== "MESSAGE"
  ) {
    throw new Error("Message Catch fixture must declare a Message definition");
  }
  if (
    claim.feature === "timer-catch-event" &&
    eventAssertions[0]?.kind !== "TIMER"
  ) {
    throw new Error("Timer Catch fixture must declare a Timer definition");
  }
  if (
    eventAssertions.length > 0 &&
    semanticTypesById.get(eventAssertions[0]!.ownerId) !==
      (claim.feature === "boundary-event"
        ? "bpmn:BoundaryEvent"
        : "bpmn:IntermediateCatchEvent")
  ) {
    throw new Error("Event definition owner must match the claimed event feature");
  }
  if (claim.feature === "boundary-event") {
    const boundary = claim.semanticAssertions.find(
      (assertion) => assertion.type === "bpmn:BoundaryEvent",
    );
    const attachment = claim.referenceAssertions.find(
      (assertion) =>
        assertion.elementId === boundary?.id &&
        assertion.property === "attachedToRef",
    );
    const hostType = attachment?.targetIds.length === 1
      ? semanticTypesById.get(attachment.targetIds[0]!)
      : undefined;
    const interrupting = claim.propertyAssertions.find(
      (assertion) =>
        assertion.elementId === boundary?.id &&
        assertion.property === "cancelActivity",
    );
    const claimedShapeIds = new Set(
      claim.di.shapes.map((shape) => shape.elementId),
    );
    if (
      !attachment ||
      ![
        "bpmn:Task",
        "bpmn:UserTask",
        "bpmn:ServiceTask",
        "bpmn:ManualTask",
        "bpmn:ReceiveTask",
      ].includes(hostType ?? "") ||
      typeof interrupting?.value !== "boolean" ||
      !boundary?.id ||
      !claimedShapeIds.has(boundary.id) ||
      !claimedShapeIds.has(attachment.targetIds[0]!)
    ) {
      throw new Error(
        "Boundary Event claim must declare one supported host, interrupting state and both DI shapes",
      );
    }
  }

  if (claim.feature === "call-activity-local-target") {
    const call = claim.semanticAssertions.find(
      (assertion) => assertion.type === "bpmn:CallActivity",
    );
    const processes = claim.semanticAssertions.filter(
      (assertion) => assertion.type === "bpmn:Process",
    );
    const calledElement = claim.referenceAssertions.find(
      (assertion) =>
        assertion.elementId === call?.id && assertion.property === "calledElement",
    );
    const targetId = calledElement?.targetIds[0];
    const targetExecutable = claim.propertyAssertions.find(
      (assertion) =>
        assertion.elementId === targetId && assertion.property === "isExecutable",
    );
    if (
      !call?.parentId ||
      processes.length !== 2 ||
      calledElement?.targetIds.length !== 1 ||
      !targetId ||
      targetId === call.parentId ||
      !processes.some((process) => process.id === call.parentId) ||
      !processes.some((process) => process.id === targetId) ||
      processes.some((process) => !process.parentId) ||
      new Set(processes.map((process) => process.parentId)).size !== 1 ||
      targetExecutable?.value !== false
    ) {
      throw new Error(
        "Local CallActivity claim must resolve one distinct non-executable Definitions-root Process",
      );
    }
  }
  if (
    new Set(claim.expectedTeb.ruleIds).size !==
    claim.expectedTeb.ruleIds.length
  ) {
    throw new Error("Expected TEB rule IDs must be unique");
  }
}

function xmlNamespaceInventory(bytes: Uint8Array) {
  const xml = Buffer.from(bytes).toString("utf8");
  return [...xml.matchAll(/\bxmlns(?::[\w.-]+)?\s*=\s*["']([^"']+)["']/gu)]
    .map((match) => match[1]!)
    .sort();
}

function assertProducerEvidence(
  manifest: z.infer<typeof manifestSchema>,
  bytes: Uint8Array,
) {
  if (manifest.producerEvidence.evidence !== "xml-metadata") return;
  const xml = Buffer.from(bytes).toString("utf8");
  const exporter = xml.match(/\bexporter\s*=\s*["']([^"']+)["']/u)?.[1];
  const version = xml.match(/\bexporterVersion\s*=\s*["']([^"']+)["']/u)?.[1];
  if (
    !exporter ||
    exporter.toLocaleLowerCase() !== manifest.producerEvidence.tool.toLocaleLowerCase() ||
    version !== manifest.producerEvidence.version
  ) {
    throw new Error("Producer evidence must match exporter metadata in the raw XML");
  }
}

export function validateExternalBpmnFixtureManifest(
  candidate: unknown,
  fixtureName: string,
  bytes: Uint8Array,
): ExternalBpmnFixtureManifest {
  const manifest = manifestSchema.parse(candidate);
  if (manifest.fixture !== fixtureName || basename(manifest.fixture) !== manifest.fixture) {
    throw new Error("Manifest fixture must match the adjacent BPMN basename");
  }
  if (!isBpmnProfileId(manifest.claimBoundary.minimumTebProfile)) {
    throw new Error("Claim boundary must use a supported immutable TEB profile");
  }
  assertSourceTopology(manifest);
  assertFeatureClaimBoundary(manifest);
  assertProducerEvidence(manifest, bytes);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== manifest.integrity.value) {
    throw new Error("Fixture SHA-256 does not match immutable provenance");
  }
  if (new Set(manifest.namespaces).size !== manifest.namespaces.length) {
    throw new Error("Namespace inventory must not contain duplicates");
  }
  const actualNamespaces = xmlNamespaceInventory(bytes);
  if (
    JSON.stringify(manifest.namespaces) !== JSON.stringify(actualNamespaces)
  ) {
    throw new Error("Namespace inventory must exactly match sorted raw XML declarations");
  }
  if (new Set(manifest.claimBoundary.exclusions).size !== exclusionSchema.options.length) {
    throw new Error("Claim boundary must contain every required exclusion exactly once");
  }
  return manifest as ExternalBpmnFixtureManifest;
}

export function auditExternalBpmnFixtureDirectory(directory: string) {
  const files = readdirSync(directory).filter((file) => !file.startsWith("._"));
  const bpmn = files.filter((file) => file.endsWith(".bpmn")).sort();
  const manifests = files
    .filter((file) => file.endsWith(".provenance.json"))
    .map((file) => file.replace(/\.provenance\.json$/u, ".bpmn"))
    .sort();
  if (JSON.stringify(bpmn) !== JSON.stringify(manifests)) {
    throw new Error("External fixture directory must have a BPMN/provenance bijection");
  }
  return bpmn;
}

export function loadExternalBpmnFixture(
  directory: string,
  fixtureName: string,
) {
  const fixturePath = resolve(directory, fixtureName);
  const manifestPath = resolve(
    directory,
    fixtureName.replace(/\.bpmn$/u, ".provenance.json"),
  );
  const bytes = readFileSync(fixturePath);
  const manifest = validateExternalBpmnFixtureManifest(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    fixtureName,
    bytes,
  );
  return { bytes, xml: bytes.toString("utf8"), manifest } as const;
}

export function assertUniqueExternalFixtureClaims(
  manifests: readonly ExternalBpmnFixtureManifest[],
) {
  const claimIds = manifests.map((manifest) => manifest.claimBoundary.id);
  if (new Set(claimIds).size !== claimIds.length) {
    throw new Error("External fixture claim IDs must be unique");
  }
}

export type TrustedExternalFixtureComparison = {
  readonly fixture: string;
  readonly claimId: string;
  readonly feature: ExternalBpmnFixtureManifest["claimBoundary"]["feature"];
  readonly cohortId: string;
  readonly producerFamily: string;
  readonly modelerFamily: string;
  readonly scope: string;
  readonly integrity: string;
  readonly repository: string;
  readonly officialSource: string;
  readonly licenseSource: string;
  readonly licenseSpdx: "MIT" | "LicenseRef-bpmn-io" | "CC-BY-3.0";
  readonly tool: string;
};

export function assertBoundedMultiVendorFixtureEvidence(
  manifests: readonly ExternalBpmnFixtureManifest[],
  trusted: readonly TrustedExternalFixtureComparison[],
) {
  const manifestsByFixture = new Map(
    manifests.map((manifest) => [manifest.fixture, manifest]),
  );
  const trustedByFixture = new Map(
    trusted.map((entry) => [entry.fixture, entry]),
  );
  if (trustedByFixture.size !== trusted.length) {
    throw new Error("Trusted multi-vendor fixture entries must be unique");
  }
  const manifestComparisonFixtures = manifests
    .filter((manifest) => manifest.comparisonEvidence)
    .map((manifest) => manifest.fixture)
    .sort();
  const trustedFixtures = trusted.map((entry) => entry.fixture).sort();
  if (JSON.stringify(manifestComparisonFixtures) !== JSON.stringify(trustedFixtures)) {
    throw new Error("Manifest comparison evidence requires an exact trusted matrix entry");
  }

  for (const entry of trusted) {
    const manifest = manifestsByFixture.get(entry.fixture);
    if (!manifest) throw new Error("Trusted multi-vendor fixture is missing from the corpus");
    const actual = {
      fixture: manifest.fixture,
      claimId: manifest.claimBoundary.id,
      feature: manifest.claimBoundary.feature,
      cohortId: manifest.comparisonEvidence?.cohortId,
      producerFamily: manifest.comparisonEvidence?.producerFamily,
      modelerFamily: manifest.comparisonEvidence?.modelerFamily,
      scope: manifest.comparisonEvidence?.scope,
      integrity: manifest.integrity.value,
      repository: manifest.source.repository,
      officialSource: manifest.source.officialSource,
      licenseSource: manifest.license.source,
      licenseSpdx: manifest.license.spdx,
      tool: manifest.producerEvidence.tool,
    };
    if (JSON.stringify(actual) !== JSON.stringify(entry)) {
      throw new Error("Multi-vendor evidence drifted from the trusted overlap matrix");
    }
  }

  const cohorts = new Map<string, TrustedExternalFixtureComparison[]>();
  for (const entry of trusted) {
    cohorts.set(entry.cohortId, [...(cohorts.get(entry.cohortId) ?? []), entry]);
  }
  for (const [cohortId, entries] of cohorts) {
    if (entries.length < 2) {
      throw new Error(`Multi-vendor cohort ${cohortId} must contain at least two fixtures`);
    }
    if (
      new Set(entries.map((entry) => entry.feature)).size !== 1 ||
      new Set(entries.map((entry) => entry.scope)).size !== 1
    ) {
      throw new Error("Multi-vendor cohort must compare one bounded feature and scope");
    }
    if (
      new Set(entries.map((entry) => entry.producerFamily)).size < 2 ||
      new Set(entries.map((entry) => entry.modelerFamily)).size < 2
    ) {
      throw new Error("Multi-vendor cohort requires two independent producer and modeler families");
    }
    if (
      new Set(entries.map((entry) => entry.repository)).size < 2 ||
      new Set(entries.map((entry) => entry.tool)).size < 2
    ) {
      throw new Error("Multi-vendor cohort requires two independent repositories and tools");
    }
    if (new Set(entries.map((entry) => entry.integrity)).size !== entries.length) {
      throw new Error("Multi-vendor cohort fixtures must have distinct checksums");
    }
  }
}
