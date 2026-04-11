#!/usr/bin/env node

/**
 * Enrich directory-import churches using TinyFish for unique websites.
 * Shares results across churches that point to the same domain.
 *
 * Usage:
 *   node scripts/enrich-directory-import.mjs
 *   node scripts/enrich-directory-import.mjs --limit=20
 *   node scripts/enrich-directory-import.mjs --dry-run
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
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 0);

if (!TINYFISH_API_KEY) {
  console.error("Missing TINYFISH_API_KEY");
  process.exit(1);
}

const GOAL = `Extract from this church website:
1) A 1-2 sentence description of the church (max 200 chars)
2) Contact email if visible
3) Service times if visible
4) URL of the main hero/banner image (full URL, not a logo, must be a real image URL ending in .jpg/.png/.webp or similar)

Return JSON: {"description": "...", "email": "...", "serviceTimes": "...", "heroImageUrl": "..."}
Use null for fields not found.`;

async function runTinyFish(url) {
  try {
    const res = await fetch("https://agent.tinyfish.ai/v1/automation/run-sse", {
      method: "POST",
      headers: { "X-API-Key": TINYFISH_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ url, goal: GOAL }),
    });
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "COMPLETE" && event.result?.result) {
          return JSON.parse(event.result.result.replace(/```json\n?/g, "").replace(/```/g, "").trim());
        }
      } catch {}
    }
  } catch (err) {
    console.error("  TinyFish error:", err.message);
  }
  return null;
}

function domainKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

async function main() {
  const churches = await sql`
    SELECT slug, name, website, description, email, header_image
    FROM churches
    WHERE status = 'approved' AND discovery_source = 'directory-import'
    AND website IS NOT NULL AND website != ''
    AND (description IS NULL OR description = '')
    ORDER BY website, name
  `;

  // Group by domain
  const byDomain = new Map();
  for (const c of churches) {
    const domain = domainKey(c.website);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(c);
  }

  const domains = [...byDomain.keys()];
  const total = LIMIT > 0 ? Math.min(LIMIT, domains.length) : domains.length;

  console.log(`\n${churches.length} churches across ${domains.length} unique domains`);
  console.log(`Processing ${total} domains with TinyFish\n`);
  if (DRY_RUN) console.log("  (dry run)\n");

  let enriched = 0;
  let credits = 0;

  for (let i = 0; i < total; i++) {
    const domain = domains[i];
    const group = byDomain.get(domain);
    const sample = group[0];

    console.log(`[${i + 1}/${total}] ${domain} (${group.length} churches)`);

    if (DRY_RUN) { enriched += group.length; credits++; continue; }

    const data = await runTinyFish(sample.website);
    credits++;

    if (!data || (!data.description && !data.heroImageUrl)) {
      console.log("  no useful data");
      continue;
    }

    console.log("  desc: " + (data.description || "none").slice(0, 60) + "...");
    console.log("  hero: " + (data.heroImageUrl || "none"));

    // Apply to all churches in this group
    for (const church of group) {
      const updates = {};
      if (data.description && (!church.description || church.description === "")) {
        updates.description = data.description.slice(0, 500);
      }
      if (data.email && data.email !== "null" && !church.email) {
        updates.email = data.email;
      }
      if (data.heroImageUrl && data.heroImageUrl !== "null" && !church.header_image) {
        updates.header_image = data.heroImageUrl;
      }

      if (Object.keys(updates).length === 0) continue;

      const setClauses = [];
      const values = [];
      let j = 1;
      for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`${key} = $${j}`);
        values.push(value);
        j++;
      }
      setClauses.push("updated_at = now()");
      values.push(church.slug);

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await sql.query(`UPDATE churches SET ${setClauses.join(", ")} WHERE slug = $${j}`, values);
          break;
        } catch (err) {
          if (attempt < 2) { await new Promise((r) => setTimeout(r, 3000)); continue; }
          console.error("  DB error for " + church.slug + ": " + err.message);
        }
      }
      enriched++;
    }

    console.log(`  applied to ${group.length} churches`);

    // Brief pause between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\nDone! Enriched: ${enriched} churches using ${credits} TinyFish credits`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
