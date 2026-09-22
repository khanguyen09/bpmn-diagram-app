ALTER TABLE "Post"
  ADD COLUMN "taxonomyVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Post_taxonomyVersion_nonnegative" CHECK ("taxonomyVersion" >= 0);

ALTER TABLE "PublishedArticleSnapshot"
  ADD COLUMN "sourceTaxonomyVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "PublishedArticleSnapshot_sourceTaxonomyVersion_nonnegative"
    CHECK ("sourceTaxonomyVersion" >= 0);

ALTER TABLE "PublishRequest"
  ADD COLUMN "expectedTaxonomyVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "PublishRequest_expectedTaxonomyVersion_nonnegative"
    CHECK ("expectedTaxonomyVersion" >= 0);

ALTER TABLE "PublicationSchedule"
  ADD COLUMN "expectedTaxonomyVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "PublicationSchedule_expectedTaxonomyVersion_nonnegative"
    CHECK ("expectedTaxonomyVersion" >= 0);

DROP INDEX "PublishedArticleSnapshot_postId_postRevisionId_key";
CREATE INDEX "PublishedArticleSnapshot_postId_postRevisionId_idx"
  ON "PublishedArticleSnapshot"("postId", "postRevisionId");
