#!/usr/bin/env node

import churchesSnapshot from "../src/data/churches.json" with { type: "json" };
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  extractPlainText,
  findLikelyHeroImage,
  looksSuspiciousMediaUrl,
  parseTitleFromHtml,
  scoreWebsiteSignals,
} from "./lib/church-quality.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const SNAPSHOT_PATH = resolve(ROOT_DIR, "src/data/churches.json");
const FAILURE_LOG_PATH = resolve(ROOT_DIR, "tmp/hero-backfill-failures.json");
const SKIP_LOG_PATH = resolve(ROOT_DIR, "tmp/hero-backfill-skips.json");

loadLocalEnv(ROOT_DIR);

const MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
const MEDIA_HOST = new URL(MEDIA_BASE_URL).hostname.replace(/^www\./, "").toLowerCase();
const BLOCKED_IMAGE_HOST_PATTERNS = [
  "instagram.com",
  "igcdn-photos-",
  "cdninstagram.com",
  "facebook.com",
  "fbcdn.net",
  "youtube.com",
  "youtu.be",
  "ytimg.com",
  "linkedin.com",
  "licdn.com",
  "paypal.com",
  "archive.org",
  "118712.fr",
  "pagesjaunes.fr",
  "tripadvisor.",
  "wikipedia.org",
  "wikimedia.org",
  "yelp.",
];
const UNTRUSTED_WEBSITE_HOST_PATTERNS = [
  "pagesjaunes.",
  "tripadvisor.",
  "yelp.",
  "topusadetails.",
  "usacatopbusi.",
];
const BLOCKED_IMAGE_PATH_PATTERNS = [
  "/logo",
  "/logos/",
  "/icon",
  "/icons/",
  "/avatar",
  "/favicon",
  "/flags/",
  "/badge",
  "/placeholder",
  "/default",
  "/spinner",
  "/loading",
  "/social/",
];
const UNTRUSTED_WEBSITE_PATH_PATTERNS = [
  "/details/",
  "/listing/",
  "/listings/",
  "/business/",
  "/place/",
];
const MIN_HERO_WIDTH = 480;
const MIN_HERO_HEIGHT = 240;
const MAX_HERO_WIDTH = 1600;
const MAX_HERO_HEIGHT = 1200;
const WEBP_QUALITY = 76;
const MIN_CACHE_IMAGE_SCORE = 3;
const REJECTED_IMAGE_KEYWORDS = /logo|icon|avatar|favicon|flag|badge|placeholder|dummy|default|spinner|loading|play-subscribe|menu|facebook|instagram|twitter|conference|event|poster|flyer|brochure|bulletin|guide|ghid|admit|admission|sermon|schedule|thumbnail|spacer|transparent|copy|small|lockup|billboard|artwork|pastor|text|series|pixel|screenshot|swish|vipps|paypal|stripe|klarna|bankid|qr/i;

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
}

const sql = neon(DATABASE_URL);

function getArgValue(flag, fallback = "") {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1] || fallback;
  return fallback;
}

function getArgValues(flag) {
  const values = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === flag) {
      const next = process.argv[index + 1];
      if (next) values.push(next);
      continue;
    }

    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }

  return values;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normalizeUrl(value = "", baseUrl = "") {
  if (!value) return "";

  try {
    return baseUrl ? new URL(value, baseUrl).toString() : new URL(value).toString();
  } catch {
    return "";
  }
}

