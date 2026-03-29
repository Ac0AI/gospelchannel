/**
 * Enrichment pipeline orchestrator.
 * Coordinates: load churches → fetch Google Places → crawl website → LLM extract → save.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fetchGooglePlaces } from "./google-places.mjs";
import { fetchFacebookPage } from "./facebook-scraper.mjs";
import { crawlChurchWebsite } from "./website-crawler.mjs";
import { extractChurchData, generateChurchContent } from "./llm-extractor.mjs";
import { findPublishedDuplicate } from "./disambiguator.mjs";
import { mapWithConcurrency, sleep } from "./rate-limiter.mjs";

const SCHEMA_VERSION = 1;

/**
 * Load all churches that need enrichment.
 */
export async function loadChurchesForEnrichment({
  rootDir,
  supabase,
  status,
  region,
  slug,
}) {
  const churches = [];

  // Load published churches from churches.json
  const churchesPath = join(rootDir, "src/data/churches.json");
  const published = JSON.parse(readFileSync(churchesPath, "utf8"));

  for (const c of published) {
    if (slug && c.slug !== slug) continue;
    if (region && !matchesRegion(c.country, region)) continue;

    churches.push({
      type: "published",
      slug: c.slug,
      name: c.name,
      location: c.location || "",
      country: c.country || "",
      website: c.website || "",
      denomination: c.denomination || "",
    });
  }

  // Load pending/approved candidates from church_candidates table
  if (!slug) {
    const query = supabase
      .from("church_candidates")
      .select("id,name,country,website,status,location");

    if (status) {
      query.eq("status", status);
    } else {
      query.in("status", ["pending", "approved"]);
    }

    const { data: candidates } = await query;

    if (candidates) {
      for (const c of candidates) {
        if (region && !matchesRegion(c.country, region)) continue;

        // Check for duplicate against published churches
        const dup = findPublishedDuplicate(c, published);
        if (dup) continue;

        churches.push({
          type: "candidate",
          candidateId: c.id,
          name: c.name,
          location: c.location || "",
          country: c.country || "",
          website: c.website || "",
          denomination: "",
        });
      }
    }
  }

  // Load discovered churches from churches table (not in churches.json)
  const publishedSlugs = new Set(published.map((c) => c.slug));
  {
    let query = supabase
      .from("churches")
      .select("slug,name,country,location,website,denomination,discovery_source");

    if (slug) {
      query = query.eq("slug", slug);
    } else if (status) {
      query = query.eq("status", status);
    } else {
      query = query.in("status", ["pending", "approved"]);
    }

    const { data: dbChurches } = await query;

    if (dbChurches) {
      for (const c of dbChurches) {
        if (publishedSlugs.has(c.slug)) continue;
        if (churches.some((ch) => ch.slug === c.slug)) continue;
        if (region && !matchesRegion(c.country, region)) continue;

        churches.push({
          type: "discovered",
          slug: c.slug,
          name: c.name,
          location: c.location || "",
          country: c.country || "",
          website: c.website || "",
          denomination: c.denomination || "",
          discoverySource: c.discovery_source,
        });
      }
    }
  }

  return churches;
}

/**
 * Check which churches already have enrichment data.
 */
export async function loadExistingEnrichments(supabase) {
  const { data } = await supabase
    .from("church_enrichments")
    .select("church_slug,candidate_id,enrichment_status");

  const enriched = new Map();
  for (const row of data || []) {
    const key = row.church_slug || row.candidate_id;
    enriched.set(key, row.enrichment_status);
  }
  return enriched;
}

/**
 * Load existing raw data for re-extraction mode.
 */
async function loadExistingRawData(supabase, church) {
  const column = church.slug ? "church_slug" : "candidate_id";
  const value = church.slug || church.candidateId;

  const { data } = await supabase
    .from("church_enrichments")
    .select("raw_google_places,raw_crawled_pages,raw_website_markdown")
    .eq(column, value)
    .single();

  return data;
}

/**
 * Enrich a single church through the full pipeline.
 */
