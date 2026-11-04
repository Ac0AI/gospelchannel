import { getSql } from "@/db";
import type { FacetLink } from "@/lib/church-directory";
import type { FacetKind, FacetRelatedLinks } from "@/lib/church";

/**
 * Precomputed facet links (drizzle-d1/0005_facet_links.sql).
 *
 * The related countries, cities, styles and denominations on a facet page, and
 * the full lists on the hub pages and in the sitemap, are aggregates over the
 * whole directory. Computing them per request read 300k-640k rows per query
 * several hundred times a day, and after each deploy the burst tripped D1's
 * limit ("Too many resources consumed within a 10 second window"). They are
 * now computed nightly (scripts/build-facet-links.ts) with the same SQL the
 * pages used, and read here with one primary-key range scan.
 *
 * City pages are not precomputed: their aggregates are bounded by the city
 * through idx_churches_status_city_slug and stay cheap per request.
 */

export type FacetLinkSourceKind = "all" | Exclude<FacetKind, "city">;
type TargetKind = keyof FacetRelatedLinks;

const TARGET_KINDS: TargetKind[] = ["country", "city", "style", "denomination"];
const GENERATION_KEY = "facet_links_generation";
const INSERT_BATCH = 400;

/** Per-kind related-link limits, matching what each facet page rendered before. */
export const FACET_RELATED_LIMITS: Record<FacetKind, Partial<Record<TargetKind, number>>> = {
  city: { country: 12, style: 8, denomination: 8 },
  country: { city: 12, style: 8, denomination: 8 },
  style: { country: 12, city: 12, denomination: 8 },
  denomination: { country: 12, city: 12, style: 8 },
};

export type FacetLinkRow = {
  sourceKind: FacetLinkSourceKind;
  sourceSlug: string;
  targetKind: TargetKind;
  position: number;
  targetSlug: string;
  label: string;
  count: number;
};

export function facetLinksToRows(
  sourceKind: FacetLinkSourceKind,
  sourceSlug: string,
  links: FacetRelatedLinks,
): FacetLinkRow[] {
  return TARGET_KINDS.flatMap((targetKind) =>
    links[targetKind].map((link, position) => ({
      sourceKind,
      sourceSlug,
      targetKind,
      position,
      targetSlug: link.slug,
      label: link.label,
      count: link.count,
    })),
  );
}

function emptyLinks(): FacetRelatedLinks {
  return { country: [], city: [], style: [], denomination: [] };
}

/**
 * The precomputed links for one source, or null when there are none: the table
 * is not migrated yet, no build has run, or the source is newer than the last
 * build. Callers then compute the links live.
 */
export async function readFacetLinks(
  sourceKind: FacetLinkSourceKind,
  sourceSlug: string,
): Promise<FacetRelatedLinks | null> {
  const sql = getSql();
  let rows: Array<{ tk: string; ts: string; lbl: string; n: number }>;
  try {
    // Aliased columns, so decodeD1Row never reinterprets them by name.
    rows = (await sql.query(
      `SELECT target_kind AS tk, target_slug AS ts, label AS lbl, count AS n
         FROM facet_links
        WHERE generation = (SELECT json_extract(value, '$') FROM app_kv WHERE key = $1)
          AND source_kind = $2
          AND source_slug = $3
        ORDER BY target_kind, position`,
      [GENERATION_KEY, sourceKind, sourceSlug],
    )) as typeof rows;
  } catch (error) {
    console.warn(
      `[facet-links] Precomputed links unavailable (${sourceKind}:${sourceSlug}): ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
  if (rows.length === 0) return null;

  const links = emptyLinks();
  for (const row of rows) {
    const kind = row.tk as TargetKind;
    if (!TARGET_KINDS.includes(kind)) continue;
    const link: FacetLink = {
      slug: row.ts,
      label: row.lbl,
      href: `/church/${kind}/${row.ts}`,
      count: Number(row.n),
    };
    links[kind].push(link);
  }
  return links;
}

/**
 * Writes a complete new generation, points app_kv at it, then deletes the
 * older generations. A failure before the pointer moves leaves the previous
 * generation in place.
 */
export async function writeFacetLinkGeneration(generation: string, rows: FacetLinkRow[]): Promise<void> {
  const sql = getSql();
  for (let start = 0; start < rows.length; start += INSERT_BATCH) {
    const batch = rows.slice(start, start + INSERT_BATCH).map((row) => ({
      sk: row.sourceKind,
      ss: row.sourceSlug,
      tk: row.targetKind,
      p: row.position,
      ts: row.targetSlug,
      l: row.label,
      c: row.count,
    }));
    await sql.query(
      `INSERT INTO facet_links (generation, source_kind, source_slug, target_kind, position, target_slug, label, count)
       SELECT $1, json_extract(value, '$.sk'), json_extract(value, '$.ss'), json_extract(value, '$.tk'),
              json_extract(value, '$.p'), json_extract(value, '$.ts'), json_extract(value, '$.l'),
              json_extract(value, '$.c')
         FROM json_each($2)`,
      [generation, batch],
    );
  }
  await sql.query(
    `INSERT INTO app_kv (key, value, updated_at) VALUES ($1, json_quote($2), unixepoch() * 1000)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [GENERATION_KEY, generation],
  );
  await sql.query(`DELETE FROM facet_links WHERE generation <> $1`, [generation]);
}