function normalizeHost(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isOwnedMediaUrl(url = "") {
  return normalizeHost(url) === MEDIA_HOST;
}

function getImageUrlHints(url = "") {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const numbers = new Map();

    for (const key of ["w", "width", "imwidth", "maxwidth", "mw"]) {
      const raw = parsed.searchParams.get(key);
      const value = Number.parseInt(raw || "", 10);
      if (Number.isFinite(value) && value > 0) {
        numbers.set("width", Math.max(numbers.get("width") || 0, value));
      }
    }

    for (const key of ["h", "height", "imheight", "maxheight", "mh"]) {
      const raw = parsed.searchParams.get(key);
      const value = Number.parseInt(raw || "", 10);
      if (Number.isFinite(value) && value > 0) {
        numbers.set("height", Math.max(numbers.get("height") || 0, value));
      }
    }

    const resize = (parsed.searchParams.get("resize") || "").match(/^(\d{2,5})[,x](\d{2,5})$/i);
    if (resize) {
      numbers.set("width", Math.max(numbers.get("width") || 0, Number.parseInt(resize[1] || "0", 10)));
      numbers.set("height", Math.max(numbers.get("height") || 0, Number.parseInt(resize[2] || "0", 10)));
    }

    const sizeMatch = pathname.match(/(?:^|[^0-9])(\d{2,5})[xX](\d{2,5})(?:[^0-9]|$)/);
    if (sizeMatch) {
      numbers.set("width", Math.max(numbers.get("width") || 0, Number.parseInt(sizeMatch[1] || "0", 10)));
      numbers.set("height", Math.max(numbers.get("height") || 0, Number.parseInt(sizeMatch[2] || "0", 10)));
    }

    const pxWidthMatch = pathname.match(/(?:^|\/)(\d{2,4})px[-_]/);
    if (pxWidthMatch) {
      numbers.set("width", Math.max(numbers.get("width") || 0, Number.parseInt(pxWidthMatch[1] || "0", 10)));
    }

    const format = (parsed.searchParams.get("fm") || parsed.searchParams.get("format") || "").toLowerCase();

    return {
      host,
      pathname,
      width: numbers.get("width") || 0,
      height: numbers.get("height") || 0,
      format,
    };
  } catch {
    return {
      host: "",
      pathname: "",
      width: 0,
      height: 0,
      format: "",
    };
  }
}

function getImageUrlRejectionReason(url = "") {
  const normalized = normalizeUrl(url);
  if (!normalized) return "invalid_url";
  if (!/^https?:\/\//i.test(normalized)) return "unsupported_protocol";
  if (isOwnedMediaUrl(normalized)) return "owned_media";
  if (looksSuspiciousMediaUrl(normalized)) return "suspicious_media";
  const hints = getImageUrlHints(normalized);
  if (BLOCKED_IMAGE_HOST_PATTERNS.some((pattern) => hints.host.includes(pattern))) return "blocked_host";
  if (BLOCKED_IMAGE_PATH_PATTERNS.some((pattern) => hints.pathname.includes(pattern))) return "blocked_path";
  if (hints.pathname.endsWith(".svg") || hints.format === "svg") return "svg_not_allowed";
  if (hints.pathname.endsWith(".gif") || hints.format === "gif") return "gif_not_allowed";
  if ((hints.width > 0 && hints.width < MIN_HERO_WIDTH) || (hints.height > 0 && hints.height < MIN_HERO_HEIGHT)) return "tiny_hint";
  if (REJECTED_IMAGE_KEYWORDS.test(normalized)) {
    return "keyword_blocked";
  }
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(normalized) && !/wp-content|uploads|images\/|image\/|img\//i.test(normalized)) {
    return "not_image_like";
  }
  return "";
}

function isExternalImageUrl(url = "") {
  return getImageUrlRejectionReason(url) === "";
}

