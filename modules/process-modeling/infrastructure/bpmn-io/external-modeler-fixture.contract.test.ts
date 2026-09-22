import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BpmnModdle, type Definitions } from "bpmn-moddle";
import { describe, expect, it } from "vitest";
import {
  auditExternalBpmnFixtureDirectory,
  assertBoundedMultiVendorFixtureEvidence,
  assertUniqueExternalFixtureClaims,
  loadExternalBpmnFixture,
  validateExternalBpmnFixtureManifest,
  type ExternalBpmnFixtureManifest,
  type TrustedExternalFixtureComparison,
} from "../../../../tests/support/external-bpmn-fixture";
import type { BpmnProfileId } from "../../domain/core-profile";
import { inspectBpmnXml } from "./inspect-bpmn-xml";

const fixtureDirectory = resolve(process.cwd(), "tests/fixtures/external");

const fixtureCases: readonly {
  readonly name: string;
  readonly fixture: string;
  readonly predecessorProfile: BpmnProfileId | null;
  readonly predecessorRuleId: string | null;
  readonly predecessorEvidence?: {
    readonly exactRuleIds: readonly string[];
    readonly elementId: string;
    readonly elementRuleIds: readonly string[];
  };
  readonly expectedTebElements?: readonly Record<string, unknown>[];
  readonly expectedTebRegistry?: readonly Record<string, unknown>[];
}[] = [
  {
    name: "Camunda Collaboration",
    fixture: "camunda-modeler-collaboration.bpmn",
    predecessorProfile: null,
    predecessorRuleId: null,
    expectedTebElements: [
      { id: "Collaboration_1hcwsxy", type: "bpmn:Collaboration" },
      { id: "Process_1tp2lk4", type: "bpmn:Process" },
      { id: "StartEvent_1", type: "bpmn:StartEvent" },
    ],
    expectedTebRegistry: [],
  },
  {
    name: "bpmn-js expanded SubProcess",
    fixture: "bpmn-js-expanded-subprocess.bpmn",
    predecessorProfile: "teb-core-full-authoring@1",
    predecessorRuleId: "BPMN-PROFILE-003",
    expectedTebElements: [
      { id: "SubProcess_1", type: "bpmn:SubProcess", parentContainerId: "Process_1" },
      { id: "StartEvent_1", type: "bpmn:StartEvent", parentContainerId: "SubProcess_1" },
      { id: "Task_1", type: "bpmn:Task", parentContainerId: "SubProcess_1" },
      { id: "SequenceFlow_1", type: "bpmn:SequenceFlow", parentContainerId: "SubProcess_1", sourceId: "StartEvent_1", targetId: "Task_1" },
    ],
    expectedTebRegistry: [],
  },
  {
    name: "bpmn-js CallActivity",
    fixture: "bpmn-js-call-activity.bpmn",
    predecessorProfile: "teb-core-full-authoring@1",
    predecessorRuleId: "BPMN-PROFILE-003",
    expectedTebElements: [
      { id: "CallActivity", type: "bpmn:CallActivity", parentContainerId: "Process_1", calledElementId: null },
    ],
    expectedTebRegistry: [],
  },
  {
    name: "bpmn-js DataObject",
    fixture: "bpmn-js-data-object.bpmn",
    predecessorProfile: "teb-core-activity-containers@1",
    predecessorRuleId: "BPMN-PROFILE-003",
    expectedTebElements: [
      { id: "DataObjectReference_1", type: "bpmn:DataObjectReference", parentContainerId: "Process_1", dataObjectRefId: "DataObject_1" },
      { id: "DataOutputAssociation_1", type: "bpmn:DataOutputAssociation", parentContainerId: "Process_1", associationOwnerId: "Task_1", sourceId: "Task_1", targetId: "DataObjectReference_1" },
      { id: "DataInputAssociation_1", type: "bpmn:DataInputAssociation", parentContainerId: "Process_1", associationOwnerId: "Task_2", sourceId: "DataObjectReference_1", targetId: "Task_2" },
    ],
    expectedTebRegistry: [],
  },
  {
    name: "bpmn-js DataStore",
    fixture: "bpmn-js-data-store.bpmn",
    predecessorProfile: "teb-collaboration-activity-containers@1",
    predecessorRuleId: "BPMN-SEC-002",
  },
  {
    name: "bpmn-js Complex Gateway",
    fixture: "bpmn-js-complex-gateway.bpmn",
    predecessorProfile: "teb-core-data-authoring@1",
    predecessorRuleId: "BPMN-PROFILE-003",
  },
  {
    name: "Camunda Modeler Message Catch Event",
    fixture: "camunda-modeler-message-catch.bpmn",
    predecessorProfile: "teb-core-conditional@1",
    predecessorRuleId: "BPMN-PROFILE-003",
    predecessorEvidence: {
      exactRuleIds: ["BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-MSG-004", "BPMN-NAME-001", "BPMN-PROFILE-003", "BPMN-PROFILE-006", "BPMN-XOR-001"],
      elementId: "IntermediateCatchEvent_1",
      elementRuleIds: ["BPMN-NAME-001", "BPMN-PROFILE-003", "BPMN-PROFILE-006"],
    },
  },
  {
    name: "bpmn-js Timer Catch Event",
    fixture: "bpmn-js-timer-catch.bpmn",
    predecessorProfile: null,
    predecessorRuleId: null,
  },
  {
    name: "Camunda Modeler Timer Boundary Event",
    fixture: "camunda-modeler-timer-boundary.bpmn",
    predecessorProfile: "teb-core-intermediate-events@1",
    predecessorRuleId: "BPMN-PROFILE-003",
    predecessorEvidence: {
      exactRuleIds: ["BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-EVT-001", "BPMN-FLOW-001", "BPMN-MSG-004", "BPMN-NAME-001", "BPMN-PROFILE-003", "BPMN-REF-001", "BPMN-THROW-001", "BPMN-TIMER-001", "BPMN-XOR-001"],
      elementId: "BoundaryEvent_1",
      elementRuleIds: ["BPMN-NAME-001", "BPMN-PROFILE-003"],
    },
  },
  {
    name: "BPMN MIWG Reference local CallActivity",
    fixture: "miwg-reference-call-activity-local.bpmn",
    predecessorProfile: null,
    predecessorRuleId: null,
  },
  {
    name: "BPMN MIWG SAP Signavio Message Catch Event",
    fixture: "miwg-signavio-message-catch.bpmn",
    predecessorProfile: null,
    predecessorRuleId: null,
  },
] as const;

type TrustedFixtureClaim = {
  readonly id: string;
  readonly feature: string;
  readonly minimumTebProfile: BpmnProfileId;
  readonly predecessorProfile: BpmnProfileId | null;
  readonly expectedTeb: {
    readonly accepted: boolean;
    readonly safeToPersist: boolean;
    readonly readyToSeal: boolean;
    readonly ruleIds: readonly string[];
  };
  readonly semanticKeys: readonly string[];
  readonly propertyKeys: readonly string[];
  readonly referenceKeys: readonly string[];
  readonly eventDefinitionKeys: readonly string[];
  readonly shapeKeys: readonly string[];
  readonly edgeKeys: readonly string[];
  readonly claimTextDigest: string;
  readonly licenseKey: string;
};

