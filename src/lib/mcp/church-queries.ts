// Neon query layer for the MCP church-finder tools.
//
// Every public function is wrapped in unstable_cache (R2-backed) — that is the
// primary protection against Neon load on a public endpoint. Near-queries cache
// on coordinates rounded to ~1.1 km so semantically-identical lookups collapse
// onto one cache entry. Service times are surfaced only when we actually hold
// them; we never fabricate a time.

import { unstable_cache } from "next/cache";
import { getSql } from "@/db";
import { INDEXABLE_ONBRAND_SCORE_MIN, OFF_BRAND_DENOMINATIONS } from "@/lib/content-quality";

const SITE_URL = "https://gospelchannel.com";
const CACHE_SECONDS = 3600;
const SERVICE_TIMES_NOTE = "Times are shown as last recorded. Confirm with the church before you go.";

export type ChurchResult = {
  slug: string;
  name: string;
  url: string;
  location: string | null;
  country: string | null;
  denomination: string | null;
  worshipStyles: string[];
  language: string | null;
  website: string | null;
  imageUrl: string | null;
  summary: string | null;
  distanceKm?: number;
  serviceTimes?: unknown;
  serviceTimesNote?: string;
  phone?: string;
  mapsUrl?: string;
  livestreamUrl?: string;
  streetAddress?: string | null;
  languages?: string[];
  hasKids?: boolean;
  hasVisitorDetails?: boolean;
  hasParkingInfo?: boolean;
  checkedAt?: string;
};

export type ChurchProfile = ChurchResult & {
  description: string | null;
  whatToExpect: string | null;
  pastorName: string | null;
  streetAddress: string | null;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  topSongs: Array<{ title: string; artist: string | null }>;
};

type ChurchRow = {
  slug: string;
  name: string;
  location: string | null;
  country: string | null;
  denomination: string | null;
  music_style: string[] | null;
  language: string | null;
  website: string | null;
  header_image: string | null;
  service_times: unknown;
  phone: string | null;
  google_maps_url: string | null;
  livestream_url: string | null;
  summary: string | null;
  website_url: string | null;
  cover_image_url: string | null;
  distance_km?: number | null;
  street_address?: string | null;
  languages?: string[] | null;
  has_kids?: boolean | null;
  has_visitor_details?: boolean | null;
  has_parking_info?: boolean | null;
  last_enriched_at?: string | Date | null;
};

type ProfileRow = ChurchRow & {
  description: string | null;
  what_to_expect: string | null;
  pastor_name: string | null;
  street_address: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
};

type Filters = {
  style?: string;
  denomination?: string;
  language?: string;
  hasServiceTimes?: boolean;
  kids?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function norm(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function cached<T>(keyParts: string[], fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, keyParts, { revalidate: CACHE_SECONDS, tags: ["mcp"] })();
}

// Positional-parameter builder: each call pushes a value and returns its $n token.
function makeParamBuilder() {
  const params: unknown[] = [];
  const p = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };
  return { params, p };
}

// SQL mirror of isIndexableChurch (content-quality.ts): worship playlist OR an
// on-brand denomination with display_score above the floor.
function indexableClause(c: string, denylistToken: string, scoreToken: string): string {
  return `AND (
    (array_length(${c}.spotify_playlist_ids, 1) > 0 OR array_length(${c}.additional_playlists, 1) > 0)
    OR (
      ${c}.denomination IS NOT NULL AND length(${c}.denomination) > 0
      AND NOT (${c}.denomination = ANY(${denylistToken}::text[]))
      AND ${c}.display_score IS NOT NULL AND ${c}.display_score >= ${scoreToken}
    )
  )`;
}

function buildFilters(p: (value: unknown) => string, filters: Filters, c = "c", e = "e"): string {
  const clauses: string[] = [];
  if (filters.style) {
    // Contains-match, not exact: stored values are phrases like "contemporary
    // worship", so a search for "contemporary" should still hit.
    const token = p(`%${filters.style}%`);
    clauses.push(`AND EXISTS (SELECT 1 FROM unnest(${c}.music_style) ms WHERE ms ILIKE ${token})`);
  }
  if (filters.denomination) {
    const token = p(`%${filters.denomination}%`);
    clauses.push(`AND ${c}.denomination ILIKE ${token}`);
  }
  if (filters.language) {
    const token = p(`%${filters.language}%`);
    clauses.push(
      `AND (${c}.language ILIKE ${token} OR EXISTS (SELECT 1 FROM unnest(${e}.languages) lg WHERE lg ILIKE ${token}))`,
    );
  }
  if (filters.hasServiceTimes) {
    clauses.push(`AND ${e}.service_times IS NOT NULL AND jsonb_typeof(${e}.service_times) = 'array' AND jsonb_array_length(${e}.service_times) > 0`);
  }
  if (filters.kids) {
    clauses.push(`AND (${e}.children_ministry IS TRUE OR ${e}.youth_ministry IS TRUE)`);
  }
  return clauses.join("\n      ");
}