export async function enrichOneChurch(
  church,
  { supabase, apifyToken, firecrawlKey, anthropicKey, reExtract = false }
) {
  const label = `${church.name} (${church.location || church.country})`;
  console.log(`\n--- Enriching: ${label} ---`);

  // Mark as enriching
  await upsertEnrichmentStatus(supabase, church, "enriching");

  try {
    const sources = [];
    let googleData = null;
    let rawGooglePlaces = null;
    let googleConfidence = 0;
    let pages = [];
    let homepageMarkdown = null;
    let facebookData = null;

    if (reExtract) {
      // Re-extract mode: load existing raw data, skip crawling
      console.log(`  [re-extract] Loading cached raw data`);
      const existing = await loadExistingRawData(supabase, church);

      if (existing) {
        rawGooglePlaces = existing.raw_google_places;
        if (rawGooglePlaces) {
          googleData = {
            streetAddress: rawGooglePlaces.address || null,
            googleMapsUrl: rawGooglePlaces.url || null,
            latitude: rawGooglePlaces.location?.lat || null,
            longitude: rawGooglePlaces.location?.lng || null,
            phone: rawGooglePlaces.phone || null,
          };
          googleConfidence = 0.7;
          sources.push({
            type: "google_places_cached",
            fetchedAt: new Date().toISOString(),
          });
        }
        pages = existing.raw_crawled_pages || [];
        homepageMarkdown = existing.raw_website_markdown || null;
        if (pages.length > 0)
          sources.push({
            type: "firecrawl_cached",
            fetchedAt: new Date().toISOString(),
          });
      } else {
        console.log(`  [re-extract] No existing raw data found, skipping`);
        await upsertEnrichmentStatus(supabase, church, "failed");
        return { success: false, confidence: 0, label };
      }
    } else {
      // Full pipeline: fetch from external sources

      // Step 1: Google Places
      if (apifyToken) {
        const gp = await fetchGooglePlaces(church, apifyToken);
        googleData = gp.data;
        rawGooglePlaces = gp.raw;
        googleConfidence = gp.confidence;
        if (gp.data)
          sources.push({
            type: "google_places",
            fetchedAt: new Date().toISOString(),
          });
        await sleep(1000);
      }

      // Step 1.5: Facebook page (if URL known from previous enrichment or church data)
      let facebookData = null;
      if (apifyToken) {
        // Check if we already know the Facebook URL from a previous run
        const existingFbUrl = await getExistingFacebookUrl(supabase, church);
        if (existingFbUrl) {
          facebookData = await fetchFacebookPage(existingFbUrl, apifyToken);
          if (facebookData.data) {
            sources.push({
              type: "facebook",
              fetchedAt: new Date().toISOString(),
            });
          }
          await sleep(1000);
        }
      }

      // Step 2: Crawl website
      if (church.website && firecrawlKey) {
        const crawl = await crawlChurchWebsite(church.website, firecrawlKey);
        pages = crawl.pages;
        homepageMarkdown = crawl.homepageMarkdown;
        if (pages.length > 0)
          sources.push({
            type: "firecrawl",
            fetchedAt: new Date().toISOString(),
          });
        await sleep(500);
      }
    }

    // Combine all page markdown for LLM
    const allMarkdown = pages
      .map((p) => `--- Page: ${p.url} ---\n${p.markdown}`)
      .join("\n\n");

    // Step 3: LLM extraction
    let extracted = null;
    let content = null;

    if (anthropicKey && (googleData || allMarkdown)) {
      extracted = await extractChurchData(
        { googleData, websiteMarkdown: allMarkdown, church },
        anthropicKey
      );
      sources.push({
        type: "claude_extraction",
        fetchedAt: new Date().toISOString(),
      });

      await sleep(200); // Small delay between LLM calls

      content = await generateChurchContent(
        { church, extractedData: extracted, websiteMarkdown: homepageMarkdown },
        anthropicKey
      );
      sources.push({
        type: "claude_content",
        fetchedAt: new Date().toISOString(),
      });
    }

    // Step 4: Merge and compute confidence
    const confidence = computeConfidence(
      googleData,
      extracted,
      googleConfidence
    );

    const fb = facebookData?.data || {};

    const enrichmentRow = {
      church_slug: church.slug || null,
      candidate_id: church.candidateId || null,

      // Name
      official_church_name: extracted?.officialChurchName || googleData?.title || null,

      // Level 1 — merge Google Places > Facebook > LLM extraction
      street_address: googleData?.streetAddress || fb.address || null,
      google_maps_url: googleData?.googleMapsUrl || null,
      latitude: googleData?.latitude || null,
      longitude: googleData?.longitude || null,
      service_times: extracted?.serviceTimes || googleData?.serviceTimes || fb.businessHours || null,
      theological_orientation: extracted?.theologicalOrientation || null,
      denomination_network: extracted?.denominationNetwork || extractDenominationFromCategories(fb.categories) || null,
      languages: extracted?.languages || null,
      phone: extracted?.phone || googleData?.phone || fb.phone || null,
      contact_email: extracted?.contactEmail || fb.email || null,
      website_url: church.website || fb.website || null,

      // Social links — LLM first, then Facebook
      instagram_url: extracted?.instagramUrl || fb.instagramUrl || null,
      facebook_url: extracted?.facebookUrl || null,
      youtube_url: extracted?.youtubeUrl || null,

      // Level 2
      children_ministry: extracted?.childrenMinistry ?? null,
      youth_ministry: extracted?.youthMinistry ?? null,
      ministries: extracted?.ministries || null,
      church_size: extracted?.churchSize || estimateChurchSizeFromFollowers(fb.followers || fb.likes) || null,

      // Level 3
      seo_description: content?.seoDescription || null,
      summary: content?.summary || null,

      // Raw data (only overwrite if we have new data)
      ...(reExtract
        ? {}
        : {
            raw_website_markdown: homepageMarkdown || null,
            raw_google_places: rawGooglePlaces || null,
            raw_crawled_pages: pages.length > 0 ? pages : null,
          }),

      // Metadata
      sources,
      enrichment_status: "complete",
      confidence,
      schema_version: SCHEMA_VERSION,
      last_enriched_at: new Date().toISOString(),
    };

    await upsertEnrichment(supabase, church, enrichmentRow);

    console.log(
      `  [done] Confidence: ${confidence.toFixed(2)}, Sources: ${sources.map((s) => s.type).join(", ")}`
    );
    return { success: true, confidence, label };
  } catch (err) {
    // Ensure we mark as failed if anything throws
    console.error(`  [error] ${err.message}`);
    try {
      await upsertEnrichmentStatus(supabase, church, "failed");
    } catch {
      // Ignore upsert failure during error handling
    }
    throw err;
  }
}

