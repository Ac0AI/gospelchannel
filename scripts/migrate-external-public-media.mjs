#!/usr/bin/env node

import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { findLikelyHeroImage } from "./lib/church-quality.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT_DIR, "tmp/external-public-media-report.json");
const PUBLIC_DIR = resolve(ROOT_DIR, "public");

loadLocalEnv(ROOT_DIR);

const MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
const MEDIA_HOST = new URL(MEDIA_BASE_URL).hostname.replace(/^www\./, "").toLowerCase();
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
const FETCH_TIMEOUT_MS = 20_000;
const CONCURRENCY = getIntArg("--concurrency", 6);
const LIMIT = getIntArg("--limit", 0);
const DRY_RUN = hasFlag("--dry-run");
const KEEP_FAILURES = hasFlag("--keep-failures");
const UPLOAD_RETRIES = 3;

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
}

if (!existsSync(resolve(ROOT_DIR, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler"))) {
  throw new Error("Missing local Wrangler install");
}

const sql = neon(DATABASE_URL);

const REJECTED_LOGO_PATTERNS = /swish|vipps|paypal|stripe|klarna|bankid|qr|venmo|cashapp|pixel|spacer|spinner|loading|placeholder|default|wix\.com|squarespace\.com|wordpress\.org\/logo|w3\.org|cloudflare|google-analytics|facebook\.com|twitter\.com/i;

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getIntArg(flag, fallback) {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) return Math.max(0, Number.parseInt(direct.slice(flag.length + 1), 10) || fallback);
  const index = process.argv.indexOf(flag);
  if (index >= 0) return Math.max(0, Number.parseInt(process.argv[index + 1] || "", 10) || fallback);
  return fallback;
}

function normalizeUrl(value = "", baseUrl = "") {
  const normalizedValue = String(value || "").replaceAll("&amp;", "&").trim();
  try {
    return baseUrl ? new URL(normalizedValue, baseUrl).toString() : new URL(normalizedValue).toString();
  } catch {
    return "";
  }
}

function isExternalPublicUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const parsed = new URL(normalized);
  return /^https?:$/i.test(parsed.protocol) && parsed.hostname.replace(/^www\./, "").toLowerCase() !== MEDIA_HOST;
}

function resolvePublicAssetPath(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) return "";
  const relativePath = normalized.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  if (!relativePath) return "";
  const resolvedPath = resolve(PUBLIC_DIR, relativePath);
  if (resolvedPath !== PUBLIC_DIR && !resolvedPath.startsWith(`${PUBLIC_DIR}/`)) return "";
  return resolvedPath;
}

function isMissingLocalPublicAsset(value) {
  const assetPath = resolvePublicAssetPath(value);
  return Boolean(assetPath) && !existsSync(assetPath);
}

function needsOwnedMediaMigration(value) {
  return isExternalPublicUrl(value) || isMissingLocalPublicAsset(value);
}

function extensionFromContentType(contentType = "", fallbackUrl = "") {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("image/jpeg")) return "jpg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/avif")) return "avif";
  if (normalized.includes("image/gif")) return "gif";
  if (normalized.includes("image/svg")) return "svg";

  const url = normalizeUrl(fallbackUrl);
  const match = url.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/i);
  return match?.[1]?.toLowerCase() || "jpg";
}

function buildPublicMediaUrl(path) {
  return `${MEDIA_BASE_URL}/${path.replace(/^\//, "")}`;
}

