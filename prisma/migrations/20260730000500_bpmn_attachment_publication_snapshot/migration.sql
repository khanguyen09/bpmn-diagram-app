BEGIN;

CREATE UNIQUE INDEX "ProcessModel_id_ownerId_key"
  ON "ProcessModel"("id", "ownerId");
CREATE UNIQUE INDEX "ProcessModelVersion_id_processModelId_revisionId_xmlChecksum_key"
  ON "ProcessModelVersion"("id", "processModelId", "revisionId", "xmlChecksum");

CREATE TABLE "Publication" (
  "id" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "activeSnapshotId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Publication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Publication_generation_nonnegative" CHECK ("generation" >= 0),
  CONSTRAINT "Publication_slug_bounded"
    CHECK (char_length("slug") BETWEEN 1 AND 180)
);

CREATE TABLE "PublishedArticleSnapshot" (
  "id" UUID NOT NULL,
  "publicationId" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "postRevisionId" UUID NOT NULL,
  "generation" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "document" JSONB NOT NULL,
  "sourcePayloadHash" TEXT NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "publishedBy" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishedArticleSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublishedArticleSnapshot_generation_positive"
    CHECK ("generation" > 0),
  CONSTRAINT "PublishedArticleSnapshot_schema_positive"
    CHECK ("schemaVersion" > 0),
  CONSTRAINT "PublishedArticleSnapshot_slug_bounded"
    CHECK (char_length("slug") BETWEEN 1 AND 180),
  CONSTRAINT "PublishedArticleSnapshot_metadata_bounded"
    CHECK (octet_length("metadata"::text) <= 65536),
  CONSTRAINT "PublishedArticleSnapshot_document_bounded"
    CHECK (octet_length("document"::text) <= 1048576),
  CONSTRAINT "PublishedArticleSnapshot_source_hash_shape"
    CHECK ("sourcePayloadHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PublishedArticleSnapshot_hash_shape"
    CHECK ("snapshotHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "PublishedBpmnEmbed" (
  "snapshotId" UUID NOT NULL,
  "blockId" TEXT NOT NULL,
  "blockOrder" INTEGER NOT NULL,
  "ownerId" TEXT NOT NULL,
  "processModelId" UUID NOT NULL,
  "processModelVersionId" UUID NOT NULL,
  "processModelRevisionId" UUID NOT NULL,
  "xmlChecksum" TEXT NOT NULL,
  "displayProjection" JSONB NOT NULL,
  CONSTRAINT "PublishedBpmnEmbed_pkey" PRIMARY KEY ("snapshotId", "blockId"),
  CONSTRAINT "PublishedBpmnEmbed_order_positive" CHECK ("blockOrder" > 0),
  CONSTRAINT "PublishedBpmnEmbed_block_id_bounded"
    CHECK (char_length("blockId") BETWEEN 1 AND 120),
  CONSTRAINT "PublishedBpmnEmbed_checksum_shape"
    CHECK ("xmlChecksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PublishedBpmnEmbed_projection_bounded"
    CHECK (octet_length("displayProjection"::text) <= 16384)
);

CREATE TABLE "PublishRequest" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "postId" UUID NOT NULL,
  "publicationId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "expectedDraftVersion" INTEGER NOT NULL,
  "expectedPublicationGeneration" INTEGER NOT NULL,
  "postRevisionId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "acknowledgedGeneration" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublishRequest_expected_draft_nonnegative"
    CHECK ("expectedDraftVersion" >= 0),
  CONSTRAINT "PublishRequest_expected_generation_nonnegative"
    CHECK ("expectedPublicationGeneration" >= 0),
  CONSTRAINT "PublishRequest_acknowledged_generation_positive"
    CHECK ("acknowledgedGeneration" > 0),
  CONSTRAINT "PublishRequest_key_bounded"
    CHECK (char_length("idempotencyKey") BETWEEN 1 AND 160),
  CONSTRAINT "PublishRequest_hash_shape"
    CHECK ("requestHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "Publication_postId_key" ON "Publication"("postId");
CREATE UNIQUE INDEX "Publication_slug_key" ON "Publication"("slug");
CREATE UNIQUE INDEX "Publication_activeSnapshotId_key"
  ON "Publication"("activeSnapshotId");
CREATE UNIQUE INDEX "Publication_id_postId_key"
  ON "Publication"("id", "postId");
CREATE UNIQUE INDEX "Publication_id_postId_ownerId_key"
  ON "Publication"("id", "postId", "ownerId");
CREATE UNIQUE INDEX "Publication_postId_ownerId_key"
  ON "Publication"("postId", "ownerId");
CREATE UNIQUE INDEX "Publication_activeSnapshotId_id_key"
  ON "Publication"("activeSnapshotId", "id");
CREATE INDEX "Publication_ownerId_updatedAt_idx"
  ON "Publication"("ownerId", "updatedAt");

CREATE UNIQUE INDEX "PublishedArticleSnapshot_publicationId_generation_key"
  ON "PublishedArticleSnapshot"("publicationId", "generation");
CREATE UNIQUE INDEX "PublishedArticleSnapshot_postId_postRevisionId_key"
  ON "PublishedArticleSnapshot"("postId", "postRevisionId");
CREATE UNIQUE INDEX "PublishedArticleSnapshot_id_publicationId_key"
  ON "PublishedArticleSnapshot"("id", "publicationId");
CREATE UNIQUE INDEX "PublishedArticleSnapshot_id_postId_key"
  ON "PublishedArticleSnapshot"("id", "postId");
CREATE UNIQUE INDEX "PublishedArticleSnapshot_id_ownerId_key"
  ON "PublishedArticleSnapshot"("id", "ownerId");
CREATE INDEX "PublishedArticleSnapshot_publishedAt_idx"
  ON "PublishedArticleSnapshot"("publishedAt");

CREATE UNIQUE INDEX "PublishedBpmnEmbed_snapshotId_blockOrder_key"
  ON "PublishedBpmnEmbed"("snapshotId", "blockOrder");
CREATE INDEX "PublishedBpmnEmbed_processModelVersionId_idx"
  ON "PublishedBpmnEmbed"("processModelVersionId");

CREATE UNIQUE INDEX "PublishRequest_postId_idempotencyKey_key"
  ON "PublishRequest"("postId", "idempotencyKey");
CREATE INDEX "PublishRequest_snapshotId_idx"
  ON "PublishRequest"("snapshotId");

ALTER TABLE "Publication"
  ADD CONSTRAINT "Publication_postId_ownerId_fkey"
  FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Publication"
  ADD CONSTRAINT "Publication_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishedArticleSnapshot"
  ADD CONSTRAINT "PublishedArticleSnapshot_publicationId_postId_ownerId_fkey"
  FOREIGN KEY ("publicationId", "postId", "ownerId")
  REFERENCES "Publication"("id", "postId", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishedArticleSnapshot"
  ADD CONSTRAINT "PublishedArticleSnapshot_postId_ownerId_fkey"
  FOREIGN KEY ("postId", "ownerId")
  REFERENCES "Post"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishedArticleSnapshot"
  ADD CONSTRAINT "PublishedArticleSnapshot_postRevisionId_postId_fkey"
  FOREIGN KEY ("postRevisionId", "postId")
  REFERENCES "PostRevision"("id", "postId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishedArticleSnapshot"
  ADD CONSTRAINT "PublishedArticleSnapshot_publishedBy_fkey"
  FOREIGN KEY ("publishedBy") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Publication"
  ADD CONSTRAINT "Publication_activeSnapshotId_id_fkey"
  FOREIGN KEY ("activeSnapshotId", "id")
  REFERENCES "PublishedArticleSnapshot"("id", "publicationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishedBpmnEmbed"
  ADD CONSTRAINT "PublishedBpmnEmbed_snapshotId_ownerId_fkey"
  FOREIGN KEY ("snapshotId", "ownerId")
  REFERENCES "PublishedArticleSnapshot"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishedBpmnEmbed"
  ADD CONSTRAINT "PublishedBpmnEmbed_processModelId_ownerId_fkey"
  FOREIGN KEY ("processModelId", "ownerId")
  REFERENCES "ProcessModel"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishedBpmnEmbed"
  ADD CONSTRAINT "PublishedBpmnEmbed_exact_version_fkey"
  FOREIGN KEY (
    "processModelVersionId",
    "processModelId",
    "processModelRevisionId",
    "xmlChecksum"
  )
  REFERENCES "ProcessModelVersion"(
    "id",
    "processModelId",
    "revisionId",
    "xmlChecksum"
  )
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishRequest"
  ADD CONSTRAINT "PublishRequest_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishRequest"
  ADD CONSTRAINT "PublishRequest_postId_ownerId_fkey"
  FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishRequest"
  ADD CONSTRAINT "PublishRequest_publicationId_postId_ownerId_fkey"
  FOREIGN KEY ("publicationId", "postId", "ownerId")
  REFERENCES "Publication"("id", "postId", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishRequest"
  ADD CONSTRAINT "PublishRequest_postRevisionId_postId_fkey"
  FOREIGN KEY ("postRevisionId", "postId")
  REFERENCES "PostRevision"("id", "postId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublishRequest"
  ADD CONSTRAINT "PublishRequest_snapshotId_publicationId_fkey"
  FOREIGN KEY ("snapshotId", "publicationId")
  REFERENCES "PublishedArticleSnapshot"("id", "publicationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
