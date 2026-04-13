#!/usr/bin/env node

/**
 * Google Places enrichment for churches that have no website / location data.
 *
 * Takes a list of church slugs, builds a "${name} ${city}" query per slug,
 * runs them all through a single Apify `compass/google-maps-extractor`
 * actor run, matches the top result back to each slug (by name + city
 * verification), and updates `churches` + `church_enrichments` with the new
 * data.
 *
 * Usage:
 *   node scripts/enrich-google-places-by-slug.mjs --country=Spain --limit=50 --dry-run
 *   node scripts/enrich-google-places-by-slug.mjs --country=Spain --limit=50
 *   node scripts/enrich-google-places-by-slug.mjs --slugs=a,b,c
 *
 * Flags:
 *   --country=X         Filter by country (e.g. Spain)
 *   --slugs=a,b,c       Explicit slug list
 *   --reason-prefix=X   Filter by reason substring (e.g. "FEREDE Spain")
 *   --limit=N           Max slugs to process (default 50)
 *   --missing-only      Skip slugs that already have a website (default true)
 *   --force             Process even slugs that already have a website
 *   --dry-run           Show planned work + Apify result, don't write to DB
 *   --min-score=N       Min match score to accept (default 0.5)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const APIFY_ACTOR = "compass~google-maps-extractor";
const DEFAULT_LIMIT = 50;
const DEFAULT_MIN_SCORE = 0.5;
// Per Apify docs: Node.js actors cap out at 4096 MB (1 full CPU core). More
// memory = no extra throughput since Node is single-threaded. Crawlee
// autoscales concurrent browsers internally within a single run, so the
// optimal shape is "one big run, 4 GB memory, let autoscaling do its job"
// rather than many small runs.
const APIFY_MEMORY_MB = 4096;

function parseArgs(argv) {
  const o = {
    country: "",
    slugs: [],
    reasonPrefix: "",
    limit: DEFAULT_LIMIT,
    force: false,
    dryRun: false,
    minScore: DEFAULT_MIN_SCORE,
    chunkSize: 500,
    parallelRuns: 2,
  };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--force") o.force = true;
    else if (a.startsWith("--country=")) o.country = a.split("=")[1];
    else if (a.startsWith("--slugs=")) o.slugs = a.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--reason-prefix=")) o.reasonPrefix = a.split("=")[1];
    else if (a.startsWith("--limit=")) o.limit = Math.max(1, Number(a.split("=")[1]) || DEFAULT_LIMIT);
    else if (a.startsWith("--min-score=")) o.minScore = Math.max(0, Math.min(1, Number(a.split("=")[1]) || DEFAULT_MIN_SCORE));
    else if (a.startsWith("--chunk-size=")) o.chunkSize = Math.max(1, Number(a.split("=")[1]) || 50);
    else if (a.startsWith("--parallel-runs=")) o.parallelRuns = Math.max(1, Number(a.split("=")[1]) || 4);
  }
  return o;
}

function stripDiacritics(s) {
  return String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalize(s) {
  return stripDiacritics(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  const stop = new Set([
    "iglesia", "evangelica", "evangelico", "cristiana", "cristiano", "bautista",
    "pentecostal", "asamblea", "asambleas", "comunidad", "centro", "ministerio",
    "de", "la", "el", "y", "del", "las", "los", "a", "an", "the", "en",
    "church", "chapel", "kirche", "gemeinde",
  ]);
  return normalize(s).split(" ").filter((t) => t && !stop.has(t));
}

function similarity(a, b) {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

async function loadTargets(sql, options) {
  if (options.slugs.length > 0) {
    return sql`
      SELECT slug, name, location, country, website, header_image
      FROM churches
      WHERE slug = ANY(${options.slugs}::text[]) AND status = 'approved'
    `;
  }
  const where = ["status = 'approved'"];
  const params = {};
  if (!options.force) where.push("(website IS NULL OR website = '')");
  if (options.country) {
    return options.reasonPrefix
      ? sql`
          SELECT slug, name, location, country, website, header_image FROM churches
          WHERE status = 'approved'
            AND country = ${options.country}
            AND (${options.force}::boolean OR website IS NULL OR website = '')
            AND reason LIKE ${`%${options.reasonPrefix}%`}
          ORDER BY slug
          LIMIT ${options.limit}
        `
      : sql`
          SELECT slug, name, location, country, website, header_image FROM churches
          WHERE status = 'approved'
            AND country = ${options.country}
            AND (${options.force}::boolean OR website IS NULL OR website = '')
          ORDER BY slug
          LIMIT ${options.limit}
        `;
  }
  return sql`
    SELECT slug, name, location, country, website, header_image FROM churches
    WHERE status = 'approved'
      AND (${options.force}::boolean OR website IS NULL OR website = '')
    ORDER BY slug
    LIMIT ${options.limit}
  `;
}

function buildQuery(church) {
  const name = (church.name || "").trim();
  const city = (church.location || "").trim();
  if (city && !name.toLowerCase().includes(city.toLowerCase())) {
    return `${name} ${city}`;
  }
  return name;
}

async function startApifyRun(searchStrings, country, token) {
  const body = {
    searchStringsArray: searchStrings,
    locationQuery: country,
    maxCrawledPlacesPerSearch: 1,
    language: country === "Spain" ? "es" : country === "Germany" ? "de" : country === "France" ? "fr" : "en",
    // We deliberately include closed places so we can auto-archive churches
    // that Google marks permanently closed.
    skipClosedPlaces: false,
    // Detail page scraping gives us: full opening hours per day, hero image,
    // description, claim status, and cleaner address parsing. Worth the
    // modest extra cost per item.
    scrapePlaceDetailPage: true,
  };
  const startUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${token}&memory=${APIFY_MEMORY_MB}`;
  const res = await fetch(startUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  return { runId: data.id, datasetId: data.defaultDatasetId };
}

async function pollApifyRun(runId, token, maxWaitMs, expectedItems = null) {
  // Poll the dataset directly rather than waiting for run status.
  // The actor often marks a run as RUNNING long after the last useful
  // item has landed in the dataset — it's waiting on a single slow
  // Google Maps search that eventually times out. We stop when:
  //  (a) dataset has expectedItems items (all queries answered), or
  //  (b) item count has been stable for STABLE_SECS (tail-latency cutoff), or
  //  (c) run SUCCEEDED / failed / wall-clock timeout.
  const STABLE_SECS = 60;
  const start = Date.now();
  let lastCount = 0;
  let lastChange = Date.now();
  let datasetId = null;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 6000));
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const { data } = await poll.json();
    datasetId = datasetId || data.defaultDatasetId;
    if (data.status === "SUCCEEDED") return data;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) {
      throw new Error(`Apify run ${runId} ${data.status}`);
    }
    // Check dataset size — early exit when we have everything or it's stable
    if (datasetId) {
      try {
        const headRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}?token=${token}`,
        );
        const head = await headRes.json();
        const count = head?.data?.itemCount ?? 0;
        if (count !== lastCount) {
          lastCount = count;
          lastChange = Date.now();
        }
        if (expectedItems && count >= expectedItems) {
          // Abort the run to free compute + stop Google requests
          await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`,
            { method: "POST" },
          );
          return data;
        }
        if (count > 0 && Date.now() - lastChange > STABLE_SECS * 1000) {
          // No new items for STABLE_SECS — tail latency, stop waiting
          await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`,
            { method: "POST" },
          );
          return data;
        }
      } catch {
        // non-fatal
      }
    }
  }
  throw new Error(`Apify run ${runId} timed out client-side`);
}

async function fetchDataset(datasetId, token) {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&token=${token}&limit=10000`,
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

async function runApifySearchParallel(queries, country, token, chunkSize, parallelRuns) {
  const chunks = [];
  for (let i = 0; i < queries.length; i += chunkSize) {
    chunks.push(queries.slice(i, i + chunkSize));
  }
  console.log(
    `Splitting ${queries.length} queries into ${chunks.length} chunks of up to ${chunkSize}, running ${parallelRuns} in parallel`,
  );

  const allResults = [];
  const maxWaitMs = 20 * 60 * 1000;
  // Process chunks with bounded concurrency
  for (let i = 0; i < chunks.length; i += parallelRuns) {
    const batch = chunks.slice(i, i + parallelRuns);
    const started = Date.now();
    const runs = await Promise.all(
      batch.map(async (chunk, idx) => {
        const { runId, datasetId } = await startApifyRun(chunk, country, token);
        console.log(`  [batch ${i + idx + 1}/${chunks.length}] run ${runId} (${chunk.length} queries)`);
        return { runId, datasetId, queryCount: chunk.length };
      }),
    );
    // Poll all in parallel with per-run expected items for early exit
    await Promise.all(
      runs.map(async (r) => {
        try {
          await pollApifyRun(r.runId, token, maxWaitMs, r.queryCount);
        } catch (error) {
          console.log(`  run ${r.runId} error: ${error.message}`);
        }
      }),
    );
    // Fetch datasets in parallel
    const datasets = await Promise.all(
      runs.map((r) =>
        fetchDataset(r.datasetId, token).catch((e) => {
          console.log(`  dataset ${r.datasetId} fetch error: ${e.message}`);
          return [];
        }),
      ),
    );
    for (const d of datasets) allResults.push(...d);
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`  batch ${Math.min(i + parallelRuns, chunks.length)}/${chunks.length} done in ${elapsed}s (results so far: ${allResults.length})`);
  }
  return allResults;
}

function isChurchCategory(category = "") {
  const lower = String(category).toLowerCase();
  return (
    lower.includes("iglesia") ||
    lower.includes("church") ||
    lower.includes("kirche") ||
    lower.includes("chapel") ||
    lower.includes("parish") ||
    lower.includes("catedral") ||
    lower.includes("templo") ||
    lower.includes("religious") ||
    lower.includes("place of worship")
  );
}

function scoreMatch(church, place) {
  const nameSim = similarity(church.name, place.title || "");
  const citySim = similarity(church.location || "", place.city || "");
  const churchy = isChurchCategory(place.categoryName || "");
  let score = nameSim * 0.7 + citySim * 0.3;
  if (churchy) score += 0.15;
  if (!place.title) score = 0;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

const SOCIAL_BARE_HOSTS = new Set([
  "facebook.com", "www.facebook.com", "m.facebook.com",
  "instagram.com", "www.instagram.com",
  "twitter.com", "www.twitter.com", "x.com",
  "tiktok.com", "www.tiktok.com",
  "youtube.com", "www.youtube.com",
]);

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    // Reject bare social-media domains (Google Maps sometimes returns
    // "https://www.facebook.com/" as the website when a business only has
    // a Facebook page). A real social profile has a path like /churchname,
    // which is fine to reject here — those belong in facebook_url, not
    // website.
    const bareHost = SOCIAL_BARE_HOSTS.has(url.hostname.toLowerCase());
    const pathIsEmpty = !url.pathname || url.pathname === "/" || url.pathname === "";
    if (bareHost && pathIsEmpty) return "";
    // Also reject social-media URLs with paths — they're not websites.
    if (SOCIAL_BARE_HOSTS.has(url.hostname.toLowerCase())) return "";
    return `${url.origin}/`;
  } catch {
    return "";
  }
}

function serviceTimesFromOpeningHours(openingHours) {
  if (!Array.isArray(openingHours)) return null;
  const entries = openingHours
    .filter((h) => h && h.day && h.hours)
    .map((h) => ({ label: `${h.day}: ${h.hours}`, source: "google-places" }));
  return entries.length > 0 ? entries : null;
}

function pickHeroImage(place) {
  // Google Maps actor returns images via several possible fields depending
  // on whether scrapePlaceDetailPage was on.
  if (Array.isArray(place.imageUrls) && place.imageUrls.length > 0) {
    return place.imageUrls[0];
  }
  if (place.imageUrl) return place.imageUrl;
  if (place.image) return place.image;
  return null;
}

function buildStreetAddress(place) {
  if (place.street && (place.postalCode || place.city)) {
    return [place.street, [place.postalCode, place.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
  }
  return place.address || place.street || "";
}

function categoryTags(place) {
  const tags = new Set();
  if (place.categoryName) tags.add(place.categoryName);
  if (Array.isArray(place.categories)) {
    for (const c of place.categories) if (c) tags.add(c);
  }
  return [...tags];
}

async function upsertEnrichment(sql, slug, updates) {
  const columns = Object.keys(updates).filter((k) => updates[k] !== undefined);
  if (columns.length === 0) return;
  const existing = await sql`SELECT id FROM church_enrichments WHERE church_slug = ${slug}`;
  const values = columns.map((c) => {
    const v = updates[c];
    if (["service_times", "sources"].includes(c) && v !== null && typeof v === "object") {
      return JSON.stringify(v);
    }
    return v;
  });
  if (existing.length > 0) {
    const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(", ");
    await sql.query(
      `UPDATE church_enrichments SET ${setClause}, updated_at = NOW() WHERE church_slug = $${columns.length + 1}`,
      [...values, slug],
    );
  } else {
    const colList = ["church_slug", ...columns].join(", ");
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(", ");
    await sql.query(
      `INSERT INTO church_enrichments (${colList}, created_at, updated_at) VALUES ($1, ${placeholders}, NOW(), NOW())`,
      [slug, ...values],
    );
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  if (!process.env.APIFY_TOKEN) throw new Error("Missing APIFY_TOKEN");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const targets = await loadTargets(sql, options);
  console.log(`Loaded ${targets.length} target churches`);
  if (targets.length === 0) return;

  const queries = targets.map(buildQuery);
  console.log("Sample queries:");
  queries.slice(0, 5).forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  if (options.dryRun && !process.argv.includes("--force-apify")) {
    console.log("\nDRY RUN — would run Apify on", queries.length, "queries. Pass --force-apify to hit the API.");
    return;
  }

  console.log("\nCalling Apify Google Maps Extractor (parallel chunks)...");
  const results = await runApifySearchParallel(
    queries,
    targets[0]?.country || "Spain",
    process.env.APIFY_TOKEN,
    options.chunkSize,
    options.parallelRuns,
  );
  console.log(`Apify returned ${results.length} total results`);

  // Back-map Apify results by the exact searchString field so we don't rely
  // on positional alignment (Apify may skip queries with no results).
  const resultsByQuery = new Map();
  for (const r of results) {
    if (r?.searchString && !resultsByQuery.has(r.searchString)) {
      resultsByQuery.set(r.searchString, r);
    }
  }
  console.log(`Unique searchStrings matched: ${resultsByQuery.size}/${queries.length}`);

  const summary = {
    processed: 0,
    matched: 0,
    websiteAdded: 0,
    phoneAdded: 0,
    coordsAdded: 0,
    heroImageAdded: 0,
    archivedClosed: 0,
    belowThreshold: 0,
  };
  const preview = [];

  for (let i = 0; i < targets.length; i += 1) {
    const church = targets[i];
    const query = queries[i];
    const place = resultsByQuery.get(query);
    summary.processed += 1;
    if (!place || !place.title) {
      preview.push({ slug: church.slug, name: church.name, result: "no_place_returned" });
      continue;
    }
    const score = scoreMatch(church, place);
    if (score < options.minScore) {
      summary.belowThreshold += 1;
      preview.push({ slug: church.slug, name: church.name, result: `below_threshold ${score}`, placeTitle: place.title });
      continue;
    }
    summary.matched += 1;

    const website = cleanWebsite(place.website);
    const phone = place.phone || place.phoneUnformatted || null;
    const lat = place.location?.lat ?? null;
    const lng = place.location?.lng ?? null;
    const street = buildStreetAddress(place);
    const serviceTimes = serviceTimesFromOpeningHours(place.openingHours);
    const heroImage = pickHeroImage(place);
    const categories = categoryTags(place);

    if (website) summary.websiteAdded += 1;
    if (phone) summary.phoneAdded += 1;
    if (lat != null && lng != null) summary.coordsAdded += 1;
    if (heroImage) summary.heroImageAdded += 1;

    preview.push({
      slug: church.slug,
      name: church.name,
      score,
      place: place.title,
      website: website || null,
      phone: phone || null,
      lat,
      lng,
      heroImage: heroImage || null,
      closed: place.permanentlyClosed || false,
      rating: place.totalScore || null,
    });

    if (options.dryRun) continue;

    // Update churches table — website + hero image + archive if permanently closed
    const churchUpdates = [];
    const churchValues = [];
    if (website) {
      churchUpdates.push(`website = COALESCE(NULLIF(website, ''), $${churchValues.length + 1})`);
      churchValues.push(website);
    }
    if (heroImage && !church.header_image) {
      churchUpdates.push(`header_image = COALESCE(NULLIF(header_image, ''), $${churchValues.length + 1})`);
      churchValues.push(heroImage);
      churchUpdates.push(`header_image_attribution = COALESCE(NULLIF(header_image_attribution, ''), $${churchValues.length + 1})`);
      churchValues.push("google-places");
    }
    if (place.permanentlyClosed === true) {
      churchUpdates.push(`status = $${churchValues.length + 1}`);
      churchValues.push("archived");
      summary.archivedClosed += 1;
    }
    if (churchUpdates.length > 0) {
      churchValues.push(church.slug);
      await sql.query(
        `UPDATE churches SET ${churchUpdates.join(", ")}, updated_at = NOW() WHERE slug = $${churchValues.length}`,
        churchValues,
      );
    }

    await upsertEnrichment(sql, church.slug, {
      ...(website ? { website_url: website } : {}),
      ...(street ? { street_address: street } : {}),
      ...(phone ? { phone } : {}),
      ...(lat != null ? { latitude: lat } : {}),
      ...(lng != null ? { longitude: lng } : {}),
      ...(serviceTimes ? { service_times: serviceTimes } : {}),
      ...(place.placeId ? { google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.placeId}` } : {}),
      ...(heroImage ? { cover_image_url: heroImage } : {}),
      ...(categories.length > 0 ? { good_fit_tags: categories } : {}),
      raw_google_places: place,
      sources: { google_places: { scraped_at: new Date().toISOString(), place_id: place.placeId || null, score } },
      last_enriched_at: new Date().toISOString(),
    });
  }

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));

  console.log("\nFirst 10 results:");
  for (const p of preview.slice(0, 10)) {
    console.log(` ${p.slug}`);
    console.log(`   → ${JSON.stringify(p).slice(0, 200)}`);
  }

  if (options.dryRun) console.log("\nDRY RUN — no DB writes performed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
