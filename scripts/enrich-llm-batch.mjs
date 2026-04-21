#!/usr/bin/env node

/**
 * Batch-mode LLM enrichment pipeline via OpenAI Batch API (50% cheaper,
 * async 1-24h turnaround). Replaces the synchronous `enrich-llm-bulk.mjs`
 * for large one-shot runs.
 *
 * Pipeline:
 *   1. prepare  — fetch each church's website (Firecrawl + raw fallback),
 *                 run platform inspection, build an OpenAI chat-completion
 *                 request per church, write {requests.jsonl, metadata.jsonl}.
 *                 Resumable: skips slugs already in done-slugs.txt.
 *   2. submit   — upload requests.jsonl to OpenAI Files, create a Batch job,
 *                 save batch-id.txt.
 *   3. poll     — check batch status; with --watch, loops until terminal.
 *   4. process  — download output.jsonl, parse results, upsert DB
 *                 (church_enrichments + church_website_tech + churches.email,
 *                 description).
 *
 * Usage:
 *   node scripts/enrich-llm-batch.mjs prepare --countries="United States" --dir=/tmp/batch-us-1
 *   node scripts/enrich-llm-batch.mjs submit  --dir=/tmp/batch-us-1
 *   node scripts/enrich-llm-batch.mjs poll    --dir=/tmp/batch-us-1 --watch
 *   node scripts/enrich-llm-batch.mjs process --dir=/tmp/batch-us-1
 *
 * Required env: DATABASE_URL, OPENAI_API_KEY
 * Optional env: FIRECRAWL_API_KEY (falls back to raw fetch if missing)
 */

import { neon } from "@neondatabase/serverless";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";
import { inspectHtml } from "./lib/website-platform.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }

const sql = neon(DATABASE_URL);

const MODEL_ID = "gpt-4.1-nano";
const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_STALE_DAYS = 30;

// ─── Args ────────────────────────────────────────────────────────────────────
function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

const MODE = process.argv[2];
const DIR = parseFlag("dir");
if (!MODE || !["prepare", "submit", "poll", "process"].includes(MODE)) {
  console.error("Usage: node scripts/enrich-llm-batch.mjs <prepare|submit|poll|process> --dir=<path> [opts]");
  process.exit(1);
}
if (!DIR) { console.error("Missing --dir=<path>"); process.exit(1); }

// ─── Website fetching ────────────────────────────────────────────────────────
async function fetchWithFirecrawl(url) {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        waitFor: 1500,
        timeout: 20000,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      markdown: data?.data?.markdown?.slice(0, 40000) || "",
      html: data?.data?.html?.slice(0, 40000) || "",
      finalUrl: data?.data?.metadata?.url || url,
    };
  } catch {
    return null;
  }
}

