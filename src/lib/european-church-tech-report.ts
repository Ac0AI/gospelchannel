/**
 * Data layer for the "European Church Tech 2026" report.
 *
 * Aggregates observed digital signals (website, CMS detection, Facebook/YouTube
 * presence, livestream) per country across approved churches. Methodology:
 * we measured what each church's public presence shows. We did not survey.
 *
 * Output shape is consumed by the report page at
 * /european-church-tech-2026 and the press-kit JSON download.
 */
import { unstable_cache } from "next/cache";
import { getSql } from "@/db";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";

const EMPTY_REPORT: ReportData = {
  generatedAt: new Date(0).toISOString(),
  version: "offline-stub",
  primary: [],
  smaller: [],
  totals: { countries: 0, churches: 0 },
  topPlatforms: [],
  cmsBreakdown: {
    totalDetected: 0,
    wordpressCount: 0,
    wordpressShare: 0,
    modernDiyCount: 0,
    churchPlatformCount: 0,
    modernFrameworkCount: 0,
  },
  cmsByCountry: [],
  spotifyRates: [],
};

export const REPORT_VERSION = "2026-04-28-r5";

/** Countries that anchor the leaderboard (≥250 approved churches). */
const TIER_PRIMARY = [
  "United Kingdom",
  "Germany",
  "France",
  "Spain",
  "Sweden",
  "Italy",
  "Switzerland",
  "Norway",
] as const;

/** Smaller markets called out separately by coverage rate. */
const TIER_SMALLER = [
  "Netherlands",
  "Denmark",
  "Finland",
  "Belgium",
  "Austria",
  "Ireland",
  "Poland",
  "Czech Republic",
  "Hungary",
  "Greece",
  "Portugal",
] as const;

const ALL_COUNTRIES = [...TIER_PRIMARY, ...TIER_SMALLER];

export type CountryStats = {
  country: string;
  /** Total approved churches in our catalog. */
  total: number;
  /** Number with any website (churches.website OR enrichments.website_url). */
  withWebsite: number;
  /** Number with website tech detected (CMS / platform identified). */
  withCms: number;
  /** Number with any Facebook URL detected. */
  withFacebook: number;
  /** Number with any YouTube channel/URL detected. */
  withYouTube: number;
  /** Number with a confirmed livestream URL. */
  withLivestream: number;
  /** Coverage percentages, rounded to nearest integer. */
  pct: {
    website: number;
    cms: number;
    facebook: number;
    youtube: number;
    livestream: number;
  };
};

export type SpotifyRate = {
  country: string;
  total: number;
  active: number;
  pct: number;
};

export type CmsBreakdown = {
  /** Total detected CMS rows across primary tier countries. */
  totalDetected: number;
  /** Number of WordPress installs across primary tier. */
  wordpressCount: number;
  /** WordPress share of detected platforms, percentage 0-100. */
  wordpressShare: number;
  /** Combined Squarespace/Wix/Webflow count — "modern DIY" tier. */
  modernDiyCount: number;
  /** Combined count for church-specific platforms (Subsplash, Faithlife, etc). */
  churchPlatformCount: number;
  /** Combined count for modern JS frameworks (Next.js, Nuxt, Gatsby, Framer). */
  modernFrameworkCount: number;
};

export type CountryCmsRate = {
  country: string;
  detected: number;
  modernDiyPct: number;
  wordpressPct: number;
};

export type ReportData = {
  generatedAt: string;
  version: string;
  primary: CountryStats[]; // ranked by composite score
  smaller: CountryStats[]; // sorted by avg coverage
  totals: {
    countries: number;
    churches: number;
  };
  /** Top CMS platforms across the primary tier — for the platform-mix chart. */
  topPlatforms: Array<{ platform: string; count: number }>;
  /** Aggregate CMS breakdown across primary markets. */
  cmsBreakdown: CmsBreakdown;
  /** Per-country CMS / modern DIY rate. */
  cmsByCountry: CountryCmsRate[];
  /** Spotify presence rate by country (sorted high to low). */
  spotifyRates: SpotifyRate[];
};

