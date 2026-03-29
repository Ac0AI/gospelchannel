#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CHURCHES_PATH = join(ROOT_DIR, "src", "data", "churches.json");
const DEFAULT_OUTPUT_PATH = join(ROOT_DIR, "tmp", "website-tech-report.json");

const PLATFORM_PRIORITY = [
  "WordPress",
  "Squarespace",
  "Wix",
  "Webflow",
  "Framer",
  "Shopify",
  "Ghost",
  "Drupal",
  "Joomla",
  "HubSpot CMS",
  "Next.js",
  "Nuxt",
  "Gatsby",
];

function parseArgs(argv) {
  const options = {
    city: "",
    country: "",
    limit: 0,
    output: DEFAULT_OUTPUT_PATH,
    concurrency: 8,
    writeSupabase: false,
    onlyMissingSupabase: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--city=")) options.city = arg.split("=")[1]?.trim() || "";
    else if (arg.startsWith("--country=")) options.country = arg.split("=")[1]?.trim() || "";
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--output=")) options.output = arg.split("=")[1]?.trim() || DEFAULT_OUTPUT_PATH;
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Math.min(20, Number(arg.split("=")[1]) || 8));
    else if (arg === "--write-supabase") options.writeSupabase = true;
    else if (arg === "--only-missing-supabase") options.onlyMissingSupabase = true;
  }

  return options;
}

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesLocation(location = "", expected = "") {
  if (!expected) return true;
  return new RegExp(`(^|\\b)${escapeRegExp(expected)}(\\b|$)`, "i").test(location);
}

function loadChurches() {
  return JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));
}

function addDetection(map, technology, category, reason) {
  const existing = map.get(technology);
  if (existing) {
    existing.reasons.push(reason);
    return;
  }

  map.set(technology, {
    technology,
    category,
    reasons: [reason],
  });
}

function findMetaGenerator(html = "") {
  const match = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  return match?.[1]?.trim() || "";
}