async function fetchRaw(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return { markdown: "", html: html.slice(0, 40000), finalUrl: res.url };
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

// ─── Prompt ──────────────────────────────────────────────────────────────────
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
  "summary": "2-3 sentences for a visitor. Warm but factual. Describe worship style, community size/vibe, or theology — WHATEVER IS DISTINCTIVE. Do NOT write generic boilerplate unless that is literally all the site says. Max 280 chars.",
  "seo_description": "Single sentence, 140-160 chars, optimized for Google. Include church name + location + distinctive feature.",
  "street_address": "Street + city + postal code. null if not found.",
  "theological_orientation": "ONE of: evangelical, pentecostal, charismatic, reformed, lutheran, anglican, catholic, orthodox, baptist, methodist, non-denominational. null if unclear.",
  "denomination_network": "Specific denomination or network (e.g. Southern Baptist Convention, Assemblies of God, Vineyard, PCA). null if independent.",
  "languages": ["Array of languages, lowercase, e.g. ['english','spanish']"],
  "service_times": [{"day": "Sunday", "time": "10:30", "label": "Main Service"}],
  "pastor_name": "Lead pastor full name. null if not found.",
  "pastor_title": "e.g. 'Lead Pastor', 'Senior Pastor'. null if not found.",
  "contact_email": "General church email. null if not found.",
  "phone": "Phone. null if not found.",
  "instagram_url": "Full https URL. null if not found.",
  "facebook_url": "Full https URL. null if not found.",
  "youtube_url": "Full https URL. null if not found.",
  "livestream_url": "Direct watch URL. null if not found.",
  "what_to_expect": "Max 180 chars: dress code, service length, vibe. null if unclear.",
  "children_ministry": "boolean or null",
  "youth_ministry": "boolean or null",
  "ministries": ["Array of program names. e.g. ['worship team','small groups']"],
  "estimated_size": "ONE of: small, medium, large, mega. null if unclear.",
  "has_donate_page": "boolean",
  "has_blog": "boolean",
  "has_podcast": "boolean",
  "has_app": "boolean",
  "outreach_notes": "1 sentence, max 200 chars, specific B2B-sales observation. null if nothing specific."
}`;
  return { systemPrompt, userPrompt };
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

// ─── JSONL helpers ───────────────────────────────────────────────────────────
async function* readJsonl(path) {
  if (!existsSync(path)) return;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { yield JSON.parse(trimmed); } catch { /* skip malformed */ }
  }
}

async function loadSlugSet(path) {
  const set = new Set();
  if (!existsSync(path)) return set;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

// ─── Mode: prepare ───────────────────────────────────────────────────────────
async function doPrepare() {
  await mkdir(DIR, { recursive: true });

  const STATUS_LIST = (parseFlag("status", "approved") || "approved").split(",").map((s) => s.trim()).filter(Boolean);
  const COUNTRIES_RAW = parseFlag("countries");
  const COUNTRIES = COUNTRIES_RAW ? COUNTRIES_RAW.split(",").map((c) => c.trim()).filter(Boolean) : null;
  const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;
  const CONCURRENCY = parseInt(parseFlag("concurrency", String(DEFAULT_CONCURRENCY)), 10) || DEFAULT_CONCURRENCY;
  const STALE_DAYS = parseInt(parseFlag("stale-days", String(DEFAULT_STALE_DAYS)), 10) || DEFAULT_STALE_DAYS;
  const FORCE = process.argv.includes("--force");

  const requestsPath = join(DIR, "requests.jsonl");
  const metadataPath = join(DIR, "metadata.jsonl");
  const doneSlugsPath = join(DIR, "done-slugs.txt");
  const failedSlugsPath = join(DIR, "failed-slugs.txt");

  const doneSlugs = await loadSlugSet(doneSlugsPath);
  console.log(`Mode: prepare`);
  console.log(`Dir: ${DIR}`);
  console.log(`Already done (resumable): ${doneSlugs.size}`);
  console.log(`Filters: status=${STATUS_LIST.join(",")}  countries=${COUNTRIES?.join(",") || "all"}  limit=${LIMIT || "none"}  stale-days=${STALE_DAYS}  force=${FORCE}`);
  console.log(`Concurrency: ${CONCURRENCY}  Firecrawl: ${FIRECRAWL_API_KEY ? "on" : "off (raw only)"}\n`);

  let query = `
    SELECT c.slug, c.name, c.country, c.location, c.website, c.description,
           ce.last_enriched_at
    FROM churches c
    LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
    WHERE c.status = ANY($1::text[])
      AND c.website IS NOT NULL AND c.website != ''
  `;
  const params = [STATUS_LIST];
  if (COUNTRIES) { query += ` AND c.country = ANY($${params.length + 1}::text[])`; params.push(COUNTRIES); }
  if (!FORCE) {
    query += ` AND (ce.last_enriched_at IS NULL OR ce.last_enriched_at < NOW() - INTERVAL '${STALE_DAYS} days' OR ce.enrichment_status IS NULL OR ce.enrichment_status != 'complete')`;
  }
  query += ` ORDER BY c.country, c.name`;
  if (LIMIT > 0) { query += ` LIMIT $${params.length + 1}`; params.push(LIMIT); }

  const churches = (await sql.query(query, params)).filter((c) => !doneSlugs.has(c.slug));
  console.log(`Targets to fetch: ${churches.length}\n`);
  if (churches.length === 0) {
    console.log("Nothing to prepare. If the batch was submitted, continue with `submit` or `poll`.");
    return;
  }

  const startedAt = Date.now();
  let done = 0;
  let ok = 0;
  let fetchFail = 0;

  await mapWithConcurrency(churches, CONCURRENCY, async (church) => {
    done += 1;
    try {
      const content = await fetchWebsite(church.website);
      if (!content || (!content.markdown && !content.html)) {
        fetchFail += 1;
        await appendFile(failedSlugsPath, `${church.slug}\tfetch-failed\n`);
        return;
      }
      const text = (content.markdown || "") + (content.html ? "\n\n" + content.html : "");
      const inspection = inspectHtml({
        website: church.website,
        finalUrl: content.finalUrl,
        html: content.html || "",
        headers: null,
      });
      const { systemPrompt, userPrompt } = buildPrompt({
        name: church.name,
        country: church.country,
        location: church.location,
        website: church.website,
        content: text,
        platformHint: inspection.primary_platform !== "Unknown" ? inspection.primary_platform : null,
      });

      // OpenAI Batch request line
      const request = {
        custom_id: church.slug,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: MODEL_ID,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
        },
      };
      const metadata = {
        slug: church.slug,
        website: church.website,
        final_url: content.finalUrl || church.website,
        inspection,
        description: church.description,
      };

      await appendFile(requestsPath, JSON.stringify(request) + "\n");
      await appendFile(metadataPath, JSON.stringify(metadata) + "\n");
      await appendFile(doneSlugsPath, church.slug + "\n");
      ok += 1;
    } catch (err) {
      fetchFail += 1;
      await appendFile(failedSlugsPath, `${church.slug}\terror: ${err.message}\n`);
    }

    if (done % 200 === 0 || done === churches.length) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const rate = done / Math.max(1, elapsed);
      const remaining = Math.round((churches.length - done) / Math.max(0.01, rate));
      console.log(`  ${done}/${churches.length} (${Math.round(100 * done / churches.length)}%) · ${rate.toFixed(2)}/s · ok=${ok} fetchFail=${fetchFail} · ~${Math.round(remaining / 60)}min left`);
    }
  });

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n━━━ Prepare summary ━━━`);
  console.log(`Processed: ${churches.length} in ${Math.round(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`OK:        ${ok}`);
  console.log(`Failed:    ${fetchFail}`);
  console.log(`\nNext: node scripts/enrich-llm-batch.mjs submit --dir=${DIR}`);
}

// ─── Mode: submit ────────────────────────────────────────────────────────────
// OpenAI Batch API limits: 200 MB per input file, 50 000 requests per batch.
// Leave headroom on both.
const MAX_FILE_BYTES = 180 * 1024 * 1024;
const MAX_REQUESTS_PER_BATCH = 45_000;

// Stream-split the input JSONL at byte level. We manage our own line buffer
// because `readline` (createInterface) silently truncates very long lines
// (seen cutoff ~19 KB) — our request lines can be 30-100 KB.
async function splitRequestsIntoChunks(requestsPath) {
  const { createWriteStream } = await import("node:fs");
  const chunkInfo = [];
  let chunkIndex = 0;
  let lineCount = 0;
  let byteCount = 0;
  let outStream = null;
  let pendingBuf = Buffer.alloc(0);

  const openNext = () => {
    const chunkPath = join(DIR, `requests-chunk-${chunkIndex}.jsonl`);
    outStream = createWriteStream(chunkPath);
    chunkInfo.push({ chunkIndex, path: chunkPath, lines: 0, bytes: 0 });
    lineCount = 0;
    byteCount = 0;
  };

  const closeCurrent = () => new Promise((resolve) => {
    if (!outStream) return resolve();
    const info = chunkInfo[chunkIndex];
    info.lines = lineCount;
    info.bytes = byteCount;
    outStream.end(() => resolve());
  });

  const writeLine = async (lineBuf) => {
    // Include newline in accounting; emit newline here.
    const lineBytes = lineBuf.length + 1;
    if (lineCount >= MAX_REQUESTS_PER_BATCH || byteCount + lineBytes > MAX_FILE_BYTES) {
      await closeCurrent();
      chunkIndex += 1;
      openNext();
    }
    if (!outStream.write(lineBuf)) {
      await new Promise((r) => outStream.once("drain", r));
    }
    if (!outStream.write("\n")) {
      await new Promise((r) => outStream.once("drain", r));
    }
    lineCount += 1;
    byteCount += lineBytes;
  };

  openNext();

  const readStream = createReadStream(requestsPath, { highWaterMark: 1024 * 1024 });
  for await (const chunkBuf of readStream) {
    pendingBuf = pendingBuf.length === 0 ? chunkBuf : Buffer.concat([pendingBuf, chunkBuf]);
    let start = 0;
    while (true) {
      const nl = pendingBuf.indexOf(0x0a, start);
      if (nl === -1) break;
      const lineBuf = pendingBuf.subarray(start, nl);
      if (lineBuf.length > 0) await writeLine(lineBuf);
      start = nl + 1;
    }
    pendingBuf = pendingBuf.subarray(start);
  }
  if (pendingBuf.length > 0) await writeLine(pendingBuf);
  await closeCurrent();
  return chunkInfo;
}

async function uploadAndCreateBatch(chunkPath, index) {
  const form = new FormData();
  form.append("purpose", "batch");
  const fileBuf = await readFile(chunkPath);
  form.append("file", new Blob([fileBuf], { type: "application/jsonl" }), `chunk-${index}.jsonl`);
  const uploadRes = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Upload failed (chunk ${index}): ${uploadRes.status} ${err}`);
  }
  const fileData = await uploadRes.json();
  const batchRes = await fetch("https://api.openai.com/v1/batches", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input_file_id: fileData.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
      metadata: { source: "gospelchannel-enrich-llm-batch", chunk: String(index) },
    }),
  });
  if (!batchRes.ok) {
    const err = await batchRes.text();
    throw new Error(`Batch create failed (chunk ${index}): ${batchRes.status} ${err}`);
  }
  const batch = await batchRes.json();
  return { chunkIndex: index, fileId: fileData.id, batchId: batch.id, status: batch.status };
}

