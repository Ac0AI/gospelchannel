import { test } from "vitest";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readRelatedCandidates, writeRelatedRows } from "../lib/d1-directory.mjs";

test("loads and writes related churches without losing array contents", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE churches (slug TEXT PRIMARY KEY, country TEXT, city_slug TEXT, directory_rank INTEGER, display_score INTEGER, music_style TEXT, denomination TEXT, status TEXT, related_church_slugs TEXT);
    CREATE TABLE church_enrichments (id TEXT, church_slug TEXT, latitude REAL, longitude REAL, updated_at INTEGER);
    INSERT INTO churches VALUES ('a', 'SE', 'city', 1, 5, '["Worship"]', NULL, 'approved', NULL);
    INSERT INTO churches VALUES ('b', 'SE', 'city', 2, 2, NULL, NULL, 'archived', NULL);`);
  const client = { async query(sql, params) { const statement = db.prepare(sql); return sql.trimStart().startsWith("SELECT") ? statement.all(...params) : statement.run(...params); } };
  const rows = await readRelatedCandidates(client, 4);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].music_style, ["Worship"]);
  await writeRelatedRows(client, [{ slug: "a", related: ["b", "x,y"] }]);
  assert.deepEqual(JSON.parse(db.prepare("SELECT related_church_slugs FROM churches WHERE slug='a'").get().related_church_slugs), ["b", "x,y"]);
});
