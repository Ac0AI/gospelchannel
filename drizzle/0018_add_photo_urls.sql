-- Gallery photos per church, mirrored to R2 (media.gospelchannel.com/photos/<slug>/<n>.webp).
-- Populated by scripts/fetch-church-photos.mjs from Google Places imagery.
ALTER TABLE church_enrichments ADD COLUMN IF NOT EXISTS photo_urls jsonb;
