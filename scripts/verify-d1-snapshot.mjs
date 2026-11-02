// Verifies a locally imported snapshot against hashes captured within the
// same Postgres repeatable-read transaction that produced the SQL export.
import { Client } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { ident } from "./d1-snapshot-codec.mjs";

const [databasePath, manifestPath] = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databasePath || !manifestPath || !url) throw new Error("Usage: DATABASE_URL=... node scripts/verify-d1-snapshot.mjs snapshot.sqlite snapshot.sql.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const db = new DatabaseSync(databasePath, { readOnly: true });
const client = new Client(url);
try {
  await client.connect();
  const { rows: columns } = await client.query(`SELECT table_name, column_name, data_type, ordinal_position
    FROM information_schema.columns WHERE table_schema='public' AND table_name IN
      (SELECT tablename FROM pg_tables WHERE schemaname='public') ORDER BY table_name, ordinal_position`);
  const { rows: keys } = await client.query(`SELECT c.relname AS table_name, a.attname AS column_name, k.ordinality
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_index i ON i.indrelid=c.oid AND i.indisprimary
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
    WHERE n.nspname='public' ORDER BY c.relname,k.ordinality`);
  const tables = Object.keys(manifest.tables);
  const payloadIds = new Set(db.prepare("SELECT DISTINCT enrichment_id FROM church_enrichment_payload_chunks WHERE field='raw_crawled_pages'").all().map((row) => row.enrichment_id));
  const payloadQuery = db.prepare("SELECT value FROM church_enrichment_payload_chunks WHERE enrichment_id = ? AND field = 'raw_crawled_pages' ORDER BY part");
  const failures = [];
  for (const table of tables) {
    const tableColumns = columns.filter((column) => column.table_name === table);
    const primary = keys.filter((key) => key.table_name === table).map((key) => key.column_name);
    if (!tableColumns.length || !primary.length) throw new Error(`Source schema changed for ${table}`);
    const query = `SELECT ${tableColumns.map((column) => ident(column.column_name)).join(", ")} FROM ${ident(table)} ORDER BY ${primary.map(ident).join(", ")}`;
    const hash = createHash("sha256");
    let count = 0;
    for (const row of db.prepare(query).iterate()) {
      if (table === "church_enrichments" && payloadIds.has(row.id)) row.raw_crawled_pages = payloadQuery.all(row.id).map((part) => part.value).join("");
      const normalized = {};
      for (const { column_name: name, data_type: type } of tableColumns) {
        let value = row[name];
        if (value !== null && type === "boolean") value = Boolean(value);
        if (value !== null && type.startsWith("timestamp")) value = String(value);
        normalized[name] = value;
      }
      hash.update(JSON.stringify(normalized)).update("\n");
      count++;
    }
    const expected = manifest.tables[table];
    const matches = count === expected.count && hash.digest("hex") === expected.sha256;
    if (!matches) failures.push(table);
    process.stdout.write(`${table}: ${count} rows, ${matches ? "match" : "MISMATCH"}\n`);
  }
  const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all().length;
  if (foreignKeyErrors) failures.push(`foreign keys: ${foreignKeyErrors}`);
  if (failures.length) throw new Error(`Snapshot verification failed: ${failures.join(", ")}`);
} finally {
  await client.end().catch(() => {});
  db.close();
}
