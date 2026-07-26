#!/usr/bin/env node
/**
 * Build the "worship by denomination" dataset: which worship songs churches of
 * each denomination actually sing, from real church-curated Spotify playlists
 * (playlist.church corpus) joined to directory denomination labels (Neon).
 *
 * These are two INDEPENDENT sources: denomination comes from directory/import
 * metadata; song adoption comes from the church's playlists. Nothing here is
 * derived from an AI worship-style classifier.
 *
 * Restricted to English-speaking countries so cross-denomination comparison is
 * not confounded by language (e.g. German-language congregations).
 *
 *   node scripts/export-worship-by-denomination.mjs /path/to/corpus.db
 * Writes src/data/worship-by-denomination-2026.json. Env: DATABASE_URL.
 */
import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(ROOT);
const CORPUS = process.argv[2];
if (!CORPUS) throw new Error("Usage: node scripts/export-worship-by-denomination.mjs <corpus.db path>");
if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");

const ENGLISH = new Set(["United States", "USA", "United Kingdom", "Australia", "Canada", "Ireland", "New Zealand"]);
const HYMN = /CityAlight|Getty|Sovereign Grace/i;         // modern-hymn houses
const ANTHEM = /Hillsong|Bethel|Elevation|Passion/i;      // megachurch anthem houses

const db = new DatabaseSync(CORPUS, { readOnly: true });
// English-speaking corpus churches with >=1 worship song
const churchCountry = new Map(db.prepare(`SELECT slug, country FROM churches`).all().map((r) => [r.slug, r.country]));
const rows = db.prepare(`
  SELECT sc.church_slug slug, s.group_key gk, s.title title, s.artist_name artist, s.adoption_count ac
  FROM song_churches sc JOIN songs s ON s.id=sc.song_id
  WHERE s.is_worship=1 AND s.group_key IS NOT NULL`).all();
const churchGroups = new Map();  // slug -> Set(gk)
const rep = new Map();           // gk -> {title, artist, ac}
for (const r of rows) {
  if (!ENGLISH.has(churchCountry.get(r.slug))) continue;
  if (!churchGroups.has(r.slug)) churchGroups.set(r.slug, new Set());
  churchGroups.get(r.slug).add(r.gk);
  const c = rep.get(r.gk);
  if (!c || r.ac > c.ac) rep.set(r.gk, { title: r.title, artist: r.artist, ac: r.ac });
}
const slugs = [...churchGroups.keys()];

const sql = neon(process.env.DATABASE_URL);
const denomRows = await sql`SELECT slug, denomination FROM churches WHERE slug = ANY(${slugs})`;
const famOf = (dRaw) => {
  const d = (dRaw || "").toLowerCase();
  if (!d) return null;
  if (d.includes("non-denomination") || d.includes("nondenomination")) return "Non-denominational";
  if (d.includes("baptist")) return "Baptist";
  if (d.includes("assemblies of god")) return "Pentecostal";
  if (d.includes("pentecostal") || d.includes("foursquare") || d.includes("apostolic")) return "Pentecostal";
  if (d.includes("vineyard")) return "Vineyard";
  if (d.includes("charismatic")) return "Charismatic";
  if (d.includes("anglican") || d.includes("episcopal")) return "Anglican / Episcopal";
  if (d.includes("presbyterian") || d.includes("reformed")) return "Presbyterian / Reformed";
  if (d.includes("evangelical")) return "Evangelical (general)";
  return null; // exclude unknown/other/liturgical-thin
};
const slugFam = new Map(denomRows.map((r) => [r.slug, famOf(r.denomination)]));

const byFam = new Map();
for (const slug of slugs) {
  const f = slugFam.get(slug);
  if (!f) continue;
  if (!byFam.has(f)) byFam.set(f, []);
  byFam.get(f).push(slug);
}

const clean = (t) => t.replace(/\s*\(feat\.[^)]*\)/i, "").replace(/\s*-\s*(Live|Radio.*|Studio|Acoustic)\s*$/i, "").trim();
const reachPct = (list, re) => Math.round((list.filter((slug) => [...churchGroups.get(slug)].some((gk) => re.test(rep.get(gk)?.artist || ""))).length / list.length) * 100);

function familyStats(list) {
  const cnt = new Map();
  for (const slug of list) for (const gk of churchGroups.get(slug)) cnt.set(gk, (cnt.get(gk) || 0) + 1);
  const topSongs = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([gk, n]) => ({ title: clean(rep.get(gk).title), artist: rep.get(gk).artist, pct: Math.round((n / list.length) * 100) }));
  return { churches: list.length, modernHymnPct: reachPct(list, HYMN), megachurchAnthemPct: reachPct(list, ANTHEM), topSongs };
}

const MIN = 25;
const reportableFamilies = [...byFam.entries()]
  .filter(([, l]) => l.length >= MIN)
  .sort((a, b) => b[1].length - a[1].length);
const families = reportableFamilies.map(([family, list]) => ({ family, ...familyStats(list) }));

// Overall computed over the SAME reportable population the page shows (union of
// the reported families), so hero/lead percentages match the church count.
const reportSlugs = reportableFamilies.flatMap(([, l]) => l);
const overall = familyStats(reportSlugs);

const out = {
  version: "2026.07",
  generatedAt: "2026-07-26",
  builtOn: db.prepare(`SELECT value FROM corpus_meta WHERE key='corpus_built_on'`).get()?.value,
  population: {
    churches: slugs.length,
    reportableChurches: reportSlugs.length,
    countries: [...ENGLISH],
    minFamilySize: MIN,
    note: "English-speaking-country churches with >=1 worship-flagged song in a public Spotify playlist; reportableChurches = those in a denomination family of >=25.",
  },
  method: "Denomination from directory/import metadata; song adoption from church playlists (not the AI worship-style classifier). Hymn/anthem indices classify by PUBLISHING HOUSE, not song form.",
  hymnHouses: ["CityAlight", "Keith & Kristyn Getty", "Sovereign Grace Music"],
  anthemHouses: ["Hillsong", "Bethel Music", "Elevation Worship", "Passion"],
  overall,
  families,
};
writeFileSync(join(ROOT, "src/data/worship-by-denomination-2026.json"), JSON.stringify(out, null, 2));

console.log(`English-speaking corpus churches: ${slugs.length}`);
console.log(`\nfamily [n]  hymn%  anthem%   top song`);
for (const f of families) console.log(`  ${f.family} [${f.churches}]  hymn ${f.modernHymnPct}%  anthem ${f.megachurchAnthemPct}%  · #1 ${f.topSongs[0].title} (${f.topSongs[0].pct}%)`);
console.log(`\noverall [${overall.churches}]: hymn ${overall.modernHymnPct}% / anthem ${overall.megachurchAnthemPct}%`);
