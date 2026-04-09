#!/usr/bin/env node

/**
 * Targeted enrichment for a specific list of church slugs.
 *
 * For each slug:
 * 1. Fetches the church website (Firecrawl, with native fetch fallback)
 * 2. Extracts Spotify links from the HTML via regex
 * 3. Calls Claude Haiku to extract structured data:
 *    street_address, denomination_network, theological_orientation,
 *    service_times, summary, pastor_name, pastor_title, languages,
 *    instagram/facebook/youtube URLs, what_to_expect
 * 4. Upserts into church_enrichments
 * 5. Updates churches.spotify_playlist_ids and spotify_url if Spotify
 *    links were found and no playlist is set yet
 *
 * Usage:
 *   node scripts/enrich-by-slugs.mjs --slugs=slug1,slug2,slug3
 *   node scripts/enrich-by-slugs.mjs --slugs=... --dry-run
 *
 * Required env: DATABASE_URL, ANTHROPIC_API_KEY
 * Optional env: FIRECRAWL_API_KEY (falls back to raw fetch)
 */

import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

loadLocalEnv(process.cwd());

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const DRY_RUN = process.argv.includes("--dry-run");
const slugArg = process.argv.find(a => a.startsWith("--slugs="));
const SLUGS = slugArg ? slugArg.split("=")[1].split(",").map(s => s.trim()).filter(Boolean) : [];

if (SLUGS.length === 0) {
  console.error("Usage: node scripts/enrich-by-slugs.mjs --slugs=slug1,slug2,slug3 [--dry-run]");
  process.exit(1);
}

// ─────────── Website fetching ───────────

async function fetchWithFirecrawl(url) {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        waitFor: 1500,
        timeout: 20000,
      }),
    });
    if (!res.ok) {
      console.log(`    [firecrawl] ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    return {
      markdown: data?.data?.markdown?.slice(0, 40000) || "",
      html: data?.data?.html?.slice(0, 40000) || "",
    };
  } catch (err) {
    console.log(`    [firecrawl] error: ${err.message}`);
    return null;
  }
}

async function fetchRaw(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return { markdown: "", html: html.slice(0, 40000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWebsite(url) {
  const fc = await fetchWithFirecrawl(url);
  if (fc && (fc.markdown || fc.html)) return fc;
  return fetchRaw(url);
}

// ─────────── Spotify link extraction ───────────

const SPOTIFY_LINK_RE = /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(artist|playlist|album|track)\/([A-Za-z0-9]+)/g;

function extractSpotifyLinks(content) {
  const links = new Set();
  const byType = { artist: [], playlist: [], album: [], track: [] };
  for (const match of content.matchAll(SPOTIFY_LINK_RE)) {
    const [full, type, id] = match;
    const clean = `https://open.spotify.com/${type}/${id}`;
    if (links.has(clean)) continue;
    links.add(clean);
    byType[type].push(id);
  }
  return byType;
}

// ─────────── Haiku extraction ───────────

