import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

// Suspicious patterns: prayers that describe church problems rather than praise/petition
const PATTERNS = [
  "new pastor",
  "fire the",
  "remove the",
  "split",
  "conflict",
  "leaving",
  "leave the church",
  "division",
  "scandal",
  "abuse",
  "resign",
  "step down",
];

for (const p of PATTERNS) {
  const rows = await sql`
    SELECT id, church_slug, content, author_name, created_at
    FROM prayers
    WHERE content ILIKE ${"%" + p + "%"}
    ORDER BY created_at DESC
  `;
  if (rows.length === 0) continue;
  console.log(`\n── "${p}" (${rows.length}) ──`);
  for (const row of rows) {
    console.log(`  [${row.id.slice(0, 8)}] ${row.church_slug} · ${row.author_name || "anon"}`);
    console.log(`    "${row.content.slice(0, 200)}"`);
  }
}
