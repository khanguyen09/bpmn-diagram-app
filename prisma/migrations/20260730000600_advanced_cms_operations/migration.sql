CREATE TYPE "TaxonomyTermKind" AS ENUM ('TOPIC', 'TAG');
CREATE TYPE "TaxonomyTermStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "PublicationScheduleState" AS ENUM ('PENDING', 'CLAIMED', 'SUCCEEDED', 'CANCELLED', 'STALE', 'FAILED');
CREATE TYPE "SubscriberState" AS ENUM ('PENDING_CONFIRMATION', 'ACTIVE', 'UNSUBSCRIBED', 'SUPPRESSED');
CREATE TYPE "SubscriberCapabilityPurpose" AS ENUM ('CONFIRM', 'UNSUBSCRIBE');

ALTER TABLE "Post" ADD COLUMN "primaryTopicId" UUID;
ALTER TABLE "PublishedArticleSnapshot"
  ADD COLUMN "taxonomyProjection" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "searchDocument" TEXT NOT NULL DEFAULT '';

UPDATE "PublishedArticleSnapshot"
SET "taxonomyProjection" = jsonb_build_object(
      'topic', CASE
        WHEN jsonb_typeof("metadata"->'topic') = 'string'
        THEN jsonb_build_object('id', NULL, 'slug', lower(regexp_replace("metadata"->>'topic', '[^[:alnum:]]+', '-', 'g')), 'label', "metadata"->>'topic')
        ELSE NULL
      END,
      'tags', '[]'::jsonb
    ),
    "searchDocument" = concat_ws(' ', "metadata"::text, "document"::text);

CREATE INDEX "PublishedArticleSnapshot_searchDocument_fts_idx"
ON "PublishedArticleSnapshot"
USING GIN (to_tsvector('simple', "searchDocument"));

CREATE TABLE "TaxonomyTerm" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" "TaxonomyTermKind" NOT NULL,
  "status" "TaxonomyTermStatus" NOT NULL DEFAULT 'ACTIVE',
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxonomyTerm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "TaxonomyTerm_ownerId_kind_normalizedKey_key" ON "TaxonomyTerm"("ownerId","kind","normalizedKey");
CREATE UNIQUE INDEX "TaxonomyTerm_ownerId_kind_slug_key" ON "TaxonomyTerm"("ownerId","kind","slug");
CREATE UNIQUE INDEX "TaxonomyTerm_id_ownerId_key" ON "TaxonomyTerm"("id","ownerId");
CREATE INDEX "TaxonomyTerm_ownerId_kind_status_label_idx" ON "TaxonomyTerm"("ownerId","kind","status","label");

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_primaryTopicId_fkey" FOREIGN KEY ("primaryTopicId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT;

CREATE TABLE "PostTagAssignment" (
  "postId" UUID NOT NULL,
  "termId" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostTagAssignment_pkey" PRIMARY KEY ("postId","termId"),
  CONSTRAINT "PostTagAssignment_postId_ownerId_fkey" FOREIGN KEY ("postId","ownerId") REFERENCES "Post"("id","ownerId") ON DELETE CASCADE,
  CONSTRAINT "PostTagAssignment_termId_ownerId_fkey" FOREIGN KEY ("termId","ownerId") REFERENCES "TaxonomyTerm"("id","ownerId") ON DELETE RESTRICT
);
CREATE INDEX "PostTagAssignment_ownerId_termId_postId_idx" ON "PostTagAssignment"("ownerId","termId","postId");

CREATE TABLE "TaxonomyBulkRequest" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomyBulkRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxonomyBulkRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "TaxonomyBulkRequest_ownerId_idempotencyKey_key" ON "TaxonomyBulkRequest"("ownerId","idempotencyKey");

CREATE TABLE "PublicationSchedule" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "postId" UUID NOT NULL,
  "postRevisionId" UUID NOT NULL,
  "expectedDraftVersion" INTEGER NOT NULL,
  "expectedPublicationGeneration" INTEGER NOT NULL,
  "expectedPins" JSONB NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "timeZone" TEXT NOT NULL,
  "state" "PublicationScheduleState" NOT NULL DEFAULT 'PENDING',
  "leaseTokenHash" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "fence" INTEGER NOT NULL DEFAULT 0,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicationSchedule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT,
  CONSTRAINT "PublicationSchedule_postId_ownerId_fkey" FOREIGN KEY ("postId","ownerId") REFERENCES "Post"("id","ownerId") ON DELETE RESTRICT,
  CONSTRAINT "PublicationSchedule_postRevisionId_postId_fkey" FOREIGN KEY ("postRevisionId","postId") REFERENCES "PostRevision"("id","postId") ON DELETE RESTRICT
);
CREATE INDEX "PublicationSchedule_ownerId_state_dueAt_id_idx" ON "PublicationSchedule"("ownerId","state","dueAt","id");

CREATE TABLE "PublicationScheduleRequest" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "scheduleId" UUID NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationScheduleRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicationScheduleRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT,
  CONSTRAINT "PublicationScheduleRequest_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PublicationSchedule"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "PublicationScheduleRequest_ownerId_idempotencyKey_key" ON "PublicationScheduleRequest"("ownerId","idempotencyKey");
CREATE INDEX "PublicationScheduleRequest_scheduleId_idx" ON "PublicationScheduleRequest"("scheduleId");

CREATE TABLE "Subscriber" (
  "id" UUID NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "state" "SubscriberState" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "confirmedAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscriber_emailHash_key" ON "Subscriber"("emailHash");

CREATE TABLE "SubscriberCapability" (
  "id" UUID NOT NULL,
  "subscriberId" UUID NOT NULL,
  "purpose" "SubscriberCapabilityPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriberCapability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriberCapability_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "SubscriberCapability_tokenHash_key" ON "SubscriberCapability"("tokenHash");
CREATE INDEX "SubscriberCapability_subscriberId_purpose_expiresAt_idx" ON "SubscriberCapability"("subscriberId","purpose","expiresAt");

CREATE TABLE "NewsletterIssue" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NewsletterIssue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT
);
CREATE INDEX "NewsletterIssue_ownerId_createdAt_idx" ON "NewsletterIssue"("ownerId","createdAt");
CREATE UNIQUE INDEX "NewsletterIssue_ownerId_idempotencyKey_key" ON "NewsletterIssue"("ownerId","idempotencyKey");

CREATE TABLE "NewsletterIssueSnapshot" (
  "issueId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "NewsletterIssueSnapshot_pkey" PRIMARY KEY ("issueId","snapshotId"),
  CONSTRAINT "NewsletterIssueSnapshot_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE CASCADE,
  CONSTRAINT "NewsletterIssueSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PublishedArticleSnapshot"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "NewsletterIssueSnapshot_issueId_position_key" ON "NewsletterIssueSnapshot"("issueId","position");

CREATE TABLE "NewsletterCapture" (
  "issueId" UUID NOT NULL,
  "subscriberId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CAPTURED_LOCAL',
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterCapture_pkey" PRIMARY KEY ("issueId","subscriberId"),
  CONSTRAINT "NewsletterCapture_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE RESTRICT,
  CONSTRAINT "NewsletterCapture_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE RESTRICT
);
CREATE INDEX "NewsletterCapture_subscriberId_capturedAt_idx" ON "NewsletterCapture"("subscriberId","capturedAt");
