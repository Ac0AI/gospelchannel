#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";
import supabaseCompat from "../src/lib/supabase.ts";
import {
  extractHeadingText,
  extractJsonLdNames,
  extractPlainText,
  hasIdentityKeyword,
  parseTitleFromHtml,
} from "./lib/church-quality.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PAGE_SIZE = 1000;
const EUROPE_COUNTRIES = new Set([
  "Albania","Andorra","Armenia","Austria","Azerbaijan","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic",
  "Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Italy",
  "Latvia","Lithuania","Luxembourg","Macedonia","Malta","Moldova","Monaco","Netherlands","Norway","Poland",
  "Portugal","Romania","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Turkey","Ukraine","United Kingdom",
]);
const MODEL = "claude-haiku-4-5-20251001";

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 0,
    concurrency: 4,
    region: "europe",
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || 4);
    else if (arg.startsWith("--region=")) options.region = arg.split("=")[1] || "europe";
  }

  return options;
}

function matchesRegion(country, region) {
  if (region !== "europe") return true;
  return EUROPE_COUNTRIES.has(country);
}

async function fetchHtml(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function loadPendingChurches(supabase, region) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,website,location,country")
      .eq("status", "pending")
      .order("confidence", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load pending churches: ${error.message}`);
    rows.push(...(data || []).filter((row) => matchesRegion(row.country, region)));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function loadEnrichments(supabase, slugs) {
  const map = new Map();
  for (let index = 0; index < slugs.length; index += 200) {
    const batch = slugs.slice(index, index + 200);
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("church_slug,official_church_name,street_address")
      .in("church_slug", batch);
    if (error) throw new Error(`Failed to load enrichments: ${error.message}`);
    for (const row of data || []) map.set(row.church_slug, row);
  }
  return map;
}

function needsIdentityOrPlaceWork(church, enrichment) {
  const name = enrichment?.official_church_name || church.name || "";
  const hasIdentity = hasIdentityKeyword(name);
  const hasPlace = Boolean((church.location || enrichment?.street_address || "").trim());
  return !hasIdentity || !hasPlace;
}

async function extractWithHaiku(client, church, html) {
  const title = parseTitleFromHtml(html);
  const h1 = extractHeadingText(html, "h1").slice(0, 5);
  const jsonLdNames = extractJsonLdNames(html).slice(0, 8);
  const text = extractPlainText(html).slice(0, 8000);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [
      {
        role: "user",
        content: `You are validating a church website entry.

Current entry:
- Name: ${church.name}
- Country: ${church.country || "unknown"}
- Current location: ${church.location || "unknown"}
- Website: ${church.website}

Website signals:
- Page title: ${title || "unknown"}
- H1 headings: ${h1.join(" | ") || "none"}
- JSON-LD names: ${jsonLdNames.join(" | ") || "none"}
- Text excerpt: ${text || "none"}

Return ONLY valid JSON in this exact shape:
{
  "officialChurchName": string | null,
  "location": string | null,
  "streetAddress": string | null,
  "isChurch": boolean | null,
  "confidence": number
}

Rules:
- Only return "officialChurchName" if the website clearly shows a fuller or more correct church name than the current entry.
- "location" should be the city/town/locality only, not a country, region, email, or URL.
- "streetAddress" should only be returned when explicit on the page.
- Prefer null over guessing.
- Set confidence from 0 to 1.
- If this does not look like a church site, set isChurch to false.
`,
      },
    ],
  });

  const textResponse = (response.content[0]?.text || "{}")
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  return JSON.parse(textResponse);
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  const { createAdminClient, hasSupabaseServiceConfig } = supabaseCompat;

  if (!hasSupabaseServiceConfig()) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const supabase = createAdminClient();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const churches = await loadPendingChurches(supabase, options.region);
  const enrichmentMap = await loadEnrichments(supabase, churches.map((row) => row.slug));
  const candidates = churches.filter((church) => church.website && needsIdentityOrPlaceWork(church, enrichmentMap.get(church.slug)));
  const selected = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;

  console.log(`Pending identity/location candidates: ${selected.length}`);

  const results = await mapWithConcurrency(selected, options.concurrency, async (church) => {
    const enrichment = enrichmentMap.get(church.slug);
    const html = await fetchHtml(church.website);
    if (!html) {
      return { slug: church.slug, updated: false, reason: "fetch_failed" };
    }

    const extracted = await extractWithHaiku(client, church, html);
    const confidence = Number(extracted?.confidence || 0);
    const officialChurchName = String(extracted?.officialChurchName || "").trim();
    const location = String(extracted?.location || "").trim();
    const streetAddress = String(extracted?.streetAddress || "").trim();
    const isChurch = extracted?.isChurch;

    if (isChurch === false || confidence < 0.72) {
      return { slug: church.slug, updated: false, reason: "low_confidence", confidence, isChurch };
    }

    const enrichmentUpdate = {
      church_slug: church.slug,
      ...(officialChurchName ? { official_church_name: officialChurchName } : {}),
      ...(streetAddress ? { street_address: streetAddress } : {}),
    };

    const churchUpdate = {
      ...(location && !church.location ? { location } : {}),
    };

    if (!options.preview) {
      if (Object.keys(enrichmentUpdate).length > 1) {
        const { error } = await supabase
          .from("church_enrichments")
          .upsert(enrichmentUpdate, { onConflict: "church_slug" });
        if (error) throw new Error(`Failed to update enrichment for ${church.slug}: ${error.message}`);
      }

      if (Object.keys(churchUpdate).length > 0) {
        const { error } = await supabase
          .from("churches")
          .update(churchUpdate)
          .eq("slug", church.slug);
        if (error) throw new Error(`Failed to update church for ${church.slug}: ${error.message}`);
      }
    }

    return {
      slug: church.slug,
      updated: Object.keys(enrichmentUpdate).length > 1 || Object.keys(churchUpdate).length > 0,
      officialChurchName: officialChurchName || "",
      location: churchUpdate.location || "",
      streetAddress: streetAddress || "",
      confidence,
    };
  });

  const updated = results.filter((result) => result.ok && result.value?.updated).map((result) => result.value);
  console.log(`Updated: ${updated.length}`);
  console.log(JSON.stringify(updated.slice(0, 30), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
