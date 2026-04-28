ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "facebook_url" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "instagram_url" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "tiktok_url" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "apple_podcast_url" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "donate_url" text;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "service_times" jsonb;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "website_extracted_at" timestamp;
CREATE INDEX IF NOT EXISTS "idx_churches_website_unscraped" ON "churches" ("website_extracted_at") WHERE "website" IS NOT NULL AND "website_extracted_at" IS NULL;
