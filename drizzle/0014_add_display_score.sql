ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "display_score" integer;
CREATE INDEX IF NOT EXISTS "idx_churches_display_score" ON "churches" ("status", "display_score");
