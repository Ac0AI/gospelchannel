#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";
import { fetchFacebookPage } from "./lib/enrichment/facebook-scraper.mjs";
import { extractEmailsFromHtml } from "./lib/website-contact.mjs";
import {
  addChurchToIndex,
  createChurchIndex,
  decodeHtml,
  findChurchDuplicate,
  isOfficialWebsiteUrl,
  normalizeHost,
  normalizeWhitespace,
  slugifyName,
  toSiteRoot,
} from "./lib/church-intake-utils.mjs";
import { inferLocationFromAddress } from "./lib/international-directory.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DIRECTORY_URL = "https://www.everynation.org/find-a-church/";
const DIRECTORY_REASON = `directory-import: Every Nation | ${DIRECTORY_URL}`;
const SENSITIVE_LISTING_TEXT = "Due to the sensitive nature of our ministry, the church locations are not available.";
const UPSERT_BATCH_SIZE = 100;

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 0,
    concurrency: 6,
    facebookConcurrency: 2,
    skipFacebook: false,
    skipWebsite: false,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--skip-facebook") options.skipFacebook = true;
    else if (arg === "--skip-website") options.skipWebsite = true;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--facebook-concurrency=")) {
      options.facebookConcurrency = Math.max(1, Number(arg.split("=")[1]) || 0);
    }
  }

  return options;
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function fetchHtml(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(value = "") {
  return normalizeWhitespace(
    decodeHtml(String(value).replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]+>/g, " "))
  );
}

function extractHref(value = "") {
  const match = String(value).match(/href=["']([^"']+)["']/i);
  return match ? decodeHtml(match[1]) : "";
}

function absolutize(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeFacebookUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.facebook.com");
    if (!/facebook\.com$/i.test(parsed.hostname) && !/\.facebook\.com$/i.test(parsed.hostname)) return "";

    if (parsed.pathname === "/profile.php") {
      const id = parsed.searchParams.get("id");
      return id ? `https://www.facebook.com/profile.php?id=${id}` : "";
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";

    const root = parts[0].toLowerCase();
    if (["share.php", "sharer.php", "dialog", "plugins", "photo.php", "watch", "reel", "reels", "stories"].includes(root)) {
      return "";
    }

    return `https://www.facebook.com/${parts.join("/")}`;
  } catch {
    return "";
  }
}

function normalizeInstagramUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.instagram.com");
    if (!/instagram\.com$/i.test(parsed.hostname) && !/\.instagram\.com$/i.test(parsed.hostname)) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const username = parts[0].replace(/^@/, "");
    if (!username) return "";
    if (["p", "reel", "reels", "stories", "explore", "tv", "accounts"].includes(username.toLowerCase())) return "";
    return `https://www.instagram.com/${username}/`;
  } catch {
    return "";
  }
}

function normalizeYouTubeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") return "";
    if (!host.endsWith("youtube.com")) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";

    const first = parts[0];
    if (first.startsWith("@")) return `https://www.youtube.com/${first}`;
    if (first.toLowerCase() === "channel" && /^UC[A-Za-z0-9_-]{20,}$/i.test(parts[1] || "")) {
      return `https://www.youtube.com/${first}/${parts[1]}`;
    }
    if (["user", "c"].includes(first.toLowerCase()) && parts[1]) {
      return `https://www.youtube.com/${first}/${parts[1]}`;
    }
    if (parts.length === 1 && !["watch", "playlist", "results", "feed", "shorts", "embed", "live", "channel", "user", "c"].includes(first.toLowerCase())) {
      return `https://www.youtube.com/${first}`;
    }
    return "";
  } catch {
    return "";
  }
}

