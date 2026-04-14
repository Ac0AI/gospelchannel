#!/usr/bin/env node

/**
 * Resolve youtube_url → youtube_channel_id for churches that have one but
 * not the other. Writes back to churches.youtube_channel_id.
 *
 * Strategy per slug:
 *   1. If url is /channel/UC... → verify via channels.list?id=
 *   2. Else fetch the page and grep "channelId":"UC..."
 *   3. Else if url has @handle → channels.list?forHandle=
 *   4. Else if url has /user/X → channels.list?forUsername=
 *
 * Each successful resolve costs 1-2 quota units. A skipped resolve costs 0.
 *
 * Usage:
 *   node scripts/resolve-youtube-channel-ids.mjs --dry-run --limit=10
 *   node scripts/resolve-youtube-channel-ids.mjs --limit=2000
 *   node scripts/resolve-youtube-channel-ids.mjs            # all needing resolve
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DEFAULT_LIMIT = 0;
const THROTTLE_MS = 150;

function parseArgs(argv) {
  const o = { dryRun: false, limit: DEFAULT_LIMIT };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
  }
  return o;
}

async function fetchHtml(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function extractDirectChannelId(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    if (!/youtube\.com$/i.test(parsed.hostname) && !/\.youtube\.com$/i.test(parsed.hostname)) return "";
    const m = parsed.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{20,})/i);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

async function verifyChannelId(candidate, apiKey) {
  if (!candidate) return "";
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&id=${encodeURIComponent(candidate)}&key=${apiKey}`,
    );
    if (!res.ok) return "";
    const json = await res.json();
    return json.items?.[0]?.id || "";
  } catch {
    return "";
  }
}

async function resolveByHandle(handle, apiKey) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
    );
    if (!res.ok) return "";
    const json = await res.json();
    return json.items?.[0]?.id || "";
  } catch {
    return "";
  }
}

async function resolveByUsername(username, apiKey) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(username)}&key=${apiKey}`,
    );
    if (!res.ok) return "";
    const json = await res.json();
    return json.items?.[0]?.id || "";
  } catch {
    return "";
  }
}

async function resolveYouTubeChannelId(url, apiKey) {
  if (!url) return "";

  // Path 1: direct /channel/UC...
  const direct = extractDirectChannelId(url);
  if (direct) {
    const verified = await verifyChannelId(direct, apiKey);
    if (verified) return verified;
  }

  // Path 2: page scrape for channelId
  const html = await fetchHtml(url);
  if (html) {
    const patterns = [
      /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
      /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{20,})["']/i,
      /https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/i,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) {
        const verified = await verifyChannelId(m[1], apiKey);
        if (verified) return verified;
      }
    }
  }

  // Path 3: @handle or /user/name
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("@")) {
      const channelId = await resolveByHandle(parts[0].slice(1), apiKey);
      if (channelId) return channelId;
    }
    if (parts[0] === "user" && parts[1]) {
      const channelId = await resolveByUsername(parts[1], apiKey);
      if (channelId) return channelId;
    }
    if (parts[0] === "c" && parts[1]) {
      // Custom URL — page scrape is the only path; we already tried html
    }
  } catch {
    // fallthrough
  }
  return "";
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  if (!process.env.YOUTUBE_API_KEY) throw new Error("Missing YOUTUBE_API_KEY");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
  const apiKey = process.env.YOUTUBE_API_KEY;

  console.log("Loading churches with youtube_url but no youtube_channel_id...");
  const targets = options.limit > 0
    ? await sql`
        SELECT c.slug, e.youtube_url
        FROM churches c
        JOIN church_enrichments e ON e.church_slug = c.slug
        WHERE c.status = 'approved'
          AND c.youtube_channel_id IS NULL
          AND e.youtube_url IS NOT NULL AND e.youtube_url != ''
        ORDER BY c.slug
        LIMIT ${options.limit}
      `
    : await sql`
        SELECT c.slug, e.youtube_url
        FROM churches c
        JOIN church_enrichments e ON e.church_slug = c.slug
        WHERE c.status = 'approved'
          AND c.youtube_channel_id IS NULL
          AND e.youtube_url IS NOT NULL AND e.youtube_url != ''
        ORDER BY c.slug
      `;
  console.log(`Targets: ${targets.length}`);
  if (targets.length === 0) return;

  const summary = { total: targets.length, resolved: 0, noMatch: 0, errors: 0 };

  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    try {
      const channelId = await resolveYouTubeChannelId(t.youtube_url, apiKey);
      if (channelId) {
        if (!options.dryRun) {
          await sql`UPDATE churches SET youtube_channel_id = ${channelId}, updated_at = NOW() WHERE slug = ${t.slug} AND youtube_channel_id IS NULL`;
        }
        summary.resolved += 1;
        if (summary.resolved <= 5 || summary.resolved % 100 === 0) {
          console.log(`  ${summary.resolved}: ${t.slug} → ${channelId}`);
        }
      } else {
        summary.noMatch += 1;
      }
    } catch (error) {
      summary.errors += 1;
      if (summary.errors < 5) console.log(`  error on ${t.slug}: ${error.message}`);
    }
    if (i + 1 < targets.length) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  if (options.dryRun) console.log("DRY RUN — no DB writes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
