import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("D1 schema creates server-side UUID and timestamp defaults for raw SQL writers", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("drizzle-d1/0000_initial.sql", "utf8"));
  db.exec("INSERT INTO church_claims (church_slug, name, email) VALUES ('test', 'test', 'test')");
  const row = db.prepare("SELECT id, submitted_at FROM church_claims").get();
  assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(row.submitted_at > 1_700_000_000_000);
});

test("D1 schema retains the source fields absent from the Postgres ORM model", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("drizzle-d1/0000_initial.sql", "utf8"));
  const churchColumns = db.prepare("PRAGMA table_info(churches)").all().map((row) => row.name);
  const enrichmentColumns = db.prepare("PRAGMA table_info(church_enrichments)").all().map((row) => row.name);
  for (const column of ["claim_preview_token", "service_times", "website_extracted_at"]) assert.ok(churchColumns.includes(column));
  for (const column of ["pastor_photo_url", "good_fit_tags", "visitor_faq", "photo_urls"]) assert.ok(enrichmentColumns.includes(column));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='church_enrichment_payload_chunks'").get().n, 1);
});