async function haikuExtract({ name, country, website, content }) {
  const systemPrompt = `You are a data analyst for GospelChannel.com, a directory of worship-active churches.
Analyze church website content and extract structured information.
Respond ONLY with valid JSON — no markdown fences, no commentary.`;

  const userPrompt = `Church: ${name}
Country: ${country}
Website: ${website}

Website content:
${content.slice(0, 28000)}

Extract the following JSON. Use null (not empty strings) for missing fields.

{
  "street_address": "Full physical address including street, city, postal code. null if not found.",
  "theological_orientation": "One of: evangelical, pentecostal, charismatic, reformed, lutheran, anglican, catholic, orthodox, baptist, methodist, non-denominational. null if unclear.",
  "denomination_network": "Network/movement name if applicable (e.g. Hillsong, C3 Church, ICF, Vineyard, Newfrontiers, Assembly of God). null if independent.",
  "languages": ["Array of languages services are held in, lowercase. e.g. ['english','dutch']. null if not found."],
  "service_times": [{"day": "Sunday", "time": "10:30"}],
  "summary": "One paragraph (max 240 chars) describing this church — what makes it unique, who it serves, worship style. Natural human-written tone.",
  "pastor_name": "Lead pastor full name. null if not found.",
  "pastor_title": "Pastor's title e.g. 'Lead Pastor', 'Senior Pastor'. null if not found.",
  "phone": "Phone number in international format if possible. null if not found.",
  "instagram_url": "Full https URL to their Instagram profile. null if not found.",
  "facebook_url": "Full https URL to their Facebook page. null if not found.",
  "youtube_url": "Full https URL to their YouTube channel. null if not found.",
  "livestream_url": "Direct URL to watch their livestream if available. null otherwise.",
  "what_to_expect": "Short (max 180 chars) answer to 'what should a first-time visitor expect'. Casual dress? Length? Style? null if you cannot tell."
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned);
}

// ─────────── DB upsert ───────────

async function upsertEnrichment(slug, extracted) {
  const existing = await sql`SELECT id FROM church_enrichments WHERE church_slug = ${slug} LIMIT 1`;

  if (existing.length > 0) {
    await sql.query(
      `UPDATE church_enrichments SET
        street_address = COALESCE($1, street_address),
        theological_orientation = COALESCE($2, theological_orientation),
        denomination_network = COALESCE($3, denomination_network),
        languages = COALESCE($4::text[], languages),
        service_times = COALESCE($5::jsonb, service_times),
        summary = COALESCE($6, summary),
        pastor_name = COALESCE($7, pastor_name),
        pastor_title = COALESCE($8, pastor_title),
        phone = COALESCE($9, phone),
        instagram_url = COALESCE($10, instagram_url),
        facebook_url = COALESCE($11, facebook_url),
        youtube_url = COALESCE($12, youtube_url),
        livestream_url = COALESCE($13, livestream_url),
        what_to_expect = COALESCE($14, what_to_expect),
        enrichment_status = 'complete',
        last_enriched_at = NOW(),
        updated_at = NOW()
      WHERE church_slug = $15`,
      [
        extracted.street_address,
        extracted.theological_orientation,
        extracted.denomination_network,
        extracted.languages,
        extracted.service_times ? JSON.stringify(extracted.service_times) : null,
        extracted.summary,
        extracted.pastor_name,
        extracted.pastor_title,
        extracted.phone,
        extracted.instagram_url,
        extracted.facebook_url,
        extracted.youtube_url,
        extracted.livestream_url,
        extracted.what_to_expect,
        slug,
      ],
    );
  } else {
    await sql.query(
      `INSERT INTO church_enrichments (
        church_slug, street_address, theological_orientation, denomination_network,
        languages, service_times, summary, pastor_name, pastor_title, phone,
        instagram_url, facebook_url, youtube_url, livestream_url, what_to_expect,
        enrichment_status, last_enriched_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5::text[], $6::jsonb, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, 'complete', NOW(), NOW(), NOW()
      )`,
      [
        slug,
        extracted.street_address,
        extracted.theological_orientation,
        extracted.denomination_network,
        extracted.languages,
        extracted.service_times ? JSON.stringify(extracted.service_times) : null,
        extracted.summary,
        extracted.pastor_name,
        extracted.pastor_title,
        extracted.phone,
        extracted.instagram_url,
        extracted.facebook_url,
        extracted.youtube_url,
        extracted.livestream_url,
        extracted.what_to_expect,
      ],
    );
  }
}

async function updateSpotify(slug, spotify) {
  const current = await sql`SELECT spotify_url, spotify_playlist_ids FROM churches WHERE slug = ${slug}`;
  const row = current[0];
  if (!row) return;

  const updates = {};

  // Only set spotify_url if not set and we found an artist/playlist link
  if (!row.spotify_url) {
    if (spotify.artist.length > 0) {
      updates.spotify_url = `https://open.spotify.com/artist/${spotify.artist[0]}`;
    } else if (spotify.playlist.length > 0) {
      updates.spotify_url = `https://open.spotify.com/playlist/${spotify.playlist[0]}`;
    }
  }

  // Only add playlist IDs if none exist
  const existingIds = row.spotify_playlist_ids || [];
  if (existingIds.length === 0 && spotify.playlist.length > 0) {
    updates.spotify_playlist_ids = spotify.playlist.slice(0, 5);
  }

  if (Object.keys(updates).length === 0) return;

  if ("spotify_url" in updates && "spotify_playlist_ids" in updates) {
    await sql`UPDATE churches SET spotify_url = ${updates.spotify_url}, spotify_playlist_ids = ${updates.spotify_playlist_ids}, updated_at = NOW() WHERE slug = ${slug}`;
  } else if ("spotify_url" in updates) {
    await sql`UPDATE churches SET spotify_url = ${updates.spotify_url}, updated_at = NOW() WHERE slug = ${slug}`;
  } else if ("spotify_playlist_ids" in updates) {
    await sql`UPDATE churches SET spotify_playlist_ids = ${updates.spotify_playlist_ids}, updated_at = NOW() WHERE slug = ${slug}`;
  }
}

// ─────────── Main ───────────

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Slugs: ${SLUGS.length}`);
  console.log();

  const churches = await sql`
    SELECT slug, name, website, country
    FROM churches
    WHERE slug = ANY(${SLUGS}::text[]) AND status = 'approved'
  `;

  if (churches.length === 0) {
    console.error("No approved churches found for those slugs");
    process.exit(1);
  }

  console.log(`Loaded ${churches.length} churches from DB`);
  console.log();

  let successCount = 0;
  let failCount = 0;

  for (const church of churches) {
    console.log(`• ${church.name}`);
    console.log(`  slug: ${church.slug}`);

    if (!church.website) {
      console.log(`  ⏭ no website, skipping`);
      failCount++;
      continue;
    }

    const content = await fetchWebsite(church.website);
    if (!content || (!content.markdown && !content.html)) {
      console.log(`  ⏭ failed to fetch website`);
      failCount++;
      continue;
    }

    const combined = (content.markdown || "") + "\n\n" + (content.html || "");
    const spotify = extractSpotifyLinks(combined);
    const spotifyFound = spotify.artist.length + spotify.playlist.length;
    console.log(`  ✓ fetched ${combined.length} chars · ${spotifyFound} spotify link(s)`);

    let extracted;
    try {
      extracted = await haikuExtract({
        name: church.name,
        country: church.country,
        website: church.website,
        content: content.markdown || content.html,
      });
    } catch (err) {
      console.log(`  ✗ haiku error: ${err.message}`);
      failCount++;
      continue;
    }

    const found = Object.entries(extracted)
      .filter(([, v]) => v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0))
      .map(([k]) => k);
    console.log(`  ✓ extracted: ${found.join(", ") || "nothing"}`);

    if (DRY_RUN) {
      console.log(`  (dry run — not writing to DB)`);
      console.log();
      successCount++;
      continue;
    }

    try {
      await upsertEnrichment(church.slug, extracted);
      await updateSpotify(church.slug, spotify);
      console.log(`  ✓ saved to DB`);
    } catch (err) {
      console.log(`  ✗ save error: ${err.message}`);
      failCount++;
      continue;
    }

    successCount++;
    console.log();
  }

  console.log("━".repeat(50));
  console.log(`Done: ${successCount} succeeded, ${failCount} failed`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
