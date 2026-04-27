ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "youtube_searched_at" timestamp;
CREATE INDEX IF NOT EXISTS "idx_churches_youtube_unsearched" ON "churches" ("youtube_searched_at") WHERE "youtube_channel_id" IS NULL;
