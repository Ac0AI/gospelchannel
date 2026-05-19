/**
 * Single source of truth for the two materialized facet columns
 * (`churches.city_slug`, `churches.directory_score`).
 *
 * Zero-drift contract: the backfill script, every runtime write path that
 * recomputes these columns, and the parity tests ALL import from here. The
 * directory score itself is the existing `getDirectoryScore` (re-exported, not
 * reimplemented) so the DB-sorted facet list cannot diverge from the old
 * in-memory `filterChurchDirectory` + `getDirectoryScore` ordering.
 *
 * Why these are persisted: facet/browse pages used to pull all ~72.8k
 * approved churches (~56 MB) into the Cloudflare Worker to filter+sort in JS,
 * which OOM'd the isolate (503s). With these columns the DB does the filter
 * (`city_slug = $1`) and sort (`directory_score DESC`) and only a page of
 * rows crosses the wire.
 */
import { slugify } from "@/lib/slugify";
import { extractCity } from "@/lib/church-directory";

/**
 * `churches.city_slug`. Mirrors the old in-memory city facet predicate
 * `slugify(extractCity(location)) === citySlug` exactly (same `extractCity`,
 * same `slugify`). Returns null when no city can be extracted so the column
 * is NULL (city facet simply won't list the church) rather than a bogus slug.
 */
export function computeCitySlug(location?: string | null): string | null {
  const city = extractCity(location ?? undefined);
  if (!city) return null;
  const slug = slugify(city);
  return slug ? slug : null;
}

/**
 * `churches.directory_score`. Re-export — NOT a reimplementation — so there is
 * exactly one scoring formula shared by the old JS browse sort and the new
 * SQL `ORDER BY directory_score`. `real` column (formula has
 * `dataRichnessScore * 0.5`).
 */
export { getDirectoryScore as computeDirectoryScore } from "@/lib/church-directory";
export type { ChurchDirectoryEntry } from "@/lib/church-directory";
