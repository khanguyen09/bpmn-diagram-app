CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

CREATE TABLE "user" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_role_owner_only" CHECK ("role" = 'OWNER')
);

CREATE TABLE "session" (
  "id" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersion" INTEGER NOT NULL DEFAULT 0,
  "currentRevisionId" UUID,
  "workingSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "workingMetadata" JSONB NOT NULL,
  "workingDocument" JSONB NOT NULL,
  "workingPayloadHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Post_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Post_currentVersion_nonnegative" CHECK ("currentVersion" >= 0),
  CONSTRAINT "Post_schemaVersion_positive" CHECK ("workingSchemaVersion" > 0)
);

CREATE TABLE "PostRevision" (
  "id" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "baseVersion" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL,
  "document" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostRevision_version_positive" CHECK ("version" > 0),
  CONSTRAINT "PostRevision_baseVersion_nonnegative" CHECK ("baseVersion" >= 0),
  CONSTRAINT "PostRevision_schemaVersion_positive" CHECK ("schemaVersion" > 0)
);

CREATE TABLE "DraftSaveRequest" (
  "id" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "baseVersion" INTEGER NOT NULL,
  "acknowledgedVersion" INTEGER NOT NULL,
  "revisionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftSaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");
CREATE INDEX "account_userId_idx" ON "account"("userId");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE UNIQUE INDEX "Post_currentRevisionId_key" ON "Post"("currentRevisionId");
CREATE INDEX "Post_ownerId_status_updatedAt_idx" ON "Post"("ownerId", "status", "updatedAt");
CREATE UNIQUE INDEX "PostRevision_postId_version_key" ON "PostRevision"("postId", "version");
CREATE INDEX "PostRevision_postId_createdAt_idx" ON "PostRevision"("postId", "createdAt");
CREATE UNIQUE INDEX "DraftSaveRequest_postId_idempotencyKey_key" ON "DraftSaveRequest"("postId", "idempotencyKey");
CREATE INDEX "DraftSaveRequest_revisionId_idx" ON "DraftSaveRequest"("revisionId");

ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DraftSaveRequest" ADD CONSTRAINT "DraftSaveRequest_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DraftSaveRequest" ADD CONSTRAINT "DraftSaveRequest_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "PostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "PostRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