async function upsertEnrichmentStatus(supabase, church, status) {
  const key = church.slug
    ? { church_slug: church.slug }
    : { candidate_id: church.candidateId };

  await supabase.from("church_enrichments").upsert(
    { ...key, enrichment_status: status },
    { onConflict: church.slug ? "church_slug" : "candidate_id" }
  );
}

async function upsertEnrichment(supabase, church, row) {
  const conflict = church.slug ? "church_slug" : "candidate_id";
  const { error } = await supabase
    .from("church_enrichments")
    .upsert(row, { onConflict: conflict });

  if (error) {
    console.error(`  [save] Upsert error: ${error.message}`);
    throw error;
  }
}

function computeConfidence(googleData, extracted, googleConfidence) {
  let score = 0;
  let factors = 0;

  if (googleData) {
    score += googleConfidence;
    factors++;
  }

  if (extracted) {
    const fields = [
      extracted.theologicalOrientation,
      extracted.languages,
      extracted.serviceTimes,
      extracted.ministries,
    ].filter(Boolean).length;
    score += (fields / 4) * 0.8;
    factors++;
  }

  return factors > 0 ? Math.min(score / factors, 1) : 0;
}

/**
 * Look up existing Facebook URL from a previous enrichment run.
 */
async function getExistingFacebookUrl(supabase, church) {
  const column = church.slug ? "church_slug" : "candidate_id";
  const value = church.slug || church.candidateId;

  const { data } = await supabase
    .from("church_enrichments")
    .select("facebook_url")
    .eq(column, value)
    .single();

  return data?.facebook_url || null;
}

/**
 * Extract denomination from Facebook page categories.
 */
function extractDenominationFromCategories(categories) {
  if (!categories || !Array.isArray(categories)) return null;

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

  for (const cat of categories) {
    for (const { pattern, name } of denomPatterns) {
      if (pattern.test(cat)) return name;
    }
  }
  return null;
}

/**
 * Estimate church size from Facebook followers/likes.
 */
function estimateChurchSizeFromFollowers(count) {
  if (!count) return null;
  if (count > 50000) return "mega";
  if (count > 10000) return "large";
  if (count > 2000) return "medium";
  if (count > 500) return "small";
  return "small";
}

const EUROPE_COUNTRIES = new Set([
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "UK",
  "United Kingdom",
  "Ireland",
  "Germany",
  "Netherlands",
  "Switzerland",
  "Spain",
  "France",
  "Italy",
  "Portugal",
  "Austria",
  "Belgium",
  "Poland",
  "Czech Republic",
  "Romania",
  "Hungary",
  "Greece",
]);

function matchesRegion(country, region) {
  if (region === "europe") return EUROPE_COUNTRIES.has(country);
  return true;
}