function classifyWebsiteLink(url = "") {
  if (!String(url || "").trim()) {
    return { raw: "" };
  }

  const absolute = absolutize(url, DIRECTORY_URL);
  if (!absolute) return { raw: "" };

  if (isOfficialWebsiteUrl(absolute)) {
    return { raw: absolute, officialWebsite: toSiteRoot(absolute) };
  }

  const facebookUrl = normalizeFacebookUrl(absolute);
  if (facebookUrl) return { raw: absolute, facebookUrl };

  const instagramUrl = normalizeInstagramUrl(absolute);
  if (instagramUrl) return { raw: absolute, instagramUrl };

  const youtubeUrl = normalizeYouTubeUrl(absolute);
  if (youtubeUrl) return { raw: absolute, youtubeUrl };

  return { raw: absolute };
}

function parseDirectoryRows(html = "") {
  const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const matches = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  return matches
    .map((match, index) => {
      const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
      if (cells.length < 5) return null;

      const [regionCell, countryCell, cityCell, nameCell, websiteCell] = cells;
      const website = classifyWebsiteLink(extractHref(websiteCell));

      return {
        rowIndex: index,
        region: stripTags(regionCell),
        country: stripTags(countryCell),
        city: stripTags(cityCell),
        name: stripTags(nameCell),
        officialWebsite: website.officialWebsite || "",
        facebookUrl: website.facebookUrl || "",
        instagramUrl: website.instagramUrl || "",
        youtubeUrl: website.youtubeUrl || "",
        rawLink: website.raw || "",
      };
    })
    .filter(Boolean);
}

function isSensitiveListing(listing) {
  return listing.name === SENSITIVE_LISTING_TEXT;
}

function isCampusListing(listing) {
  return /\bcampus\b/i.test(listing.name);
}

function buildConfidence(listing) {
  let score = 0.5;
  if (listing.city) score += 0.08;
  if (listing.officialWebsite) score += 0.16;
  if (listing.facebookUrl) score += 0.1;
  if (listing.youtubeUrl) score += 0.06;
  if (listing.instagramUrl) score += 0.04;
  if (!listing.officialWebsite && !listing.facebookUrl && !listing.youtubeUrl && !listing.instagramUrl) score -= 0.06;
  return Number(Math.max(0.32, Math.min(0.9, score)).toFixed(2));
}

function createUniqueSlug(name, location, country, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName([name, location].filter(Boolean).join(" ")),
    slugifyName([name, country].filter(Boolean).join(" ")),
    slugifyName([name, location, country].filter(Boolean).join(" ")),
  ].filter(Boolean);

  for (const attempt of attempts) {
    if (!usedSlugs.has(attempt)) {
      usedSlugs.add(attempt);
      return attempt;
    }
  }

  let suffix = 2;
  const base = slugifyName(name);
  while (usedSlugs.has(`${base}-${suffix}`)) suffix += 1;
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function prepareChurchValue(column, value) {
  if (value === undefined) return undefined;
  if (["spotify_playlists", "youtube_videos"].includes(column) && value !== null) return JSON.stringify(value);
  return value;
}

function prepareEnrichmentValue(column, value) {
  if (value === undefined) return undefined;
  if (["service_times", "sources", "raw_google_places", "raw_crawled_pages"].includes(column) && value !== null) {
    return JSON.stringify(value);
  }
  return value;
}

async function upsertRow(sql, table, conflictColumn, row, prepareValue) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const columns = entries.map(([column]) => column);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values = entries.map(([column, value]) => prepareValue(column, value));
  const updates = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${column} = EXCLUDED.${column}`);

  if (!columns.includes("updated_at")) {
    updates.push("updated_at = NOW()");
  }

  await sql.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates.join(", ")}`,
    values,
  );
}

async function updateRow(sql, table, keyColumn, keyValue, updates, prepareValue) {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
  assignments.push("updated_at = NOW()");
  const params = entries.map(([column, value]) => prepareValue(column, value));
  params.push(keyValue);

  await sql.query(
    `UPDATE ${table} SET ${assignments.join(", ")} WHERE ${keyColumn} = $${params.length}`,
    params,
  );
}

