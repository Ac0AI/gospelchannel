#!/usr/bin/env node

/**
 * IndexNow — Ping Bing, Yandex, DuckDuckGo, Seznam, Naver about new/updated URLs.
 *
 * Usage:
 *   node scripts/indexnow.mjs                    # Submit all URLs from sitemap
 *   node scripts/indexnow.mjs --changed          # Submit only recently changed (last 24h)
 *   node scripts/indexnow.mjs --urls /church/foo /church/bar
 *   node scripts/indexnow.mjs --dry-run           # Show what would be submitted
 *
 * The API key file is served at /[key].txt automatically via public/ dir.
 * IndexNow accepts up to 10,000 URLs per batch.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SITE_URL = "https://gospelchannel.com";
const KEY_FILE = join(ROOT_DIR, "public", "indexnow-key.txt");
const BATCH_SIZE = 9000; // IndexNow max is 10,000

// ─── Ensure API key exists ───

function getOrCreateKey() {
  if (existsSync(KEY_FILE)) {
    return readFileSync(KEY_FILE, "utf8").trim();
  }
  const key = randomUUID().replace(/-/g, "");
  writeFileSync(KEY_FILE, key, "utf8");
  console.log(`Created IndexNow key: ${key}`);
  console.log(`Key file: public/indexnow-key.txt (must be deployed for verification)`);
  return key;
}

// ─── Parse sitemap for URLs ───

async function fetchSitemapUrls(changedOnly = false) {
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  console.log(`Fetching sitemap: ${sitemapUrl}`);

  const res = await fetch(sitemapUrl);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();

  const urls = [];
  const cutoff = changedOnly ? Date.now() - 24 * 60 * 60 * 1000 : 0;

  // Simple XML parsing — extract <url> entries
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (!loc) continue;

    if (changedOnly) {
      const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
      if (lastmod) {
        const modDate = new Date(lastmod).getTime();
        if (modDate < cutoff) continue;
      }
    }

    urls.push(loc);
  }

  return urls;
}

// ─── Submit to IndexNow ───

async function submitBatch(urls, key, engine) {
  const body = {
    host: "gospelchannel.com",
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList: urls,
  };

  const res = await fetch(`https://${engine}/indexnow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { engine, status: res.status, ok: res.ok };
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const changedOnly = args.includes("--changed");
  const urlsIdx = args.indexOf("--urls");

  const key = getOrCreateKey();

  // Also create the key verification file at /[key].txt
  const verificationFile = join(ROOT_DIR, "public", `${key}.txt`);
  if (!existsSync(verificationFile)) {
    writeFileSync(verificationFile, key, "utf8");
  }

  let urls;
  if (urlsIdx >= 0) {
    // Manual URLs
    urls = args.slice(urlsIdx + 1).filter((u) => !u.startsWith("--")).map((u) =>
      u.startsWith("http") ? u : `${SITE_URL}${u}`
    );
  } else {
    urls = await fetchSitemapUrls(changedOnly);
  }

  console.log(`URLs to submit: ${urls.length}${changedOnly ? " (changed last 24h)" : ""}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would submit:");
    for (const u of urls.slice(0, 20)) console.log(`  ${u}`);
    if (urls.length > 20) console.log(`  ... and ${urls.length - 20} more`);
    return;
  }

  if (urls.length === 0) {
    console.log("No URLs to submit.");
    return;
  }

  // Submit in batches to multiple engines
  const engines = ["api.indexnow.org", "www.bing.com", "yandex.com"];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} URLs`);

    const results = await Promise.all(
      engines.map((engine) => submitBatch(batch, key, engine))
    );

    for (const r of results) {
      const status = r.ok ? "OK" : `FAILED (${r.status})`;
      console.log(`  ${r.engine}: ${status}`);
    }
  }

  console.log(`\nDone! Submitted ${urls.length} URLs to ${engines.length} engines.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