function markdownToImageCandidates(markdown = "", baseUrl = "") {
  const matches = [
    ...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/gi),
    ...markdown.matchAll(/https?:\/\/[^\s)]+?\.(?:jpg|jpeg|png|webp|gif|svg)(?:[?#][^\s)]*)?/gi),
  ];

  return [...new Set(
    matches
      .map((match) => normalizeUrl(match[1] || match[0] || "", baseUrl))
      .filter(Boolean)
  )];
}

function scoreImageCandidate(url = "") {
  if (!isExternalImageUrl(url)) {
    return -999;
  }

  let score = 0;
  const lower = url.toLowerCase();
  const hints = getImageUrlHints(url);

  if (/hero|banner|header|cover|frontpage|homepage|worship|church|building|exterior|interior|community|background/i.test(lower)) {
    score += 5;
  }

  if (/\/wp-content\/uploads\/|cdn|cloudinary|imgix|assets\/images\//i.test(lower)) {
    score += 2;
  }

  const width = hints.width;
  const height = hints.height;
  if (width > 0 || height > 0) {
    if (width >= 900 && height >= 400) score += 3;
    if (width > 0 && height > 0 && width / Math.max(height, 1) >= 1.3) score += 2;
    if (width < MIN_HERO_WIDTH || height < MIN_HERO_HEIGHT) score -= 6;
  }

  if (REJECTED_IMAGE_KEYWORDS.test(lower)) {
    score -= 8;
  }

  if (BLOCKED_IMAGE_HOST_PATTERNS.some((pattern) => hints.host.includes(pattern))) {
    score -= 12;
  }

  if (BLOCKED_IMAGE_PATH_PATTERNS.some((pattern) => hints.pathname.includes(pattern))) {
    score -= 10;
  }

  if (looksSuspiciousMediaUrl(lower)) {
    score -= 12;
  }

  return score;
}

function pickImageFromMarkdown(markdown = "", baseUrl = "") {
  const candidates = markdownToImageCandidates(markdown, baseUrl)
    .filter((candidate) => !looksSuspiciousMediaUrl(candidate))
    .map((candidate) => ({ candidate, score: scoreImageCandidate(candidate) }))
    .filter((row) => row.score >= MIN_CACHE_IMAGE_SCORE)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.candidate || "";
}

function buildPageText(row) {
  const pages = Array.isArray(row.raw_crawled_pages) ? row.raw_crawled_pages : [];
  const pageText = pages
    .map((page) => (typeof page?.markdown === "string" ? page.markdown : ""))
    .filter(Boolean)
    .join("\n\n");

  return [row.raw_website_markdown || "", pageText].filter(Boolean).join("\n\n");
}

function isLikelyChurchPage(row, headerImageUrl = "") {
  const pageText = buildPageText(row);
  const websiteUrl = row.website_url || row.website || "";
  const websiteHost = normalizeHost(websiteUrl);
  const websitePath = (() => {
    try {
      return new URL(websiteUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (UNTRUSTED_WEBSITE_HOST_PATTERNS.some((pattern) => websiteHost.includes(pattern))) {
    return false;
  }

  if (UNTRUSTED_WEBSITE_PATH_PATTERNS.some((pattern) => websitePath.includes(pattern))) {
    return false;
  }

  if (!pageText) return true;

  const review = scoreWebsiteSignals({
    candidateName: row.name || "",
    pageTitle: "",
    nameCandidates: [row.name || ""],
    pageText,
    finalUrl: row.website_url || row.website || "",
    emails: [],
    location: row.location || "",
    headerImageUrl,
  });

  return !review.flags.includes("non_church_page")
    && !review.flags.includes("blocked_host")
    && review.score >= 0.25;
}

function chooseHeroSource(row, snapshotChurch, debug = false) {
  const websiteUrl = row.website_url || row.website || "";
  const pageText = buildPageText(row);
  const normalizedCandidates = [
    snapshotChurch?.headerImage || "",
    row.header_image || "",
    row.cover_image_url || "",
  ]
    .map((value) => normalizeUrl(value, websiteUrl))
    .filter(Boolean);
  const candidateSources = normalizedCandidates.filter(isExternalImageUrl);

  if (debug) {
    console.log(JSON.stringify({
      slug: row.slug,
      websiteUrl,
      headerImage: row.header_image || "",
      coverImageUrl: row.cover_image_url || "",
      normalizedCandidates,
      candidateSources,
      hasPageText: Boolean(pageText),
    }, null, 2));

    for (const sourceUrl of normalizedCandidates) {
      console.log(JSON.stringify({
        slug: row.slug,
        sourceUrl,
        acceptedByUrlFilter: isExternalImageUrl(sourceUrl),
        rejectionReason: getImageUrlRejectionReason(sourceUrl),
      }, null, 2));
    }
  }

  for (const sourceUrl of candidateSources) {
    const allowed = isLikelyChurchPage(row, sourceUrl);
    if (debug) {
      console.log(JSON.stringify({
        slug: row.slug,
        sourceUrl,
        allowed,
      }, null, 2));
    }

    if (allowed) {
      return { sourceUrl, source: "existing" };
    }
  }

  if (pageText) {
    const cachedCandidate = pickImageFromMarkdown(pageText, websiteUrl);
    if (debug) {
      console.log(JSON.stringify({
        slug: row.slug,
        cachedCandidate,
      }, null, 2));
    }
    if (cachedCandidate && isLikelyChurchPage(row, cachedCandidate)) {
      return { sourceUrl: cachedCandidate, source: "cache" };
    }
  }

  return { sourceUrl: "", source: "" };
}

async function fetchWebsiteHero(row, timeoutMs) {
  const websiteUrl = row.website_url || row.website || "";
  if (!websiteUrl) return { sourceUrl: "", source: "", reason: "missing_website" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });

    if (!response.ok) {
      return { sourceUrl: "", source: "", reason: `fetch_${response.status}` };
    }

    const html = await response.text();
    const finalUrl = response.url || websiteUrl;
    const candidate = findLikelyHeroImage(html, finalUrl);
    if (!candidate || !isExternalImageUrl(candidate)) {
      return { sourceUrl: "", source: "", reason: "no_viable_html_image" };
    }

    const review = scoreWebsiteSignals({
      candidateName: row.name || "",
      pageTitle: parseTitleFromHtml(html),
      nameCandidates: [row.name || ""],
      pageText: extractPlainText(html),
      finalUrl,
      emails: [],
      location: row.location || "",
      headerImageUrl: candidate,
    });

    if (review.flags.includes("non_church_page")) {
      return { sourceUrl: "", source: "", reason: "non_church_page" };
    }

    return { sourceUrl: candidate, source: "live_fetch", reason: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sourceUrl: "", source: "", reason: message || "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(sourceUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`download_${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`non_image_${contentType || "unknown"}`);
  }
  if (/svg/i.test(contentType)) {
    throw new Error("svg_not_allowed");
  }
  if (!isExternalImageUrl(response.url || sourceUrl)) {
    throw new Error("rejected_after_redirect");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 5_000) {
    throw new Error(`too_small_${buffer.length}`);
  }

  const optimized = sharp(buffer, { failOn: "none", animated: false }).rotate();
  const metadata = await optimized.metadata();
  if ((metadata.width || 0) < MIN_HERO_WIDTH || (metadata.height || 0) < MIN_HERO_HEIGHT) {
    throw new Error(`too_small_dimensions_${metadata.width || 0}x${metadata.height || 0}`);
  }

  const webpBuffer = await optimized
    .resize({
      width: MAX_HERO_WIDTH,
      height: MAX_HERO_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 4,
    })
    .toBuffer();

  if (webpBuffer.length < 4_000) {
    throw new Error(`optimized_too_small_${webpBuffer.length}`);
  }

  return {
    buffer: webpBuffer,
    contentType: "image/webp",
    extension: "webp",
  };
}

async function uploadToR2({ key, buffer, contentType }) {
  const tempPath = resolve(tmpdir(), `gospel-hero-${randomUUID()}`);
  await writeFile(tempPath, buffer);

  const args = [
    "wrangler",
    "r2",
    "object",
    "put",
    `${process.env.R2_BUCKET_NAME || "church-assets"}/${key}`,
    "--remote",
    "--file",
    tempPath,
  ];

  if (contentType) {
    args.push("--content-type", contentType);
  }

  try {
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn("npx", args, {
        cwd: ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", rejectPromise);
      child.on("close", (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(stderr || stdout || `wrangler exited with code ${code}`));
      });
    });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

async function hydrateCloudflareApiToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return false;
  }

  const tokenConfigPaths = [
    resolve(homedir(), ".wrangler/config/default.toml"),
    resolve(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
  ];

  for (const configPath of tokenConfigPaths) {
    try {
      const content = await readFile(configPath, "utf8");
      const token = content.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1]?.trim();
      if (token) {
        process.env.CLOUDFLARE_API_TOKEN = token;
        return true;
      }
    } catch {
      // ignore missing local wrangler config
    }
  }

  return false;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function mediaUrlForSlug(slug, extension) {
  return `${MEDIA_BASE_URL}/heroes/${slug}.${extension}`;
}

async function updateHeroInDatabase(slug, mediaUrl) {
  await sql`update churches set header_image = ${mediaUrl}, updated_at = now() where slug = ${slug}`;
  await sql`
    insert into church_enrichments (church_slug, cover_image_url, updated_at)
    values (${slug}, ${mediaUrl}, now())
    on conflict (church_slug)
    do update set cover_image_url = excluded.cover_image_url, updated_at = now()
  `;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const syncOnly = hasFlag("--sync-only");
  const allowLiveFetch = !hasFlag("--no-live-fetch");
  const sourceMode = getArgValue("--source", "all");
  const debugChoice = hasFlag("--debug-choice");
  const limit = Number.parseInt(getArgValue("--limit", "0"), 10) || 0;
  const concurrency = Math.max(1, Number.parseInt(getArgValue("--concurrency", "3"), 10) || 3);
  const timeoutMs = Math.max(4_000, Number.parseInt(getArgValue("--timeout-ms", "12000"), 10) || 12_000);
  const slugFilter = new Set(
    getArgValues("--slug")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const snapshot = structuredClone(churchesSnapshot);
  const snapshotBySlug = new Map(snapshot.map((church) => [church.slug, church]));

  const rows = await sql`
    select
      c.slug,
      c.name,
      c.location,
      c.website,
      c.header_image,
      e.website_url,
      e.cover_image_url,
      e.raw_website_markdown,
      e.raw_crawled_pages
    from churches c
    left join church_enrichments e on e.church_slug = c.slug
    where c.status = 'approved'
      and coalesce(nullif(trim(c.website), ''), nullif(trim(e.website_url), '')) is not null
    order by c.slug
  `;

  const syncJobs = [];
  const fetchJobs = [];

  for (const row of rows) {
    if (slugFilter.size > 0 && !slugFilter.has(row.slug)) {
      continue;
    }

    const snapshotChurch = snapshotBySlug.get(row.slug);
    const snapshotOwnedHero = typeof snapshotChurch?.headerImage === "string" && isOwnedMediaUrl(snapshotChurch.headerImage)
      ? snapshotChurch.headerImage
      : "";

    const dbOwnsHero = isOwnedMediaUrl(row.header_image || "") || isOwnedMediaUrl(row.cover_image_url || "");
    if (snapshotOwnedHero && !dbOwnsHero) {
      syncJobs.push({
        slug: row.slug,
        mediaUrl: snapshotOwnedHero,
        source: "snapshot_owned",
      });
      continue;
    }

    if (dbOwnsHero) {
      continue;
    }

    fetchJobs.push({
      ...row,
      snapshotChurch,
    });
  }

  const preparedFetchJobs = fetchJobs
    .map((row) => ({
      ...row,
      cachedChoice: chooseHeroSource(
        row,
        row.snapshotChurch,
        debugChoice && (slugFilter.size === 0 || slugFilter.has(row.slug)),
      ),
    }))
    .sort((left, right) => {
      const leftReady = left.cachedChoice?.sourceUrl ? 1 : 0;
      const rightReady = right.cachedChoice?.sourceUrl ? 1 : 0;
      return rightReady - leftReady || left.slug.localeCompare(right.slug);
    });
  const eligibleFetchJobs = sourceMode === "all"
    ? preparedFetchJobs
    : preparedFetchJobs.filter((row) => row.cachedChoice?.source === sourceMode);
  const selectedFetchJobs = limit > 0 ? eligibleFetchJobs.slice(0, limit) : eligibleFetchJobs;
  const readyExistingJobs = preparedFetchJobs.filter((row) => row.cachedChoice?.source === "existing").length;
  const readyCacheJobs = preparedFetchJobs.filter((row) => row.cachedChoice?.source === "cache").length;
  const cacheReadyJobs = readyExistingJobs + readyCacheJobs;

  console.log(JSON.stringify({
    approvedWithWebsite: rows.length,
    rowsConsidered: syncJobs.length + fetchJobs.length,
    syncJobs: syncJobs.length,
    fetchJobs: fetchJobs.length,
    cacheReadyJobs,
    readyExistingJobs,
    readyCacheJobs,
    sourceMode,
    selectedFetchJobs: selectedFetchJobs.length,
    dryRun,
    syncOnly,
    allowLiveFetch,
    concurrency,
    timeoutMs,
  }, null, 2));

  const syncResults = await mapWithConcurrency(syncJobs, Math.min(12, concurrency * 4), async (job) => {
    if (!dryRun) {
      await updateHeroInDatabase(job.slug, job.mediaUrl);
    }
    return { slug: job.slug, status: dryRun ? "dry-run" : "synced" };
  });

  if (syncOnly) {
    console.log(JSON.stringify({
      synced: syncResults.filter((row) => row.status === "synced").length,
      dryRun: syncResults.filter((row) => row.status === "dry-run").length,
    }, null, 2));
    return;
  }

  const failures = [];
  const skips = [];
  let persisted = 0;

  if (!dryRun && selectedFetchJobs.length > 0) {
    await hydrateCloudflareApiToken();
  }

  const fetchResults = await mapWithConcurrency(selectedFetchJobs, concurrency, async (row, index) => {
    const ordinal = index + 1;
    const label = `[${ordinal}/${selectedFetchJobs.length}] ${row.slug}`;

    const choice = row.cachedChoice?.sourceUrl
      ? row.cachedChoice
      : chooseHeroSource(
        row,
        row.snapshotChurch,
        debugChoice && (slugFilter.size === 0 || slugFilter.has(row.slug)),
      );
    const fallbackChoice = choice.sourceUrl
      ? choice
      : allowLiveFetch
        ? await fetchWebsiteHero(row, timeoutMs)
        : { sourceUrl: "", source: "", reason: "live_fetch_disabled" };

    if (!fallbackChoice.sourceUrl) {
      const skip = { slug: row.slug, reason: fallbackChoice.reason || "no_source" };
      skips.push(skip);
      console.log(`${label} skip -> ${skip.reason}`);
      return { slug: row.slug, status: "skipped" };
    }

    if (dryRun) {
      console.log(`${label} ${fallbackChoice.source} -> ${fallbackChoice.sourceUrl}`);
      return { slug: row.slug, status: "dry-run", source: fallbackChoice.source };
    }

    try {
      const downloaded = await downloadImage(fallbackChoice.sourceUrl, timeoutMs);
      const key = `heroes/${row.slug}.${downloaded.extension}`;
      const mediaUrl = mediaUrlForSlug(row.slug, downloaded.extension);
      await uploadToR2({
        key,
        buffer: downloaded.buffer,
        contentType: downloaded.contentType,
      });
      await updateHeroInDatabase(row.slug, mediaUrl);

      const snapshotChurch = snapshotBySlug.get(row.slug);
      if (snapshotChurch) {
        snapshotChurch.headerImage = mediaUrl;
      }

      persisted += 1;
      console.log(`${label} uploaded -> ${mediaUrl}`);
      return { slug: row.slug, status: "uploaded", source: fallbackChoice.source };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        slug: row.slug,
        sourceUrl: fallbackChoice.sourceUrl,
        source: fallbackChoice.source,
        error: message,
      });
      console.error(`${label} failed -> ${message}`);
      return { slug: row.slug, status: "failed" };
    }
  });

  if (!dryRun && persisted > 0) {
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  if (failures.length > 0) {
    await mkdir(resolve(ROOT_DIR, "tmp"), { recursive: true });
    await writeFile(FAILURE_LOG_PATH, `${JSON.stringify(failures, null, 2)}\n`);
  }

  if (skips.length > 0) {
    await mkdir(resolve(ROOT_DIR, "tmp"), { recursive: true });
    await writeFile(SKIP_LOG_PATH, `${JSON.stringify(skips, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    synced: syncResults.filter((row) => row.status === "synced").length,
    uploaded: fetchResults.filter((row) => row.status === "uploaded").length,
    skipped: fetchResults.filter((row) => row.status === "skipped").length,
    failed: fetchResults.filter((row) => row.status === "failed").length,
    dryRun: fetchResults.filter((row) => row.status === "dry-run").length,
    failureLogPath: failures.length > 0 ? FAILURE_LOG_PATH : null,
    skipLogPath: skips.length > 0 ? SKIP_LOG_PATH : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