function detectTechnologies({ website = "", finalUrl = "", html = "", headers = new Headers() }) {
  const detections = new Map();
  const haystack = `${website}\n${finalUrl}\n${html}`.toLowerCase();
  const generator = findMetaGenerator(html);
  const server = headers.get("server") || "";
  const poweredBy = headers.get("x-powered-by") || "";

  if (generator) {
    if (/wordpress/i.test(generator)) addDetection(detections, "WordPress", "cms", `meta generator: ${generator}`);
    if (/squarespace/i.test(generator)) addDetection(detections, "Squarespace", "builder", `meta generator: ${generator}`);
    if (/ghost/i.test(generator)) addDetection(detections, "Ghost", "cms", `meta generator: ${generator}`);
    if (/drupal/i.test(generator)) addDetection(detections, "Drupal", "cms", `meta generator: ${generator}`);
    if (/joomla/i.test(generator)) addDetection(detections, "Joomla", "cms", `meta generator: ${generator}`);
    if (/hubspot/i.test(generator)) addDetection(detections, "HubSpot CMS", "cms", `meta generator: ${generator}`);
  }

  if (/(wp-content|wp-includes|\/wp-json\/|wordpress\.com)/i.test(haystack)) {
    addDetection(detections, "WordPress", "cms", "wordpress asset or endpoint detected");
  }
  if (/(squarespace\.com|squarespace-cdn\.com|static1\.squarespace\.com)/i.test(haystack)) {
    addDetection(detections, "Squarespace", "builder", "squarespace asset detected");
  }
  if (/(wixsite\.com|wixstatic\.com|parastorage\.com|static\.wixstatic\.com)/i.test(haystack)) {
    addDetection(detections, "Wix", "builder", "wix asset detected");
  }
  if (/(webflow\.js|webflow\.css|data-wf-domain|uploads-ssl\.webflow\.com)/i.test(haystack)) {
    addDetection(detections, "Webflow", "builder", "webflow asset detected");
  }
  if (/(framerusercontent\.com|cdn\.framer\.com|framer\.app)/i.test(haystack)) {
    addDetection(detections, "Framer", "builder", "framer asset detected");
  }
  if (/(cdn\.shopify\.com|\/cdn\/shop\/|shopify\.theme|shopify\.section)/i.test(haystack)) {
    addDetection(detections, "Shopify", "commerce", "shopify asset detected");
  }
  if (/(ghost\/api|content=\"ghost|cdn\.ghost\.io)/i.test(haystack)) {
    addDetection(detections, "Ghost", "cms", "ghost asset detected");
  }
  if (/(\/_next\/static\/|__next_data__|x-powered-by:\s*next\.js)/i.test(haystack) || /next\.js/i.test(poweredBy)) {
    addDetection(detections, "Next.js", "framework", "next.js asset or header detected");
  }
  if (/(\/_nuxt\/|__nuxt__)/i.test(haystack)) {
    addDetection(detections, "Nuxt", "framework", "nuxt asset detected");
  }
  if (/(webpack-runtime|___gatsby|gatsby-browser)/i.test(haystack)) {
    addDetection(detections, "Gatsby", "framework", "gatsby asset detected");
  }
  if (/(hubspotusercontent|hs-sites|hsforms|hubspot)/i.test(haystack)) {
    addDetection(detections, "HubSpot CMS", "cms", "hubspot asset detected");
  }
  if (/drupal-settings-json|sites\/default\/files/i.test(haystack)) {
    addDetection(detections, "Drupal", "cms", "drupal asset detected");
  }
  if (/\/media\/system\/js\/|joomla/i.test(haystack)) {
    addDetection(detections, "Joomla", "cms", "joomla asset detected");
  }

  if (headers.get("x-vercel-id") || headers.get("x-vercel-cache")) {
    addDetection(detections, "Vercel", "hosting", "vercel response header detected");
  }
  if (headers.get("x-nf-request-id")) {
    addDetection(detections, "Netlify", "hosting", "netlify response header detected");
  }
  if (headers.get("cf-ray") || /cloudflare/i.test(server)) {
    addDetection(detections, "Cloudflare", "infrastructure", "cloudflare response header detected");
  }
  if (/firebaseapp\.com|web\.app/i.test(haystack)) {
    addDetection(detections, "Firebase Hosting", "hosting", "firebase host detected");
  }

  return [...detections.values()].sort((left, right) => left.technology.localeCompare(right.technology));
}

function pickPrimaryPlatform(detections) {
  for (const technology of PLATFORM_PRIORITY) {
    if (detections.some((item) => item.technology === technology)) {
      return technology;
    }
  }
  return "Unknown";
}

function getSalesAngle(primaryPlatform) {
  switch (primaryPlatform) {
    case "WordPress":
      return "Plugin/theme maintenance, speed, security, and redesign angle.";
    case "Squarespace":
      return "Migration, SEO control, and conversion-focused redesign angle.";
    case "Wix":
      return "Migration, SEO flexibility, and editorial control angle.";
    case "Webflow":
    case "Framer":
      return "Less rebuild urgency; better angle is SEO, content model, and analytics.";
    case "Ghost":
      return "Publishing/blog optimization and membership/content workflow angle.";
    case "Next.js":
    case "Nuxt":
    case "Gatsby":
      return "Modern stack already; pitch performance, analytics, and content/editor workflow.";
    case "Unknown":
      return "Audit and modernization angle.";
    default:
      return "CMS cleanup, content workflow, and redesign angle.";
  }
}

async function inspectWebsite(church) {
  const result = {
    slug: church.slug,
    name: church.name,
    website: church.website,
    location: church.location || "",
    country: church.country || "",
    finalUrl: church.website,
    httpStatus: null,
    primaryPlatform: "Unknown",
    technologies: [],
    salesAngle: getSalesAngle("Unknown"),
    error: null,
  };

  if (!church.website) {
    result.error = "missing_website";
    return result;
  }

  try {
    const response = await fetch(church.website, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "user-agent": "GospelChannelTechAudit/1.0",
        "accept": "text/html,application/xhtml+xml",
      },
    });

    result.finalUrl = response.url || church.website;
    result.httpStatus = response.status;

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      result.error = `http_${response.status}`;
      return result;
    }
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      result.error = `non_html:${contentType || "unknown"}`;
      return result;
    }

    const html = (await response.text()).slice(0, 800000);
    const detections = detectTechnologies({
      website: church.website,
      finalUrl: result.finalUrl,
      html,
      headers: response.headers,
    });

    result.technologies = detections;
    result.primaryPlatform = pickPrimaryPlatform(detections);
    result.salesAngle = getSalesAngle(result.primaryPlatform);
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function next() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