/** Composite score 0-100 used for primary tier ranking. Equal-weighted. */
function compositeScore(s: CountryStats): number {
  return Math.round(
    (s.pct.website + s.pct.cms + s.pct.facebook + s.pct.youtube + s.pct.livestream) / 5,
  );
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * Run the per-country aggregation. One query for the whole leaderboard +
 * smaller markets — Neon handles this comfortably under the church_index_tag
 * cache window.
 */
async function fetchCountryStats(): Promise<CountryStats[]> {
  const sql = getSql();

  const rows = (await sql.query(
    `
    SELECT
      c.country AS country,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE c.website IS NOT NULL OR e.website_url IS NOT NULL)::int AS with_website,
      COUNT(t.primary_platform)::int AS with_cms,
      COUNT(*) FILTER (WHERE c.facebook_url IS NOT NULL OR e.facebook_url IS NOT NULL)::int AS with_facebook,
      COUNT(*) FILTER (WHERE c.youtube_channel_id IS NOT NULL OR e.youtube_url IS NOT NULL)::int AS with_youtube,
      COUNT(*) FILTER (WHERE e.livestream_url IS NOT NULL)::int AS with_livestream
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    LEFT JOIN church_website_tech t ON t.church_slug = c.slug
    WHERE c.status = 'approved'
      AND c.country = ANY($1)
    GROUP BY c.country
    `,
    [ALL_COUNTRIES],
  )) as Array<{
    country: string;
    total: number;
    with_website: number;
    with_cms: number;
    with_facebook: number;
    with_youtube: number;
    with_livestream: number;
  }>;

  return rows.map((row) => {
    const total = row.total;
    const stats: CountryStats = {
      country: row.country,
      total,
      withWebsite: row.with_website,
      withCms: row.with_cms,
      withFacebook: row.with_facebook,
      withYouTube: row.with_youtube,
      withLivestream: row.with_livestream,
      pct: {
        website: pct(row.with_website, total),
        cms: pct(row.with_cms, total),
        facebook: pct(row.with_facebook, total),
        youtube: pct(row.with_youtube, total),
        livestream: pct(row.with_livestream, total),
      },
    };
    return stats;
  });
}

/**
 * Top 8 detected CMS / hosting platforms across the primary tier.
 * Used for the "what European churches actually run" chart.
 */
async function fetchTopPlatforms(): Promise<ReportData["topPlatforms"]> {
  const sql = getSql();

  const rows = (await sql.query(
    `
    SELECT
      t.primary_platform AS platform,
      COUNT(*)::int AS n
    FROM churches c
    JOIN church_website_tech t ON t.church_slug = c.slug
    WHERE c.status = 'approved'
      AND c.country = ANY($1)
      AND t.primary_platform IS NOT NULL
      AND t.primary_platform <> ''
    GROUP BY t.primary_platform
    ORDER BY n DESC
    LIMIT 8
    `,
    [TIER_PRIMARY],
  )) as Array<{ platform: string; n: number }>;

  return rows.map((row) => ({ platform: row.platform, count: row.n }));
}

const MODERN_DIY = ["Squarespace", "Wix", "Webflow"] as const;
const CHURCH_PLATFORMS = [
  "Subsplash",
  "Faithlife",
  "Tithe.ly",
  "Pushpay",
  "Church Center",
  "Planningcenter",
  "Ekklesia",
] as const;
const MODERN_FRAMEWORKS = ["Next.js", "Nuxt", "Gatsby", "Framer"] as const;

async function fetchCmsBreakdown(): Promise<{
  breakdown: CmsBreakdown;
  byCountry: CountryCmsRate[];
}> {
  const sql = getSql();

  const rows = (await sql.query(
    `
    SELECT
      c.country AS country,
      COUNT(t.primary_platform)::int AS detected,
      COUNT(*) FILTER (WHERE t.primary_platform = 'WordPress')::int AS wordpress,
      COUNT(*) FILTER (WHERE t.primary_platform = ANY($2))::int AS modern_diy,
      COUNT(*) FILTER (WHERE t.primary_platform = ANY($3))::int AS church_platform,
      COUNT(*) FILTER (WHERE t.primary_platform = ANY($4))::int AS modern_framework
    FROM churches c
    LEFT JOIN church_website_tech t ON t.church_slug = c.slug
    WHERE c.status = 'approved'
      AND c.country = ANY($1)
    GROUP BY c.country
    `,
    [
      TIER_PRIMARY,
      [...MODERN_DIY],
      [...CHURCH_PLATFORMS],
      [...MODERN_FRAMEWORKS],
    ],
  )) as Array<{
    country: string;
    detected: number;
    wordpress: number;
    modern_diy: number;
    church_platform: number;
    modern_framework: number;
  }>;

  const totalDetected = rows.reduce((sum, r) => sum + r.detected, 0);
  const wordpressCount = rows.reduce((sum, r) => sum + r.wordpress, 0);
  const modernDiyCount = rows.reduce((sum, r) => sum + r.modern_diy, 0);
  const churchPlatformCount = rows.reduce((sum, r) => sum + r.church_platform, 0);
  const modernFrameworkCount = rows.reduce((sum, r) => sum + r.modern_framework, 0);

  const breakdown: CmsBreakdown = {
    totalDetected,
    wordpressCount,
    wordpressShare: pct(wordpressCount, totalDetected),
    modernDiyCount,
    churchPlatformCount,
    modernFrameworkCount,
  };

  const byCountry: CountryCmsRate[] = rows
    .filter((r) => r.detected >= 50)
    .map((r) => ({
      country: r.country,
      detected: r.detected,
      modernDiyPct: pct(r.modern_diy, r.detected),
      wordpressPct: pct(r.wordpress, r.detected),
    }))
    .sort((a, b) => b.modernDiyPct - a.modernDiyPct);

  return { breakdown, byCountry };
}

async function fetchSpotifyRates(): Promise<SpotifyRate[]> {
  const sql = getSql();

  const rows = (await sql.query(
    `
    SELECT
      country,
      COUNT(spotify_url)::int AS active,
      COUNT(*)::int AS total
    FROM churches
    WHERE status = 'approved'
      AND country = ANY($1)
    GROUP BY country
    HAVING COUNT(spotify_url) > 0
    `,
    [ALL_COUNTRIES],
  )) as Array<{ country: string; active: number; total: number }>;

  return rows
    .map((row) => ({
      country: row.country,
      total: row.total,
      active: row.active,
      pct: row.total > 0 ? Math.round((row.active / row.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

async function buildReport(): Promise<ReportData> {
  // CI / build-time prerender runs without DATABASE_URL; return a stub so
  // the page and JSON API can be statically built. First runtime request
  // re-fetches with real data.
  if (isOfflinePublicBuild()) return EMPTY_REPORT;

  const [stats, topPlatforms, cmsResult, spotifyRates] = await Promise.all([
    fetchCountryStats(),
    fetchTopPlatforms(),
    fetchCmsBreakdown(),
    fetchSpotifyRates(),
  ]);
  const { breakdown: cmsBreakdown, byCountry: cmsByCountry } = cmsResult;

  const byCountry = new Map(stats.map((s) => [s.country, s]));

  const primary = TIER_PRIMARY.map((c) => byCountry.get(c)).filter(
    (s): s is CountryStats => Boolean(s),
  );
  primary.sort((a, b) => compositeScore(b) - compositeScore(a));

  const smaller = TIER_SMALLER.map((c) => byCountry.get(c))
    .filter((s): s is CountryStats => Boolean(s))
    .filter((s) => s.total >= 20);
  smaller.sort((a, b) => compositeScore(b) - compositeScore(a));

  const totalChurches = stats.reduce((sum, s) => sum + s.total, 0);

  return {
    generatedAt: new Date().toISOString(),
    version: REPORT_VERSION,
    primary,
    smaller,
    totals: {
      countries: primary.length + smaller.length,
      churches: totalChurches,
    },
    topPlatforms,
    cmsBreakdown,
    cmsByCountry,
    spotifyRates,
  };
}

/**
 * Cached entrypoint. 1-hour revalidate keeps Neon load low while data updates
 * naturally as enrichment runs land.
 */
export const getEuropeanChurchTechReport = unstable_cache(
  buildReport,
  [`european-church-tech-report-${REPORT_VERSION}`],
  { revalidate: 3600, tags: ["european-church-tech-report"] },
);

export { compositeScore };