async function loadAllChurchRows(sql) {
  return sql`
    SELECT slug, name, country, location, website, status, reason, youtube_channel_id
    FROM churches
  `;
}

async function loadChurchRowsBySlug(sql, slugs) {
  const map = new Map();
  for (const batch of chunk(slugs, 200)) {
    const rows = await sql`
      SELECT slug, name, country, location, website, status, reason, youtube_channel_id
      FROM churches
      WHERE slug = ANY(${batch})
    `;
    for (const row of rows) map.set(row.slug, row);
  }
  return map;
}

async function loadEnrichmentsBySlug(sql, slugs) {
  const map = new Map();
  for (const batch of chunk(slugs, 200)) {
    const rows = await sql`
      SELECT
        id,
        church_slug,
        street_address,
        service_times,
        denomination_network,
        phone,
        contact_email,
        website_url,
        instagram_url,
        facebook_url,
        youtube_url,
        church_size,
        summary,
        confidence,
        facebook_followers
      FROM church_enrichments
      WHERE church_slug = ANY(${batch})
    `;
    for (const row of rows) map.set(row.church_slug, row);
  }
  return map;
}

async function upsertChurches(sql, rows) {
  let fallbackLogged = false;

  for (const originalBatch of chunk(rows, UPSERT_BATCH_SIZE)) {
    let batch = originalBatch;

    while (true) {
      try {
        for (const row of batch) {
          await upsertRow(sql, "churches", "slug", row, prepareChurchValue);
        }
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("chk_churches_discovery_source")
          && batch.some((row) => row.discovery_source === "directory-import")
        ) {
          if (!fallbackLogged) {
            console.log("Database does not yet allow discovery_source=directory-import; falling back to google-search for this import.");
            fallbackLogged = true;
          }

          batch = batch.map((row) => ({
            ...row,
            discovery_source: "google-search",
            reason: String(row.reason || "").replace(/^directory-import:/, "directory-import-fallback:"),
          }));
          continue;
        }

        throw new Error(`Failed to upsert churches: ${message}`);
      }
    }
  }
}

async function upsertEnrichmentSeeds(sql, rows) {
  const mergedBySlug = new Map();

  for (const row of rows) {
    if (!row.church_slug) continue;
    const previous = mergedBySlug.get(row.church_slug) || { church_slug: row.church_slug };
    mergedBySlug.set(row.church_slug, {
      ...previous,
      ...(row.website_url ? { website_url: row.website_url } : {}),
      ...(row.facebook_url ? { facebook_url: row.facebook_url } : {}),
      ...(row.instagram_url ? { instagram_url: row.instagram_url } : {}),
      ...(row.youtube_url ? { youtube_url: row.youtube_url } : {}),
      ...(typeof row.confidence === "number" ? { confidence: row.confidence } : {}),
      updated_at: new Date().toISOString(),
    });
  }

  for (const batch of chunk([...mergedBySlug.values()], UPSERT_BATCH_SIZE)) {
    for (const row of batch) {
      await upsertRow(sql, "church_enrichments", "church_slug", row, prepareEnrichmentValue);
    }
  }
}

function extractSocialLinks(html, website) {
  const links = [...String(html).matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absolutize(match[1], website))
    .filter(Boolean);

  const firstMatch = (normalizer) => {
    for (const link of links) {
      const normalized = normalizer(link);
      if (normalized) return normalized;
    }
    return "";
  };

  return {
    facebook: firstMatch(normalizeFacebookUrl),
    instagram: firstMatch(normalizeInstagramUrl),
    youtube: firstMatch(normalizeYouTubeUrl),
  };
}

function extractDirectYouTubeChannelId(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    if (!/youtube\.com$/i.test(parsed.hostname) && !/\.youtube\.com$/i.test(parsed.hostname)) return "";
    return parsed.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{20,})$/i)?.[1] || "";
  } catch {
    return "";
  }
}