function mapRow(row: ChurchRow): ChurchResult {
  const result: ChurchResult = {
    slug: row.slug,
    name: row.name,
    url: `${SITE_URL}/church/${row.slug}`,
    location: row.location ?? null,
    country: row.country ?? null,
    denomination: row.denomination ?? null,
    worshipStyles: Array.isArray(row.music_style) ? row.music_style : [],
    language: row.language ?? null,
    website: row.website ?? row.website_url ?? null,
    imageUrl: row.header_image ?? row.cover_image_url ?? null,
    summary: row.summary ?? null,
  };
  if (row.distance_km != null && Number.isFinite(Number(row.distance_km))) {
    result.distanceKm = Math.round(Number(row.distance_km) * 10) / 10;
  }
  const times = row.service_times;
  const hasTimes =
    times != null && (typeof times !== "object" || Array.isArray(times) || Object.keys(times as object).length > 0);
  if (hasTimes) {
    result.serviceTimes = times;
    result.serviceTimesNote = SERVICE_TIMES_NOTE;
  }
  if (row.phone) result.phone = row.phone;
  if (row.google_maps_url) result.mapsUrl = row.google_maps_url;
  if (row.livestream_url) result.livestreamUrl = row.livestream_url;
  if (row.street_address?.trim()) result.streetAddress = row.street_address.trim();
  if (Array.isArray(row.languages) && row.languages.length > 0) {
    result.languages = [...new Set(row.languages.map((value) => value.trim()).filter(Boolean))];
  }
  result.hasKids = row.has_kids === true;
  result.hasVisitorDetails = row.has_visitor_details === true;
  result.hasParkingInfo = row.has_parking_info === true;
  if (row.last_enriched_at) {
    const checkedAt = new Date(row.last_enriched_at);
    if (!Number.isNaN(checkedAt.getTime())) result.checkedAt = checkedAt.toISOString();
  }
  return result;
}

async function queryNear(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  limit: number;
  filters: Filters;
}): Promise<ChurchResult[]> {
  const sql = getSql();
  const { params, p } = makeParamBuilder();

  const latDelta = input.radiusKm / 111;
  const cosLat = Math.cos((input.lat * Math.PI) / 180);
  const lngDelta = input.radiusKm / (111 * Math.max(Math.abs(cosLat), 0.01));

  const latToken = p(input.lat);
  const lngToken = p(input.lng);
  const latMin = p(input.lat - latDelta);
  const latMax = p(input.lat + latDelta);
  const lngMin = p(input.lng - lngDelta);
  const lngMax = p(input.lng + lngDelta);
  const filterSql = buildFilters(p, input.filters);
  const denylist = p(OFF_BRAND_DENOMINATIONS as unknown as string[]);
  const score = p(INDEXABLE_ONBRAND_SCORE_MIN);
  const radius = p(input.radiusKm);
  const limit = p(input.limit);

  const text = `
    SELECT * FROM (
      SELECT
        c.slug, c.name, c.location, c.country, c.denomination, c.music_style, c.language,
        c.website, c.header_image,
        e.service_times, e.phone, e.google_maps_url, e.livestream_url, e.summary,
        e.website_url, e.cover_image_url, e.street_address, e.languages,
        (e.children_ministry IS TRUE OR e.youth_ministry IS TRUE) AS has_kids,
        (e.enrichment_status = 'complete' AND NULLIF(trim(e.what_to_expect), '') IS NOT NULL) AS has_visitor_details,
        (NULLIF(trim(e.parking_info), '') IS NOT NULL) AS has_parking_info,
        e.last_enriched_at,
        (6371 * acos(least(1, greatest(-1,
          sin(radians(${latToken})) * sin(radians(e.latitude)) +
          cos(radians(${latToken})) * cos(radians(e.latitude)) * cos(radians(e.longitude - ${lngToken}))
        )))) AS distance_km
      FROM churches c
      JOIN church_enrichments e ON e.church_slug = c.slug
      WHERE c.status = 'approved'
        AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
        AND e.latitude BETWEEN ${latMin} AND ${latMax}
        AND e.longitude BETWEEN ${lngMin} AND ${lngMax}
        ${indexableClause("c", denylist, score)}
        ${filterSql}
    ) ranked
    WHERE ranked.distance_km <= ${radius}
    ORDER BY ranked.distance_km ASC
    LIMIT ${limit}
  `;

  const rows = (await sql.query(text, params)) as ChurchRow[];
  return rows.map(mapRow);
}

