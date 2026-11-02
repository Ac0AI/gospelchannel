// Read-only comparison of the live source with the verified local snapshot.
// Hash rows on Postgres before transfer so large crawl payloads stay local.
import { Client } from "@neondatabase/serverless";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ident } from "./d1-snapshot-codec.mjs";

const [databasePath, manifestPath] = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databasePath || !manifestPath || !url) throw new Error("Provide the private SQLite snapshot, manifest and source database URL");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const db = new DatabaseSync(databasePath, { readOnly: true });
const source = new Client(url);
try {
  await source.connect();
  await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await source.query("SET LOCAL TIME ZONE 'UTC'");
  const { rows: columns } = await source.query(`SELECT table_name, column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
  const chunks = new Set(db.prepare("SELECT DISTINCT enrichment_id FROM church_enrichment_payload_chunks").all().map((row) => row.enrichment_id));
  const getChunks = db.prepare("SELECT value FROM church_enrichment_payload_chunks WHERE enrichment_id = ? AND field = 'raw_crawled_pages' ORDER BY part");
  const changed = [];
  for (const table of Object.keys(manifest.tables)) {
    const cols = columns.filter((column) => column.table_name === table);
    const keys = db.prepare(`PRAGMA table_info(${ident(table)})`).all().filter((column) => column.pk).sort((a, b) => a.pk - b.pk).map((column) => column.name);
    const select = cols.map(({ column_name: name, data_type: type }) => {
      const column = ident(name);
      if (type === "ARRAY") return `to_jsonb(${column})::text AS ${column}`;
      if (type === "json" || type === "jsonb") return `${column}::text AS ${column}`;
      if (type.startsWith("timestamp")) return `((extract(epoch FROM ${column}) * 1000)::bigint)::text AS ${column}`;
      return column;
    });
    const hash = createHash("sha256");
    let count = 0;
    for (const row of db.prepare(`SELECT ${cols.map((column) => ident(column.column_name)).join(",")} FROM ${ident(table)} ORDER BY ${keys.map(ident).join(",")}`).iterate()) {
      if (table === "church_enrichments" && chunks.has(row.id)) row.raw_crawled_pages = getChunks.all(row.id).map((chunk) => chunk.value).join("");
      for (const { column_name: name, data_type: type } of cols) {
        if (row[name] != null && type === "boolean") row[name] = Boolean(row[name]);
        if (row[name] != null && type.startsWith("timestamp")) row[name] = String(row[name]);
      }
      hash.update(createHash("sha256").update(JSON.stringify(row)).digest("hex")).update("\n");
      count++;
    }
    const { rows: [live] } = await source.query(`SELECT count(*)::int AS count,
      encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(row_to_json(t)::text, 'UTF8')), 'hex') || E'\\n', '' ORDER BY ${keys.map((key) => `t.${ident(key)}`).join(",")}), ''), 'UTF8')), 'hex') AS hash
      FROM (SELECT ${select.join(",")} FROM ${ident(table)}) t`);
    const matches = live.count === count && live.hash === hash.digest("hex");
    console.log(`${table}: ${matches ? "unchanged" : "DIFFERS"} (${count} snapshot / ${live.count} source)`);
    if (!matches) changed.push(table);
  }
  await source.query("ROLLBACK");
  if (changed.length) { console.log(`Source tables requiring reconciliation: ${changed.join(", ")}`); process.exitCode = 2; }
} finally { await source.end().catch(() => {}); db.close(); }
