import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const PATTERNS = [
  "pastor",
  "leadership",
  "elder",
  "vacancy",
  "problem",
  "hurt",
  "gossip",
  "complaint",
  "frustration",
  "criticize",
  "angry at",
  "disappointed",
];

for (const p of PATTERNS) {
  const rows = await sql`
    SELECT id, church_slug, content, author_name
    FROM prayers
    WHERE content ILIKE ${"%" + p + "%"}
    ORDER BY created_at DESC
    LIMIT 10
  `;
  if (rows.length === 0) continue;
  console.log(`\n── "${p}" (${rows.length}) ──`);
  for (const row of rows) {
    console.log(`  [${row.id.slice(0, 8)}] ${row.church_slug} · ${row.author_name || "anon"}`);
    console.log(`    "${row.content.slice(0, 180)}"`);
  }
}
