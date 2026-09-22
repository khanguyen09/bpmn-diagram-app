BEGIN;

CREATE TABLE "PostCreateRequest" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "postId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "acknowledgedVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostCreateRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostCreateRequest_acknowledged_positive"
    CHECK ("acknowledgedVersion" > 0)
);

CREATE UNIQUE INDEX "Post_id_ownerId_key" ON "Post"("id", "ownerId");
CREATE UNIQUE INDEX "PostCreateRequest_postId_key"
  ON "PostCreateRequest"("postId");
CREATE UNIQUE INDEX "PostCreateRequest_revisionId_key"
  ON "PostCreateRequest"("revisionId");
CREATE UNIQUE INDEX "PostCreateRequest_ownerId_idempotencyKey_key"
  ON "PostCreateRequest"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "PostCreateRequest_postId_ownerId_key"
  ON "PostCreateRequest"("postId", "ownerId");
CREATE UNIQUE INDEX "PostCreateRequest_revisionId_postId_key"
  ON "PostCreateRequest"("revisionId", "postId");
CREATE INDEX "PostCreateRequest_revisionId_idx"
  ON "PostCreateRequest"("revisionId");

ALTER TABLE "PostCreateRequest"
  ADD CONSTRAINT "PostCreateRequest_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostCreateRequest"
  ADD CONSTRAINT "PostCreateRequest_postId_ownerId_fkey"
  FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostCreateRequest"
  ADD CONSTRAINT "PostCreateRequest_revisionId_postId_fkey"
  FOREIGN KEY ("revisionId", "postId") REFERENCES "PostRevision"("id", "postId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
