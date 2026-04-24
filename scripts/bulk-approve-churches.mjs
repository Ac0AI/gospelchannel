#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { buildApprovalDecision, resolveApprovedChurchName } from "./lib/church-approval.mjs";
import supabaseCompat from "../src/lib/supabase.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SCREENING_PATH = resolve(ROOT_DIR, "src", "data", "cache", "church-candidate-screening.json");
const PAGE_SIZE = 1000;
const BATCH_SIZE = 100;
const EUROPE_COUNTRIES = new Set([
  "Albania",
  "Andorra",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Macedonia",
  "Malta",
  "Moldova",
  "Monaco",
  "Netherlands",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
  "Ukraine",
  "United Kingdom",
]);

function parseArgs(argv) {
  const options = {
    threshold: 70,
    limit: 0,
    preview: false,
    reconcile: true,
    region: "europe",
    reasonPrefix: "",
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--skip-reconcile") options.reconcile = false;
    else if (arg.startsWith("--min-score=")) {
      options.threshold = Math.max(0, Number(arg.split("=")[1]) || 70);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    } else if (arg.startsWith("--region=")) {
      options.region = arg.split("=")[1] || "europe";
    } else if (arg.startsWith("--reason-prefix=")) {
      options.reasonPrefix = arg.split("=")[1] || "";
    }
  }

  return options;
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value || "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function loadScreeningMap() {
  try {
    const rows = JSON.parse(readFileSync(SCREENING_PATH, "utf8"));
    return new Map(rows.map((row) => [row.slug, {
      verdict: row.verdict || "",
      websiteChurchScore: Number(row.website_church_score || 0),
      headerImageUrl: row.header_image_url || "",
      location: row.location || "",
      country: row.country || "",
      websiteEmails: splitList(row.website_emails),
    }]));
  } catch {
    return new Map();
  }
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function matchesRegion(country, region) {
  if (region !== "europe") return true;
  return EUROPE_COUNTRIES.has(country);
}

async function loadPendingChurches(supabase, region, reasonPrefix) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,website,email,location,country,confidence,status,header_image,discovery_source,source_kind,reason")
      .eq("status", "pending")
      .order("confidence", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load pending churches: ${error.message}`);
    }

    const filtered = (data || []).filter((row) => matchesRegion(row.country, region) && (!reasonPrefix || String(row.reason || "").startsWith(reasonPrefix)));
    rows.push(...filtered);

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function loadEnrichmentMap(supabase, slugs) {
  const map = new Map();

  for (const batch of chunk(slugs, 200)) {
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("church_slug,street_address,contact_email,website_url,facebook_url,youtube_url,cover_image_url,official_church_name,confidence")
      .in("church_slug", batch);

    if (error) {
      throw new Error(`Failed to load enrichments: ${error.message}`);
    }

    for (const row of data || []) {
      map.set(row.church_slug, row);
    }
  }

  return map;
}

async function updateChurchBatch(supabase, rows) {
  for (const row of rows) {
    const { error } = await supabase
      .from("churches")
      .update(row.updates)
      .eq("slug", row.slug);
    if (error) {
      throw new Error(`Failed to approve ${row.slug}: ${error.message}`);
    }
  }
}

async function upsertEnrichmentBatch(supabase, rows) {
  if (rows.length === 0) return;

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await supabase
      .from("church_enrichments")
      .upsert(batch, { onConflict: "church_slug" });
    if (error) {
      throw new Error(`Failed to update enrichment seeds: ${error.message}`);
    }
  }
}

function runReconcile() {
  const result = spawnSync("npm", ["run", "churches:reconcile"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error("churches:reconcile failed");
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  const { createAdminClient, hasSupabaseServiceConfig } = supabaseCompat;

  if (!hasSupabaseServiceConfig()) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }

  const supabase = createAdminClient();

  const screeningMap = loadScreeningMap();
  const pendingChurches = await loadPendingChurches(supabase, options.region, options.reasonPrefix);
  const slicedChurches = options.limit > 0 ? pendingChurches.slice(0, options.limit) : pendingChurches;
  const enrichmentMap = await loadEnrichmentMap(supabase, slicedChurches.map((row) => row.slug));

  const decisions = slicedChurches.map((church) => {
    const screening = screeningMap.get(church.slug);
    const enrichment = enrichmentMap.get(church.slug);
    const fetchedEmail = screening?.websiteEmails?.[0] || "";
    const decision = buildApprovalDecision(church, {
      enrichment,
      screening,
      fetchedEmail,
      approvalThreshold: options.threshold,
    });

    return {
      church,
      screening,
      enrichment,
      fetchedEmail,
      ...decision,
    };
  }).sort((left, right) => {
    if (left.wave !== right.wave) return left.wave - right.wave;
    if (right.score !== left.score) return right.score - left.score;
    return (right.church.confidence || 0) - (left.church.confidence || 0);
  });

  const approved = decisions.filter((row) => row.eligible);
  const stats = {
    totalPending: slicedChurches.length,
    approvedNetNew: approved.length,
    enrichedEmail: approved.filter((row) => row.merged.email && !row.church.email).length,
    enrichedFacebook: approved.filter((row) => row.merged.facebookUrl).length,
    usableHeroHints: approved.filter((row) => row.merged.headerImage).length,
  };

  console.log(`Pending reviewed: ${stats.totalPending}`);
  console.log(`Would approve: ${stats.approvedNetNew}`);
  console.log(`Email fills: ${stats.enrichedEmail}`);
  console.log(`Facebook available: ${stats.enrichedFacebook}`);
  console.log(`Usable hero hints: ${stats.usableHeroHints}`);
  console.log(JSON.stringify(
    approved.slice(0, 20).map((row) => ({
      slug: row.church.slug,
      name: row.church.name,
      country: row.church.country,
      location: row.merged.location,
      score: row.score,
      wave: row.wave,
      email: row.merged.email || null,
      facebook: row.merged.facebookUrl || null,
      headerImage: row.merged.headerImage || null,
    })),
    null,
    2
  ));

  if (options.preview || approved.length === 0) {
    console.log(options.preview ? "\nPreview mode: nothing written." : "\nNothing eligible for approval.");
    return;
  }

  const now = new Date().toISOString();
  const churchUpdates = approved.map((row) => ({
    slug: row.church.slug,
    updates: {
      ...(resolveApprovedChurchName(row.church.name || "", row.enrichment?.official_church_name || "") !== (row.church.name || "")
        ? { name: resolveApprovedChurchName(row.church.name || "", row.enrichment?.official_church_name || "") }
        : {}),
      status: "approved",
      email: row.merged.email || row.church.email || null,
      location: row.church.location || row.merged.location || null,
      country: row.church.country || row.merged.country || null,
      website: row.merged.website || row.church.website || null,
      last_researched: now,
    },
  }));

  const enrichmentUpdates = approved.flatMap((row) => {
    const update = {
      church_slug: row.church.slug,
      ...(row.merged.email && !row.enrichment?.contact_email ? { contact_email: row.merged.email } : {}),
      ...(row.enrichment?.official_church_name ? { official_church_name: row.enrichment.official_church_name } : {}),
      ...(row.merged.facebookUrl && !row.enrichment?.facebook_url ? { facebook_url: row.merged.facebookUrl } : {}),
      ...(row.merged.website && !row.enrichment?.website_url ? { website_url: row.merged.website } : {}),
    };

    return Object.keys(update).length > 1 ? [update] : [];
  });

  await upsertEnrichmentBatch(supabase, enrichmentUpdates);
  await updateChurchBatch(supabase, churchUpdates);
  console.log(`\nApproved ${approved.length} churches.`);

  if (options.reconcile) {
    console.log("\nRunning churches:reconcile...");
    runReconcile();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
