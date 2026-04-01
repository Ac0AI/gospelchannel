#!/usr/bin/env node

/**
 * Normalize denomination data across the entire database.
 * 1. Normalize churches.denomination to canonical values
 * 2. Fill in missing denominations from denomination_network
 * 3. Consolidate denomination_network duplicates
 *
 * Usage:
 *   node scripts/normalize-denominations.mjs --dry-run
 *   node scripts/normalize-denominations.mjs
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Taxonomy (mirrors src/lib/denomination-taxonomy.ts) ───

const DENOMINATIONS = [
  {
    canonical: "Pentecostal",
    match: ["pentecostal", "pingst", "pingstförsamling", "pingstkyrka", "assemblies of god", "asambleas de dios", "assembleia de deus", "assemblées de dieu", "elim", "foursquare", "apostolic", "church of god", "redeemed christian"],
    networks: ["Assemblies of God", "Pingst", "Pingstkyrkan", "Pingstförsamlingen", "Elim", "The Foursquare Church", "Foursquare Church", "Church of God", "Redeemed Christian Church of God", "Church of Pentecost"],
  },
  {
    canonical: "Charismatic",
    match: ["charismatic", "spirit-filled", "full gospel"],
    networks: ["Every Nation", "Hillsong Church", "Hillsong Network", "C3 Church Global", "C3 Church", "C3 Church Movement", "C3 Church Network", "Planetshakers", "Bethel", "Newfrontiers", "ICF Movement", "ICF Church", "Vineyard", "Vineyard Churches", "Vineyard Movement", "Winners Chapel", "Christ Embassy"],
  },
  {
    canonical: "Baptist",
    match: ["baptist", "battista"],
    networks: ["Southern Baptist Convention", "Baptist Union", "International Baptist Convention", "Calvary Chapel", "Swiss Baptist Union"],
  },
  {
    canonical: "Anglican",
    match: ["anglican", "church of england", "church in wales", "episcopal", "church of ireland"],
    networks: ["Church of England", "Anglican Communion", "Diocese in Europe", "Church in Wales"],
  },
  {
    canonical: "Lutheran",
    match: ["lutheran", "luthersk", "lutherisch", "luthérien"],
    networks: ["Church of Sweden", "Church of Norway", "Church of Denmark", "Evangelical Lutheran Church in Denmark", "Evangelical Lutheran Church of Finland", "Evangelical Lutheran Church in Germany (EKD)", "EKD", "Evangelical Lutheran Church in America"],
  },
  {
    canonical: "Catholic",
    match: ["catholic", "katolsk", "katholisch", "catholique", "cattolica"],
    networks: ["Catholic Church", "Roman Catholic Church"],
  },
  {
    canonical: "Methodist",
    match: ["methodist", "wesleyan", "nazarene", "salvation army", "frälsningsarmén", "frelsesarmeen"],
    networks: ["Methodist Church", "Salvation Army", "Church of the Nazarene", "Free Methodist Church"],
  },
  {
    canonical: "Reformed",
    match: ["reformed", "presbyterian", "calvinist", "reformiert", "réformée"],
    networks: ["Church of Scotland", "Presbyterian Church", "United Reformed Church", "Christian Reformed Church"],
  },
  {
    canonical: "Evangelical",
    match: ["evangelical", "evangelisk", "evangelisch", "évangélique", "evangelical free", "frikyrklig"],
    networks: ["Evangelical Free Church", "Evangelical Alliance", "CNEF"],
  },
  {
    canonical: "Non-denominational",
    match: ["non-denominational", "nondenominational", "interdenominational", "undenominational"],
  },
  {
    canonical: "Orthodox",
    match: ["orthodox", "ortodoxa", "ortodox"],
  },
];

const UNDERSCORE_MAP = {
  salvation_army: "Methodist",
  roman_catholic: "Catholic",
  church_in_wales: "Anglican",
  latter_day_saints: "Non-denominational",
  christadelphian: "Non-denominational",
  quaker: "Non-denominational",
  united_reformed: "Reformed",
};

function normalizeDenomination(raw) {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase().replace(/_/g, " ");
  const underscoreKey = trimmed.toLowerCase().replace(/\s+/g, "_");
  if (UNDERSCORE_MAP[underscoreKey]) return UNDERSCORE_MAP[underscoreKey];
  for (const cat of DENOMINATIONS) {
    if (cat.match.some((m) => lower.includes(m))) return cat.canonical;
  }
  return lower.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function classifyByNetwork(network) {
  if (!network || !network.trim()) return null;
  const lower = network.trim().toLowerCase();
  for (const cat of DENOMINATIONS) {
    if (!cat.networks) continue;
    if (cat.networks.some((n) => lower === n.toLowerCase() || lower.includes(n.toLowerCase()))) return cat.canonical;
  }
  for (const cat of DENOMINATIONS) {
    if (cat.match.some((m) => lower.includes(m))) return cat.canonical;
  }
  return null;
}

// ─── Network consolidation map ───

const NETWORK_CONSOLIDATION = {
  "Hillsong Network": "Hillsong Church",
  "C3 Church Movement": "C3 Church Global",
  "C3 Church": "C3 Church Global",
  "C3 Church Network": "C3 Church Global",
  "Pingstkyrkan": "Pingst",
  "Pingstförsamlingen": "Pingst",
  "Pingströrelsen Sverige": "Pingst",
  "Roman Catholic Church": "Catholic Church",
  "Vineyard Churches": "Vineyard",
  "Vineyard Movement": "Vineyard",
  "Vineyard Churches International": "Vineyard",
  "Vineyard Churches UK & Ireland": "Vineyard",
  "Vineyard Benelux": "Vineyard",
  "ICF Church": "ICF Movement",
};

// ─── Main ───

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Denomination Normalization");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("═══════════════════════════════════════════\n");

  // Phase 1: Normalize churches.denomination
  console.log("── Phase 1: Normalize churches.denomination ──\n");
  const churches = await sql`
    SELECT slug, denomination FROM churches
    WHERE status = 'approved' AND denomination IS NOT NULL AND denomination != ''
  `;

  let normalized = 0;
  let unchanged = 0;
  for (const church of churches) {
    const canonical = normalizeDenomination(church.denomination);
    if (canonical && canonical !== church.denomination) {
      if (!DRY_RUN) {
        await sql.query(`UPDATE churches SET denomination = $1 WHERE slug = $2`, [canonical, church.slug]);
      }
      normalized++;
      if (normalized <= 20) console.log(`  "${church.denomination}" → "${canonical}" (${church.slug})`);
    } else {
      unchanged++;
    }
  }
  console.log(`\n  Normalized: ${normalized}, Unchanged: ${unchanged}\n`);

  // Phase 2: Fill missing denominations from denomination_network
  console.log("── Phase 2: Fill missing from denomination_network ──\n");
  const missing = await sql`
    SELECT c.slug, e.denomination_network
    FROM churches c
    JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.status = 'approved'
    AND (c.denomination IS NULL OR c.denomination = '')
    AND e.denomination_network IS NOT NULL AND e.denomination_network != ''
  `;

  let filled = 0;
  let noMatch = 0;
  for (const row of missing) {
    const canonical = classifyByNetwork(row.denomination_network);
    if (canonical) {
      if (!DRY_RUN) {
        await sql.query(`UPDATE churches SET denomination = $1 WHERE slug = $2`, [canonical, row.slug]);
      }
      filled++;
      if (filled <= 20) console.log(`  ${row.slug}: "${row.denomination_network}" → "${canonical}"`);
    } else {
      noMatch++;
      if (noMatch <= 10) console.log(`  ? ${row.slug}: "${row.denomination_network}" (no match)`);
    }
  }
  console.log(`\n  Filled: ${filled}, No match: ${noMatch}\n`);

  // Phase 3: Consolidate denomination_network duplicates
  console.log("── Phase 3: Consolidate denomination_network ──\n");
  let consolidated = 0;
  for (const [from, to] of Object.entries(NETWORK_CONSOLIDATION)) {
    if (!DRY_RUN) {
      const r = await sql.query(
        `UPDATE church_enrichments SET denomination_network = $1 WHERE denomination_network = $2`,
        [to, from]
      );
    }
    const count = await sql.query(
      `SELECT COUNT(*) as cnt FROM church_enrichments WHERE denomination_network = $1`,
      [from]
    );
    const cnt = DRY_RUN ? Number(count[0]?.cnt || 0) : 0;
    if (cnt > 0 || !DRY_RUN) {
      console.log(`  "${from}" → "${to}" (${DRY_RUN ? cnt + ' rows' : 'done'})`);
      consolidated++;
    }
  }
  console.log(`\n  Consolidated: ${consolidated} network names\n`);

  // Summary
  console.log("── Final check ──\n");
  const denomCounts = await sql`
    SELECT denomination, COUNT(*) as cnt FROM churches
    WHERE status = 'approved' AND denomination IS NOT NULL AND denomination != ''
    GROUP BY denomination ORDER BY cnt DESC LIMIT 20
  `;
  console.log("  Top denominations after normalization:");
  for (const r of denomCounts) console.log(`    ${r.denomination}: ${r.cnt}`);

  const stillMissing = await sql`
    SELECT COUNT(*) as cnt FROM churches
    WHERE status = 'approved' AND (denomination IS NULL OR denomination = '')
  `;
  console.log(`\n  Still missing denomination: ${stillMissing[0].cnt}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