async function resolveYouTubeChannelId(youtubeUrl) {
  const verifyCandidate = async (candidate) => {
    if (!candidate) return "";
    if (!process.env.YOUTUBE_API_KEY) return candidate;

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=${encodeURIComponent(candidate)}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return json.items?.[0]?.id || "";
    } catch {
      return "";
    }
  };

  const directId = await verifyCandidate(extractDirectYouTubeChannelId(youtubeUrl));
  if (directId) return directId;
  if (!youtubeUrl) return "";

  const html = await fetchHtml(youtubeUrl, 12000).catch(() => "");
  if (html) {
    const patterns = [
      /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
      /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{20,})["']/i,
      /https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/i,
    ];
    for (const pattern of patterns) {
      const verified = await verifyCandidate(html.match(pattern)?.[1] || "");
      if (verified) return verified;
    }
  }

  if (!process.env.YOUTUBE_API_KEY) return "";

  try {
    const parsed = new URL(youtubeUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parts[0]?.startsWith("@")) {
      const handle = parts[0].slice(1);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return await verifyCandidate(json.items?.[0]?.id || "");
    }

    if (parts[0] === "user" && parts[1]) {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(parts[1])}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return await verifyCandidate(json.items?.[0]?.id || "");
    }
  } catch {
    return "";
  }

  return "";
}

function extractDenomination(categories = []) {
  const denomPatterns = [
    { pattern: /catholic/i, name: "Catholic" },
    { pattern: /pentecostal/i, name: "Pentecostal" },
    { pattern: /baptist/i, name: "Baptist" },
    { pattern: /lutheran/i, name: "Lutheran" },
    { pattern: /methodist/i, name: "Methodist" },
    { pattern: /presbyterian/i, name: "Presbyterian" },
    { pattern: /anglican/i, name: "Anglican" },
    { pattern: /orthodox/i, name: "Orthodox" },
    { pattern: /evangelical/i, name: "Evangelical" },
    { pattern: /charismatic/i, name: "Charismatic" },
    { pattern: /assemblies.*god/i, name: "Assemblies of God" },
    { pattern: /seventh.*day/i, name: "Seventh-day Adventist" },
    { pattern: /nondenominational/i, name: "Non-denominational" },
    { pattern: /reformed/i, name: "Reformed" },
  ];

  for (const category of categories) {
    for (const entry of denomPatterns) {
      if (entry.pattern.test(category)) return entry.name;
    }
  }

  return "";
}

function estimateChurchSize(followers) {
  const count = Number(followers) || 0;
  if (count > 50000) return "mega";
  if (count > 10000) return "large";
  if (count > 2000) return "medium";
  if (count > 500) return "small";
  return count > 0 ? "small" : "";
}

function normalizeSummary(text = "") {
  const summary = normalizeWhitespace(String(text).replace(/\s+/g, " "));
  if (!summary) return "";
  return summary.length > 240 ? `${summary.slice(0, 237).trimEnd()}...` : summary;
}

