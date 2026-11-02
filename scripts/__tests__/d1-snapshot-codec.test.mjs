import { test } from "vitest";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { rowStatements } from "../d1-snapshot-codec.mjs";

test("preserves unicode, quotes, NUL, null, and large values under the D1 SQL limit", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE item (id TEXT PRIMARY KEY, a TEXT, b TEXT, c TEXT, absent TEXT, enabled INTEGER)");
  const source = { id: "a'b", a: "🕊å\u0000'".repeat(10_000), b: "z".repeat(35_000), c: "y".repeat(35_000), absent: null, enabled: true };
  const statements = rowStatements("item", source, ["id"]);
  for (const sql of statements) {
    assert.ok(Buffer.byteLength(sql) <= 95_000);
    db.exec(sql);
  }
  const saved = db.prepare("SELECT hex(a) AS a_hex, b, c, absent, enabled FROM item").get();
  assert.deepEqual({ ...saved }, { a_hex: Buffer.from(source.a).toString("hex").toUpperCase(), b: source.b, c: source.c, absent: null, enabled: 1 });
});

test("preserves an oversized crawl payload in ordered chunks", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE church_enrichments (id TEXT PRIMARY KEY, raw_crawled_pages TEXT); CREATE TABLE church_enrichment_payload_chunks (enrichment_id TEXT, field TEXT, part INTEGER, value TEXT, PRIMARY KEY(enrichment_id,field,part))");
  const payload = JSON.stringify([{ text: "🕊".repeat(300_000) }]);
  for (const sql of rowStatements("church_enrichments", { id: "42", raw_crawled_pages: payload }, ["id"])) db.exec(sql);
  assert.equal(db.prepare("SELECT raw_crawled_pages FROM church_enrichments").get().raw_crawled_pages, null);
  const reconstructed = db.prepare("SELECT value FROM church_enrichment_payload_chunks ORDER BY part").all().map((row) => row.value).join("");
  assert.equal(reconstructed, payload);
});

test("fails closed for oversized ordinary rows and missing keys", () => {
  assert.throws(() => rowStatements("item", { id: "a", a: "x".repeat(1_900_000) }, ["id"]), /too large/);
  assert.throws(() => rowStatements("item", { id: null }, ["id"]), /Missing primary key/);
});