async function doSubmit() {
  const requestsPath = join(DIR, "requests.jsonl");
  const batchesPath = join(DIR, "batches.tsv"); // chunk_index\tfile_id\tbatch_id
  if (!existsSync(requestsPath)) {
    console.error(`Missing ${requestsPath} — run \`prepare\` first.`);
    process.exit(1);
  }
  if (existsSync(batchesPath)) {
    const existing = await readFile(batchesPath, "utf8");
    console.error(`Batches already submitted:\n${existing}\nUse \`poll\` to check status.`);
    process.exit(1);
  }

  const stats = await stat(requestsPath);
  const totalSize = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`Input: ${totalSize} MB (streaming line count during split)`);

  // Stream-split into chunk files (each written directly to disk).
  const chunkInfo = await splitRequestsIntoChunks(requestsPath);
  console.log(`Split into ${chunkInfo.length} chunks (limits: ${MAX_REQUESTS_PER_BATCH} req / ${MAX_FILE_BYTES / 1024 / 1024}MB):`);
  let totalLines = 0;
  for (const info of chunkInfo) {
    console.log(`  chunk ${info.chunkIndex}: ${info.lines} requests · ${(info.bytes / 1024 / 1024).toFixed(1)} MB`);
    totalLines += info.lines;
  }
  console.log(`  total: ${totalLines} requests\n`);
  const chunkPaths = chunkInfo.map((info) => info.path);

  // Upload + create batch for each chunk
  const results = [];
  for (let i = 0; i < chunkPaths.length; i++) {
    console.log(`Submitting chunk ${i}…`);
    const r = await uploadAndCreateBatch(chunkPaths[i], i);
    results.push(r);
    console.log(`  file_id: ${r.fileId}  batch_id: ${r.batchId}  status: ${r.status}`);
  }

  // Write batches.tsv
  const lines = ["chunk\tfile_id\tbatch_id"];
  for (const r of results) lines.push(`${r.chunkIndex}\t${r.fileId}\t${r.batchId}`);
  await writeFile(batchesPath, lines.join("\n") + "\n");

  console.log(`\n━━━ Submit summary ━━━`);
  console.log(`Chunks submitted: ${results.length}`);
  console.log(`Total requests:   ${totalLines}`);
  console.log(`Wrote ${batchesPath}`);
  console.log(`\nNext: node scripts/enrich-llm-batch.mjs poll --dir=${DIR} --watch`);
}