function summarize(results) {
  const counts = new Map();

  for (const row of results) {
    const key = row.primaryPlatform || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([platform, count]) => ({ platform, count }));
}

function normalizeWebsiteKey(url = "") {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function createSupabaseServiceClient() {
  loadLocalEnv(ROOT_DIR);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function writeResultsToSupabase(results, generatedAt) {
  const supabase = createSupabaseServiceClient();
  const rows = results.map((row) => ({
    church_slug: row.slug,
    website_url: row.website,
    final_url: row.finalUrl || null,
    http_status: Number.isInteger(row.httpStatus) ? row.httpStatus : null,
    primary_platform: row.primaryPlatform || null,
    technologies: row.technologies || [],
    sales_angle: row.salesAngle || null,
    error: row.error || null,
    detection_version: 1,
    last_checked_at: generatedAt,
  }));

  const { error } = await supabase
    .from("church_website_tech")
    .upsert(rows, { onConflict: "church_slug" });

  if (error) {
    throw new Error(`Failed to upsert church_website_tech: ${error.message}`);
  }
}

async function loadExistingSupabaseSlugs() {
  const supabase = createSupabaseServiceClient();
  const slugs = new Set();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("church_website_tech")
      .select("church_slug")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load church_website_tech slugs: ${error.message}`);
    }

    for (const row of data || []) {
      if (row.church_slug) slugs.add(row.church_slug);
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return slugs;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let churches = loadChurches()
    .filter((church) => Boolean(church.website))
    .filter((church) => !options.city || matchesLocation(church.location || "", options.city))
    .filter((church) => !options.country || normalize(church.country) === normalize(options.country));

  if (options.onlyMissingSupabase) {
    const existingSlugs = await loadExistingSupabaseSlugs();
    churches = churches.filter((church) => !existingSlugs.has(church.slug));
    console.log(`Filtered to ${churches.length} church website(s) missing Supabase tech rows.`);
  }

  const selected = options.limit > 0 ? churches.slice(0, options.limit) : churches;
  console.log(`Inspecting ${selected.length} church website(s)...`);
  const websiteCache = new Map();

  const results = await mapWithConcurrency(selected, options.concurrency, async (church, index) => {
    console.log(`[${index + 1}/${selected.length}] ${church.name}`);
    const cacheKey = normalizeWebsiteKey(church.website);
    const cached = websiteCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        slug: church.slug,
        name: church.name,
        website: church.website,
        location: church.location || "",
        country: church.country || "",
      };
    }

    const inspected = await inspectWebsite(church);
    websiteCache.set(cacheKey, {
      ...inspected,
      slug: "",
      name: "",
      website: church.website,
      location: "",
      country: "",
    });
    return inspected;
  });

  const generatedAt = new Date().toISOString();

  const report = {
    generatedAt,
    filters: {
      city: options.city || null,
      country: options.country || null,
      limit: options.limit || null,
    },
    summary: summarize(results),
    results,
  };

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (options.writeSupabase) {
    await writeResultsToSupabase(results, generatedAt);
  }

  console.log("\nPlatform summary:");
  for (const row of report.summary) {
    console.log(`  ${row.platform}: ${row.count}`);
  }
  console.log(`\nWrote report to ${options.output}`);
  if (options.writeSupabase) {
    console.log("Upserted results to church_website_tech");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