function createTempPath(extension) {
  return resolve(tmpdir(), `gospel-media-${randomUUID()}.${extension}`);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function isUsableHeroMetadata(metadata, contentType) {
  if ((contentType || "").toLowerCase().includes("image/svg")) return false;
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  return width >= 320 && height >= 160;
}

function isUsableLogoMetadata(metadata, bufferLength) {
  if ((metadata.width || 0) > 0 && (metadata.height || 0) > 0) {
    return metadata.width >= 32 && metadata.height >= 32;
  }
  return bufferLength >= 1000;
}

async function inspectBuffer(buffer) {
  try {
    return await sharp(buffer, { animated: false }).metadata();
  } catch {
    return {};
  }
}

async function downloadImage(url, kind) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return { ok: false, reason: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(normalized, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return { ok: false, reason: `not_image_${contentType || "unknown"}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 512) {
      return { ok: false, reason: `too_small_${buffer.length}` };
    }

    const metadata = await inspectBuffer(buffer);
    const valid = kind === "logo"
      ? isUsableLogoMetadata(metadata, buffer.length)
      : isUsableHeroMetadata(metadata, contentType);

    if (!valid) {
      return { ok: false, reason: "bad_dimensions" };
    }

    return {
      ok: true,
      buffer,
      contentType,
      extension: extensionFromContentType(contentType, normalized),
      sourceUrl: normalized,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

const websiteHtmlCache = new Map();

async function fetchWebsiteHtml(websiteUrl) {
  if (!websiteUrl) return "";
  if (websiteHtmlCache.has(websiteUrl)) {
    return websiteHtmlCache.get(websiteUrl);
  }

  const request = (async () => {
    const normalized = normalizeUrl(websiteUrl);
    if (!normalized) return "";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(normalized, {
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
  })();

  websiteHtmlCache.set(websiteUrl, request);
  return request;
}

function resolveUrl(href, baseUrl) {
  return normalizeUrl(href, baseUrl);
}

function extractLogoCandidates(html, baseUrl) {
  const candidates = [];

  const appleTouch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
  if (appleTouch?.[1]) {
    const url = resolveUrl(appleTouch[1], baseUrl);
    if (url) candidates.push({ url, priority: 10 });
  }

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImage?.[1]) {
    const url = resolveUrl(ogImage[1], baseUrl);
    if (url) candidates.push({ url, priority: 6 });
  }

  const logoImgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  for (const match of logoImgs) {
    const tag = match[0].toLowerCase();
    const src = (match[1] || "").toLowerCase();
    if (!(tag.includes("logo") || tag.includes("brand") || src.includes("logo") || src.includes("brand"))) {
      continue;
    }
    if (REJECTED_LOGO_PATTERNS.test(src)) continue;
    const url = resolveUrl(match[1], baseUrl);
    if (url) candidates.push({ url, priority: 8 });
  }

  const iconLinks = [...html.matchAll(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["'][^>]*>/gi)];
  for (const match of iconLinks) {
    const sizeMatch = match[0].match(/sizes=["'](\d+)x(\d+)["']/i);
    const size = sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0;
    if (size > 0 && size < 64) continue;
    const url = resolveUrl(match[1], baseUrl);
    if (url) candidates.push({ url, priority: size >= 128 ? 7 : 4 });
  }

  const deduped = new Map();
  for (const candidate of candidates.sort((left, right) => right.priority - left.priority)) {
    if (REJECTED_LOGO_PATTERNS.test(candidate.url)) continue;
    if (!deduped.has(candidate.url)) deduped.set(candidate.url, candidate);
  }

  return [...deduped.values()].slice(0, 8);
}

async function discoverFallbackImages(item) {
  if (!item.website) {
    return [];
  }

  const html = await fetchWebsiteHtml(item.website);
  if (!html) {
    return [];
  }

  if (item.kind === "hero") {
    const candidate = normalizeUrl(findLikelyHeroImage(html, item.website), item.website);
    return candidate ? [candidate] : [];
  }

  return extractLogoCandidates(html, item.website)
    .map((candidate) => candidate.url)
    .filter(Boolean);
}

async function uploadToR2(path, buffer, contentType) {
  const tempPath = createTempPath(extensionFromContentType(contentType));
  await writeFile(tempPath, buffer);

  try {
    for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt += 1) {
      try {
        await new Promise((resolvePromise, rejectPromise) => {
          const child = spawn(NPX_BIN, [
            "wrangler",
            "r2",
            "object",
            "put",
            `church-assets/${path}`,
            "--remote",
            "--file",
            tempPath,
            "--content-type",
            contentType,
          ], {
            cwd: ROOT_DIR,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
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
              resolvePromise(stdout);
              return;
            }
            rejectPromise(new Error(stderr || stdout || `wrangler exited with code ${code}`));
          });
        });

        return;
      } catch (error) {
        if (attempt >= UPLOAD_RETRIES) {
          throw error;
        }
        await sleep(1000 * attempt);
      }
    }
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

async function updateField(table, field, slug, value) {
  if (table === "churches" && field === "header_image") {
    await sql`update churches set header_image = ${value} where slug = ${slug}`;
    return;
  }
  if (table === "churches" && field === "logo") {
    await sql`update churches set logo = ${value} where slug = ${slug}`;
    return;
  }
  if (table === "church_enrichments" && field === "cover_image_url") {
    await sql`update church_enrichments set cover_image_url = ${value} where church_slug = ${slug}`;
    return;
  }
  if (table === "church_enrichments" && field === "logo_image_url") {
    await sql`update church_enrichments set logo_image_url = ${value} where church_slug = ${slug}`;
    return;
  }
  throw new Error(`Unsupported update target: ${table}.${field}`);
}

async function fetchApprovedChurches() {
  return sql`
    select slug, website, header_image, logo
    from churches
    where status = 'approved'
    order by slug
  `;
}

async function fetchApprovedEnrichments() {
  return sql`
    select e.church_slug as slug, c.website, e.cover_image_url, e.logo_image_url
    from church_enrichments e
    join churches c on c.slug = e.church_slug
    where c.status = 'approved'
    order by e.church_slug
  `;
}

function buildWorkItems(churchRows, enrichmentRows) {
  const items = [];

  for (const row of churchRows) {
    if (needsOwnedMediaMigration(row.header_image)) {
      items.push({
        table: "churches",
        field: "header_image",
        slug: row.slug,
        website: row.website || "",
        url: row.header_image,
        kind: "hero",
        targetPrefix: "heroes",
      });
    }

    if (needsOwnedMediaMigration(row.logo)) {
      items.push({
        table: "churches",
        field: "logo",
        slug: row.slug,
        website: row.website || "",
        url: row.logo,
        kind: "logo",
        targetPrefix: "logos/churches",
      });
    }
  }

  for (const row of enrichmentRows) {
    if (needsOwnedMediaMigration(row.cover_image_url)) {
      items.push({
        table: "church_enrichments",
        field: "cover_image_url",
        slug: row.slug,
        website: row.website || "",
        url: row.cover_image_url,
        kind: "hero",
        targetPrefix: "covers",
      });
    }

    if (needsOwnedMediaMigration(row.logo_image_url)) {
      items.push({
        table: "church_enrichments",
        field: "logo_image_url",
        slug: row.slug,
        website: row.website || "",
        url: row.logo_image_url,
        kind: "logo",
        targetPrefix: "logos/enrichments",
      });
    }
  }

  return LIMIT > 0 ? items.slice(0, LIMIT) : items;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function processItem(item, index, total) {
  const label = `[${index + 1}/${total}] ${item.table}.${item.field}:${item.slug}`;
  const triedUrls = [];
  let image = null;
  for (const candidateUrl of [item.url].filter(Boolean)) {
    if (triedUrls.includes(candidateUrl)) continue;
    triedUrls.push(candidateUrl);
    const downloaded = await downloadImage(candidateUrl, item.kind);
    if (downloaded.ok) {
      image = downloaded;
      break;
    }
  }

  if (!image) {
    const fallbackUrls = await discoverFallbackImages(item);
    for (const candidateUrl of fallbackUrls) {
      if (triedUrls.includes(candidateUrl)) continue;
      triedUrls.push(candidateUrl);
      const downloaded = await downloadImage(candidateUrl, item.kind);
      if (downloaded.ok) {
        image = downloaded;
        break;
      }
    }
  }

  if (!image) {
    if (!KEEP_FAILURES && !DRY_RUN) {
      await updateField(item.table, item.field, item.slug, null);
    }
    console.log(`${label} ${KEEP_FAILURES ? "failed" : "cleared"} (${triedUrls.join(" | ") || "no-source"})`);
    return {
      ...item,
      status: KEEP_FAILURES ? "failed" : "cleared",
      triedUrls,
    };
  }

  const key = `${item.targetPrefix}/${item.slug}.${image.extension}`;
  const mediaUrl = buildPublicMediaUrl(key);

  if (!DRY_RUN) {
    await uploadToR2(key, image.buffer, image.contentType);
    await updateField(item.table, item.field, item.slug, mediaUrl);
  }

  console.log(`${label} migrated -> ${mediaUrl}`);
  return {
    ...item,
    status: "migrated",
    sourceUrl: image.sourceUrl,
    mediaUrl,
  };
}

async function main() {
  const churches = await fetchApprovedChurches();
  const enrichments = await fetchApprovedEnrichments();
  const workItems = buildWorkItems(churches, enrichments);

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    keepFailures: KEEP_FAILURES,
    concurrency: CONCURRENCY,
    limit: LIMIT,
    approvedChurches: churches.length,
    approvedEnrichments: enrichments.length,
    workItems: workItems.length,
  }, null, 2));

  if (workItems.length === 0) {
    return;
  }

  const results = await mapWithConcurrency(workItems, CONCURRENCY, (item, index) =>
    processItem(item, index, workItems.length),
  );

  const summary = results.reduce((accumulator, result) => {
    const key = result.status || "unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  await mkdir(resolve(ROOT_DIR, "tmp"), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2)}\n`);
  console.log(`Wrote report to ${REPORT_PATH}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
