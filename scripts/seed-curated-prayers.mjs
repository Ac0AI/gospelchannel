#!/usr/bin/env node

import pkg from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://gospelchannel.com").replace(/\/+$/, "");
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const AUTHOR_NAME = "Prayer Team";
const WAIT_FOR_CACHE_MS = 70_000;

const CURATED_PRAYERS = [
  {
    churchSlug: "all-souls-langham-place",
    content:
      "Lord, bring real hope to people walking through central London this week. Let those who feel crowded yet unseen find truth, rest, and a clear sight of Jesus.",
  },
  {
    churchSlug: "all-souls-langham-place",
    content:
      "Father, strengthen students, workers, and families in this city who are carrying quiet anxiety. Give them wisdom, deep roots in Scripture, and genuine Christian friendship.",
  },
  {
    churchSlug: "american-church-in-berlin-e-v",
    content:
      "Lord, bless the internationals in Berlin who feel homesick and unsettled. Give them peace, steady friendships, and a church home where they can heal and grow.",
  },
  {
    churchSlug: "american-church-in-berlin-e-v",
    content:
      "Father, guide people navigating visas, job changes, language barriers, and new beginnings in this city. Meet them with practical provision and calm hearts.",
  },
  {
    churchSlug: "malaga-christian-church",
    content:
      "Senor, trae paz a las familias en Malaga que cargan preocupaciones en silencio. Dales descanso, direccion y una fe firme para cada nuevo dia.",
  },
  {
    churchSlug: "malaga-christian-church",
    content:
      "Lord, gather people in Malaga who feel far from home. Let this church be a place of welcome, steady faith, and fresh joy.",
  },
  {
    churchSlug: "alive-church-montreal",
    content:
      "Jesus, strengthen families in Montreal who are carrying hidden mental and financial strain. Give them courage for today and hope for what comes next.",
  },
  {
    churchSlug: "alive-church-montreal",
    content:
      "Seigneur, attire vers toi les personnes qui se sentent seules dans cette ville. Donne-leur une vraie communaute, une paix profonde et un coeur ouvert a ta presence.",
  },
  {
    churchSlug: "calvary-cork",
    content:
      "Lord, keep the young adults, students, and families in Cork close to you. Raise up a warm, grounded church life marked by prayer, honesty, and care for neighbors.",
  },
  {
    churchSlug: "calvary-cork",
    content:
      "Father, give endurance to people who are job-hunting, grieving, or quietly burned out. Meet them with open doors and deep peace.",
  },
  {
    churchSlug: "anchor-church-sydney",
    content:
      "Lord, protect families in Sydney facing pressure, exhaustion, and isolation. Slow us down enough to hear your voice and care for one another well.",
  },
  {
    churchSlug: "anchor-church-sydney",
    content:
      "Father, bless the people serving this church each week. Keep them joyful, humble, and full of courage as they love their city.",
  },
  {
    churchSlug: "planetshakers",
    content:
      "Jesus, bring steady faith to young people in Melbourne who are surrounded by noise, pressure, and confusion. Give them a hunger for truth and a real love for your presence.",
  },
  {
    churchSlug: "planetshakers",
    content:
      "Lord, heal people carrying anxiety, shame, and exhaustion behind a smiling face. Let them find prayer, honesty, and real freedom in your presence.",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomRecentTimestamp() {
  const now = Date.now();
  const windowMs = 72 * 60 * 60 * 1000;
  const offsetMs = Math.floor(Math.random() * windowMs);
  return new Date(now - offsetMs).toISOString();
}

async function warmUrls(urls) {
  let index = 0;
  const list = [...urls];
  const results = [];

  async function worker() {
    while (index < list.length) {
      const url = list[index++];
      const startedAt = performance.now();
      try {
        const response = await fetch(url, { redirect: "follow" });
        await response.arrayBuffer();
        results.push({
          url,
          status: response.status,
          ms: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        results.push({
          url,
          status: "ERR",
          ms: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  return results.sort((a, b) => b.ms - a.ms);
}

async function main() {
  const targetSlugs = [...new Set(CURATED_PRAYERS.map((entry) => entry.churchSlug))];
  const churchRows = await sql.query(
    `
      select slug, name
      from churches
      where status = 'approved'
        and slug = any($1::text[])
    `,
    [targetSlugs],
  );
  const knownSlugs = new Set(churchRows.map((row) => row.slug));
  const missing = targetSlugs.filter((slug) => !knownSlugs.has(slug));
  if (missing.length > 0) {
    console.error(`Missing churches for curated prayer seed: ${missing.join(", ")}`);
    process.exit(1);
  }

  const existingRows = await sql.query(
    `
      select church_slug, content
      from prayers
      where church_slug = any($1::text[])
        and author_name = $2
    `,
    [targetSlugs, AUTHOR_NAME],
  );
  const existingKeys = new Set(
    existingRows.map((row) => `${row.church_slug}::${row.content.trim()}`),
  );

  const rowsToInsert = CURATED_PRAYERS.filter((entry) => (
    !existingKeys.has(`${entry.churchSlug}::${entry.content.trim()}`)
  )).map((entry) => ({
    churchSlug: entry.churchSlug,
    content: entry.content.trim(),
    authorName: AUTHOR_NAME,
    createdAt: randomRecentTimestamp(),
  }));

  if (rowsToInsert.length === 0) {
    console.log("No new curated prayers to insert.");
    return;
  }

  const inserted = [];
  for (const row of rowsToInsert) {
    const result = await sql.query(
      `
        insert into prayers (church_slug, content, original_content, author_name, prayed_count, moderated, created_at)
        values ($1, $2, null, $3, 0, false, $4::timestamptz)
        returning id, church_slug, content
      `,
      [row.churchSlug, row.content, row.authorName, row.createdAt],
    );
    inserted.push(...result);
  }

  const perChurch = inserted.reduce((acc, row) => {
    acc[row.church_slug] = (acc[row.church_slug] || 0) + 1;
    return acc;
  }, {});

  console.log(`Inserted ${inserted.length} curated prayers.`);
  for (const [slug, count] of Object.entries(perChurch)) {
    console.log(`- ${slug}: ${count}`);
  }

  console.log(`Waiting ${Math.round(WAIT_FOR_CACHE_MS / 1000)}s for prayer caches to expire...`);
  await sleep(WAIT_FOR_CACHE_MS);

  const warmTargets = new Set([
    `${SITE_URL}/`,
    `${SITE_URL}/prayerwall`,
  ]);

  for (const slug of targetSlugs) {
    warmTargets.add(`${SITE_URL}/church/${slug}`);
    warmTargets.add(`${SITE_URL}/prayerwall/church/${slug}`);
    warmTargets.add(`${SITE_URL}/api/prayer?church=${encodeURIComponent(slug)}&limit=5`);
  }

  const warmResults = await warmUrls(warmTargets);
  console.log("Warmup complete. Slowest targets:");
  for (const result of warmResults.slice(0, 8)) {
    console.log(`- ${result.status} ${result.ms}ms ${result.url}${result.error ? ` (${result.error})` : ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
