#!/usr/bin/env node

/**
 * Offline hero image backfill — works without database access.
 * Reads external headerImage URLs from the local churches.json snapshot,
 * downloads, optimizes to WebP, uploads to R2, and updates the snapshot.
 * DB updates are deferred — run --sync-db later when quota is available.
 */

import churchesSnapshot from "../src/data/churches.json" with { type: "json" };
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const SNAPSHOT_PATH = resolve(ROOT_DIR, "src/data/churches.json");
const FAILURE_LOG_PATH = resolve(ROOT_DIR, "tmp/hero-offline-failures.json");

const MEDIA_BASE_URL = "https://media.gospelchannel.com";
const MEDIA_HOST = "media.gospelchannel.com";

const BLOCKED_HOST_PATTERNS = [
  "instagram.com", "cdninstagram.com", "facebook.com", "fbcdn.net",
  "linkedin.com", "licdn.com", "paypal.com", "archive.org",
  "wikipedia.org", "wikimedia.org", "yelp.", "tripadvisor.",
];

const MIN_WIDTH = 480;
const MIN_HEIGHT = 240;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1200;
const WEBP_QUALITY = 76;

function isOwnedUrl(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase() === MEDIA_HOST; }
  catch { return false; }
}

function isBlockedUrl(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return BLOCKED_HOST_PATTERNS.some((p) => host.includes(p));
  } catch { return true; }
}

function hasFlag(flag) { return process.argv.includes(flag); }

function getArgValue(flag, fallback = "") {
  const direct = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1);
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? (process.argv[idx + 1] || fallback) : fallback;
}

async function downloadAndOptimize(sourceUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`http_${res.status}`);

    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) throw new Error(`not_image_${ct}`);
    if (/svg/i.test(ct)) throw new Error("svg");

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) throw new Error(`too_small_${buf.length}b`);

    const img = sharp(buf, { failOn: "none", animated: false }).rotate();
    const meta = await img.metadata();
    if ((meta.width || 0) < MIN_WIDTH || (meta.height || 0) < MIN_HEIGHT) {
      throw new Error(`tiny_${meta.width}x${meta.height}`);
    }

    const webp = await img
      .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    if (webp.length < 4000) throw new Error(`optimized_too_small_${webp.length}`);
    return webp;
  } finally {
    clearTimeout(timer);
  }
}

async function uploadToR2(key, buffer) {
  const tmp = resolve(tmpdir(), `hero-${randomUUID()}`);
  await writeFile(tmp, buffer);

  try {
    await new Promise((ok, fail) => {
      const child = spawn("npx", [
        "wrangler", "r2", "object", "put",
        `church-assets/${key}`, "--remote", "--file", tmp,
        "--content-type", "image/webp",
      ], { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "pipe"], env: process.env });

      let stderr = "";
      child.stderr.on("data", (c) => { stderr += c; });
      child.on("error", fail);
      child.on("close", (code) => code === 0 ? ok() : fail(new Error(stderr || `exit ${code}`)));
    });
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function hydrateToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return;
  const paths = [
    resolve(homedir(), ".wrangler/config/default.toml"),
    resolve(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
  ];
  for (const p of paths) {
    try {
      const { readFile: rf } = await import("node:fs/promises");
      const content = await rf(p, "utf8");
      const token = content.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
      if (token) { process.env.CLOUDFLARE_API_TOKEN = token; return; }
    } catch {}
  }
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = Number(getArgValue("--limit", "0")) || 0;
  const concurrency = Math.max(1, Number(getArgValue("--concurrency", "3")) || 3);
  const timeoutMs = Math.max(4000, Number(getArgValue("--timeout-ms", "12000")) || 12000);

  const snapshot = structuredClone(churchesSnapshot);

  // Find churches with external (non-owned, non-blocked) header images
  const candidates = snapshot.filter((c) =>
    c.headerImage &&
    !isOwnedUrl(c.headerImage) &&
    !isBlockedUrl(c.headerImage) &&
    /^https?:\/\//i.test(c.headerImage)
  );

  const selected = limit > 0 ? candidates.slice(0, limit) : candidates;

  console.log(`Found ${candidates.length} churches with external hero images`);
  console.log(`Processing ${selected.length} (concurrency: ${concurrency}, dry-run: ${dryRun})`);

  if (!dryRun && selected.length > 0) await hydrateToken();

  const failures = [];
  let uploaded = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < selected.length) {
      const idx = cursor++;
      const church = selected[idx];
      const label = `[${idx + 1}/${selected.length}] ${church.slug}`;

      if (dryRun) {
        console.log(`${label} -> ${church.headerImage.substring(0, 80)}`);
        continue;
      }

      try {
        const webp = await downloadAndOptimize(church.headerImage, timeoutMs);
        const key = `heroes/${church.slug}.webp`;
        await uploadToR2(key, webp);

        const mediaUrl = `${MEDIA_BASE_URL}/heroes/${church.slug}.webp`;
        church.headerImage = mediaUrl;
        uploaded++;
        console.log(`${label} -> ${mediaUrl}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ slug: church.slug, source: church.headerImage, error: msg });
        console.error(`${label} FAIL: ${msg}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, () => worker()));

  if (!dryRun && uploaded > 0) {
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Updated snapshot with ${uploaded} owned URLs`);
  }

  if (failures.length > 0) {
    await mkdir(resolve(ROOT_DIR, "tmp"), { recursive: true });
    await writeFile(FAILURE_LOG_PATH, `${JSON.stringify(failures, null, 2)}\n`);
  }

  console.log(JSON.stringify({ total: selected.length, uploaded, failed: failures.length, dryRun }, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
