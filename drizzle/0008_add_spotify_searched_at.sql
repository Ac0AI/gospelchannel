ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "spotify_searched_at" timestamp;
CREATE INDEX IF NOT EXISTS "idx_churches_spotify_unsearched" ON "churches" ("spotify_searched_at") WHERE "spotify_url" IS NULL;
