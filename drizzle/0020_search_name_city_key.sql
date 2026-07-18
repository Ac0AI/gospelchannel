-- "lev church downey" found nothing: search keys were name, city, country, and
-- denomination separately, so a query mixing name + city matched none of them.
-- Adds a combined "name city" search key (skipped when the city already appears
-- in the name) and backfills it for all approved churches.

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
    SELECT 'name_city'::text AS source_key,
      CASE
        WHEN church_city IS NOT NULL AND position(lower(church_city) IN lower(church_row.name)) = 0
        THEN church_row.name || ' ' || church_city
      END AS value,
      95 AS source_score
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

-- Backfill the combined key for existing approved churches without re-running
-- the full refresh per row.
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
  'church:' || c.slug || ':name_city',
  'church',
  c.slug,
  c.name,
  nullif(concat_ws(', ', nullif(btrim(coalesce(c.location, '')), ''), nullif(btrim(coalesce(c.country, '')), '')), ''),
  c.slug,
  lower(regexp_replace(btrim(c.name || ' ' || btrim(split_part(c.location, ',', 1))), '[[:space:]]+', ' ', 'g')),
  (coalesce(cardinality(c.spotify_playlist_ids), 0) + coalesce(cardinality(c.additional_playlists), 0)) * 10
    + CASE WHEN coalesce(c.spotify_url, '') <> '' THEN 15 ELSE 0 END
    + CASE WHEN c.verified_at IS NOT NULL THEN 20 ELSE 0 END
    + CASE WHEN coalesce(c.header_image, '') <> '' OR coalesce(c.logo, '') <> '' THEN 8 ELSE 0 END
    + 95,
  now()
FROM churches c
WHERE c.status = 'approved'
  AND nullif(btrim(split_part(coalesce(c.location, ''), ',', 1)), '') IS NOT NULL
  AND position(lower(btrim(split_part(c.location, ',', 1))) IN lower(c.name)) = 0
ON CONFLICT (suggestion_key) DO UPDATE SET
  title = excluded.title,
  subtitle = excluded.subtitle,
  slug = excluded.slug,
  search_key = excluded.search_key,
  popularity = excluded.popularity,
  updated_at = excluded.updated_at;
