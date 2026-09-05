/**
 * Reviewed facts are imported into Neon, the public source of truth.
 * Dry run: pnpm exec tsx scripts/apply-austin-official-reviews.ts
 * Apply:   pnpm exec tsx scripts/apply-austin-official-reviews.ts --apply
 * Then run pnpm run reconcile:facets to refresh the existing directory order.
 * Full before-images are saved under ignored tmp/ before any write.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
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

async function main() {
  loadLocalEnv(process.cwd());
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  assert(databaseUrl, "DATABASE_URL is required");
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

  const sql = neon(databaseUrl);
  const slugs = patches.map((patch) => patch.slug);
  const before = await sql`
    SELECT c.slug, to_jsonb(c) AS church, to_jsonb(e) AS enrichment,
      c.updated_at::text AS church_version, e.updated_at::text AS enrichment_version,
      EXISTS (SELECT 1 FROM church_memberships m WHERE m.church_slug = c.slug AND m.status = 'active') AS claimed
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.slug = ANY(${slugs}::text[])
  `;
  assert.equal(before.length, patches.length, "Every reviewed profile must already exist");
  for (const row of before) {
    assert(row.enrichment, `Missing enrichment: ${row.slug}`);
    assert.equal(row.church.status, "approved");
    assert.equal(row.church.city_slug, "austin");
    assert(!row.claimed && row.church.source_kind !== "claimed", `Preserve church-owned details: ${row.slug}`);
  }
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", profiles: patches.length, facts: patches.reduce((n, row) => n + Object.keys(row.review.facts).length, 0), claimedProfiles: 0 }));
  if (!process.argv.includes("--apply")) return;
  assert(before.every((row) => !row.enrichment.sources?.official_review), "Reviews already exist; inspect changes before importing again");

  const backupPath = `tmp/austin-review-2026-09-05/before-apply-${Date.now()}.json`;
  await mkdir("tmp/austin-review-2026-09-05", { recursive: true });
  await writeFile(backupPath, JSON.stringify(before, null, 2), { mode: 0o600, flag: "wx" });
  const payload = JSON.stringify(patches.map((patch) => {
    const old = before.find((row) => row.slug === patch.slug)!;
    return { patch, churchVersion: old.church_version, enrichmentVersion: old.enrichment_version };
  }));

  // Version predicates and row-count assertions abort the entire transaction
  // if a church/admin edit races this import. Ownership is never changed.
  const result = await sql.transaction([
    sql`
      WITH patches AS (SELECT value FROM jsonb_array_elements(${payload}::jsonb)),
      updated AS (
        UPDATE churches c SET
          name = p.value->'patch'->>'name',
          description = p.value->'patch'->>'summary',
          website = p.value->'patch'->>'website',
          service_times = p.value->'patch'->'serviceTimes',
          denomination = p.value->'patch'->>'denomination',
          music_style = ARRAY(SELECT jsonb_array_elements_text(p.value->'patch'->'musicStyles')),
          language = NULLIF(array_to_string(ARRAY(SELECT jsonb_array_elements_text(p.value->'patch'->'languages')), ', '), ''),
          last_researched = ((p.value->'patch'->'review'->>'checkedAt') || 'T00:00:00Z')::timestamptz,
          updated_at = NOW()
        FROM patches p WHERE c.slug = p.value->'patch'->>'slug'
          AND c.updated_at = (p.value->>'churchVersion')::timestamptz
          AND c.status = 'approved' AND c.city_slug = 'austin' AND c.source_kind <> 'claimed'
          AND NOT EXISTS (SELECT 1 FROM church_memberships m WHERE m.church_slug = c.slug AND m.status = 'active')
        RETURNING c.slug
      ) SELECT COUNT(*)::int AS updated, 1 / ((COUNT(*) = ${patches.length})::int) AS complete FROM updated
    `,
    sql`
      WITH patches AS (SELECT value FROM jsonb_array_elements(${payload}::jsonb)),
      updated AS (
        UPDATE church_enrichments e SET
          official_church_name = p.value->'patch'->>'name',
          street_address = p.value->'patch'->>'address',
          website_url = p.value->'patch'->>'website',
          service_times = p.value->'patch'->'serviceTimes',
          languages = ARRAY(SELECT jsonb_array_elements_text(p.value->'patch'->'languages')),
          denomination_network = p.value->'patch'->>'denomination',
          phone = p.value->'patch'->>'phone',
          children_ministry = (p.value->'patch'->>'childrenMinistry')::boolean,
          youth_ministry = (p.value->'patch'->>'youthMinistry')::boolean,
          summary = p.value->'patch'->>'summary',
          seo_description = LEFT(p.value->'patch'->>'summary', 160),
          what_to_expect = p.value->'patch'->'review'->'facts'->'firstVisit'->>'value',
          parking_info = p.value->'patch'->'review'->'facts'->'transport'->>'value',
          service_duration_minutes = (p.value->'patch'->>'serviceDurationMinutes')::integer,
          ministries = '{}', good_fit_tags = '{}', visitor_faq = '[]'::jsonb,
          theological_orientation = NULL, church_size = NULL,
          pastor_name = NULL, pastor_title = NULL, pastor_photo_url = NULL,
          sources = (CASE WHEN jsonb_typeof(e.sources) = 'object' THEN e.sources ELSE jsonb_build_object('legacy', e.sources) END)
            || jsonb_build_object('official_review', p.value->'patch'->'review'),
          last_enriched_at = ((p.value->'patch'->'review'->>'checkedAt') || 'T00:00:00Z')::timestamptz,
          updated_at = NOW()
        FROM patches p WHERE e.church_slug = p.value->'patch'->>'slug'
          AND e.updated_at = (p.value->>'enrichmentVersion')::timestamptz
        RETURNING e.church_slug
      ) SELECT COUNT(*)::int AS updated, 1 / ((COUNT(*) = ${patches.length})::int) AS complete FROM updated
    `,
  ], { isolationLevel: "Serializable" });
  console.log(JSON.stringify({ result, backupPath }));
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