type TrustedFixtureClaimCore = Omit<
  TrustedFixtureClaim,
  "claimTextDigest" | "licenseKey"
>;

const trustedClaims: Readonly<Record<string, TrustedFixtureClaimCore>> = {
  "camunda-modeler-collaboration.bpmn": {
    id: "camunda-modeler-collaboration-core-v1",
    feature: "collaboration",
    minimumTebProfile: "teb-collaboration-starter@1",
    predecessorProfile: null,
    expectedTeb: { accepted: true, safeToPersist: true, readyToSeal: false, ruleIds: ["BPMN-COLLAB-NAME-001", "BPMN-CONNECT-001", "BPMN-MESSAGE-003"] },
    semanticKeys: ["Collaboration_1hcwsxy|bpmn:Collaboration|Definitions_0m3i0zk", "Participant_06rtacw|bpmn:Participant|Collaboration_1hcwsxy", "Process_1tp2lk4|bpmn:Process|Definitions_0m3i0zk", "StartEvent_1|bpmn:StartEvent|Process_1tp2lk4"],
    propertyKeys: [],
    referenceKeys: ["Participant_06rtacw|processRef|Process_1tp2lk4"],
    eventDefinitionKeys: [],
    shapeKeys: ["Participant_06rtacw_di|Participant_06rtacw|", "_BPMNShape_StartEvent_2|StartEvent_1|"],
    edgeKeys: [],
  },
  "bpmn-js-expanded-subprocess.bpmn": {
    id: "bpmn-js-expanded-subprocess-v18-22-1",
    feature: "expanded-subprocess",
    minimumTebProfile: "teb-core-activity-containers@1",
    predecessorProfile: "teb-core-full-authoring@1",
    expectedTeb: { accepted: true, safeToPersist: true, readyToSeal: false, ruleIds: ["BPMN-CONNECT-001", "BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-NAME-001", "BPMN-SUBPROCESS-003"] },
    semanticKeys: ["SubProcess_1|bpmn:SubProcess|Process_1", "StartEvent_1|bpmn:StartEvent|SubProcess_1", "Task_1|bpmn:Task|SubProcess_1", "SequenceFlow_1|bpmn:SequenceFlow|SubProcess_1"],
    propertyKeys: [],
    referenceKeys: ["SequenceFlow_1|sourceRef|StartEvent_1", "SequenceFlow_1|targetRef|Task_1"],
    eventDefinitionKeys: [],
    shapeKeys: ["SubProcess_1_di|SubProcess_1|true", "StartEvent_1_di|StartEvent_1|", "Task_1_di|Task_1|"],
    edgeKeys: ["SequenceFlow_1_di|SequenceFlow_1|2"],
  },
  "bpmn-js-call-activity.bpmn": {
    id: "bpmn-js-call-activity-v18-22-1",
    feature: "call-activity",
    minimumTebProfile: "teb-core-activity-containers@1",
    predecessorProfile: "teb-core-full-authoring@1",
    expectedTeb: { accepted: true, safeToPersist: true, readyToSeal: false, ruleIds: ["BPMN-CALL-001", "BPMN-CONNECT-001", "BPMN-CONNECT-002", "BPMN-CONNECT-003"] },
    semanticKeys: ["CallActivity|bpmn:CallActivity|Process_1"],
    propertyKeys: ["CallActivity|name|\"A\""],
    referenceKeys: [],
    eventDefinitionKeys: [],
    shapeKeys: ["CallActivity_di|CallActivity|"],
    edgeKeys: [],
  },
  "bpmn-js-data-object.bpmn": {
    id: "bpmn-js-data-object-v18-22-1",
    feature: "data-object",
    minimumTebProfile: "teb-core-data-authoring@1",
    predecessorProfile: "teb-core-activity-containers@1",
    expectedTeb: { accepted: true, safeToPersist: true, readyToSeal: false, ruleIds: ["BPMN-CONNECT-001", "BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-NAME-001"] },
    semanticKeys: ["DataObject_1|bpmn:DataObject|Process_1", "DataObjectReference_1|bpmn:DataObjectReference|Process_1", "DataOutputAssociation_1|bpmn:DataOutputAssociation|Task_1", "DataInputAssociation_1|bpmn:DataInputAssociation|Task_2"],
    propertyKeys: [],
    referenceKeys: ["DataObjectReference_1|dataObjectRef|DataObject_1", "DataOutputAssociation_1|targetRef|DataObjectReference_1", "DataInputAssociation_1|sourceRef|DataObjectReference_1"],
    eventDefinitionKeys: [],
    shapeKeys: ["DataObjectReference_1_di|DataObjectReference_1|"],
    edgeKeys: ["DataOutputAssociation_1_di|DataOutputAssociation_1|2", "DataInputAssociation_1_di|DataInputAssociation_1|2"],
  },
  "bpmn-js-data-store.bpmn": {
    id: "bpmn-js-data-store-v18-22-1",
    feature: "data-store",
    minimumTebProfile: "teb-collaboration-data-authoring@1",
    predecessorProfile: "teb-collaboration-activity-containers@1",
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-SEC-002"] },
    semanticKeys: ["DataStore_1|bpmn:DataStore|Definitions_1", "DataStoreReference|bpmn:DataStoreReference|Process"],
    propertyKeys: ["DataStoreReference|name|\"Data Store\""],
    referenceKeys: ["DataStoreReference|dataStoreRef|DataStore_1"],
    eventDefinitionKeys: [],
    shapeKeys: ["_BPMNShape_DataStoreReference_3|DataStoreReference|"],
    edgeKeys: [],
  },
  "bpmn-js-complex-gateway.bpmn": {
    id: "bpmn-js-complex-gateway-v18-22-1",
    feature: "complex-gateway",
    minimumTebProfile: "teb-core-complex-routing@1",
    predecessorProfile: "teb-core-data-authoring@1",
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-COMPLEX-001", "BPMN-COMPLEX-002", "BPMN-COMPLEX-003", "BPMN-COMPLEX-004", "BPMN-CONNECT-001", "BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-DEFAULT-001", "BPMN-NAME-001"] },
    semanticKeys: ["ComplexGateway_1|bpmn:ComplexGateway|Process_1", "SequenceFlow_1|bpmn:SequenceFlow|Process_1", "SequenceFlow_2|bpmn:SequenceFlow|Process_1"],
    propertyKeys: [],
    referenceKeys: ["ComplexGateway_1|default|SequenceFlow_1", "ComplexGateway_1|outgoing|SequenceFlow_1,SequenceFlow_2"],
    eventDefinitionKeys: [],
    shapeKeys: ["ComplexGateway_1_di|ComplexGateway_1|"],
    edgeKeys: ["SequenceFlow_1_di|SequenceFlow_1|2", "SequenceFlow_2_di|SequenceFlow_2|2"],
  },
  "camunda-modeler-message-catch.bpmn": {
    id: "camunda-modeler-message-catch-3-5-0",
    feature: "message-catch-event",
    minimumTebProfile: "teb-core-catching-events@1",
    predecessorProfile: "teb-core-conditional@1",
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-EVT-001", "BPMN-MSG-004", "BPMN-NAME-001", "BPMN-PROFILE-003", "BPMN-XOR-001"] },
    semanticKeys: ["Message_1|bpmn:Message|Definitions_1", "IntermediateCatchEvent_1|bpmn:IntermediateCatchEvent|Process_1", "MessageEventDefinition_1kowj0h|bpmn:MessageEventDefinition|IntermediateCatchEvent_1"],
    propertyKeys: [],
    referenceKeys: ["MessageEventDefinition_1kowj0h|messageRef|Message_1"],
    eventDefinitionKeys: ["IntermediateCatchEvent_1|MessageEventDefinition_1kowj0h|MESSAGE|Message_1"],
    shapeKeys: ["Event_0rpxpya_di|IntermediateCatchEvent_1|"],
    edgeKeys: [],
  },
  "bpmn-js-timer-catch.bpmn": {
    id: "bpmn-js-timer-catch-4-0-0-beta-1",
    feature: "timer-catch-event",
    minimumTebProfile: "teb-core-catching-events@1",
    predecessorProfile: null,
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-SEC-002"] },
    semanticKeys: ["sid-41E98E3E-9EEB-43E2-B1EA-4802BC3CF842|bpmn:IntermediateCatchEvent|Process_1", "sid-153c1db4-e6d3-4f4b-83a6-fa1eeff24547|bpmn:TimerEventDefinition|sid-41E98E3E-9EEB-43E2-B1EA-4802BC3CF842"],
    propertyKeys: [],
    referenceKeys: [],
    eventDefinitionKeys: ["sid-41E98E3E-9EEB-43E2-B1EA-4802BC3CF842|sid-153c1db4-e6d3-4f4b-83a6-fa1eeff24547|TIMER||"],
    shapeKeys: ["sid-41E98E3E-9EEB-43E2-B1EA-4802BC3CF842_gui|sid-41E98E3E-9EEB-43E2-B1EA-4802BC3CF842|"],
    edgeKeys: [],
  },
  "camunda-modeler-timer-boundary.bpmn": {
    id: "camunda-modeler-timer-boundary-5-23-0",
    feature: "boundary-event",
    minimumTebProfile: "teb-core-boundary-events@1",
    predecessorProfile: "teb-core-intermediate-events@1",
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-BOUNDARY-002", "BPMN-BOUNDARY-003", "BPMN-CONNECT-002", "BPMN-CONNECT-003", "BPMN-EVT-001", "BPMN-FLOW-001", "BPMN-MSG-004", "BPMN-NAME-001", "BPMN-PROFILE-003", "BPMN-REF-001", "BPMN-THROW-001", "BPMN-TIMER-001", "BPMN-XOR-001"] },
    semanticKeys: ["Task_1|bpmn:Task|Process_1", "BoundaryEvent_1|bpmn:BoundaryEvent|Process_1"],
    propertyKeys: ["BoundaryEvent_1|cancelActivity|false|explicit"],
    referenceKeys: ["BoundaryEvent_1|attachedToRef|Task_1"],
    eventDefinitionKeys: ["BoundaryEvent_1||TIMER|DURATION|P1D"],
    shapeKeys: ["Task_1_di|Task_1|", "BoundaryEvent_1_di|BoundaryEvent_1|"],
    edgeKeys: [],
  },
  "miwg-reference-call-activity-local.bpmn": {
    id: "miwg-reference-call-activity-local-c5",
    feature: "call-activity-local-target",
    minimumTebProfile: "teb-core-activity-containers@1",
    predecessorProfile: null,
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-PROFILE-004"] },
    semanticKeys: ["_3d1ef204-2d4c-4643-8fc5-c319cc032ec0|bpmn:Process|_5f5fbc02-46c1-4615-b2bd-89b2d938ac0b", "_b9338c62-a257-47dd-8c2e-88b80b73c330|bpmn:CallActivity|_3d1ef204-2d4c-4643-8fc5-c319cc032ec0", "_774bc005-0917-43d5-ab70-0f9fe123fbd1|bpmn:Process|_5f5fbc02-46c1-4615-b2bd-89b2d938ac0b"],
    propertyKeys: ["_b9338c62-a257-47dd-8c2e-88b80b73c330|name|\"Check for connected clients\"|explicit", "_774bc005-0917-43d5-ab70-0f9fe123fbd1|isExecutable|false|effective-bpmn-default"],
    referenceKeys: ["_b9338c62-a257-47dd-8c2e-88b80b73c330|calledElement|_774bc005-0917-43d5-ab70-0f9fe123fbd1"],
    eventDefinitionKeys: [],
    shapeKeys: ["_1a35c023-bfda-41a8-a7a1-65fdaa238623|_b9338c62-a257-47dd-8c2e-88b80b73c330|"],
    edgeKeys: [],
  },
  "miwg-signavio-message-catch.bpmn": {
    id: "miwg-signavio-message-catch-19-9-0",
    feature: "message-catch-event",
    minimumTebProfile: "teb-core-catching-events@1",
    predecessorProfile: null,
    expectedTeb: { accepted: false, safeToPersist: false, readyToSeal: false, ruleIds: ["BPMN-PROFILE-004", "BPMN-SEC-002"] },
    semanticKeys: ["sid-FF72E926-605E-4EF6-9793-6AA4B05B213B|bpmn:IntermediateCatchEvent|sid-C379ECAF-5378-4344-BF9C-2BF7D8B812C6", "sid-26ed7d8d-3d53-4f2d-9844-ef4441edcfca|bpmn:MessageEventDefinition|sid-FF72E926-605E-4EF6-9793-6AA4B05B213B"],
    propertyKeys: [],
    referenceKeys: [],
    eventDefinitionKeys: ["sid-FF72E926-605E-4EF6-9793-6AA4B05B213B|sid-26ed7d8d-3d53-4f2d-9844-ef4441edcfca|MESSAGE|"],
    shapeKeys: ["sid-FF72E926-605E-4EF6-9793-6AA4B05B213B_gui|sid-FF72E926-605E-4EF6-9793-6AA4B05B213B|"],
    edgeKeys: [],
  },
};

