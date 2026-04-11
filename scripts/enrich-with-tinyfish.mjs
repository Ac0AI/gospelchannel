#!/usr/bin/env node

/**
 * Enrich churches using TinyFish AI browser agent.
 * Good for Wix/SPA sites that regular HTML fetch can't render.
 *
 * Usage:
 *   node scripts/enrich-with-tinyfish.mjs                     # all Wix-flagged
 *   node scripts/enrich-with-tinyfish.mjs --slug=some-slug    # single church
 *   node scripts/enrich-with-tinyfish.mjs --dry-run            # preview
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const SINGLE_SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

if (!TINYFISH_API_KEY) {
  console.error("Missing TINYFISH_API_KEY in .env.local");
  process.exit(1);
}

const GOAL = `Extract the following about this church website:
1) Church name (as displayed on the site)
2) City and country
3) Denomination or church type (e.g. Evangelical, Pentecostal, Charismatic, Baptist, Non-denominational)
4) A 1-2 sentence description of the church (max 200 characters)
5) Contact email if visible
6) Service times if visible
7) URL of the main hero/banner image on the page (full URL, not a logo)
8) Primary language of the site

Return as JSON with keys: name, city, country, denomination, description, email, serviceTimes, heroImageUrl, language`;

async function runTinyFish(url) {
  const res = await fetch("https://agent.tinyfish.ai/v1/automation/run-sse", {
    method: "POST",
    headers: {
      "X-API-Key": TINYFISH_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, goal: GOAL }),
  });

  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));

  for (const line of lines) {
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === "COMPLETE" && event.result?.result) {
        const json = event.result.result
          .replace(/```json\n?/g, "")
          .replace(/```/g, "")
          .trim();
        return JSON.parse(json);
      }
      if (event.type === "COMPLETE" && event.status === "FAILED") {
        return null;
      }
    } catch {}
  }
  return null;
}

async function downloadAndUploadHero(imageUrl, slug) {
  try {
    const res = await fetch(imageUrl, { redirect: "follow" });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return null; // too small

    // Upload to R2 via the media endpoint
    const ext = contentType.includes("png") ? "png" : "jpg";
    const r2Key = `heroes/${slug}.${ext}`;
    const uploadUrl = `https://media.gospelchannel.com/${r2Key}`;

    // We can't upload to R2 directly from script without binding,
    // so we'll just return the source URL for now
    return imageUrl;
  } catch {
    return null;
  }
}

async function main() {
  let churches;

  if (SINGLE_SLUG) {
    churches = await sql`
      SELECT slug, name, website, description, email, header_image
      FROM churches WHERE slug = ${SINGLE_SLUG}
    `;
  } else {
    // Find churches flagged as Wix/SPA that need enrichment
    churches = await sql`
      SELECT slug, name, website, description, email, header_image
      FROM churches
      WHERE status = 'approved'
      AND website IS NOT NULL
      AND reason LIKE '%Wix%'
      AND (description IS NULL OR description = '' OR header_image IS NULL OR header_image = '')
      ORDER BY name
    `;
  }

  console.log(`\nEnriching ${churches.length} churches with TinyFish\n`);
  if (DRY_RUN) console.log("  (dry run)\n");

  let enriched = 0;

  for (const church of churches) {
    console.log(`--- ${church.name} (${church.website}) ---`);

    if (!church.website) {
      console.log("  skip: no website");
      continue;
    }

    if (DRY_RUN) {
      console.log("  would enrich");
      enriched++;
      continue;
    }

    const data = await runTinyFish(church.website);
    if (!data) {
      console.log("  failed: TinyFish returned no data");
      continue;
    }

    console.log(`  name: ${data.name}`);
    console.log(`  city: ${data.city}, ${data.country}`);
    console.log(`  denom: ${data.denomination}`);
    console.log(`  desc: ${(data.description || "").slice(0, 80)}...`);
    console.log(`  email: ${data.email || "none"}`);
    console.log(`  times: ${data.serviceTimes || "none"}`);
    console.log(`  hero: ${data.heroImageUrl || "none"}`);

    // Build update
    const updates = {};
    if (data.description && (!church.description || church.description === "")) {
      updates.description = data.description.slice(0, 500);
    }
    if (data.email && !church.email) {
      updates.email = data.email;
    }
    if (data.city) {
      updates.location = data.city;
    }
    if (data.denomination) {
      updates.denomination = data.denomination;
    }
    if (data.heroImageUrl && !church.header_image) {
      updates.header_image = data.heroImageUrl;
    }

    if (Object.keys(updates).length === 0) {
      console.log("  no updates needed");
      continue;
    }

    // Dynamic SQL update
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    setClauses.push(`updated_at = now()`);
    values.push(church.slug);

    await sql.query(
      `UPDATE churches SET ${setClauses.join(", ")} WHERE slug = $${i}`,
      values
    );

    console.log(`  updated: ${Object.keys(updates).join(", ")}`);
    enriched++;
  }

  console.log(`\nDone! Enriched: ${enriched}/${churches.length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
