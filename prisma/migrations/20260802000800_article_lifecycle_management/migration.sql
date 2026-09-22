CREATE TYPE "ArticleSlugClaimKind" AS ENUM ('CURRENT', 'FORMER');

ALTER TABLE "Post"
  ADD COLUMN "lifecycleVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletedFromStatus" "PostStatus",
  ADD CONSTRAINT "Post_lifecycleVersion_nonnegative"
    CHECK ("lifecycleVersion" >= 0);

ALTER TABLE "PublicationSchedule"
  ADD COLUMN "expectedLifecycleVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "PublicationSchedule_expectedLifecycleVersion_nonnegative"
    CHECK ("expectedLifecycleVersion" >= 0);

ALTER TABLE "PublishRequest"
  ADD COLUMN "expectedLifecycleVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "acknowledgedLifecycleVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "PublishRequest_expectedLifecycleVersion_nonnegative"
    CHECK ("expectedLifecycleVersion" >= 0),
  ADD CONSTRAINT "PublishRequest_acknowledgedLifecycleVersion_nonnegative"
    CHECK ("acknowledgedLifecycleVersion" >= 0);

CREATE TABLE "ArticleLifecycleRequest" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "postId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "expectedLifecycleVersion" INTEGER NOT NULL,
  "acknowledgedLifecycleVersion" INTEGER NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleLifecycleRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ArticleLifecycleRequest_expectedLifecycleVersion_nonnegative"
    CHECK ("expectedLifecycleVersion" >= 0),
  CONSTRAINT "ArticleLifecycleRequest_acknowledgedLifecycleVersion_nonnegative"
    CHECK ("acknowledgedLifecycleVersion" >= 0),
  CONSTRAINT "ArticleLifecycleRequest_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT,
  CONSTRAINT "ArticleLifecycleRequest_postId_ownerId_fkey"
    FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "ArticleLifecycleRequest_postId_idempotencyKey_key"
  ON "ArticleLifecycleRequest"("postId", "idempotencyKey");
CREATE INDEX "ArticleLifecycleRequest_ownerId_createdAt_idx"
  ON "ArticleLifecycleRequest"("ownerId", "createdAt");

CREATE TABLE "ArticleLifecycleEvent" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "postId" UUID NOT NULL,
  "actorId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "beforeStatus" "PostStatus" NOT NULL,
  "afterStatus" "PostStatus" NOT NULL,
  "beforeDeleted" BOOLEAN NOT NULL,
  "afterDeleted" BOOLEAN NOT NULL,
  "beforeSlug" TEXT NOT NULL,
  "afterSlug" TEXT NOT NULL,
  "beforeActiveSnapshotId" UUID,
  "afterActiveSnapshotId" UUID,
  "lifecycleVersion" INTEGER NOT NULL,
  "impact" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleLifecycleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ArticleLifecycleEvent_lifecycleVersion_nonnegative"
    CHECK ("lifecycleVersion" >= 0),
  CONSTRAINT "ArticleLifecycleEvent_postId_ownerId_fkey"
    FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId") ON DELETE RESTRICT,
  CONSTRAINT "ArticleLifecycleEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT
);

CREATE INDEX "ArticleLifecycleEvent_ownerId_postId_createdAt_idx"
  ON "ArticleLifecycleEvent"("ownerId", "postId", "createdAt");

CREATE TABLE "ArticleSlugClaim" (
  "slug" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "postId" UUID NOT NULL,
  "kind" "ArticleSlugClaimKind" NOT NULL,
  "wasPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleSlugClaim_pkey" PRIMARY KEY ("slug"),
  CONSTRAINT "ArticleSlugClaim_postId_ownerId_fkey"
    FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId") ON DELETE RESTRICT
);

INSERT INTO "ArticleSlugClaim" (
  "slug", "ownerId", "postId", "kind", "wasPublic", "createdAt", "updatedAt"
)
SELECT
  post."slug",
  post."ownerId",
  post."id",
  'CURRENT'::"ArticleSlugClaimKind",
  EXISTS (
    SELECT 1
    FROM "PublishedArticleSnapshot" snapshot
    WHERE snapshot."postId" = post."id"
  ),
  post."createdAt",
  CURRENT_TIMESTAMP
FROM "Post" post;

CREATE UNIQUE INDEX "ArticleSlugClaim_one_current_per_post_key"
  ON "ArticleSlugClaim"("postId") WHERE "kind" = 'CURRENT';
CREATE INDEX "ArticleSlugClaim_ownerId_postId_idx"
  ON "ArticleSlugClaim"("ownerId", "postId");
