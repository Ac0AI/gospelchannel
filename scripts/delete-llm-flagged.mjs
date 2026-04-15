#!/usr/bin/env node

/**
 * Delete the 62 high-confidence non-church entries flagged by the LLM audit.
 *
 * Exclusions (kept despite being flagged):
 *   - every-nation-{yogyakarta,palu,minahasa-utara,makassar,dalung-bali} — real local campuses
 *   - ferede-iglesia-hillsong-espana-3 — real Hillsong Spain location
 *   - cornerstonesf-church-mission-campus-... — real campus
 *   - fr-eglise-caef-valence — real local CAEF church
 *   - ferede-iglesia-evangelica-presbiteriana-de-espana-2 — may be real local
 *   - mision-evangelica-de-cataluna — borderline
 *   - netzwerk-freie-gemeinde-schonbuch — could be real local
 *
 * Usage:
 *   node scripts/delete-llm-flagged.mjs --dry-run
 *   node scripts/delete-llm-flagged.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

const SLUGS = [
  "fr-eglise-evangelique-56",
  "ferede-iglesia-carismatica-episcopal-de-espana",
  "the-gospel-channel-church",
  "victory-philippines",
  "anointing-fire-catholic-ministries-uk-afcm",
  "lee-abbey-christian-conference-retreat-and-holiday-centre",
  "iglesia-unida-metodista-pentecostal-coro-nacional",
  "fellowship-head-office-no-services",
  "de-norske-pinsemenigheters-ytremisjon",
  "global-harvest-church-hq",
  "africa-gospel-church-kenya-central-office-hq",
  "federazione-delle-chiese-evangeliche-in-italia",
  "living-water-fellowship",
  "pearl-church",
  "turismo-en-valencia",
  "stavanger-kirkelige-fellesrad-hjem",
  "ayuntamiento-de-malaga",
  "waze",
  "gron-kyrka",
  "wanderlog",
  "find-det-hele-p-kultunaut",
  "eglises-org",
  "varlden-idag",
  "suomen-asiakastieto-oy",
  "birmingham-churches-together",
  "fib",
  "the-best-valencia-churches-cathedrals-2026",
  "ukchurches",
  "rentech-digital",
  "worship-festival-hamburg",
  "worship-songs-for-the-church",
  "goteborgs-officiella-besoksguide",
  "pingstkyrkan-i-finland",
  "plans-comparateur-d-x27-itineraires-et-cartes-de-france",
  "kirker-dk",
  "impact-france",
  "samtidsreligion-au-dk",
  "lausanne-tourisme",
  "finn-din-neste-kirke",
  "organisez-et-enregistrez-vos-adresses-avec-mapstr",
  "iglesias-en-espana",
  "church-checker",
  "the-church-of-england-evangelical-council",
  "eglise-charismatique-pentecotiste",
  "lovsang-no",
  "balkanevents",
  "lovsangskvall-goteborg",
  "en-helg-i-lovsang-tillbedjan",
  "churches-cathedrals-in-manila",
  "lobpreis",
  "goteborgs-domkyrkas-goss-och-flickkorer",
  "trier-cathedral",
  "santuario-retoma-adoracao-eucaristica-noturna-apos",
  "tbbmi",
  "l-eglise-catholique-a-marseille",
  "st-pauls-cathedral",
  "katolska-kyrkan",
  "serving-anglican-communities-in-europe-turkey-and-morocco",
  "l-eglise-catholique-dans-le-rhone-et-le-roannais",
  "kristi-kirke-kbenhavn",
  "suomen-helluntailiike",
  "iglesias-y-horarios-de-misa-en-espana",
];

async function main() {
  console.log(`\nDeleting ${SLUGS.length} LLM-flagged non-church entries`);
  if (DRY_RUN) console.log("  (dry run)\n");

  let deleted = 0;
  let skipped = 0;

  for (const slug of SLUGS) {
    const [row] = await sql`SELECT slug, name FROM churches WHERE slug = ${slug}`;
    if (!row) {
      console.log(`  skip ${slug} (not found)`);
      skipped++;
      continue;
    }
    console.log(`  delete ${row.name} (${slug})`);
    if (!DRY_RUN) {
      await sql`DELETE FROM churches WHERE slug = ${slug}`;
    }
    deleted++;
  }

  console.log(`\nDone. Deleted: ${deleted}, Skipped: ${skipped}`);
  if (DRY_RUN) console.log("(dry run - no changes made)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
