-- Auto-enrichment results for community suggestions. saveEnrichmentToSuggestion
-- has written to this column since launch, but it was never created, so every
-- background enrichment failed silently. Applied to Neon 2026-07-08.
ALTER TABLE "church_suggestions" ADD COLUMN IF NOT EXISTS "enrichment_data" jsonb;
