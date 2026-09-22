import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectBpmnXml } from "../bpmn-io/inspect-bpmn-xml";
import { starterBpmnXml } from "../bpmn-io/starter-model";
import { preflightProcessModelVersionSeal } from "../../application/model-lifecycle-service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
process.env.BETTER_AUTH_SECRET ??= "integration-secret-that-is-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";

const suite = testDatabaseUrl ? describe : describe.skip;
const checksum = createHash("sha256").update(starterBpmnXml).digest("hex");

suite("PrismaProcessModelRepository", () => {
  const ownerId = `owner-${randomUUID()}`;
  const intruderId = `owner-${randomUUID()}`;
  const createdModelIds: string[] = [];

  beforeAll(async () => {
    const { getPrisma } = await import("../../../../platform/database");
    const prisma = getPrisma();
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          name: "BPMN Owner",
          email: `${ownerId}@example.com`,
          emailVerified: true,
          role: "OWNER",
        },
        {
          id: intruderId,
          name: "Other BPMN Owner",
          email: `${intruderId}@example.com`,
          emailVerified: true,
          role: "OWNER",
        },
      ],
    });
  });

  afterAll(async () => {
    const { getPrisma } = await import("../../../../platform/database");
    const prisma = getPrisma();
    if (createdModelIds.length > 0) {
      await prisma.processModelCommandReceipt.deleteMany({
        where: { processModelId: { in: createdModelIds } },
      });
      await prisma.processModelCreateRequest.deleteMany({
        where: { processModelId: { in: createdModelIds } },
      });
      await prisma.processModel.updateMany({
        where: { id: { in: createdModelIds } },
        data: { currentRevisionId: null },
      });
      await prisma.processModelVersion.deleteMany({
        where: { processModelId: { in: createdModelIds } },
      });
      await prisma.processModelRevision.deleteMany({
        where: { processModelId: { in: createdModelIds } },
      });
      await prisma.processModel.deleteMany({ where: { id: { in: createdModelIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, intruderId] } } });
    await prisma.$disconnect();
  });

  it("persists acknowledged revisions, resolves races, seals and restores immutably", async () => {
    const { PrismaProcessModelRepository } = await import(
      "./prisma-process-model-repository"
    );
    const repository = new PrismaProcessModelRepository();
    const content = {
      title: "Editorial review",
      description: "",
      purpose: "AS_IS" as const,
      profileId: "teb-core-starter@1",
      canonicalXml: starterBpmnXml,
      xmlChecksum: checksum,
    };
    const createKey = randomUUID();
    const created = await repository.createModel({
      ownerId,
      idempotencyKey: createKey,
      requestHash: "create-one",
      content,
    });
    expect(created.kind).toBe("acknowledged");
    if (created.kind !== "acknowledged") throw new Error("Expected create.");
    const modelId = created.draft.modelId;
    createdModelIds.push(modelId);

    expect((await repository.createModel({
      ownerId,
      idempotencyKey: createKey,
      requestHash: "create-one",
      content,
    })).kind).toBe("idempotent");
    expect((await repository.createModel({
      ownerId,
      idempotencyKey: createKey,
      requestHash: "changed",
      content,
    })).kind).toBe("idempotency-mismatch");
    expect(await repository.getDraft(intruderId, modelId)).toBeNull();

    const { getPrisma } = await import("../../../../platform/database");
    const prisma = getPrisma();
    const beforeRejectedInspection = {
      model: await prisma.processModel.findUniqueOrThrow({ where: { id: modelId } }),
      revisions: await prisma.processModelRevision.count({ where: { processModelId: modelId } }),
      receipts: await prisma.processModelCommandReceipt.count({ where: { processModelId: modelId } }),
    };
    expect((await inspectBpmnXml("<!DOCTYPE x><x/>")).accepted).toBe(false);
    expect({
      model: await prisma.processModel.findUniqueOrThrow({ where: { id: modelId } }),
      revisions: await prisma.processModelRevision.count({ where: { processModelId: modelId } }),
      receipts: await prisma.processModelCommandReceipt.count({ where: { processModelId: modelId } }),
    }).toEqual(beforeRejectedInspection);

    const beforeFault = await repository.getDraft(ownerId, modelId);
    await expect(repository.saveDraft({
      ownerId,
      modelId,
      expectedRevisionNumber: 1,
      idempotencyKey: randomUUID(),
      requestHash: "forced-db-constraint-failure",
      source: "EDITED",
      content: { ...content, title: "Must roll back", xmlChecksum: "invalid" },
    })).rejects.toBeTruthy();
    expect(await repository.getDraft(ownerId, modelId)).toEqual(beforeFault);
    expect(await prisma.processModelRevision.count({
      where: { processModelId: modelId },
    })).toBe(beforeRejectedInspection.revisions);
    expect(await prisma.processModelCommandReceipt.count({
      where: { processModelId: modelId },
    })).toBe(beforeRejectedInspection.receipts);

    expect((await repository.saveDraft({
      ownerId: intruderId,
      modelId,
      expectedRevisionNumber: 1,
      idempotencyKey: randomUUID(),
      requestHash: "cross-owner-save",
      source: "EDITED",
      content,
    })).kind).toBe("not-found");

    const sameKey = randomUUID();
    const sameSave = {
      ownerId,
      modelId,
      expectedRevisionNumber: 1,
      idempotencyKey: sameKey,
      requestHash: "same-save",
      source: "EDITED" as const,
      content: { ...content, title: "Revision two" },
    };
    const duplicateResults = await Promise.all([
      repository.saveDraft(sameSave),
      repository.saveDraft(sameSave),
    ]);
    expect(duplicateResults.map((result) => result.kind).sort()).toEqual([
      "acknowledged",
      "idempotent",
    ]);
    expect((await repository.saveDraft({
      ...sameSave,
      requestHash: "same-content-different-source",
      source: "IMPORTED",
    })).kind).toBe("idempotency-mismatch");

    const race = await Promise.all([
      repository.saveDraft({
        ...sameSave,
        expectedRevisionNumber: 2,
        idempotencyKey: randomUUID(),
        requestHash: "race-left",
        content: { ...content, title: "Race left" },
      }),
      repository.saveDraft({
        ...sameSave,
        expectedRevisionNumber: 2,
        idempotencyKey: randomUUID(),
        requestHash: "race-right",
        content: { ...content, title: "Race right" },
      }),
    ]);
    expect(race.map((result) => result.kind).sort()).toEqual([
      "acknowledged",
      "conflict",
    ]);

    const beforeStaleRetry = {
      draft: await repository.getDraft(ownerId, modelId),
      revisions: await prisma.processModelRevision.count({
        where: { processModelId: modelId },
      }),
      receipts: await prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId },
      }),
    };
    const staleExactReplay = await repository.saveDraft(sameSave);
    expect(staleExactReplay).toMatchObject({
      kind: "idempotent",
      draft: {
        revisionNumber: 2,
        title: "Revision two",
      },
    });
    expect((await repository.saveDraft({
      ...sameSave,
      expectedRevisionNumber: 2,
    })).kind).toBe("idempotency-mismatch");
    expect((await repository.saveDraft({
      ...sameSave,
      requestHash: "changed-after-later-revision",
      content: { ...sameSave.content, title: "Changed after later revision" },
    })).kind).toBe("idempotency-mismatch");
    expect((await repository.saveDraft({
      ...sameSave,
      idempotencyKey: randomUUID(),
      requestHash: "new-stale-command",
    }))).toEqual({
      kind: "conflict",
      currentRevisionNumber: 3,
    });
    expect({
      draft: await repository.getDraft(ownerId, modelId),
      revisions: await prisma.processModelRevision.count({
        where: { processModelId: modelId },
      }),
      receipts: await prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId },
      }),
    }).toEqual(beforeStaleRetry);

    const sealInput = {
      ownerId,
      modelId,
      expectedRevisionNumber: 3,
      idempotencyKey: randomUUID(),
      requestHash: "seal-one",
      note: "Release candidate",
      operation: "CREATE_VERSION" as const,
    };
    const sealed = await repository.createVersion(sealInput);
    expect(sealed.kind).toBe("acknowledged");
    if (sealed.kind !== "acknowledged") throw new Error("Expected seal.");
    const sourceVersion = sealed.version;
    const sourceDraft = sealed.draft;
    const beforeSealPreconditionReuse = {
      draft: await repository.getDraft(ownerId, modelId),
      revisions: await prisma.processModelRevision.count({
        where: { processModelId: modelId },
      }),
      versions: await prisma.processModelVersion.count({
        where: { processModelId: modelId },
      }),
      receipts: await prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId },
      }),
    };
    expect((await repository.createVersion({
      ...sealInput,
      expectedRevisionNumber: 2,
    })).kind).toBe("idempotency-mismatch");
    expect({
      draft: await repository.getDraft(ownerId, modelId),
      revisions: await prisma.processModelRevision.count({
        where: { processModelId: modelId },
      }),
      versions: await prisma.processModelVersion.count({
        where: { processModelId: modelId },
      }),
      receipts: await prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId },
      }),
    }).toEqual(beforeSealPreconditionReuse);

    const restoreInput = {
      ownerId,
      modelId,
      versionId: sourceVersion.id,
      expectedRevisionNumber: 3,
      idempotencyKey: randomUUID(),
      requestHash: "restore-one",
      operation: "RESTORE_VERSION" as const,
    };
    const restored = await repository.restoreVersion(restoreInput);
    expect(restored.kind).toBe("acknowledged");
    if (restored.kind !== "acknowledged") throw new Error("Expected restore.");
    expect(restored.draft.revisionNumber).toBe(4);
    expect(restored.draft.xmlChecksum).toBe(sourceDraft.xmlChecksum);
    const beforeRestorePreconditionReuse = {
      draft: await repository.getDraft(ownerId, modelId),
      revisions: await prisma.processModelRevision.count({
        where: { processModelId: modelId },
      }),
      versions: await prisma.processModelVersion.count({
        where: { processModelId: modelId },
      }),
      receipts: await prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId },
      }),
    };
    expect((await repository.restoreVersion({
      ...restoreInput,
      expectedRevisionNumber: 4,
    })).kind).toBe("idempotency-mismatch");
    expect({
      draft: await repository.getDraft(ownerId, modelId),
      revisions: await prisma.processModelRevision.count({
        where: { processModelId: modelId },
      }),
      versions: await prisma.processModelVersion.count({
        where: { processModelId: modelId },
      }),
      receipts: await prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId },
      }),
    }).toEqual(beforeRestorePreconditionReuse);

    const versions = await repository.listVersions(ownerId, modelId);
    expect(versions.map((version) => version.versionNumber)).toEqual([1]);
    expect(versions.find((version) => version.id === sourceVersion.id))
      .toMatchObject(sourceVersion);
    expect(await repository.listVersions(intruderId, modelId)).toEqual([]);
  });

  it("persists a recoverable draft but seals only a ready exact revision", async () => {
    const { PrismaProcessModelRepository } = await import(
      "./prisma-process-model-repository"
    );
    const repository = new PrismaProcessModelRepository();
    const incompleteInspection = await inspectBpmnXml(incompleteCoreDraftXml);
    expect(incompleteInspection).toMatchObject({
      safeToPersist: true,
      readyToSeal: false,
    });
    if (!incompleteInspection.canonicalXml) {
      throw new Error("Expected a canonical recoverable draft.");
    }
    const incompleteContent = {
      title: "Work in progress",
      description: "",
      purpose: "TO_BE" as const,
      profileId: "teb-core-starter@1",
      canonicalXml: incompleteInspection.canonicalXml,
      xmlChecksum: createHash("sha256")
        .update(incompleteInspection.canonicalXml)
        .digest("hex"),
    };
    const created = await repository.createModel({
      ownerId,
      idempotencyKey: randomUUID(),
      requestHash: "create-incomplete",
      content: incompleteContent,
    });
    expect(created.kind).toBe("acknowledged");
    if (created.kind !== "acknowledged") throw new Error("Expected create.");
    createdModelIds.push(created.draft.modelId);

    await expect(preflightProcessModelVersionSeal(
      repository,
      inspectBpmnXml,
      {
        ownerId,
        modelId: created.draft.modelId,
        expectedRevisionToken: "bpmn-revision-1",
      },
    )).resolves.toMatchObject({
      kind: "not-ready",
      ruleIds: expect.arrayContaining(["BPMN-CONNECT-001"]),
    });
    expect(await repository.listVersions(ownerId, created.draft.modelId))
      .toEqual([]);

    const readyInspection = await inspectBpmnXml(starterBpmnXml);
    expect(readyInspection.readyToSeal).toBe(true);
    if (!readyInspection.canonicalXml) {
      throw new Error("Expected canonical ready XML.");
    }
    const saved = await repository.saveDraft({
      ownerId,
      modelId: created.draft.modelId,
      expectedRevisionNumber: 1,
      idempotencyKey: randomUUID(),
      requestHash: "complete-draft",
      source: "EDITED",
      content: {
        ...incompleteContent,
        canonicalXml: readyInspection.canonicalXml,
        xmlChecksum: createHash("sha256")
          .update(readyInspection.canonicalXml)
          .digest("hex"),
      },
    });
    expect(saved.kind).toBe("acknowledged");

    await expect(preflightProcessModelVersionSeal(
      repository,
      inspectBpmnXml,
      {
        ownerId,
        modelId: created.draft.modelId,
        expectedRevisionToken: "bpmn-revision-2",
      },
    )).resolves.toEqual({ kind: "ready" });
    const sealed = await repository.createVersion({
      ownerId,
      modelId: created.draft.modelId,
      expectedRevisionNumber: 2,
      idempotencyKey: randomUUID(),
      requestHash: "seal-ready-draft",
      note: "Ready",
      operation: "CREATE_VERSION",
    });
    expect(sealed.kind).toBe("acknowledged");
  });

  it("acknowledges only one mutation when two operations race on one key", async () => {
    const { PrismaProcessModelRepository } = await import(
      "./prisma-process-model-repository"
    );
    const { getPrisma } = await import("../../../../platform/database");
    const repository = new PrismaProcessModelRepository();
    const prisma = getPrisma();
    const content = {
      title: "Cross-operation race",
      description: "",
      purpose: "AS_IS" as const,
      profileId: "teb-core-starter@1",
      canonicalXml: starterBpmnXml,
      xmlChecksum: checksum,
    };
    const created = await repository.createModel({
      ownerId,
      idempotencyKey: randomUUID(),
      requestHash: "create-cross-operation-race",
      content,
    });
    expect(created.kind).toBe("acknowledged");
    if (created.kind !== "acknowledged") throw new Error("Expected create.");
    const modelId = created.draft.modelId;
    createdModelIds.push(modelId);

    const sharedKey = randomUUID();
    const [saved, versioned] = await Promise.all([
      repository.saveDraft({
        ownerId,
        modelId,
        expectedRevisionNumber: 1,
        idempotencyKey: sharedKey,
        requestHash: "save-with-shared-key",
        source: "EDITED",
        content: { ...content, title: "Saved winner" },
      }),
      repository.createVersion({
        ownerId,
        modelId,
        expectedRevisionNumber: 1,
        idempotencyKey: sharedKey,
        requestHash: "version-with-shared-key",
        note: "Milestone winner",
        operation: "CREATE_VERSION",
      }),
    ]);

    expect([saved.kind, versioned.kind].sort()).toEqual([
      "acknowledged",
      "idempotency-mismatch",
    ]);
    const [revisionCount, versionCount, receiptCount] = await Promise.all([
      prisma.processModelRevision.count({ where: { processModelId: modelId } }),
      prisma.processModelVersion.count({ where: { processModelId: modelId } }),
      prisma.processModelCommandReceipt.count({
        where: { processModelId: modelId, idempotencyKey: sharedKey },
      }),
    ]);
    expect(revisionCount - 1 + versionCount).toBe(1);
    expect(receiptCount).toBe(1);
  });
});

const incompleteCoreDraftXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_Draft" targetNamespace="https://the-experience.blog/bpmn">
  <bpmn:process id="Process_Draft" isExecutable="false">
    <bpmn:task id="Task_Draft" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Draft">
    <bpmndi:BPMNPlane id="Plane_Draft" bpmnElement="Process_Draft">
      <bpmndi:BPMNShape id="Shape_Draft" bpmnElement="Task_Draft">
        <dc:Bounds x="100" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