async function runFacebookEnrichment(sql, slugs, concurrency) {
  if (!process.env.APIFY_TOKEN) {
    console.log("Skipping Facebook enrichment because APIFY_TOKEN is missing.");
    return { processed: 0, updated: 0 };
  }

  const enrichments = await loadEnrichmentsBySlug(sql, slugs);
  const churches = await loadChurchRowsBySlug(sql, slugs);
  const rows = slugs
    .map((slug) => ({ church: churches.get(slug), enrichment: enrichments.get(slug) }))
    .filter((row) => row.church && row.enrichment?.facebook_url);

  console.log(`Facebook enrichment targets: ${rows.length}`);
  let quotaExceeded = false;

  const results = await mapWithConcurrency(rows, concurrency, async ({ church, enrichment }) => {
    if (quotaExceeded) {
      return { slug: church.slug, updated: false, reason: "quota_exceeded" };
    }

    const { data: facebook, error } = await fetchFacebookPage(enrichment.facebook_url, process.env.APIFY_TOKEN);
    if (error && /usage hard limit exceeded|monthly usage hard limit exceeded/i.test(error)) {
      quotaExceeded = true;
      return { slug: church.slug, updated: false, reason: "quota_exceeded" };
    }

    if (!facebook) return { slug: church.slug, updated: false, reason: "no_facebook_data" };

    const enrichmentUpdates = {};
    const churchUpdates = {};

    if (!enrichment.street_address && facebook.address) enrichmentUpdates.street_address = facebook.address;
    if ((!enrichment.service_times || enrichment.service_times.length === 0) && facebook.businessHours) {
      enrichmentUpdates.service_times = facebook.businessHours;
    }
    if (!enrichment.phone && facebook.phone) enrichmentUpdates.phone = facebook.phone;
    if (!enrichment.contact_email && facebook.email) enrichmentUpdates.contact_email = facebook.email;

    const normalizedWebsite = isOfficialWebsiteUrl(facebook.website || "") ? toSiteRoot(facebook.website) : "";
    if (!enrichment.website_url && normalizedWebsite) enrichmentUpdates.website_url = normalizedWebsite;
    if (!church.website && normalizedWebsite) churchUpdates.website = normalizedWebsite;

    const normalizedInstagram = normalizeInstagramUrl(facebook.instagramUrl || "");
    if (!enrichment.instagram_url && normalizedInstagram) enrichmentUpdates.instagram_url = normalizedInstagram;

    const denomination = !enrichment.denomination_network ? extractDenomination(facebook.categories || []) : "";
    if (denomination) enrichmentUpdates.denomination_network = denomination;

    const size = !enrichment.church_size ? estimateChurchSize(facebook.followers || facebook.likes) : "";
    if (size) enrichmentUpdates.church_size = size;

    const summary = !enrichment.summary ? normalizeSummary(facebook.intro || "") : "";
    if (summary) enrichmentUpdates.summary = summary;

    if (facebook.followers && facebook.followers !== enrichment.facebook_followers) {
      enrichmentUpdates.facebook_followers = facebook.followers;
    }

    if (Object.keys(enrichmentUpdates).length > 0) {
      const nextConfidence = Math.min(1, Math.max(Number(enrichment.confidence) || 0, 0.62) + (Object.keys(enrichmentUpdates).length * 0.03));
      enrichmentUpdates.confidence = Number(nextConfidence.toFixed(2));
      enrichmentUpdates.last_enriched_at = new Date().toISOString();
      await updateRow(sql, "church_enrichments", "id", enrichment.id, enrichmentUpdates, prepareEnrichmentValue);
    }

    if (!church.location && facebook.address) {
      const inferredLocation = inferLocationFromAddress(facebook.address, church.country || "");
      if (inferredLocation) churchUpdates.location = inferredLocation;
    }

    if (Object.keys(churchUpdates).length > 0) {
      await updateRow(sql, "churches", "slug", church.slug, churchUpdates, prepareChurchValue);
    }

    const updated = Object.keys(enrichmentUpdates).length > 0 || Object.keys(churchUpdates).length > 0;
    await sleep(1200);

    return {
      slug: church.slug,
      updated,
      enrichmentFields: Object.keys(enrichmentUpdates),
      churchFields: Object.keys(churchUpdates),
    };
  });

  const updated = results.filter((result) => result.ok && result.value?.updated).length;
  if (quotaExceeded) {
    console.log("Facebook enrichment stopped early because the Apify monthly quota is exhausted.");
  }
  console.log(`Facebook enrichment updated: ${updated}`);
  return { processed: rows.length, updated };
}

