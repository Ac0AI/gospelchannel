CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE INDEX IF NOT EXISTS "search_suggestions_search_key_trgm_idx"
  ON "search_suggestions" USING gin ("search_key" gin_trgm_ops);