// ─── Mode: poll ──────────────────────────────────────────────────────────────
async function fetchBatchStatus(batchId) {
  const res = await fetch(`https://api.openai.com/v1/batches/${batchId}`, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

async function readBatchesTsv() {
  const batchesPath = join(DIR, "batches.tsv");
  if (!existsSync(batchesPath)) {
    console.error(`No batches.tsv in ${DIR} — run \`submit\` first.`);
    process.exit(1);
  }
  const lines = (await readFile(batchesPath, "utf8")).split("\n").filter(Boolean).slice(1); // skip header
  return lines.map((l) => {
    const [chunk, fileId, batchId] = l.split("\t");
    return { chunk: Number(chunk), fileId, batchId };
  });
}

async function doPoll() {
  const batches = await readBatchesTsv();
  const WATCH = process.argv.includes("--watch");

  while (true) {
    const statuses = [];
    let allDone = true;
    let totalCompleted = 0;
    let totalRequests = 0;
    let totalFailed = 0;
    for (const b of batches) {
      const batch = await fetchBatchStatus(b.batchId);
      const counts = batch.request_counts || {};
      totalCompleted += counts.completed || 0;
      totalRequests += counts.total || 0;
      totalFailed += counts.failed || 0;
      const terminal = ["completed", "failed", "expired", "cancelled"].includes(batch.status);
      if (!terminal) allDone = false;
      statuses.push({ chunk: b.chunk, batchId: b.batchId, batch, terminal });

      // Download output as soon as a chunk completes
      const outputPath = join(DIR, `output-${b.chunk}.jsonl`);
      if (batch.status === "completed" && batch.output_file_id && !existsSync(outputPath)) {
        console.log(`  Downloading chunk ${b.chunk} (${batch.output_file_id})…`);
        const dlRes = await fetch(`https://api.openai.com/v1/files/${batch.output_file_id}/content`, {
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        });
        if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
        const outputText = await dlRes.text();
        await writeFile(outputPath, outputText);
        console.log(`  Saved output-${b.chunk}.jsonl`);
      }
    }

    // Status summary
    const summary = statuses
      .map((s) => `c${s.chunk}=${s.batch.status}(${s.batch.request_counts?.completed || 0}/${s.batch.request_counts?.total || 0})`)
      .join(" ");
    console.log(`[${new Date().toISOString()}] ${summary}  total ${totalCompleted}/${totalRequests} failed=${totalFailed}`);

    if (allDone) {
      // Also save last-seen status snapshot
      await writeFile(join(DIR, "batch-status.json"), JSON.stringify(statuses.map((s) => s.batch), null, 2));
      console.log(`\nAll chunks terminal. Next: node scripts/enrich-llm-batch.mjs process --dir=${DIR}`);
      return;
    }
    if (!WATCH) return;
    await sleep(60_000);
  }
}

// ─── Mode: process ───────────────────────────────────────────────────────────
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

async function upsertWebsiteTech(slug, website, finalUrl, inspection, extracted) {
  await sqlWithRetry(() => sql.query(
    `INSERT INTO church_website_tech (
      church_slug, website_url, final_url, http_status,
      primary_platform, technologies, sales_angle,
      has_donate_page, has_blog, has_podcast, has_app, outreach_notes,
      detection_version, last_checked_at, created_at, updated_at
    ) VALUES ($1, $2, $3, 200, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, 2, NOW(), NOW(), NOW())
    ON CONFLICT (church_slug) DO UPDATE SET
      website_url = EXCLUDED.website_url,
      final_url = EXCLUDED.final_url,
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

async function refreshDescription(slug, summary, currentDescription) {
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

async function doProcess() {
  const metadataPath = join(DIR, "metadata.jsonl");
  const processedPath = join(DIR, "processed.txt");
  const errorsPath = join(DIR, "process-errors.jsonl");

  // Find all output-*.jsonl files (one per chunk)
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(DIR);
  const outputFiles = files
    .filter((f) => /^output(-\d+)?\.jsonl$/.test(f))
    .map((f) => join(DIR, f))
    .sort();
  if (outputFiles.length === 0) {
    console.error(`No output-*.jsonl files in ${DIR} — run \`poll\` until batches are completed.`);
    process.exit(1);
  }
  console.log(`Output files: ${outputFiles.length}`);
  for (const f of outputFiles) console.log(`  ${f}`);

  // Load metadata into memory (slug → metadata)
  const metaBySlug = new Map();
  for await (const m of readJsonl(metadataPath)) {
    metaBySlug.set(m.slug, m);
  }
  console.log(`Loaded ${metaBySlug.size} metadata rows`);

  const alreadyProcessed = await loadSlugSet(processedPath);
  console.log(`Already processed (resumable): ${alreadyProcessed.size}`);

  const startedAt = Date.now();
  let done = 0;
  const stats = { ok: 0, parseFail: 0, missingMeta: 0, httpFail: 0, dbFail: 0, fieldsFilled: {} };

  // Iterate across every output file
  async function* iterAllOutputs() {
    for (const path of outputFiles) {
      for await (const line of readJsonl(path)) yield line;
    }
  }

  for await (const line of iterAllOutputs()) {
    done += 1;
    const slug = line.custom_id;
    if (alreadyProcessed.has(slug)) { stats.ok += 1; continue; }

    if (line.response?.status_code !== 200) {
      stats.httpFail += 1;
      await appendFile(errorsPath, JSON.stringify({ slug, error: "http", line }) + "\n");
      continue;
    }
    const content = line.response?.body?.choices?.[0]?.message?.content;
    let extracted;
    try {
      const cleaned = (content || "{}").replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      extracted = JSON.parse(cleaned);
    } catch (err) {
      stats.parseFail += 1;
      await appendFile(errorsPath, JSON.stringify({ slug, error: "parse", message: err.message, content }) + "\n");
      continue;
    }

    const meta = metaBySlug.get(slug);
    if (!meta) {
      stats.missingMeta += 1;
      await appendFile(errorsPath, JSON.stringify({ slug, error: "missing-metadata" }) + "\n");
      continue;
    }

    try {
      await upsertEnrichment(slug, extracted);
      await upsertWebsiteTech(slug, meta.website, meta.final_url, meta.inspection, extracted);
      await refreshDescription(slug, extracted.summary, meta.description);
      await updateEmailIfMissing(slug, extracted.contact_email);
    } catch (err) {
      stats.dbFail += 1;
      await appendFile(errorsPath, JSON.stringify({ slug, error: "db", message: err.message }) + "\n");
      continue;
    }

    for (const [k, v] of Object.entries(extracted)) {
      const present = v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0);
      if (present) stats.fieldsFilled[k] = (stats.fieldsFilled[k] || 0) + 1;
    }
    await appendFile(processedPath, slug + "\n");
    stats.ok += 1;

    if (done % 500 === 0) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const rate = done / Math.max(1, elapsed);
      console.log(`  ${done}  · ${rate.toFixed(1)}/s  · ok=${stats.ok} parseFail=${stats.parseFail} dbFail=${stats.dbFail}`);
    }
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n━━━ Process summary ━━━`);
  console.log(`Total output lines:   ${done}`);
  console.log(`Written to DB:        ${stats.ok}`);
  console.log(`HTTP errors:          ${stats.httpFail}`);
  console.log(`JSON parse failed:    ${stats.parseFail}`);
  console.log(`Missing metadata:     ${stats.missingMeta}`);
  console.log(`DB failures:          ${stats.dbFail}`);
  console.log(`Time:                 ${Math.round(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`\nField fill rates (over ${stats.ok} successful):`);
  for (const [k, v] of Object.entries(stats.fieldsFilled).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(25)} ${v}  (${Math.round(100 * v / Math.max(1, stats.ok))}%)`);
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────
async function main() {
  if (MODE === "prepare") return doPrepare();
  if (MODE === "submit") return doSubmit();
  if (MODE === "poll") return doPoll();
  if (MODE === "process") return doProcess();
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