async function runWebsiteEnrichment(sql, slugs, concurrency) {
  const churches = await loadChurchRowsBySlug(sql, slugs);
  const enrichments = await loadEnrichmentsBySlug(sql, slugs);
  const rows = slugs
    .map((slug) => ({ church: churches.get(slug), enrichment: enrichments.get(slug) }))
    .filter((row) => row.church);

  console.log(`Website enrichment targets: ${rows.length}`);

  const results = await mapWithConcurrency(rows, concurrency, async ({ church, enrichment }) => {
    const website = church.website || enrichment?.website_url || "";
    const youtubeUrl = normalizeYouTubeUrl(enrichment?.youtube_url || "");

    if (!website && !youtubeUrl) {
      return { slug: church.slug, updated: false, reason: "missing_website" };
    }

    const html = website ? await fetchHtml(website, 12000).catch(() => "") : "";
    const email = enrichment?.contact_email || extractEmailsFromHtml(html, normalizeHost(website))[0] || "";
    const social = html ? extractSocialLinks(html, website) : { facebook: "", instagram: "", youtube: "" };
    const resolvedYoutubeUrl = youtubeUrl || social.youtube || "";
    const youtubeChannelId = !church.youtube_channel_id && resolvedYoutubeUrl
      ? await resolveYouTubeChannelId(resolvedYoutubeUrl)
      : "";

    const update = {
      church_slug: church.slug,
      ...(website || enrichment?.website_url ? { website_url: enrichment?.website_url || website } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(enrichment?.facebook_url || social.facebook ? { facebook_url: enrichment?.facebook_url || social.facebook } : {}),
      ...(enrichment?.instagram_url || social.instagram ? { instagram_url: enrichment?.instagram_url || social.instagram } : {}),
      ...(resolvedYoutubeUrl ? { youtube_url: resolvedYoutubeUrl } : {}),
    };

    const changedFields = Object.keys(update).filter((key) => key !== "church_slug" && (!enrichment || enrichment[key] !== update[key]));
    if (changedFields.length > 0) {
      await upsertRow(sql, "church_enrichments", "church_slug", update, prepareEnrichmentValue);
    }

    let churchUpdated = false;
    if (youtubeChannelId) {
      await sql.query(
        "UPDATE churches SET youtube_channel_id = $1, updated_at = NOW() WHERE slug = $2 AND youtube_channel_id IS NULL",
        [youtubeChannelId, church.slug],
      );
      churchUpdated = true;
    }

    return {
      slug: church.slug,
      updated: changedFields.length > 0 || churchUpdated,
      fields: changedFields,
      youtubeChannelId: Boolean(youtubeChannelId),
    };
  });

  const updated = results.filter((result) => result.ok && result.value?.updated).length;
  console.log(`Website enrichment updated: ${updated}`);
  return { processed: rows.length, updated };
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }

  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log("Fetching Every Nation directory...");
  const html = await fetchHtml(DIRECTORY_URL);
  const parsedRows = parseDirectoryRows(html);

  let sensitiveSkipped = 0;
  let campusesSkipped = 0;
  let keptRows = parsedRows.filter((row) => {
    if (isSensitiveListing(row)) {
      sensitiveSkipped += 1;
      return false;
    }
    if (isCampusListing(row)) {
      campusesSkipped += 1;
      return false;
    }
    return true;
  });

  if (options.limit > 0) {
    keptRows = keptRows.slice(0, options.limit);
  }

  console.log(`Directory rows: total=${parsedRows.length}, kept=${keptRows.length}, sensitiveSkipped=${sensitiveSkipped}, campusesSkipped=${campusesSkipped}`);

  const existingRows = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const usedSlugs = new Set(existingRows.map((row) => row.slug));
  for (const row of existingRows) addChurchToIndex(index, row);

  const inserts = [];
  const enrichmentSeeds = [];
  const touchedSlugs = new Set();
  let deduped = 0;

  for (const row of keptRows) {
    const duplicate = findChurchDuplicate(index, {
      name: row.name,
      country: row.country,
      location: row.city || "",
      website: row.officialWebsite || "",
    });

    const slug = duplicate?.slug || createUniqueSlug(row.name, row.city, row.country, usedSlugs);
    touchedSlugs.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(row.officialWebsite ? { website_url: row.officialWebsite } : {}),
      ...(row.facebookUrl ? { facebook_url: row.facebookUrl } : {}),
      ...(row.instagramUrl ? { instagram_url: row.instagramUrl } : {}),
      ...(row.youtubeUrl ? { youtube_url: row.youtubeUrl } : {}),
      confidence: buildConfidence(row),
    });

    if (duplicate) {
      deduped += 1;
      continue;
    }

    const now = new Date().toISOString();
    const churchRow = {
      slug,
      name: row.name,
      description: "",
      country: row.country || "",
      location: row.city || null,
      denomination: "Every Nation",
      founded: null,
      website: row.officialWebsite || null,
      email: null,
      language: null,
      logo: null,
      header_image: null,
      header_image_attribution: null,
      spotify_url: null,
      spotify_playlist_ids: [],
      additional_playlists: [],
      spotify_playlists: null,
      music_style: null,
      notable_artists: null,
      youtube_channel_id: null,
      spotify_artist_ids: null,
      youtube_videos: null,
      aliases: null,
      source_kind: "discovered",
      status: "pending",
      confidence: buildConfidence(row),
      reason: DIRECTORY_REASON,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    };

    inserts.push(churchRow);
    addChurchToIndex(index, churchRow);
  }

  console.log(`Prepared rows: inserts=${inserts.length}, deduped=${deduped}, touched=${touchedSlugs.size}`);
  console.log(JSON.stringify(inserts.slice(0, 12).map((row) => ({
    slug: row.slug,
    name: row.name,
    country: row.country,
    location: row.location,
    website: row.website,
    confidence: row.confidence,
  })), null, 2));

  if (options.preview) {
    console.log("Preview mode: nothing written.");
    return;
  }

  if (inserts.length > 0) {
    await upsertChurches(sql, inserts);
  }
  await upsertEnrichmentSeeds(sql, enrichmentSeeds);
  console.log(`Imported ${inserts.length} churches and seeded ${enrichmentSeeds.length} enrichment rows.`);

  const touched = [...touchedSlugs];
  if (!options.skipFacebook) {
    await runFacebookEnrichment(sql, touched, options.facebookConcurrency);
  }

  if (!options.skipWebsite) {
    await runWebsiteEnrichment(sql, touched, options.concurrency);
  }

  const finalChurches = await loadChurchRowsBySlug(sql, touched);
  const finalEnrichments = await loadEnrichmentsBySlug(sql, touched);
  const summary = touched.map((slug) => {
    const church = finalChurches.get(slug);
    const enrichment = finalEnrichments.get(slug);
    return {
      slug,
      name: church?.name || "",
      country: church?.country || "",
      location: church?.location || "",
      website: church?.website || enrichment?.website_url || "",
      facebook: enrichment?.facebook_url || "",
      instagram: enrichment?.instagram_url || "",
      youtube: enrichment?.youtube_url || "",
      email: enrichment?.contact_email || "",
      address: enrichment?.street_address || "",
      hasServiceTimes: Array.isArray(enrichment?.service_times) && enrichment.service_times.length > 0,
    };
  });

  console.log("Final summary:");
  console.log(JSON.stringify({
    touched: summary.length,
    inserted: inserts.length,
    deduped,
    withWebsite: summary.filter((row) => row.website).length,
    withFacebook: summary.filter((row) => row.facebook).length,
    withInstagram: summary.filter((row) => row.instagram).length,
    withYoutube: summary.filter((row) => row.youtube).length,
    withEmail: summary.filter((row) => row.email).length,
    withAddress: summary.filter((row) => row.address).length,
    withServiceTimes: summary.filter((row) => row.hasServiceTimes).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