async function queryInCity(input: {
  citySlug: string;
  limit: number;
  filters: Filters;
}): Promise<ChurchResult[]> {
  const sql = getSql();
  const { params, p } = makeParamBuilder();

  const city = p(input.citySlug);
  const filterSql = buildFilters(p, input.filters);
  const denylist = p(OFF_BRAND_DENOMINATIONS as unknown as string[]);
  const score = p(INDEXABLE_ONBRAND_SCORE_MIN);
  const limit = p(input.limit);

  const text = `
    SELECT
      c.slug, c.name, c.location, c.country, c.denomination, c.music_style, c.language,
      c.website, c.header_image,
      e.service_times, e.phone, e.google_maps_url, e.livestream_url, e.summary,
      e.website_url, e.cover_image_url
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.status = 'approved'
      AND c.city_slug = ${city}
      ${indexableClause("c", denylist, score)}
      ${filterSql}
    ORDER BY c.directory_rank ASC NULLS LAST, c.display_score DESC NULLS LAST, c.name ASC
    LIMIT ${limit}
  `;

  const rows = (await sql.query(text, params)) as ChurchRow[];
  return rows.map(mapRow);
}

async function queryProfile(slug: string): Promise<ChurchProfile | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `
    SELECT
      c.slug, c.name, c.description, c.location, c.country, c.denomination, c.music_style, c.language,
      c.website, c.header_image,
      e.service_times, e.phone, e.google_maps_url, e.livestream_url, e.summary, e.what_to_expect,
      e.pastor_name, e.street_address, e.website_url, e.cover_image_url,
      e.instagram_url, e.facebook_url, e.youtube_url
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.slug = $1 AND c.status = 'approved'
    LIMIT 1
  `,
    [slug],
  )) as ProfileRow[];

  const row = rows[0];
  if (!row) return null;

  const songs = (await sql.query(
    `SELECT title, artist_name FROM church_songs WHERE church_slug = $1 ORDER BY rank ASC LIMIT 5`,
    [slug],
  )) as Array<{ title: string; artist_name: string | null }>;

  const base = mapRow(row);
  return {
    ...base,
    description: row.description ?? null,
    whatToExpect: row.what_to_expect ?? null,
    pastorName: row.pastor_name ?? null,
    streetAddress: row.street_address ?? null,
    ...(row.instagram_url ? { instagramUrl: row.instagram_url } : {}),
    ...(row.facebook_url ? { facebookUrl: row.facebook_url } : {}),
    ...(row.youtube_url ? { youtubeUrl: row.youtube_url } : {}),
    topSongs: songs.map((song) => ({ title: song.title, artist: song.artist_name ?? null })),
  };
}

export async function findChurchesNear(input: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  worshipStyle?: string;
  denomination?: string;
  language?: string;
  hasServiceTimes?: boolean;
  kids?: boolean;
}): Promise<ChurchResult[]> {
  const lat = round2(input.latitude);
  const lng = round2(input.longitude);
  const radiusKm = clamp(Math.round(input.radiusKm ?? 40), 1, 500);
  const limit = clamp(Math.round(input.limit ?? 5), 1, 20);
  const filters: Filters = {
    style: norm(input.worshipStyle) || undefined,
    denomination: norm(input.denomination) || undefined,
    language: norm(input.language) || undefined,
    hasServiceTimes: input.hasServiceTimes === true,
    kids: input.kids === true,
  };
  const key = ["mcp-near", `${lat}|${lng}|${radiusKm}|${filters.style ?? ""}|${filters.denomination ?? ""}|${filters.language ?? ""}|${filters.hasServiceTimes ? "times" : ""}|${filters.kids ? "kids" : ""}|${limit}`];
  return cached(key, () => queryNear({ lat, lng, radiusKm, limit, filters }));
}

export async function findChurchesInCity(input: {
  citySlug: string;
  limit?: number;
  worshipStyle?: string;
  denomination?: string;
  language?: string;
}): Promise<ChurchResult[]> {
  const limit = clamp(Math.round(input.limit ?? 8), 1, 20);
  const filters: Filters = {
    style: norm(input.worshipStyle) || undefined,
    denomination: norm(input.denomination) || undefined,
    language: norm(input.language) || undefined,
  };
  const key = ["mcp-city", `${input.citySlug}|${filters.style ?? ""}|${filters.denomination ?? ""}|${filters.language ?? ""}|${limit}`];
  return cached(key, () => queryInCity({ citySlug: input.citySlug, limit, filters }));
}

export async function getChurchProfile(slug: string): Promise<ChurchProfile | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  return cached(["mcp-church", clean], () => queryProfile(clean));
}
