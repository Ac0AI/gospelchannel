-- Mark completed batches so the nightly job never sends a multi-megabyte
-- exclusion parameter or clears rows after a partial directory read.
ALTER TABLE churches ADD COLUMN directory_reconcile_id TEXT;
