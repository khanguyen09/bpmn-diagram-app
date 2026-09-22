BEGIN;

CREATE TYPE "ProcessModelPurpose" AS ENUM ('AS_IS', 'TO_BE', 'REFERENCE');
CREATE TYPE "ProcessModelRevisionSource" AS ENUM ('CREATED', 'EDITED', 'IMPORTED', 'RESTORED');
CREATE TYPE "ProcessModelCommandOperation" AS ENUM ('SAVE_DRAFT', 'CREATE_VERSION', 'RESTORE_VERSION');

CREATE TABLE "ProcessModel" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "purpose" "ProcessModelPurpose" NOT NULL DEFAULT 'AS_IS',
  "profileId" TEXT NOT NULL,
  "currentRevisionNumber" INTEGER NOT NULL DEFAULT 0,
  "currentRevisionId" UUID,
  "latestVersionNumber" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ProcessModel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcessModel_currentRevisionNumber_nonnegative" CHECK ("currentRevisionNumber" >= 0),
  CONSTRAINT "ProcessModel_latestVersionNumber_nonnegative" CHECK ("latestVersionNumber" >= 0)
);

CREATE TABLE "ProcessModelRevision" (
  "id" UUID NOT NULL,
  "processModelId" UUID NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "baseRevisionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "purpose" "ProcessModelPurpose" NOT NULL,
  "profileId" TEXT NOT NULL,
  "canonicalXml" TEXT NOT NULL,
  "xmlChecksum" TEXT NOT NULL,
  "source" "ProcessModelRevisionSource" NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessModelRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcessModelRevision_revision_positive" CHECK ("revisionNumber" > 0),
  CONSTRAINT "ProcessModelRevision_base_nonnegative" CHECK ("baseRevisionNumber" >= 0),
  CONSTRAINT "ProcessModelRevision_checksum_sha256" CHECK ("xmlChecksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ProcessModelRevision_xml_limit" CHECK (octet_length("canonicalXml") <= 1048576)
);

CREATE TABLE "ProcessModelVersion" (
  "id" UUID NOT NULL,
  "processModelId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "profileId" TEXT NOT NULL,
  "xmlChecksum" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessModelVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcessModelVersion_number_positive" CHECK ("versionNumber" > 0),
  CONSTRAINT "ProcessModelVersion_checksum_sha256" CHECK ("xmlChecksum" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "ProcessModelCreateRequest" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "processModelId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessModelCreateRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessModelCommandReceipt" (
  "id" UUID NOT NULL,
  "processModelId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "operation" "ProcessModelCommandOperation" NOT NULL,
  "requestHash" TEXT NOT NULL,
  "expectedRevisionNumber" INTEGER NOT NULL,
  "acknowledgedRevisionNumber" INTEGER NOT NULL,
  "revisionId" UUID NOT NULL,
  "resultVersionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessModelCommandReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcessModelCommandReceipt_expected_nonnegative" CHECK ("expectedRevisionNumber" >= 0),
  CONSTRAINT "ProcessModelCommandReceipt_acknowledged_positive" CHECK ("acknowledgedRevisionNumber" > 0)
);

CREATE UNIQUE INDEX "ProcessModel_currentRevisionId_key" ON "ProcessModel"("currentRevisionId");
CREATE UNIQUE INDEX "ProcessModel_currentRevisionId_id_key" ON "ProcessModel"("currentRevisionId", "id");
CREATE INDEX "ProcessModel_ownerId_archivedAt_updatedAt_idx" ON "ProcessModel"("ownerId", "archivedAt", "updatedAt");
CREATE UNIQUE INDEX "ProcessModelRevision_processModelId_revisionNumber_key" ON "ProcessModelRevision"("processModelId", "revisionNumber");
CREATE UNIQUE INDEX "ProcessModelRevision_id_processModelId_key" ON "ProcessModelRevision"("id", "processModelId");
CREATE INDEX "ProcessModelRevision_processModelId_createdAt_idx" ON "ProcessModelRevision"("processModelId", "createdAt");
CREATE UNIQUE INDEX "ProcessModelVersion_processModelId_versionNumber_key" ON "ProcessModelVersion"("processModelId", "versionNumber");
CREATE UNIQUE INDEX "ProcessModelVersion_id_processModelId_key" ON "ProcessModelVersion"("id", "processModelId");
CREATE INDEX "ProcessModelVersion_processModelId_createdAt_idx" ON "ProcessModelVersion"("processModelId", "createdAt");
CREATE UNIQUE INDEX "ProcessModelCreateRequest_processModelId_key" ON "ProcessModelCreateRequest"("processModelId");
CREATE UNIQUE INDEX "ProcessModelCreateRequest_ownerId_idempotencyKey_key" ON "ProcessModelCreateRequest"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "ProcessModelCommandReceipt_processModelId_idempotencyKey_key" ON "ProcessModelCommandReceipt"("processModelId", "idempotencyKey");
CREATE INDEX "ProcessModelCommandReceipt_revisionId_idx" ON "ProcessModelCommandReceipt"("revisionId");
CREATE INDEX "ProcessModelCommandReceipt_resultVersionId_idx" ON "ProcessModelCommandReceipt"("resultVersionId");

ALTER TABLE "ProcessModel" ADD CONSTRAINT "ProcessModel_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelRevision" ADD CONSTRAINT "ProcessModelRevision_processModelId_fkey"
  FOREIGN KEY ("processModelId") REFERENCES "ProcessModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelRevision" ADD CONSTRAINT "ProcessModelRevision_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModel" ADD CONSTRAINT "ProcessModel_currentRevisionId_id_fkey"
  FOREIGN KEY ("currentRevisionId", "id") REFERENCES "ProcessModelRevision"("id", "processModelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelVersion" ADD CONSTRAINT "ProcessModelVersion_processModelId_fkey"
  FOREIGN KEY ("processModelId") REFERENCES "ProcessModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelVersion" ADD CONSTRAINT "ProcessModelVersion_revisionId_processModelId_fkey"
  FOREIGN KEY ("revisionId", "processModelId") REFERENCES "ProcessModelRevision"("id", "processModelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelVersion" ADD CONSTRAINT "ProcessModelVersion_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelCreateRequest" ADD CONSTRAINT "ProcessModelCreateRequest_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelCreateRequest" ADD CONSTRAINT "ProcessModelCreateRequest_processModelId_fkey"
  FOREIGN KEY ("processModelId") REFERENCES "ProcessModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelCommandReceipt" ADD CONSTRAINT "ProcessModelCommandReceipt_processModelId_fkey"
  FOREIGN KEY ("processModelId") REFERENCES "ProcessModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelCommandReceipt" ADD CONSTRAINT "ProcessModelCommandReceipt_revisionId_processModelId_fkey"
  FOREIGN KEY ("revisionId", "processModelId") REFERENCES "ProcessModelRevision"("id", "processModelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessModelCommandReceipt" ADD CONSTRAINT "ProcessModelCommandReceipt_resultVersionId_processModelId_fkey"
  FOREIGN KEY ("resultVersionId", "processModelId") REFERENCES "ProcessModelVersion"("id", "processModelId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
