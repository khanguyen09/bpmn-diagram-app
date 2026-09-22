CREATE TABLE "ImageAsset" (
  "id" UUID NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "digest" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "byteLength" INTEGER NOT NULL CHECK ("byteLength" > 0 AND "byteLength" <= 2097152 AND "byteLength" = octet_length("data")),
  "width" INTEGER NOT NULL CHECK ("width" > 0 AND "width" <= 2560),
  "height" INTEGER NOT NULL CHECK ("height" > 0 AND "height" <= 2560),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ImageAsset_ownerId_digest_key" ON "ImageAsset"("ownerId", "digest");
CREATE INDEX "ImageAsset_ownerId_idx" ON "ImageAsset"("ownerId");
