#!/usr/bin/env node

/**
 * Bulk LLM enrichment for churches with a website.
 *
 * For each match: Firecrawl the homepage (falls back to raw fetch), then hand
 * the markdown to Claude Haiku to extract a structured payload (summary,
 * service times, pastor, socials, ministries, email/phone, etc.). Upserts to
 * `church_enrichments`; also fills `churches.description` when empty.
 *
 * Patterned after `scripts/enrich-by-slugs.mjs` but driven by a filter query
 * so we can run it across tens of thousands of rows at moderate concurrency.
 *
 * Usage:
 *   node scripts/enrich-llm-bulk.mjs --countries="United States" --dry-run --limit=20
 *   node scripts/enrich-llm-bulk.mjs --countries="United States"
 *   node scripts/enrich-llm-bulk.mjs --countries="United States" --concurrency=5 --stale-days=30
 *
 * Required env: DATABASE_URL, ANTHROPIC_API_KEY
 * Optional env: FIRECRAWL_API_KEY (falls back to raw fetch if missing)
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";
import { inspectHtml } from "./lib/website-platform.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }

const sql = neon(DATABASE_URL);

// Supported LLM providers. Keys chosen for closest price-tier equivalents.
const MODELS = {
  haiku: { provider: "anthropic", id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  "gemini-flash": { provider: "gemini", id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  "gemini-flash-lite": { provider: "gemini", id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
  "gpt-4.1-nano": { provider: "openai", id: "gpt-4.1-nano", label: "GPT-4.1 nano" },
  "gpt-5-nano": { provider: "openai", id: "gpt-5-nano", label: "GPT-5 nano" },
  "gpt-5-mini": { provider: "openai", id: "gpt-5-mini", label: "GPT-5 mini" },
};

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_STALE_DAYS = 30;
const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

const DRY_RUN = process.argv.includes("--dry-run");
const STATUS_LIST = (parseFlag("status", "approved") || "approved").split(",").map((s) => s.trim()).filter(Boolean);
const COUNTRIES_RAW = parseFlag("countries");
const COUNTRIES = COUNTRIES_RAW ? COUNTRIES_RAW.split(",").map((c) => c.trim()).filter(Boolean) : null;
const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;
const CONCURRENCY = parseInt(parseFlag("concurrency", String(DEFAULT_CONCURRENCY)), 10) || DEFAULT_CONCURRENCY;
const STALE_DAYS = parseInt(parseFlag("stale-days", String(DEFAULT_STALE_DAYS)), 10) || DEFAULT_STALE_DAYS;
const FORCE = process.argv.includes("--force");
const MODEL_KEY = parseFlag("model", "haiku");
const MODEL = MODELS[MODEL_KEY];
if (!MODEL) {
  console.error(`Unknown --model=${MODEL_KEY}. Options: ${Object.keys(MODELS).join(", ")}`);
  process.exit(1);
}
if (MODEL.provider === "anthropic" && !ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }
if (MODEL.provider === "gemini" && !GEMINI_API_KEY) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }
if (MODEL.provider === "openai" && !OPENAI_API_KEY) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }
const OUTPUT_PATH = parseFlag("out", null);
// Always pull HTML (alongside markdown) — needed for platform/tech detection.
const FETCH_HTML = true;

// ─── Fetching ────────────────────────────────────────────────────────────────
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
        formats: FETCH_HTML ? ["markdown", "html"] : ["markdown"],
        onlyMainContent: false,
        waitFor: 1500,
        timeout: 20000,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      markdown: data?.data?.markdown?.slice(0, 40000) || "",
      html: FETCH_HTML ? data?.data?.html?.slice(0, 20000) || "" : "",
    };
  } catch {
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
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return { markdown: "", html: html.slice(0, 40000), finalUrl: res.url, headers: res.headers };
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

// ─── Haiku ───────────────────────────────────────────────────────────────────
function buildPrompt({ name, country, location, website, content, platformHint }) {
  const systemPrompt = `You are a data analyst for GospelChannel.com, a directory of worship-active churches.
Extract structured information from church website content. Respond ONLY with valid JSON — no markdown fences, no commentary. Use null (not empty strings) for missing fields.`;

  const userPrompt = `Church: ${name}
Country: ${country || "?"}
${location ? `City: ${location}\n` : ""}Website: ${website}
${platformHint ? `Website is built on: ${platformHint}\n` : ""}
Website content:
${content.slice(0, 28000)}

Extract this JSON. Be thorough — look at headers, footers, "about" / "visit" pages, contact blocks. Prefer specific facts from the page over guesses.

{
  "summary": "2-3 sentences for a visitor. Warm but factual. Describe worship style, community size/vibe, or theology — WHATEVER IS DISTINCTIVE. Do NOT write generic boilerplate like 'welcoming congregation serving the community' unless that is literally all the site says. Max 280 chars.",
  "seo_description": "Single sentence, 140-160 chars, optimized for Google. Include church name + location + distinctive feature.",
  "street_address": "Street + city + postal code. null if not found.",
  "theological_orientation": "ONE of: evangelical, pentecostal, charismatic, reformed, lutheran, anglican, catholic, orthodox, baptist, methodist, non-denominational. null if unclear.",
  "denomination_network": "Specific denomination or network (e.g. Southern Baptist Convention, Assemblies of God, Vineyard, Hillsong, PCA). null if independent.",
  "languages": ["Array of languages services are held in, lowercase, e.g. ['english','spanish']"],
  "service_times": [{"day": "Sunday", "time": "10:30", "label": "Main Service"}],
  "pastor_name": "Lead pastor full name. null if not found.",
  "pastor_title": "e.g. 'Lead Pastor', 'Senior Pastor'. null if not found.",
  "contact_email": "General church email (not personal). null if not found.",
  "phone": "Phone. null if not found.",
  "instagram_url": "Full https URL. null if not found.",
  "facebook_url": "Full https URL. null if not found.",
  "youtube_url": "Full https URL. null if not found.",
  "livestream_url": "Direct watch URL if available. null otherwise.",
  "what_to_expect": "Max 180 chars: dress code, service length, vibe. null if unclear.",
  "children_ministry": "boolean or null — any mention of kids church, Sunday school?",
  "youth_ministry": "boolean or null — any mention of youth group, teens?",
  "ministries": ["Array of program/ministry names. e.g. ['worship team','small groups','missions']"],
  "estimated_size": "ONE of: small (<200 weekly), medium (200-500), large (500-2000), mega (2000+). Infer from campus count, staff page, building size, service count. null if unclear.",
  "has_donate_page": "boolean — does the site have an online giving/donate link?",
  "has_blog": "boolean — active blog/news/sermons section?",
  "has_podcast": "boolean — podcast feed or sermon audio downloads?",
  "has_app": "boolean — mobile app mentioned (Apple/Google Play link, 'download our app')?",
  "outreach_notes": "1 sentence, max 200 chars, specifically useful for B2B sales outreach. Flag things like: 'site appears outdated, last blog post 2022', 'multi-campus network of 5 locations', 'active podcast producing weekly episodes', 'uses Planning Center — tech-forward'. null if nothing specific stands out."
}`;

  return { systemPrompt, userPrompt };
}

async function callAnthropic({ systemPrompt, userPrompt, modelId }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  return text;
}

async function callGemini({ systemPrompt, userPrompt, modelId }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1800,
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

async function callOpenAI({ systemPrompt, userPrompt, modelId }) {
  const isReasoning = /^(gpt-5|o1|o3|o4)/.test(modelId);
  const body = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    // Reasoning models spend completion-token budget on chain-of-thought before
    // emitting visible output; bump budget and set effort=minimal to keep cost
    // down.
    max_completion_tokens: isReasoning ? 8000 : 2000,
    ...(isReasoning ? { reasoning_effort: "minimal" } : {}),
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

async function llmExtract(args) {
  const { systemPrompt, userPrompt } = buildPrompt(args);
  const { provider, id: modelId } = MODEL;
  let raw;
  if (provider === "anthropic") raw = await callAnthropic({ systemPrompt, userPrompt, modelId });
  else if (provider === "gemini") raw = await callGemini({ systemPrompt, userPrompt, modelId });
  else if (provider === "openai") raw = await callOpenAI({ systemPrompt, userPrompt, modelId });
  else throw new Error(`Unknown provider: ${provider}`);
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned);
}

// ─── DB upsert ───────────────────────────────────────────────────────────────
async function sqlWithRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await fn(); }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/fetch failed|ECONN|ETIMEDOUT|timeout|network|socket hang up/i.test(msg) || attempt === 3) throw err;
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function normalizeSize(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("mega")) return "mega";
  if (s.includes("large")) return "large";
  if (s.includes("medium")) return "medium";
  if (s.includes("small")) return "small";
  return null;
}

async function upsertEnrichment(slug, e) {
  await sqlWithRetry(() => sql.query(
    `INSERT INTO church_enrichments (
      church_slug, street_address, theological_orientation, denomination_network,
      languages, service_times, summary, seo_description, pastor_name, pastor_title,
      contact_email, phone, instagram_url, facebook_url, youtube_url, livestream_url,
      what_to_expect, children_ministry, youth_ministry, ministries, church_size,
      enrichment_status, last_enriched_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5::text[], $6::jsonb, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::text[], $21,
      'complete', NOW(), NOW(), NOW()
    )
    ON CONFLICT (church_slug) DO UPDATE SET
      street_address = COALESCE(EXCLUDED.street_address, church_enrichments.street_address),
      theological_orientation = COALESCE(EXCLUDED.theological_orientation, church_enrichments.theological_orientation),
      denomination_network = COALESCE(EXCLUDED.denomination_network, church_enrichments.denomination_network),
      languages = COALESCE(EXCLUDED.languages, church_enrichments.languages),
      service_times = COALESCE(EXCLUDED.service_times, church_enrichments.service_times),
      summary = COALESCE(EXCLUDED.summary, church_enrichments.summary),
      seo_description = COALESCE(EXCLUDED.seo_description, church_enrichments.seo_description),
      pastor_name = COALESCE(EXCLUDED.pastor_name, church_enrichments.pastor_name),
      pastor_title = COALESCE(EXCLUDED.pastor_title, church_enrichments.pastor_title),
      contact_email = COALESCE(EXCLUDED.contact_email, church_enrichments.contact_email),
      phone = COALESCE(EXCLUDED.phone, church_enrichments.phone),
      instagram_url = COALESCE(EXCLUDED.instagram_url, church_enrichments.instagram_url),
      facebook_url = COALESCE(EXCLUDED.facebook_url, church_enrichments.facebook_url),
      youtube_url = COALESCE(EXCLUDED.youtube_url, church_enrichments.youtube_url),
      livestream_url = COALESCE(EXCLUDED.livestream_url, church_enrichments.livestream_url),
      what_to_expect = COALESCE(EXCLUDED.what_to_expect, church_enrichments.what_to_expect),
      children_ministry = COALESCE(EXCLUDED.children_ministry, church_enrichments.children_ministry),
      youth_ministry = COALESCE(EXCLUDED.youth_ministry, church_enrichments.youth_ministry),
      ministries = COALESCE(EXCLUDED.ministries, church_enrichments.ministries),
      church_size = COALESCE(EXCLUDED.church_size, church_enrichments.church_size),
      enrichment_status = 'complete',
      last_enriched_at = NOW(),
      updated_at = NOW()`,
    [
      slug,
      e.street_address || null,
      e.theological_orientation || null,
      e.denomination_network || null,
      Array.isArray(e.languages) && e.languages.length ? e.languages : null,
      e.service_times ? JSON.stringify(e.service_times) : null,
      e.summary || null,
      e.seo_description || null,
      e.pastor_name || null,
      e.pastor_title || null,
      e.contact_email || null,
      e.phone || null,
      e.instagram_url || null,
      e.facebook_url || null,
      e.youtube_url || null,
      e.livestream_url || null,
      e.what_to_expect || null,
      typeof e.children_ministry === "boolean" ? e.children_ministry : null,
      typeof e.youth_ministry === "boolean" ? e.youth_ministry : null,
      Array.isArray(e.ministries) && e.ministries.length ? e.ministries : null,
      normalizeSize(e.estimated_size),
    ],
  ));
}

async function refreshChurchDescription(slug, summary, currentDescription) {
  // Only overwrite psalmlog boilerplate or empty descriptions. Anything human
  // or detailed we leave alone.
  if (!summary) return;
  if (currentDescription && currentDescription.length > 40) {
    const looksBoilerplate = /welcoming (congregation|church)|as a .* church,?/i.test(currentDescription)
      && currentDescription.length < 250;
    if (!looksBoilerplate) return;
  }
  await sqlWithRetry(() => sql.query(
    `UPDATE churches SET description = $1, updated_at = NOW() WHERE slug = $2`,
    [summary.slice(0, 500), slug],
  ));
}

async function updateEmailIfMissing(slug, email) {
  if (!email) return;
  await sqlWithRetry(() => sql.query(
    `UPDATE churches SET email = $1, updated_at = NOW() WHERE slug = $2 AND (email IS NULL OR email = '')`,
    [email, slug],
  ));
}

async function upsertWebsiteTech(slug, website, finalUrl, httpStatus, inspection, extracted) {
  // sales_angle stays platform-generic (from inspectHtml).
  // outreach_notes is the per-church LLM observation (separate column, not merged).
  await sqlWithRetry(() => sql.query(
    `INSERT INTO church_website_tech (
      church_slug, website_url, final_url, http_status,
      primary_platform, technologies, sales_angle,
      has_donate_page, has_blog, has_podcast, has_app, outreach_notes,
      detection_version, last_checked_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, 2, NOW(), NOW(), NOW())
    ON CONFLICT (church_slug) DO UPDATE SET
      website_url = EXCLUDED.website_url,
      final_url = EXCLUDED.final_url,
      http_status = EXCLUDED.http_status,
      primary_platform = EXCLUDED.primary_platform,
      technologies = EXCLUDED.technologies,
      sales_angle = EXCLUDED.sales_angle,
      has_donate_page = COALESCE(EXCLUDED.has_donate_page, church_website_tech.has_donate_page),
      has_blog = COALESCE(EXCLUDED.has_blog, church_website_tech.has_blog),
      has_podcast = COALESCE(EXCLUDED.has_podcast, church_website_tech.has_podcast),
      has_app = COALESCE(EXCLUDED.has_app, church_website_tech.has_app),
      outreach_notes = COALESCE(EXCLUDED.outreach_notes, church_website_tech.outreach_notes),
      detection_version = 2,
      last_checked_at = NOW(),
      updated_at = NOW()`,
    [
      slug,
      website,
      finalUrl || website,
      httpStatus || null,
      inspection.primary_platform,
      JSON.stringify(inspection.technologies),
      inspection.sales_angle || null,
      typeof extracted.has_donate_page === "boolean" ? extracted.has_donate_page : null,
      typeof extracted.has_blog === "boolean" ? extracted.has_blog : null,
      typeof extracted.has_podcast === "boolean" ? extracted.has_podcast : null,
      typeof extracted.has_app === "boolean" ? extracted.has_app : null,
      extracted.outreach_notes || null,
    ],
  ));
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Model: ${MODEL.label} (${MODEL.provider}/${MODEL.id})`);
  console.log(`Status: ${STATUS_LIST.join(",")}  Countries: ${COUNTRIES?.join(",") || "all"}`);
  console.log(`Concurrency: ${CONCURRENCY}  Limit: ${LIMIT || "none"}  Stale-days: ${STALE_DAYS}  Force: ${FORCE}`);
  console.log(`Firecrawl: ${FIRECRAWL_API_KEY ? "on" : "off (raw fetch only)"}`);
  if (OUTPUT_PATH) console.log(`Output: ${OUTPUT_PATH}`);
  console.log();

  // Pick churches that have a website and either never enriched or enriched > STALE_DAYS days ago.
  let query = `
    SELECT c.slug, c.name, c.country, c.location, c.website, c.description,
           ce.last_enriched_at, ce.summary AS current_summary
    FROM churches c
    LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
    WHERE c.status = ANY($1::text[])
      AND c.website IS NOT NULL AND c.website != ''
  `;
  const params = [STATUS_LIST];
  if (COUNTRIES) { query += ` AND c.country = ANY($${params.length + 1}::text[])`; params.push(COUNTRIES); }
  if (!FORCE) {
    query += `
      AND (
        ce.last_enriched_at IS NULL
        OR ce.last_enriched_at < NOW() - INTERVAL '${STALE_DAYS} days'
        OR ce.enrichment_status IS NULL
        OR ce.enrichment_status != 'complete'
      )`;
  }
  query += ` ORDER BY c.country, c.name`;
  if (LIMIT > 0) { query += ` LIMIT $${params.length + 1}`; params.push(LIMIT); }

  const churches = await sql.query(query, params);
  console.log(`Targets: ${churches.length}\n`);
  if (churches.length === 0) return;

  const startedAt = Date.now();
  let done = 0;
  const stats = { ok: 0, fetchFail: 0, haikuFail: 0, saveFail: 0 };
  const fieldCounts = {};
  const allResults = []; // collected only when OUTPUT_PATH is set

  await mapWithConcurrency(churches, CONCURRENCY, async (church) => {
    const t0 = Date.now();
    try {
      const content = await fetchWebsite(church.website);
      if (!content || (!content.markdown && !content.html)) {
        stats.fetchFail += 1;
        return;
      }
      const text = (content.markdown || "") + (content.html ? "\n\n" + content.html : "");

      // Platform / tech / sales-angle detection from the raw HTML we already pulled.
      const inspection = inspectHtml({
        website: church.website,
        finalUrl: content.finalUrl,
        html: content.html || "",
        headers: content.headers || null,
      });

      let extracted;
      try {
        extracted = await llmExtract({
          name: church.name,
          country: church.country,
          location: church.location,
          website: church.website,
          content: text,
          platformHint: inspection.primary_platform !== "Unknown" ? inspection.primary_platform : null,
        });
      } catch (err) {
        stats.haikuFail += 1;
        if (done < 5) console.log(`  [llm-err] ${church.slug}: ${err.message}`);
        return;
      }

      // Tally which fields Haiku filled.
      for (const [k, v] of Object.entries(extracted)) {
        const present = v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0);
        if (present) fieldCounts[k] = (fieldCounts[k] || 0) + 1;
      }

      if (OUTPUT_PATH) {
        allResults.push({
          slug: church.slug,
          name: church.name,
          location: church.location,
          website: church.website,
          platform: inspection.primary_platform,
          technologies: inspection.technologies.map((t) => t.technology),
          extracted,
        });
      }

      if (DRY_RUN) {
        if (done < 3) console.log(`sample ${church.slug}:`, JSON.stringify({
          platform: inspection.primary_platform,
          sales_angle: inspection.sales_angle,
          outreach_notes: extracted.outreach_notes,
          summary: extracted.summary?.slice(0, 100),
          pastor: extracted.pastor_name,
          email: extracted.contact_email,
          size: extracted.estimated_size,
          has_donate: extracted.has_donate_page,
          has_podcast: extracted.has_podcast,
        }));
        stats.ok += 1;
        return;
      }

      try {
        await upsertEnrichment(church.slug, extracted);
        await refreshChurchDescription(church.slug, extracted.summary, church.description);
        await updateEmailIfMissing(church.slug, extracted.contact_email);
        await upsertWebsiteTech(
          church.slug,
          church.website,
          content.finalUrl,
          200, // raw fetch returns non-OK as null earlier; Firecrawl doesn't expose status
          inspection,
          extracted,
        );
      } catch {
        stats.saveFail += 1;
        return;
      }
      stats.ok += 1;
    } finally {
      done += 1;
      if (done % 50 === 0 || done === churches.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / Math.max(1, elapsed);
        const eta = Math.round((churches.length - done) / Math.max(0.01, rate));
        const dur = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${done}/${churches.length} (${Math.round(100*done/churches.length)}%) · ${rate.toFixed(2)}/s · ~${Math.round(eta/60)}min left · last ${dur}s`);
      }
    }
  });

  if (OUTPUT_PATH && allResults.length > 0) {
    await writeFile(OUTPUT_PATH, JSON.stringify({
      model: MODEL,
      generated_at: new Date().toISOString(),
      results: allResults,
    }, null, 2));
    console.log(`\nWrote ${allResults.length} results to ${OUTPUT_PATH}`);
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n━━━ Summary ━━━`);
  console.log(`Model:         ${MODEL.label}`);
  console.log(`Done:          ${churches.length} in ${Math.round(elapsed/60)}m ${elapsed%60}s`);
  console.log(`OK:            ${stats.ok}`);
  console.log(`Fetch failed:  ${stats.fetchFail}`);
  console.log(`Haiku failed:  ${stats.haikuFail}`);
  console.log(`Save failed:   ${stats.saveFail}`);
  console.log(`\nField fill rates:`);
  for (const [k, v] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(25)} ${v}  (${Math.round(100*v/Math.max(1,stats.ok))}%)`);
  }
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
