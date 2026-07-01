import { getSql, hasDatabaseConfig } from "@/db";

export type DiscoveryChurch = {
  name: string;
  slug: string;
  location: string | null;
  country: string | null;
  website: string | null;
  denomination: string | null;
  musicStyle: string[] | null;
  language: string | null;
  headerImage: string | null;
  logo: string | null;
};

// Charismatic / Pentecostal / gospel churches across Greater London.
//
// Two data wrinkles this query is deliberately built around (verified 2026-07-01):
//   1. "London" is fragmented across city_slug values (london, north-london,
//      southeast-london, southwest-london, ...), so we match the whole area with
//      ILIKE '%london%' rather than an exact slug — otherwise we undercount badly
//      (e.g. miss Hillsong North/Southeast/Southwest London).
//   2. The intent cluster is tradition-based (Pentecostal, Charismatic, Vineyard,
//      Elim) OR worship-style-tagged (charismatic/pentecostal/gospel) — deliberately
//      NOT plain "contemporary worship", which would drag in Baptist / Evangelical
//      Free churches that nobody means by "charismatic or gospel".
//
// Ranked by the same directory_score the rest of the site uses, so the flagships
// (Hillsong Church London, Kensington Temple) surface first. Real data only.
export async function getLondonCharismaticChurches(): Promise<DiscoveryChurch[]> {
  if (!hasDatabaseConfig()) return [];
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT name, slug, location, country, website, denomination, music_style, language, header_image, logo
      FROM churches
      WHERE status = 'approved'
        AND city_slug ILIKE '%london%'
        AND (
          denomination ILIKE ANY(ARRAY['%pentecostal%', '%charismatic%', '%elim%', '%vineyard%'])
          OR music_style && ARRAY['charismatic worship', 'pentecostal', 'gospel']
        )
      ORDER BY directory_score DESC NULLS LAST, name
    `) as Array<Record<string, unknown>>;

    return rows.map(toDiscoveryChurch);
  } catch {
    return [];
  }
}

// Global "worship-known" churches — the same directory_score ranking the rest of
// the site uses, filtered to churches whose data already flags them as worship-
// led (contemporary/charismatic worship, gospel, pentecostal tags or tradition).
// No independent "best" claim beyond our own directory ranking — the page discloses
// that methodology rather than asserting an unverifiable superlative.
export async function getBestWorshipChurches(limit = 30): Promise<DiscoveryChurch[]> {
  if (!hasDatabaseConfig()) return [];
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT name, slug, location, country, website, denomination, music_style, language, header_image, logo
      FROM churches
      WHERE status = 'approved'
        AND (
          denomination ILIKE ANY(ARRAY['%pentecostal%', '%charismatic%', '%elim%', '%vineyard%'])
          OR music_style && ARRAY['charismatic worship', 'pentecostal', 'gospel', 'contemporary worship']
        )
      ORDER BY directory_score DESC NULLS LAST, name
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    return rows.map(toDiscoveryChurch);
  } catch {
    return [];
  }
}

function toDiscoveryChurch(row: Record<string, unknown>): DiscoveryChurch {
  return {
    name: String(row.name),
    slug: String(row.slug),
    location: (row.location as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    denomination: (row.denomination as string | null) ?? null,
    musicStyle: (row.music_style as string[] | null) ?? null,
    language: (row.language as string | null) ?? null,
    headerImage: (row.header_image as string | null) ?? null,
    logo: (row.logo as string | null) ?? null,
  };
}
