ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "city_slug" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "directory_score" real;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "directory_ready" boolean;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "directory_rank" integer;
CREATE INDEX IF NOT EXISTS "idx_churches_status_directory_rank" ON "churches" ("status", "directory_rank");
CREATE INDEX IF NOT EXISTS "idx_churches_status_city_slug" ON "churches" ("status", "city_slug");
CREATE INDEX IF NOT EXISTS "idx_churches_status_directory_score" ON "churches" ("status", "directory_score" DESC);
