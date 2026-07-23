-- Geo index for the MCP church-finder "near lat/lng" bounding-box prefilter.
-- Idempotent so it is safe to apply via drizzle-kit or the Neon Management API.
-- church_enrichments holds latitude/longitude (real); no index existed before.
CREATE INDEX IF NOT EXISTS idx_church_enrichments_lat_lng
  ON church_enrichments (latitude, longitude);
