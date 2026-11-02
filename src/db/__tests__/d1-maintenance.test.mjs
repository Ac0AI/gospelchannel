import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as schema from "../d1-schema";
import { createD1ScriptSql, encodeD1ScriptValue } from "../../../scripts/lib/d1-sql.mjs";
import { buildOfficialReviewBatch } from "../../../scripts/lib/official-review-batch.mjs";
import { prepareCrawlPayload, readCrawlPayload } from "../../../scripts/lib/d1-crawl-payload.mjs";

let db, sql;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle-d1").filter((name) => name.endsWith(".sql")).sort()) db.exec(readFileSync(`drizzle-d1/${file}`, "utf8"));
  function query(text, params = []) {
    const statement = db.prepare(text);
    return /\?\d/.test(text) ? statement.all(Object.fromEntries(params.map((value, i) => [`?${i + 1}`, value]))) : statement.all(...params);
  }
  sql = createD1ScriptSql({}, { query, batch(statements) {
    db.exec("BEGIN");
    try { const results = statements.map((s) => ({ results: query(s.sql, s.params) })); db.exec("COMMIT"); return results; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  } });
});
afterEach(() => db.close());

it("Node codecs match the actual D1 schema", () => {
  const expected = Object.fromEntries(Object.values(schema).filter((table) => is(table, Table)).map((table) => [
    getTableName(table), Object.fromEntries(Object.values(getTableColumns(table)).map((column) => [column.name,
      ["json", "date", "boolean"].includes(column.dataType) ? column.dataType : "other"])),
  ]));
  expect(JSON.parse(readFileSync("scripts/lib/d1-column-types.json", "utf8"))).toEqual(expected);
});

it("maintenance statements prepare against SQLite without executing any jobs", () => {
  let count = 0;
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { scan(path); continue; }
      if (!/\.(mjs|ts)$/.test(path)) continue;
      const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      const constants = new Map();
      function collect(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, node.initializer);
        ts.forEachChild(node, collect);
      }
      collect(source);
      function staticText(node, depth = 0) {
        if (!node || depth > 10) return undefined;
        if (ts.isStringLiteralLike(node)) return node.text;
        if (ts.isIdentifier(node)) return staticText(constants.get(node.text), depth + 1);
        if (ts.isTemplateExpression(node)) {
          let result = node.head.text;
          for (const span of node.templateSpans) {
            const value = staticText(span.expression, depth + 1);
            if (value === undefined) return undefined;
            result += value + span.literal.text;
          }
          return result;
        }
      }
      function visit(node) {
        let text;
        if (ts.isTaggedTemplateExpression(node) && node.tag.getText(source) === "sql") {
          const t = node.template;
          text = t.head ? t.head.text : t.text;
          for (const [index, span] of (t.templateSpans || []).entries()) text += `?${index + 1}${span.literal.text}`;
        } else if (ts.isCallExpression(node) && /\.query$/.test(node.expression.getText(source))) {
          text = staticText(node.arguments[0])?.replace(/\$(\d+)/g, "?$1");
        }
        if (text) {
          expect(() => db.prepare(`EXPLAIN ${text}`), `${path}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}`).not.toThrow();
          count++;
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan("scripts");
  expect(count).toBeGreaterThan(250);
});

it("keeps JSON arrays, dates, booleans and numbered parameters", async () => {
  const date = "2026-11-02T12:00:00.123Z";
  await sql`INSERT INTO churches (slug, name, country, music_style, updated_at)
    VALUES (${"codec"}, ${"Date $1 stays text"}, ${"SE"}, ${["Gospel"]}, ${encodeD1ScriptValue("churches", "updated_at", date)})`;
  const [row] = await sql.query("SELECT * FROM churches WHERE slug = $1 AND name <> '$1'", ["codec"]);
  expect(row.music_style).toEqual(["Gospel"]);
  expect(row.updated_at).toBe(date);
  expect(encodeD1ScriptValue("church_enrichments", "children_ministry", false)).toBe(0);
  await expect(sql.query("SELECT 1", Array(101).fill(1))).rejects.toThrow("100 bound parameters");
});

it("round-trips oversized UTF-8 crawl data and clears obsolete chunks", async () => {
  db.exec("INSERT INTO churches (slug,name,country) VALUES ('crawl','Crawl','SE'); INSERT INTO church_enrichments (id,church_slug) VALUES ('e-crawl','crawl')");
  const pages = [{ text: "å💒".repeat(210000) }];
  const payload = prepareCrawlPayload(pages, "church_slug", "crawl");
  expect(payload.inline).toBeNull();
  await sql.batch(payload.statements);
  expect(await readCrawlPayload(sql, "e-crawl", null)).toEqual(pages);
  const replacement = [{ text: "Small update" }];
  const next = prepareCrawlPayload(replacement, "church_slug", "crawl");
  await sql.batch([{ sql: "UPDATE church_enrichments SET raw_crawled_pages = ?1 WHERE id = 'e-crawl'", params: [next.inline] }, ...next.statements]);
  expect(await readCrawlPayload(sql, "e-crawl", next.inline)).toEqual(replacement);
  expect(db.prepare("SELECT COUNT(*) n FROM church_enrichment_payload_chunks").get().n).toBe(0);
});

describe("official review import protects concurrent edits and church ownership", () => {
  const patch = { slug: "review", name: "Reviewed name", website: "https://example.invalid", address: "Street",
    serviceTimes: [{ day: "Sunday", time: "10:00" }], languages: ["English"], denomination: null,
    musicStyles: ["Gospel"], phone: null, childrenMinistry: true, youthMinistry: null,
    serviceDurationMinutes: 60, summary: "Reviewed summary", review: { checkedAt: "2026-11-02", facts: { firstVisit: { value: "Welcome" } } } };
  async function fixture() {
    db.exec(`INSERT INTO churches (slug, name, country, status, city_slug, source_kind, updated_at)
      VALUES ('review', 'Original', 'US', 'approved', 'austin', 'manual', 1000);
      INSERT INTO church_enrichments (id, church_slug, sources, updated_at) VALUES ('e-review', 'review', '["legacy"]', 1000)`);
    const [church] = await sql`SELECT * FROM churches WHERE slug = 'review'`;
    const [enrichment] = await sql`SELECT * FROM church_enrichments WHERE church_slug = 'review'`;
    return [{ slug: "review", church, enrichment }];
  }
  it("writes typed facts and retains legacy sources", async () => {
    await sql.batch(buildOfficialReviewBatch([patch], await fixture()));
    const [e] = await sql`SELECT * FROM church_enrichments WHERE church_slug = 'review'`;
    expect(e.languages).toEqual(["English"]);
    expect(e.children_ministry).toBe(true);
    expect(e.sources.legacy).toEqual(["legacy"]);
    expect(e.sources.official_review).toEqual(patch.review);
  });
  it.each(["version", "claim"])("rolls back every row on a %s race", async (race) => {
    const before = await fixture();
    if (race === "version") db.exec("UPDATE church_enrichments SET updated_at = 2000");
    else db.exec("UPDATE churches SET source_kind = 'claimed'");
    await expect(sql.batch(buildOfficialReviewBatch([patch], before))).rejects.toThrow("CHECK constraint failed");
    expect(db.prepare("SELECT name FROM churches").get().name).toBe("Original");
    expect(db.prepare("SELECT sources FROM church_enrichments").get().sources).toBe('["legacy"]');
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'review_guard_%'").all()).toEqual([]);
  });
});
