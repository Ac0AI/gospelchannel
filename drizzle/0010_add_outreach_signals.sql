-- Outreach signals derived from LLM-assisted website extraction.
-- Lives on church_website_tech (not church_enrichments) because these are all
-- "what the website has" — colocated with primary_platform, sales_angle, etc.
-- outreach_notes is a per-church LLM observation kept separate from the
-- platform-generic sales_angle so we don't lose either.

ALTER TABLE "church_website_tech" ADD COLUMN IF NOT EXISTS "has_donate_page" boolean;
ALTER TABLE "church_website_tech" ADD COLUMN IF NOT EXISTS "has_blog" boolean;
ALTER TABLE "church_website_tech" ADD COLUMN IF NOT EXISTS "has_podcast" boolean;
ALTER TABLE "church_website_tech" ADD COLUMN IF NOT EXISTS "has_app" boolean;
ALTER TABLE "church_website_tech" ADD COLUMN IF NOT EXISTS "outreach_notes" text;