const trustedClaimMetadata: Readonly<
  Record<string, Pick<TrustedFixtureClaim, "claimTextDigest" | "licenseKey">>
> = {
  "bpmn-js-call-activity.bpmn": { claimTextDigest: "0f1d81a448b7d7b7e920832f658ada827056d333efdbdc09d6fe0e378a9c184e", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "bpmn-js-complex-gateway.bpmn": { claimTextDigest: "facd68d72e1ab317ffcb1295f45ed52883e9756f205d1573211ddee7c535a840", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "bpmn-js-data-object.bpmn": { claimTextDigest: "5dcaa99c9c91090d5e0cdd697e05a5a1bccbbd28b103a530b8d73a155bb21b68", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "bpmn-js-data-store.bpmn": { claimTextDigest: "5040e511275492b22284a370a682a65c5522a5aa184097734accef137e043c2f", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "bpmn-js-expanded-subprocess.bpmn": { claimTextDigest: "4a3e5b795eaa575d62cec0674c87ba7f4bcd6381213afff1faf5c9888f535e0a", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "bpmn-js-timer-catch.bpmn": { claimTextDigest: "25029021c624b153fc3280f46c7d0eef2287c9798865b092e085bbc9b99ee684", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "camunda-modeler-collaboration.bpmn": { claimTextDigest: "e2389bfef72b702662d1e79885940accc3b34ed69c95dc630116b95b63f41183", licenseKey: "MIT|https://github.com/camunda/camunda-modeler/blob/9614b85d3073ea0f91233d473ed24c91ac2d4db1/LICENSE" },
  "camunda-modeler-message-catch.bpmn": { claimTextDigest: "d3bd6f83dddfcaa90389abc029f6a8f194822fbd28846805c2d127bdcc593b20", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "camunda-modeler-timer-boundary.bpmn": { claimTextDigest: "f72b3ed54e812b2386567bc353a2ae37a3c59622598ee3a62b4ebd4a7129e92e", licenseKey: "LicenseRef-bpmn-io|https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE" },
  "miwg-reference-call-activity-local.bpmn": { claimTextDigest: "1517e58afd5e2711f25a0e65e1094dd5094d9747c97b17739a2b0106f6281c73", licenseKey: "CC-BY-3.0|https://github.com/bpmn-miwg/bpmn-miwg-test-suite/blob/cb2629519cee6280ab521f99dc46a9815a221a35/LICENSE.txt" },
  "miwg-signavio-message-catch.bpmn": { claimTextDigest: "be5e5de4dcac6ce4af22fc4047b910aaa07b03f2dfad77577f5913b9761a0af7", licenseKey: "CC-BY-3.0|https://github.com/bpmn-miwg/bpmn-miwg-test-suite/blob/cb2629519cee6280ab521f99dc46a9815a221a35/LICENSE.txt" },
};

const trustedOverlapMatrix = [
  {
    fixture: "camunda-modeler-message-catch.bpmn",
    claimId: "camunda-modeler-message-catch-3-5-0",
    feature: "message-catch-event",
    cohortId: "message-catch-owner-definition-di-v1",
    producerFamily: "bpmn-io",
    modelerFamily: "camunda-modeler",
    scope: "message-catch-owner-definition-di",
    integrity: "0eb15ec6fad34029d173ee7d87f559d14192f260f14f9b908ad66b48a1ecae52",
    repository: "https://github.com/bpmn-io/bpmn-js",
    officialSource: "https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/test/spec/features/modeling/behavior/LabelBehavior.bpmn",
    licenseSource: "https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE",
    licenseSpdx: "LicenseRef-bpmn-io",
    tool: "Camunda Modeler",
  },
  {
    fixture: "miwg-signavio-message-catch.bpmn",
    claimId: "miwg-signavio-message-catch-19-9-0",
    feature: "message-catch-event",
    cohortId: "message-catch-owner-definition-di-v1",
    producerFamily: "sap-signavio",
    modelerFamily: "signavio-process-editor",
    scope: "message-catch-owner-definition-di",
    integrity: "1efecf52906a7d3598ee49e0929133ed46bd76bbd83ec71290948c1ada44e02b",
    repository: "https://github.com/bpmn-miwg/bpmn-miwg-test-suite",
    officialSource: "https://github.com/bpmn-miwg/bpmn-miwg-test-suite/blob/cb2629519cee6280ab521f99dc46a9815a221a35/SAP%20Signavio%20Process%20Manager%2019.9.0/C.1.0-export.bpmn",
    licenseSource: "https://github.com/bpmn-miwg/bpmn-miwg-test-suite/blob/cb2629519cee6280ab521f99dc46a9815a221a35/LICENSE.txt",
    licenseSpdx: "CC-BY-3.0",
    tool: "Signavio Process Editor, http://www.signavio.com",
  },
] as const satisfies readonly TrustedExternalFixtureComparison[];

function trustedClaimProjection(
  manifest: ExternalBpmnFixtureManifest,
  predecessorProfile: BpmnProfileId | null,
): TrustedFixtureClaim {
  const claim = manifest.claimBoundary;
  return {
    id: claim.id,
    feature: claim.feature,
    minimumTebProfile: claim.minimumTebProfile,
    predecessorProfile,
    expectedTeb: claim.expectedTeb,
    semanticKeys: claim.semanticAssertions.map((item) => `${item.id}|${item.type}|${item.parentId ?? ""}`),
    propertyKeys: claim.propertyAssertions.map((item) =>
      `${item.elementId}|${item.property}|${JSON.stringify(item.value)}${item.valueSource ? `|${item.valueSource}` : ""}`,
    ),
    referenceKeys: claim.referenceAssertions.map((item) => `${item.elementId}|${item.property}|${item.targetIds.join(",")}`),
    eventDefinitionKeys: (claim.eventDefinitionAssertions ?? []).map((item) =>
      item.kind === "MESSAGE"
        ? `${item.ownerId}|${item.definitionId ?? ""}|MESSAGE|${item.messageRefId ?? ""}`
        : `${item.ownerId}|${item.definitionId ?? ""}|TIMER|${item.timerKind ?? ""}|${item.expression ?? ""}`,
    ),
    shapeKeys: claim.di.shapes.map((item) => `${item.id}|${item.elementId}|${item.isExpanded ?? ""}`),
    edgeKeys: claim.di.edges.map((item) => `${item.id}|${item.elementId}|${item.minimumWaypoints}`),
    claimTextDigest: createHash("sha256")
      .update(`${manifest.independenceBasis}\n${claim.statement}`)
      .digest("hex"),
    licenseKey: `${manifest.license.spdx}|${manifest.license.source}`,
  };
}

function trustedClaimExpectation(fixture: string): TrustedFixtureClaim | undefined {
  const claim = trustedClaims[fixture];
  const metadata = trustedClaimMetadata[fixture];
  return claim && metadata ? { ...claim, ...metadata } : undefined;
}

function assertTrustedClaim(actual: TrustedFixtureClaim, expected: TrustedFixtureClaim) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Manifest claim boundary drifted from the trusted fixture matrix");
  }
}

type FixtureElement = {
  readonly id?: string;
  readonly $type?: string;
  readonly $parent?: FixtureElement;
  readonly bounds?: {
    readonly x?: number;
    readonly y?: number;
    readonly width?: number;
    readonly height?: number;
  };
  readonly waypoint?: readonly {
    readonly x?: number;
    readonly y?: number;
  }[];
  readonly bpmnElement?: FixtureElement;
  readonly isExpanded?: boolean;
  readonly eventDefinitions?: readonly FixtureElement[];
  readonly messageRef?: FixtureElement;
  readonly timeDate?: { readonly body?: unknown };
  readonly timeDuration?: { readonly body?: unknown };
  readonly processRef?: FixtureElement;
  readonly planeElement?: FixtureElement;
  readonly [property: string]: unknown;
};

function referenceIds(value: unknown): readonly string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((candidate) => {
    if (typeof candidate === "string") return candidate;
    if (
      candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string"
    ) {
      return candidate.id;
    }
    throw new Error("Declared fixture reference did not resolve to a stable ID");
  });
}

function projectDeclaredFixture(
  elementsById: Readonly<Record<string, unknown>>,
  manifest: ExternalBpmnFixtureManifest,
) {
  const elements = elementsById as Readonly<Record<string, FixtureElement>>;
  const claim = manifest.claimBoundary;
  const semanticAssertions = claim.semanticAssertions.map((assertion) => {
    const element = elements[assertion.id];
    if (!element) throw new Error(`Missing declared element ${assertion.id}`);
    return {
      id: element.id,
      type: element.$type,
      ...(assertion.parentId ? { parentId: element.$parent?.id } : {}),
    };
  });
  const propertyAssertions = claim.propertyAssertions.map((assertion) => {
    const rawValue = elements[assertion.elementId]?.[assertion.property];
    const value = assertion.valueSource === "absent"
      ? null
      : assertion.valueSource === "effective-bpmn-default"
        ? assertion.property === "cancelActivity"
          ? rawValue !== false
          : assertion.property === "isExecutable"
            ? rawValue === true
            : rawValue
        : rawValue;
    return {
      elementId: assertion.elementId,
      property: assertion.property,
      value,
      ...(assertion.valueSource ? { valueSource: assertion.valueSource } : {}),
    };
  });
  const referenceAssertions = claim.referenceAssertions.map((assertion) => ({
    elementId: assertion.elementId,
    property: assertion.property,
    targetIds: referenceIds(elements[assertion.elementId]?.[assertion.property]),
  }));
  const eventDefinitionAssertions = (claim.eventDefinitionAssertions ?? []).map(
    (assertion) => {
      const owner = elements[assertion.ownerId];
      if (!owner) throw new Error(`Missing declared event owner ${assertion.ownerId}`);
      const definitions = owner.eventDefinitions ?? [];
      const definition = assertion.definitionId === null
        ? definitions.length === 1 && !definitions[0]?.id
          ? definitions[0]
          : undefined
        : definitions.find((candidate) => candidate.id === assertion.definitionId);
      if (!definition) {
        throw new Error("Declared event definition did not resolve inside its owner");
      }
      if (assertion.kind === "MESSAGE") {
        if (definition.$type !== "bpmn:MessageEventDefinition") {
          throw new Error("Declared Message event definition has the wrong type");
        }
        return {
          ownerId: assertion.ownerId,
          definitionId: definition.id ?? null,
          kind: "MESSAGE" as const,
          messageRefId: definition.messageRef?.id ?? null,
        };
      }
      if (definition.$type !== "bpmn:TimerEventDefinition") {
        throw new Error("Declared Timer event definition has the wrong type");
      }
      const timeDate = typeof definition.timeDate?.body === "string"
        ? definition.timeDate.body
        : null;
      const timeDuration = typeof definition.timeDuration?.body === "string"
        ? definition.timeDuration.body
        : null;
      if (timeDate !== null && timeDuration !== null) {
        throw new Error("Declared Timer event contains more than one supported expression");
      }
      return {
        ownerId: assertion.ownerId,
        definitionId: definition.id ?? null,
        kind: "TIMER" as const,
        timerKind: timeDate !== null ? "DATE" as const : timeDuration !== null
          ? "DURATION" as const
          : null,
        expression: timeDate ?? timeDuration,
      };
    },
  );
  const shapes = claim.di.shapes.map((assertion) => {
    const shape = elements[assertion.id];
    if (!shape?.bounds) throw new Error(`Missing declared shape ${assertion.id}`);
    const bounds = {
      x: shape.bounds.x,
      y: shape.bounds.y,
      width: shape.bounds.width,
      height: shape.bounds.height,
    };
    expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    return {
      id: shape.id,
      elementId: shape.bpmnElement?.id,
      bounds,
      ...(assertion.isExpanded !== undefined
        ? { isExpanded: shape.isExpanded }
        : {}),
    };
  });
  if (claim.feature === "boundary-event") {
    const boundaryId = claim.semanticAssertions.find(
      (assertion) => assertion.type === "bpmn:BoundaryEvent",
    )?.id;
    const hostId = claim.referenceAssertions.find(
      (assertion) =>
        assertion.elementId === boundaryId &&
        assertion.property === "attachedToRef",
    )?.targetIds[0];
    const boundaryShape = shapes.find((shape) => shape.elementId === boundaryId);
    const hostShape = shapes.find((shape) => shape.elementId === hostId);
    if (!boundaryShape || !hostShape) {
      throw new Error("Boundary DI claim must include both boundary and host shapes");
    }
    const boundaryBounds = boundaryShape.bounds;
    const hostBounds = hostShape.bounds;
    const boundaryCenter = {
      x: boundaryBounds.x! + boundaryBounds.width! / 2,
      y: boundaryBounds.y! + boundaryBounds.height! / 2,
    };
    const hostRight = hostBounds.x! + hostBounds.width!;
    const hostBottom = hostBounds.y! + hostBounds.height!;
    const intersects =
      boundaryBounds.x! <= hostRight &&
      boundaryBounds.x! + boundaryBounds.width! >= hostBounds.x! &&
      boundaryBounds.y! <= hostBottom &&
      boundaryBounds.y! + boundaryBounds.height! >= hostBounds.y!;
    const tolerance = 1;
    const centerWithinHostSpan =
      boundaryCenter.x >= hostBounds.x! - tolerance &&
      boundaryCenter.x <= hostRight + tolerance &&
      boundaryCenter.y >= hostBounds.y! - tolerance &&
      boundaryCenter.y <= hostBottom + tolerance;
    const perimeterDistance = Math.min(
      Math.abs(boundaryCenter.x - hostBounds.x!),
      Math.abs(boundaryCenter.x - hostRight),
      Math.abs(boundaryCenter.y - hostBounds.y!),
      Math.abs(boundaryCenter.y - hostBottom),
    );
    expect(intersects).toBe(true);
    expect(centerWithinHostSpan).toBe(true);
    expect(perimeterDistance).toBeLessThanOrEqual(tolerance);
  }
  const edges = claim.di.edges.map((assertion) => {
    const edge = elements[assertion.id];
    if (!edge?.waypoint) throw new Error(`Missing declared edge ${assertion.id}`);
    expect(edge.waypoint.length).toBeGreaterThanOrEqual(assertion.minimumWaypoints);
    expect(
      edge.waypoint.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
    ).toBe(true);
    return {
      id: edge.id,
      elementId: edge.bpmnElement?.id,
      waypoints: edge.waypoint.map((point) => ({ x: point.x, y: point.y })),
    };
  });
  return {
    semanticAssertions,
    propertyAssertions,
    referenceAssertions,
    eventDefinitionAssertions,
    shapes,
    edges,
  };
}

function expectedDeclaredFixture(manifest: ExternalBpmnFixtureManifest) {
  const claim = manifest.claimBoundary;
  return {
    semanticAssertions: claim.semanticAssertions,
    propertyAssertions: claim.propertyAssertions,
    referenceAssertions: claim.referenceAssertions,
    eventDefinitionAssertions: claim.eventDefinitionAssertions ?? [],
    shapes: claim.di.shapes.map((shape) => ({
      id: shape.id,
      elementId: shape.elementId,
      bounds: expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      }),
      ...(shape.isExpanded !== undefined
        ? { isExpanded: shape.isExpanded }
        : {}),
    })),
    edges: claim.di.edges.map((edge) => ({
      id: edge.id,
      elementId: edge.elementId,
      waypoints: expect.any(Array),
    })),
  };
}

function assertDeclaredLocalCallActivityTarget(
  elementsById: Readonly<Record<string, unknown>>,
  manifest: ExternalBpmnFixtureManifest,
) {
  if (manifest.claimBoundary.feature !== "call-activity-local-target") return;
  const elements = elementsById as Readonly<Record<string, FixtureElement>>;
  const callClaim = manifest.claimBoundary.semanticAssertions.find(
    (assertion) => assertion.type === "bpmn:CallActivity",
  );
  const calledElementClaim = manifest.claimBoundary.referenceAssertions.find(
    (assertion) =>
      assertion.elementId === callClaim?.id && assertion.property === "calledElement",
  );
  const call = callClaim ? elements[callClaim.id] : undefined;
  const caller = call?.$parent;
  const targetId = calledElementClaim?.targetIds[0];
  const target = targetId ? elements[targetId] : undefined;
  const allElements = Object.values(elements);
  expect(call?.$type).toBe("bpmn:CallActivity");
  expect(caller?.$type).toBe("bpmn:Process");
  expect(target?.$type).toBe("bpmn:Process");
  expect(target?.id).not.toBe(caller?.id);
  expect(target?.$parent?.$type).toBe("bpmn:Definitions");
  expect(target?.isExecutable).not.toBe(true);
  expect(
    allElements.some(
      (element) =>
        element.$type === "bpmn:Participant" &&
        element.processRef?.id === target?.id,
    ),
  ).toBe(false);
}

describe("immutable external BPMN fixture corpus", () => {
  const loadedFixtures = fixtureCases.map((fixtureCase) => ({
    ...fixtureCase,
    ...loadExternalBpmnFixture(fixtureDirectory, fixtureCase.fixture),
  }));

  it("uses one valid provenance/checksum/claim boundary per fixture", () => {
    expect(auditExternalBpmnFixtureDirectory(fixtureDirectory)).toHaveLength(
      fixtureCases.length,
    );
    expect(() =>
      assertUniqueExternalFixtureClaims(
        loadedFixtures.map((fixture) => fixture.manifest),
      ),
    ).not.toThrow();
    expect(loadedFixtures.map((fixture) => fixture.manifest.claimBoundary.id))
      .toHaveLength(fixtureCases.length);
  });

  it("pins one bounded Message Catch overlap to two independent modeler families", () => {
    const manifests = loadedFixtures.map((fixture) => fixture.manifest);
    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(manifests, trustedOverlapMatrix),
    ).not.toThrow();

    const sameFamilyManifests = structuredClone(manifests);
    const sameFamilyTrusted: TrustedExternalFixtureComparison[] =
      trustedOverlapMatrix.map((entry) => ({ ...entry }));
    const signavioManifest = sameFamilyManifests.find(
      (manifest) => manifest.fixture === "miwg-signavio-message-catch.bpmn",
    )!;
    signavioManifest.comparisonEvidence!.producerFamily = "bpmn-io";
    signavioManifest.comparisonEvidence!.modelerFamily = "camunda-modeler";
    sameFamilyTrusted[1] = {
      ...sameFamilyTrusted[1]!,
      producerFamily: "bpmn-io",
      modelerFamily: "camunda-modeler",
    };
    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(
        sameFamilyManifests,
        sameFamilyTrusted,
      ),
    ).toThrow(/independent producer and modeler families/u);

    const sameSourceManifests = structuredClone(manifests);
    const sameSourceTrusted: TrustedExternalFixtureComparison[] =
      trustedOverlapMatrix.map((entry) => ({ ...entry }));
    const sameSourceSignavio = sameSourceManifests.find(
      (manifest) => manifest.fixture === "miwg-signavio-message-catch.bpmn",
    )!;
    sameSourceSignavio.source.repository = trustedOverlapMatrix[0].repository;
    sameSourceSignavio.producerEvidence.tool = trustedOverlapMatrix[0].tool;
    sameSourceTrusted[1] = {
      ...sameSourceTrusted[1]!,
      repository: trustedOverlapMatrix[0].repository,
      tool: trustedOverlapMatrix[0].tool,
    };
    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(
        sameSourceManifests,
        sameSourceTrusted,
      ),
    ).toThrow(/independent repositories and tools/u);

    const duplicateHashManifests = structuredClone(manifests);
    const duplicateHashTrusted: TrustedExternalFixtureComparison[] =
      trustedOverlapMatrix.map((entry) => ({ ...entry }));
    const duplicateHashSignavio = duplicateHashManifests.find(
      (manifest) => manifest.fixture === "miwg-signavio-message-catch.bpmn",
    )!;
    duplicateHashSignavio.integrity.value = trustedOverlapMatrix[0].integrity;
    duplicateHashTrusted[1] = {
      ...duplicateHashTrusted[1]!,
      integrity: trustedOverlapMatrix[0].integrity,
    };
    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(
        duplicateHashManifests,
        duplicateHashTrusted,
      ),
    ).toThrow(/distinct checksums/u);

    const mixedFeatureManifests = structuredClone(manifests);
    const mixedFeatureTrusted: TrustedExternalFixtureComparison[] =
      trustedOverlapMatrix.map((entry) => ({ ...entry }));
    const mixedFeatureSignavio = mixedFeatureManifests.find(
      (manifest) => manifest.fixture === "miwg-signavio-message-catch.bpmn",
    )!;
    mixedFeatureSignavio.claimBoundary.feature = "timer-catch-event";
    mixedFeatureTrusted[1] = {
      ...mixedFeatureTrusted[1]!,
      feature: "timer-catch-event",
    };
    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(
        mixedFeatureManifests,
        mixedFeatureTrusted,
      ),
    ).toThrow(/one bounded feature and scope/u);

    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(manifests, [trustedOverlapMatrix[0]]),
    ).toThrow(/exact trusted matrix/u);

    const manifestOnly = structuredClone(manifests);
    const timer = manifestOnly.find(
      (manifest) => manifest.fixture === "bpmn-js-timer-catch.bpmn",
    )!;
    timer.comparisonEvidence = {
      cohortId: "message-catch-owner-definition-di-v1",
      producerFamily: "untrusted",
      modelerFamily: "untrusted",
      scope: "message-catch-owner-definition-di",
    };
    expect(() =>
      assertBoundedMultiVendorFixtureEvidence(manifestOnly, trustedOverlapMatrix),
    ).toThrow(/exact trusted matrix/u);
  });

  it.each(loadedFixtures)(
    "$name preserves its declared raw moddle projection and records the exact TEB outcome",
    async ({
      xml,
      manifest,
      predecessorProfile,
      predecessorRuleId,
      predecessorEvidence,
      expectedTebElements,
      expectedTebRegistry,
    }) => {
      const trustedClaim = trustedClaimExpectation(manifest.fixture);
      expect(trustedClaim).toBeDefined();
      assertTrustedClaim(
        trustedClaimProjection(manifest, predecessorProfile),
        trustedClaim!,
      );

      const moddle = new BpmnModdle();
      const raw = await moddle.fromXML(xml);
      const rawProjection = projectDeclaredFixture(raw.elementsById, manifest);
      expect(rawProjection).toEqual(expectedDeclaredFixture(manifest));
      assertDeclaredLocalCallActivityTarget(raw.elementsById, manifest);

      const rawSerialization = await moddle.toXML(
        raw.rootElement as Definitions,
        { format: true },
      );
      const rawReparse = await moddle.fromXML(rawSerialization.xml);
      expect(projectDeclaredFixture(rawReparse.elementsById, manifest)).toEqual(
        rawProjection,
      );
      assertDeclaredLocalCallActivityTarget(rawReparse.elementsById, manifest);

      const expectedTeb = manifest.claimBoundary.expectedTeb;
      const inspected = await inspectBpmnXml(
        xml,
        manifest.claimBoundary.minimumTebProfile,
      );
      expect({
        accepted: inspected.accepted,
        safeToPersist: inspected.safeToPersist,
        readyToSeal: inspected.readyToSeal,
        ruleIds: [...new Set(inspected.issues.map((issue) => issue.ruleId))].sort(),
      }).toEqual({
        ...expectedTeb,
        ruleIds: [...expectedTeb.ruleIds].sort(),
      });

      if (expectedTeb.safeToPersist) {
        expect(expectedTebElements).toBeDefined();
        const exactProjection = expectedTebElements!.map((expected) => {
          const element = inspected.snapshot?.elements.find(
            (candidate) => candidate.id === expected.id,
          );
          expect(element).toBeDefined();
          return Object.fromEntries(
            Object.keys(expected).map((key) => [
              key,
              key in (element ?? {})
                ? (element as unknown as Record<string, unknown>)[key]
                : null,
            ]),
          );
        });
        expect(exactProjection).toEqual(expectedTebElements);
        expect(inspected.dataStoreRegistry).toEqual(expectedTebRegistry);
        const canonical = await inspectBpmnXml(
          inspected.canonicalXml ?? "",
          manifest.claimBoundary.minimumTebProfile,
        );
        expect(canonical.snapshot).toEqual(inspected.snapshot);
        expect(canonical.dataStoreRegistry).toEqual(inspected.dataStoreRegistry);
        expect(canonical.canonicalXml).toBe(inspected.canonicalXml);
        const canonicalRaw = await new BpmnModdle().fromXML(
          inspected.canonicalXml ?? "",
        );
        expect(projectDeclaredFixture(canonicalRaw.elementsById, manifest)).toEqual(
          rawProjection,
        );
      } else {
        expect(inspected.canonicalXml).toBeUndefined();
      }

      if (predecessorProfile) {
        const predecessor = await inspectBpmnXml(xml, predecessorProfile);
        expect(predecessor.safeToPersist).toBe(false);
        expect(predecessor.issues.map((issue) => issue.ruleId)).toContain(
          predecessorRuleId,
        );
        if (predecessorEvidence) {
          expect(
            [...new Set(predecessor.issues.map((issue) => issue.ruleId))].sort(),
          ).toEqual([...predecessorEvidence.exactRuleIds].sort());
          expect(
            predecessor.issues
              .filter((issue) => issue.elementId === predecessorEvidence.elementId)
              .map((issue) => issue.ruleId)
              .sort(),
          ).toEqual([...predecessorEvidence.elementRuleIds].sort());
        }
      }
    },
  );

  it("fails closed for tampered bytes, mutable URLs, basename/profile drift and duplicate claims", () => {
    const fixture = loadedFixtures[1]!;
    const rawManifest = JSON.parse(
      readFileSync(
        resolve(
          fixtureDirectory,
          fixture.fixture.replace(/\.bpmn$/u, ".provenance.json"),
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(() =>
      validateExternalBpmnFixtureManifest(
        rawManifest,
        fixture.fixture,
        Buffer.concat([fixture.bytes, Buffer.from("tampered")]),
      ),
    ).toThrow(/SHA-256/u);
    expect(() =>
      validateExternalBpmnFixtureManifest(
        rawManifest,
        "different.bpmn",
        fixture.bytes,
      ),
    ).toThrow(/basename/u);

    const mutableUrl = structuredClone(rawManifest) as {
      source: { officialSource: string };
    };
    mutableUrl.source.officialSource = "https://github.com/bpmn-io/bpmn-js/main/test.bpmn";
    expect(() =>
      validateExternalBpmnFixtureManifest(mutableUrl, fixture.fixture, fixture.bytes),
    ).toThrow(/pinned GitHub source topology/u);

    const wrongHost = structuredClone(rawManifest) as {
      source: { officialSource: string };
    };
    wrongHost.source.officialSource = wrongHost.source.officialSource.replace(
      "github.com",
      "example.com",
    );
    expect(() =>
      validateExternalBpmnFixtureManifest(wrongHost, fixture.fixture, fixture.bytes),
    ).toThrow(/pinned GitHub source topology/u);

    const wrongRepository = structuredClone(rawManifest) as {
      source: { rawSource: string };
    };
    wrongRepository.source.rawSource = wrongRepository.source.rawSource.replace(
      "/bpmn-io/bpmn-js/",
      "/another-owner/bpmn-js/",
    );
    expect(() =>
      validateExternalBpmnFixtureManifest(
        wrongRepository,
        fixture.fixture,
        fixture.bytes,
      ),
    ).toThrow(/same repository/u);

    const unknownProfile = structuredClone(rawManifest) as {
      claimBoundary: { minimumTebProfile: string };
    };
    unknownProfile.claimBoundary.minimumTebProfile = "teb-unknown@1";
    expect(() =>
      validateExternalBpmnFixtureManifest(unknownProfile, fixture.fixture, fixture.bytes),
    ).toThrow(/supported immutable TEB profile/u);

    const missingExclusion = structuredClone(rawManifest) as {
      claimBoundary: { exclusions: string[] };
    };
    missingExclusion.claimBoundary.exclusions.pop();
    expect(() =>
      validateExternalBpmnFixtureManifest(missingExclusion, fixture.fixture, fixture.bytes),
    ).toThrow();

    const unknownLicense = structuredClone(rawManifest) as {
      license: { spdx: string };
    };
    unknownLicense.license.spdx = "LicenseRef-unverified";
    expect(() =>
      validateExternalBpmnFixtureManifest(
        unknownLicense,
        fixture.fixture,
        fixture.bytes,
      ),
    ).toThrow();

    const widenedClaim = structuredClone(rawManifest) as {
      claimBoundary: {
        semanticAssertions: Array<{ id: string; type: string }>;
      };
    };
    widenedClaim.claimBoundary.semanticAssertions.push({
      id: "Unsupported_1",
      type: "bpmn:Transaction",
    });
    expect(() =>
      validateExternalBpmnFixtureManifest(widenedClaim, fixture.fixture, fixture.bytes),
    ).toThrow(/feature allowlist/u);

    const narrowedClaim = structuredClone(rawManifest) as {
      claimBoundary: {
        semanticAssertions: Array<{ id: string; type: string }>;
      };
    };
    narrowedClaim.claimBoundary.semanticAssertions =
      narrowedClaim.claimBoundary.semanticAssertions.filter(
        (assertion) => assertion.type !== "bpmn:SubProcess",
      );
    expect(() =>
      validateExternalBpmnFixtureManifest(narrowedClaim, fixture.fixture, fixture.bytes),
    ).toThrow(/must include bpmn:SubProcess/u);

    const trusted = trustedClaimExpectation(fixture.fixture)!;
    const lateProfile = structuredClone(fixture.manifest);
    Object.assign(lateProfile.claimBoundary, {
      minimumTebProfile: "teb-core-data-authoring@1",
    });
    expect(() =>
      assertTrustedClaim(
        trustedClaimProjection(lateProfile, fixture.predecessorProfile),
        trusted,
      ),
    ).toThrow(/trusted fixture matrix/u);

    const changedOutcome = structuredClone(fixture.manifest);
    changedOutcome.claimBoundary.expectedTeb.readyToSeal = true;
    changedOutcome.claimBoundary.expectedTeb.ruleIds = ["BPMN-CALL-001"];
    expect(() =>
      assertTrustedClaim(
        trustedClaimProjection(changedOutcome, fixture.predecessorProfile),
        trusted,
      ),
    ).toThrow(/trusted fixture matrix/u);

    const rewrittenClaim = structuredClone(fixture.manifest);
    rewrittenClaim.independenceBasis =
      "Untrusted prose that attempts to broaden the independence claim.";
    rewrittenClaim.claimBoundary.statement =
      "Untrusted prose that attempts to broaden the semantic boundary.";
    expect(() =>
      assertTrustedClaim(
        trustedClaimProjection(rewrittenClaim, fixture.predecessorProfile),
        trusted,
      ),
    ).toThrow(/trusted fixture matrix/u);

    const droppedChild = structuredClone(fixture.manifest);
    droppedChild.claimBoundary.semanticAssertions =
      droppedChild.claimBoundary.semanticAssertions.filter(
        (assertion) => assertion.id !== "Task_1",
      );
    expect(() =>
      assertTrustedClaim(
        trustedClaimProjection(droppedChild, fixture.predecessorProfile),
        trusted,
      ),
    ).toThrow(/trusted fixture matrix/u);

    const droppedReference = structuredClone(fixture.manifest);
    droppedReference.claimBoundary.referenceAssertions =
      droppedReference.claimBoundary.referenceAssertions.slice(0, 1);
    expect(() =>
      assertTrustedClaim(
        trustedClaimProjection(droppedReference, fixture.predecessorProfile),
        trusted,
      ),
    ).toThrow(/trusted fixture matrix/u);

    const droppedEdge = structuredClone(fixture.manifest);
    droppedEdge.claimBoundary.di.edges = [];
    expect(() =>
      assertTrustedClaim(
        trustedClaimProjection(droppedEdge, fixture.predecessorProfile),
        trusted,
      ),
    ).toThrow(/trusted fixture matrix/u);

    expect(() =>
      assertUniqueExternalFixtureClaims([fixture.manifest, fixture.manifest]),
    ).toThrow(/unique/u);

    const messageFixture = loadedFixtures.find(
      (candidate) =>
        candidate.manifest.claimBoundary.feature === "message-catch-event" &&
        candidate.manifest.claimBoundary.eventDefinitionAssertions?.[0]?.kind === "MESSAGE" &&
        candidate.manifest.claimBoundary.eventDefinitionAssertions[0].messageRefId !== null,
    )!;
    const orphanMessage = structuredClone(messageFixture.manifest);
    const orphanMessageAssertion = orphanMessage.claimBoundary
      .eventDefinitionAssertions?.[0];
    if (orphanMessageAssertion?.kind === "MESSAGE") {
      orphanMessageAssertion.messageRefId = "Message_missing";
    }
    expect(() =>
      validateExternalBpmnFixtureManifest(
        orphanMessage,
        messageFixture.fixture,
        messageFixture.bytes,
      ),
    ).toThrow(/inside declared semantic IDs/u);
    const mismatchedOwner = structuredClone(messageFixture.manifest);
    mismatchedOwner.claimBoundary.eventDefinitionAssertions![0]!.ownerId =
      "Message_1";
    expect(() =>
      validateExternalBpmnFixtureManifest(
        mismatchedOwner,
        messageFixture.fixture,
        messageFixture.bytes,
      ),
    ).toThrow(/owner must match/u);

    const timerFixture = loadedFixtures.find(
      (candidate) => candidate.manifest.claimBoundary.feature === "timer-catch-event",
    )!;
    const invalidTimer = structuredClone(timerFixture.manifest);
    const invalidTimerAssertion = invalidTimer.claimBoundary
      .eventDefinitionAssertions?.[0];
    if (invalidTimerAssertion?.kind === "TIMER") {
      invalidTimerAssertion.timerKind = "DURATION";
      invalidTimerAssertion.expression = null;
    }
    expect(() =>
      validateExternalBpmnFixtureManifest(
        invalidTimer,
        timerFixture.fixture,
        timerFixture.bytes,
      ),
    ).toThrow(/types must match/u);
    const timerCycle = structuredClone(timerFixture.manifest) as unknown as {
      claimBoundary: {
        eventDefinitionAssertions: Array<{ timerKind: string }>;
      };
    };
    timerCycle.claimBoundary.eventDefinitionAssertions[0]!.timerKind = "CYCLE";
    expect(() =>
      validateExternalBpmnFixtureManifest(
        timerCycle,
        timerFixture.fixture,
        timerFixture.bytes,
      ),
    ).toThrow();

    const boundaryFixture = loadedFixtures.find(
      (candidate) => candidate.manifest.claimBoundary.feature === "boundary-event",
    )!;
    const detachedBoundary = structuredClone(boundaryFixture.manifest);
    detachedBoundary.claimBoundary.referenceAssertions =
      detachedBoundary.claimBoundary.referenceAssertions.filter(
        (assertion) => assertion.property !== "attachedToRef",
      );
    expect(() =>
      validateExternalBpmnFixtureManifest(
        detachedBoundary,
        boundaryFixture.fixture,
        boundaryFixture.bytes,
      ),
    ).toThrow(/supported host/u);

    const callFixture = loadedFixtures.find(
      (candidate) =>
        candidate.manifest.claimBoundary.feature === "call-activity-local-target",
    )!;
    const selfCall = structuredClone(callFixture.manifest);
    const callAssertion = selfCall.claimBoundary.semanticAssertions.find(
      (assertion) => assertion.type === "bpmn:CallActivity",
    )!;
    const calledElement = selfCall.claimBoundary.referenceAssertions.find(
      (assertion) => assertion.property === "calledElement",
    )!;
    calledElement.targetIds = [callAssertion.parentId!];
    expect(() =>
      validateExternalBpmnFixtureManifest(
        selfCall,
        callFixture.fixture,
        callFixture.bytes,
      ),
    ).toThrow(/distinct non-executable/u);
    const executableTarget = structuredClone(callFixture.manifest);
    const executableAssertion = executableTarget.claimBoundary.propertyAssertions.find(
      (assertion) => assertion.property === "isExecutable",
    )!;
    executableAssertion.value = true;
    executableAssertion.valueSource = "explicit";
    expect(() =>
      validateExternalBpmnFixtureManifest(
        executableTarget,
        callFixture.fixture,
        callFixture.bytes,
      ),
    ).toThrow(/distinct non-executable/u);
  });
});
