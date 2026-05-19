#!/usr/bin/env tsx

/**
 * Materialises churches.display_score so the search-indexing gate (sitemap
 * filter + detail-page robots meta) reads one persisted number instead of
 * recomputing the JS assessment per request.
 *
 * Zero-drift: imports the SAME functions the runtime uses
 * (deriveDisplayAssessment + the church.ts input transformers), so a
 * backfilled score equals what _getChurchPublicPageData would compute.
 *
 * Cost-safe: ONE keyset-paginated read pass over approved churches LEFT JOIN
 * church_enrichments (lean columns only — never the raw_* blobs), CPU-only
 * scoring, one batched UPDATE pass. Never calls getChurchPublicPageData per
 * church (that fans out to many queries × 73k → GB+ Neon egress).
 *
 * Usage:
 *   npx tsx scripts/backfill-display-score.ts --dry-run
 *   npx tsx scripts/backfill-display-score.ts --limit=2000
 *   npx tsx scripts/backfill-display-score.ts
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  deriveDisplayAssessment,
  getFirstServiceTimeLabel,
  isIndexableChurch,
  INDEXABLE_DISPLAY_SCORE_MIN,
} from "../src/lib/content-quality";
import {
  deriveChurchQuality,
  selectChurchPageVideos,
  resolveChurchPrimaryImage,
} from "../src/lib/church";
import type { ChurchConfig } from "../src/types/gospel";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
const sql = neon(DATABASE_URL);

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number.parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? "0",
  10,
);
// Optional explicit slug list — re-score just these (targeted self-healing
// after an enrichment run, instead of a full keyset pass).
const SLUGS = (process.argv.find((a) => a.startsWith("--slugs="))?.slice(8) ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const BATCH = 2500;

type Row = {
  slug: string;
  name: string;
  description: string | null;
  country: string | null;
  location: string | null;
  denomination: string | null;
  music_style: string[] | null;
  notable_artists: string[] | null;
  spotify_playlist_ids: string[] | null;
  additional_playlists: string[] | null;
  spotify_playlists: unknown;
  spotify_url: string | null;
  youtube_videos: unknown;
  header_image: string | null;
  logo: string | null;
  website: string | null;
  email: string | null;
  e_summary: string | null;
  e_seo_description: string | null;
  e_street_address: string | null;
  e_languages: string[] | null;
  e_service_times: unknown;
  e_website_url: string | null;
  e_contact_email: string | null;
  e_cover_image_url: string | null;
  e_logo_image_url: string | null;
  e_youtube_url: string | null;
  e_official_name: string | null;
};

function scoreRow(r: Row): number {
  // Mirror _getChurchPublicPageData's input assembly (src/lib/church.ts ~640).
  const church = {
    name: r.name,
    description: r.description ?? "",
    country: r.country ?? "",
    location: r.location ?? undefined,
    denomination: r.denomination ?? undefined,
    musicStyle: r.music_style ?? undefined,
    notableArtists: r.notable_artists ?? undefined,
    spotifyPlaylistIds: r.spotify_playlist_ids ?? [],
    additionalPlaylists: r.additional_playlists ?? [],
    spotifyPlaylists: r.spotify_playlists ?? undefined,
    spotifyUrl: r.spotify_url ?? undefined,
    youtubeVideos: r.youtube_videos ?? undefined,
    headerImage: r.header_image ?? undefined,
    logo: r.logo ?? undefined,
    email: r.email ?? undefined,
  } as unknown as ChurchConfig;

  const enrichment = {
    summary: r.e_summary ?? undefined,
    seoDescription: r.e_seo_description ?? undefined,
    streetAddress: r.e_street_address ?? undefined,
    languages: r.e_languages ?? undefined,
    serviceTimes: Array.isArray(r.e_service_times) ? r.e_service_times : undefined,
    websiteUrl: r.e_website_url ?? undefined,
    contactEmail: r.e_contact_email ?? undefined,
    coverImageUrl: r.e_cover_image_url ?? undefined,
    logoImageUrl: r.e_logo_image_url ?? undefined,
    youtubeUrl: r.e_youtube_url ?? undefined,
    officialChurchName: r.e_official_name ?? undefined,
  };

  const metrics = deriveChurchQuality(church);
  const cached = (Array.isArray(r.youtube_videos) ? r.youtube_videos : []) as Array<{
    videoId: string;
    title: string;
    thumbnailUrl?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
  }>;
  const videos = selectChurchPageVideos(
    cached.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      channelTitle: v.channelTitle ?? church.name,
      viewCount: 0,
      channelId: v.channelId,
      publishedAt: v.publishedAt,
    })),
    { church, enrichment },
  );

  // Indexing-substance assessment: feed the RAW church.description, NOT
  // resolveChurchPublicDescription's synthesized fallback. The fallback always
  // emits a sentence ("X is a church in Y."), which makes hasLongText true for
  // genuinely empty stubs and would leave them indexed. Raw input makes score
  // 20 == "no real text/music/media" == the empty pages we want to noindex,
  // while a real (even AI-written) description >=80 chars keeps the page
  // indexed. This intentionally diverges from the runtime DISPLAY score
  // (church.ts) because it answers a different question: index-worthiness, not
  // card-display readiness.
  const { displayScore } = deriveDisplayAssessment({
    description: church.description,
    enrichmentSummary: enrichment.summary,
    country: church.country,
    location: enrichment.streetAddress || church.location,
    serviceTimeLabel: getFirstServiceTimeLabel(enrichment.serviceTimes),
    websiteUrl: enrichment.websiteUrl || church.website,
    contactEmail: enrichment.contactEmail || church.email,
    spotifyUrl: church.spotifyUrl,
    playlistCount: metrics.playlistCount,
    videoCount: videos.length,
    thumbnailUrl: resolveChurchPrimaryImage({
      headerImage: church.headerImage,
      videos,
      coverImageUrl: enrichment.coverImageUrl,
    }),
    logoUrl: church.logo || enrichment.logoImageUrl,
    headerImage: church.headerImage,
  });
  return displayScore;
}

async function main() {
  console.log(
    `backfill-display-score  threshold=${INDEXABLE_DISPLAY_SCORE_MIN}  ${DRY_RUN ? "DRY-RUN" : "WRITE"}${LIMIT ? `  limit=${LIMIT}` : ""}`,
  );
  let cursor = "";
  let processed = 0;
  let indexable = 0;
  const hist = new Map<number, number>();

  const SELECT_COLS = `c.slug, c.name, c.description, c.country, c.location, c.denomination,
              c.music_style, c.notable_artists, c.spotify_playlist_ids, c.additional_playlists,
              c.spotify_playlists, c.spotify_url, c.youtube_videos, c.header_image, c.logo,
              c.website, c.email,
              ce.summary AS e_summary, ce.seo_description AS e_seo_description,
              ce.street_address AS e_street_address, ce.languages AS e_languages,
              ce.service_times AS e_service_times, ce.website_url AS e_website_url,
              ce.contact_email AS e_contact_email, ce.cover_image_url AS e_cover_image_url,
              ce.logo_image_url AS e_logo_image_url, ce.youtube_url AS e_youtube_url,
              ce.official_church_name AS e_official_name`;

  for (;;) {
    const rows = (SLUGS.length > 0
      ? ((await sql.query(
          `SELECT ${SELECT_COLS}
           FROM churches c
           LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
           WHERE c.status = 'approved' AND c.slug = ANY($1::text[])`,
          [SLUGS],
        )) as Row[])
      : ((await sql.query(
          `SELECT ${SELECT_COLS}
           FROM churches c
           LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
           WHERE c.status = 'approved' AND c.slug > $1
           ORDER BY c.slug
           LIMIT $2`,
          [cursor, BATCH],
        )) as Row[]));

    if (rows.length === 0) break;

    const updates: Array<{ slug: string; score: number }> = [];
    for (const r of rows) {
      const score = scoreRow(r);
      updates.push({ slug: r.slug, score });
      hist.set(score, (hist.get(score) ?? 0) + 1);
      if (isIndexableChurch(score)) indexable += 1;
    }

    if (!DRY_RUN) {
      await sql.query(
        `UPDATE churches AS c SET display_score = d.score
         FROM jsonb_to_recordset($1::jsonb) AS d(slug text, score int)
         WHERE c.slug = d.slug`,
        [JSON.stringify(updates)],
      );
    }

    processed += rows.length;
    cursor = rows[rows.length - 1].slug;
    process.stdout.write(`\r  processed ${processed}  indexable ${indexable}`);
    if (SLUGS.length > 0) break;
    if (LIMIT && processed >= LIMIT) break;
  }

  console.log(`\n\nScore distribution (processed ${processed}):`);
  for (const score of [...hist.keys()].sort((a, b) => a - b)) {
    const n = hist.get(score)!;
    const mark = score >= INDEXABLE_DISPLAY_SCORE_MIN ? "INDEX " : "noindex";
    console.log(`  ${String(score).padStart(3)} ${mark}  ${n}`);
  }
  const pct = processed ? ((indexable / processed) * 100).toFixed(1) : "0";
  console.log(
    `\nIndexable (>= ${INDEXABLE_DISPLAY_SCORE_MIN}): ${indexable} / ${processed} (${pct}%)  -> ${processed - indexable} deindexed`,
  );
  if (DRY_RUN) console.log("DRY-RUN: no rows written.");
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
