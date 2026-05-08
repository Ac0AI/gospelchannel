CREATE TABLE IF NOT EXISTS "search_suggestions" (
  "suggestion_key" text PRIMARY KEY,
  "target_type" text NOT NULL DEFAULT 'church',
  "target_id" text NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "slug" text NOT NULL,
  "search_key" text NOT NULL,
  "popularity" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "search_suggestions_search_key_prefix_idx"
  ON "search_suggestions" ("search_key" text_pattern_ops);

CREATE INDEX IF NOT EXISTS "search_suggestions_target_idx"
  ON "search_suggestions" ("target_type", "target_id");

CREATE INDEX IF NOT EXISTS "search_suggestions_popularity_idx"
  ON "search_suggestions" ("popularity" DESC);

CREATE OR REPLACE FUNCTION refresh_church_search_suggestions(church_row churches)
RETURNS void AS $$
DECLARE
  church_city text;
  church_subtitle text;
  church_popularity integer;
BEGIN
  DELETE FROM search_suggestions
  WHERE target_type = 'church'
    AND target_id = church_row.slug;

  IF church_row.status IS DISTINCT FROM 'approved' THEN
    RETURN;
  END IF;

  church_city := nullif(btrim(split_part(coalesce(church_row.location, ''), ',', 1)), '');
  church_subtitle := nullif(concat_ws(', ', nullif(btrim(coalesce(church_row.location, '')), ''), nullif(btrim(coalesce(church_row.country, '')), '')), '');
  church_popularity :=
    (coalesce(cardinality(church_row.spotify_playlist_ids), 0) + coalesce(cardinality(church_row.additional_playlists), 0)) * 10
    + CASE WHEN coalesce(church_row.spotify_url, '') <> '' THEN 15 ELSE 0 END
    + CASE WHEN church_row.verified_at IS NOT NULL THEN 20 ELSE 0 END
    + CASE WHEN coalesce(church_row.header_image, '') <> '' OR coalesce(church_row.logo, '') <> '' THEN 8 ELSE 0 END;

  INSERT INTO search_suggestions (
    suggestion_key,
    target_type,
    target_id,
    title,
    subtitle,
    slug,
    search_key,
    popularity,
    updated_at
  )
  SELECT
    'church:' || church_row.slug || ':' || source_key,
    'church',
    church_row.slug,
    church_row.name,
    church_subtitle,
    church_row.slug,
    lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')),
    church_popularity + source_score,
    now()
  FROM (
    SELECT 'name'::text AS source_key, church_row.name AS value, 100 AS source_score
    UNION ALL
    SELECT 'city'::text AS source_key, church_city AS value, 80 AS source_score
    UNION ALL
    SELECT 'country'::text AS source_key, church_row.country AS value, 45 AS source_score
    UNION ALL
    SELECT 'denomination'::text AS source_key, church_row.denomination AS value, 35 AS source_score
    UNION ALL
    SELECT 'alias:' || alias_row.ordinality::text AS source_key, alias_row.alias AS value, 90 AS source_score
    FROM unnest(coalesce(church_row.aliases, '{}'::text[])) WITH ORDINALITY AS alias_row(alias, ordinality)
  ) values_to_index
  WHERE nullif(btrim(value), '') IS NOT NULL
  ON CONFLICT (suggestion_key) DO UPDATE SET
    title = excluded.title,
    subtitle = excluded.subtitle,
    slug = excluded.slug,
    search_key = excluded.search_key,
    popularity = excluded.popularity,
    updated_at = excluded.updated_at;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_church_search_suggestions()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_suggestions
    WHERE target_type = 'church'
      AND target_id = OLD.slug;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    DELETE FROM search_suggestions
    WHERE target_type = 'church'
      AND target_id = OLD.slug;
  END IF;

  PERFORM refresh_church_search_suggestions(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "churches_search_suggestions_sync" ON "churches";
CREATE TRIGGER "churches_search_suggestions_sync"
AFTER INSERT OR UPDATE OF
  slug,
  name,
  country,
  location,
  denomination,
  aliases,
  status,
  spotify_playlist_ids,
  additional_playlists,
  spotify_url,
  header_image,
  logo,
  verified_at
OR DELETE ON "churches"
FOR EACH ROW
EXECUTE FUNCTION sync_church_search_suggestions();

DO $$
DECLARE
  church_record churches%ROWTYPE;
BEGIN
  FOR church_record IN SELECT * FROM churches LOOP
    PERFORM refresh_church_search_suggestions(church_record);
  END LOOP;
END $$;
