CREATE TABLE "ProcessModelFolder" (
  "id" UUID NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcessModelFolder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcessModelFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProcessModelFolder_id_ownerId_key" ON "ProcessModelFolder"("id", "ownerId");
CREATE UNIQUE INDEX "ProcessModelFolder_ownerId_normalizedName_key" ON "ProcessModelFolder"("ownerId", "normalizedName");
ALTER TABLE "ProcessModel" ADD COLUMN "folderId" UUID, ADD COLUMN "folderRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProcessModel" ADD CONSTRAINT "ProcessModel_folderId_ownerId_fkey" FOREIGN KEY ("folderId", "ownerId") REFERENCES "ProcessModelFolder"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProcessModel_ownerId_folderId_archivedAt_updatedAt_idx" ON "ProcessModel"("ownerId", "folderId", "archivedAt", "updatedAt");
