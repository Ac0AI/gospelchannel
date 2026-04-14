ALTER TABLE "church_enrichments" ADD COLUMN IF NOT EXISTS "google_rating" real;
ALTER TABLE "church_enrichments" ADD COLUMN IF NOT EXISTS "google_reviews_count" integer;
ALTER TABLE "church_enrichments" ADD COLUMN IF NOT EXISTS "google_place_id" text;
ALTER TABLE "church_enrichments" ADD COLUMN IF NOT EXISTS "amenities" jsonb;
CREATE INDEX IF NOT EXISTS "idx_church_enrichments_google_rating" ON "church_enrichments" ("google_rating") WHERE "google_rating" IS NOT NULL;
