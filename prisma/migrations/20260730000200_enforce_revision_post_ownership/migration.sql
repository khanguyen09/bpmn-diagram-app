BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DraftSaveRequest" AS request
    JOIN "PostRevision" AS revision ON revision."id" = request."revisionId"
    WHERE revision."postId" <> request."postId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce revision ownership: a draft save request references another post';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Post" AS post
    JOIN "PostRevision" AS revision ON revision."id" = post."currentRevisionId"
    WHERE revision."postId" <> post."id"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce revision ownership: a post points to another post revision';
  END IF;
END
$$;

CREATE UNIQUE INDEX "PostRevision_id_postId_key"
  ON "PostRevision"("id", "postId");
CREATE UNIQUE INDEX "Post_currentRevisionId_id_key"
  ON "Post"("currentRevisionId", "id");

ALTER TABLE "DraftSaveRequest"
  DROP CONSTRAINT "DraftSaveRequest_revisionId_fkey";
ALTER TABLE "DraftSaveRequest"
  ADD CONSTRAINT "DraftSaveRequest_revisionId_postId_fkey"
  FOREIGN KEY ("revisionId", "postId")
  REFERENCES "PostRevision"("id", "postId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "Post"
  DROP CONSTRAINT "Post_currentRevisionId_fkey";
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_currentRevisionId_id_fkey"
  FOREIGN KEY ("currentRevisionId", "id")
  REFERENCES "PostRevision"("id", "postId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

COMMIT;
