-- Orphan-pages plan, deploy 1 (2026-05-20).
-- Adds a precomputed reciprocal related-church assignment per church.
-- Read via the primary slug key (no separate index needed).
-- Populated by scripts/backfill-related-churches.ts; nightly reconcile.
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "related_church_slugs" text[];
