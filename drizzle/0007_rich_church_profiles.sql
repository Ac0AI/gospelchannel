-- Rich Church Profiles: new fields for pastor photos, service details, and claim preview tokens

-- New enrichment fields for richer church profiles
ALTER TABLE church_enrichments ADD COLUMN IF NOT EXISTS pastor_photo_url TEXT;
ALTER TABLE church_enrichments ADD COLUMN IF NOT EXISTS service_duration_minutes INTEGER;
ALTER TABLE church_enrichments ADD COLUMN IF NOT EXISTS parking_info TEXT;
ALTER TABLE church_enrichments ADD COLUMN IF NOT EXISTS good_fit_tags TEXT[] DEFAULT '{}';
ALTER TABLE church_enrichments ADD COLUMN IF NOT EXISTS visitor_faq JSONB DEFAULT '[]';

-- Claim preview token for pastor outreach (stored hashed, looked up via SHA-256)
ALTER TABLE churches ADD COLUMN IF NOT EXISTS claim_preview_token TEXT UNIQUE;
