/**
 * Reviewed facts are imported into D1, the public source of truth.
 * Dry run: pnpm exec tsx scripts/apply-austin-official-reviews.ts
 * Apply:   pnpm exec tsx scripts/apply-austin-official-reviews.ts --apply
 * Then run pnpm run reconcile:facets to refresh the existing directory order.
 * Full before-images are saved under ignored tmp/ before any write.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createD1ScriptSql } from "./lib/d1-sql.mjs";
import { buildOfficialReviewBatch } from "./lib/official-review-batch.mjs";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { parseOfficialChurchReview, type OfficialChurchReview } from "../src/lib/official-church-review";
import type { ServiceTime } from "../src/types/gospel";

type ReviewPatch = {
  slug: string; name: string; website: string; address: string;
  serviceTimes: ServiceTime[]; languages: string[]; denomination: string | null;
  musicStyles: string[]; phone: string | null; serviceDurationMinutes: number | null;
  childrenMinistry: boolean | null; youthMinistry: boolean | null;
  summary: string; review: OfficialChurchReview;
};
type ChurchBefore = { slug: string; updated_at: string; claimed: number; status: string; city_slug: string; source_kind: string };
type EnrichmentBefore = { church_slug: string; updated_at: string; sources?: { official_review?: unknown } };

async function main() {
  loadLocalEnv(process.cwd());
  const patches: ReviewPatch[] = JSON.parse(await readFile(new URL("./data/austin-official-reviews-2026-09-05.json", import.meta.url), "utf8"));
  assert.equal(patches.length, 20);
  assert.equal(new Set(patches.map((row) => row.slug)).size, patches.length);
  for (const patch of patches) {
    assert.deepEqual(parseOfficialChurchReview({ official_review: patch.review }), patch.review, `Invalid review: ${patch.slug}`);
    assert.equal(new URL(patch.website).protocol, "https:");
    assert.equal(patch.address, patch.review.facts.address?.value);
    assert(patch.review.facts.firstVisit && patch.review.facts.children, `Missing visitor facts: ${patch.slug}`);
    assert(!patch.childrenMinistry || patch.review.facts.children);
    assert(!patch.youthMinistry || patch.review.facts.youth);
    assert(!patch.languages.length || patch.review.facts.languages);
  }

  const sql = createD1ScriptSql();
  const slugs = patches.map((patch) => patch.slug);
  const churches = await sql`SELECT c.*, EXISTS (
    SELECT 1 FROM church_memberships m WHERE m.church_slug = c.slug AND m.status = 'active'
  ) AS claimed FROM churches c WHERE c.slug IN (SELECT value FROM json_each(${slugs}))` as ChurchBefore[];
  const enrichments = await sql`SELECT * FROM church_enrichments
    WHERE church_slug IN (SELECT value FROM json_each(${slugs}))` as EnrichmentBefore[];
  const before = churches.map((church) => ({ slug: church.slug, church, claimed: church.claimed,
    enrichment: enrichments.find((row) => row.church_slug === church.slug) }));
  assert.equal(before.length, patches.length, "Every reviewed profile must already exist");
  for (const row of before) {
    assert(row.enrichment, `Missing enrichment: ${row.slug}`);
    assert.equal(row.church.status, "approved");
    assert.equal(row.church.city_slug, "austin");
    assert(!row.claimed && row.church.source_kind !== "claimed", `Preserve church-owned details: ${row.slug}`);
  }
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", profiles: patches.length, facts: patches.reduce((n, row) => n + Object.keys(row.review.facts).length, 0), claimedProfiles: 0 }));
  if (!process.argv.includes("--apply")) return;
  assert(before.every((row) => !row.enrichment?.sources?.official_review), "Reviews already exist; inspect changes before importing again");

  const backupPath = `tmp/austin-review-2026-09-05/before-apply-${Date.now()}.json`;
  await mkdir("tmp/austin-review-2026-09-05", { recursive: true });
  await writeFile(backupPath, JSON.stringify(before, null, 2), { mode: 0o600, flag: "wx" });
  const result = await sql.batch(buildOfficialReviewBatch(patches, before));
  console.log(JSON.stringify({ result, backupPath }));
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
