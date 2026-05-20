/**
 * DEPLOY GATE for orphan-pages deploy 1 (2026-05-20). Asserts the two
 * load-bearing reciprocity invariants on the LIVE `churches.related_church_slugs`
 * column populated by scripts/backfill-related-churches.ts:
 *
 *   (a) every indexable church EMITS a non-empty list
 *   (b) every indexable church RECEIVES >=1 inlink
 *
 * A rank-ordered sibling query alone does NOT guarantee (b) — tail churches
 * in each city would stay orphaned. The backfill's reciprocity / least-linked
 * pass is what closes that gap. This test proves it actually did.
 *
 * Also asserts (c): every slug emitted is itself indexable — no internal
 * link points at a noindexed page (the half of the equity-leak risk we can
 * verify at backfill time; the runtime-stale half is the accepted P3 TODO).
 *
 * Live-Neon integration gate: requires DATABASE_URL. CI runs without DB
 * creds → SKIP. Run locally before each deploy:
 *   pnpm vitest run src/lib/__tests__/related-churches-reciprocity.test.ts
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

const _here = dirname(fileURLToPath(import.meta.url));
try {
  const { loadLocalEnv } = await import(
    resolve(_here, "../../../scripts/lib/local-env.mjs") as string
  );
  loadLocalEnv(resolve(_here, "../../.."));
} catch {
  /* no .env.local (CI) → suite skips */
}
const hasDb = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

type Row = {
  slug: string;
  display_score: number | null;
  related_church_slugs: string[] | null;
};

let allChurches: Row[] = [];
let indexable: Row[] = [];
let indexableSet: Set<string> = new Set();
let columnPopulated = 0;

beforeAll(async () => {
  if (!hasDb) return;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "");
  const { INDEXABLE_DISPLAY_SCORE_MIN } = await import("@/lib/content-quality");

  // ONE read — slim columns only.
  allChurches = (await sql.query(
    `SELECT slug, display_score, related_church_slugs
       FROM churches
      WHERE status = 'approved'`,
  )) as Row[];

  indexable = allChurches.filter(
    (r) => r.display_score == null || r.display_score >= INDEXABLE_DISPLAY_SCORE_MIN,
  );
  indexableSet = new Set(indexable.map((r) => r.slug));
  columnPopulated = indexable.filter((r) => (r.related_church_slugs?.length ?? 0) > 0).length;
}, 180_000);

describe.skipIf(!hasDb)("related-churches reciprocity (live Neon)", () => {
  it("column has been backfilled (precondition)", () => {
    expect(indexable.length).toBeGreaterThan(0);
    // If 0 columns populated, the backfill hasn't been run yet — fail with
    // a clear actionable message rather than a cascade of cryptic invariant
    // failures.
    expect(
      columnPopulated,
      "related_church_slugs is empty for all indexable churches — run `npx tsx scripts/backfill-related-churches.ts` first",
    ).toBeGreaterThan(0);
  });

  it("(a) every indexable church EMITS a non-empty related list", () => {
    const empty = indexable.filter((r) => (r.related_church_slugs?.length ?? 0) === 0);
    if (empty.length > 0) {
      // Surface a sample so the diff is actionable, not just a count.
      const sample = empty.slice(0, 10).map((r) => r.slug);
      throw new Error(
        `${empty.length} indexable churches have empty related_church_slugs. Sample: ${sample.join(", ")}`,
      );
    }
    expect(empty.length).toBe(0);
  });

  it("(b) every indexable church RECEIVES >=1 inlink (the reciprocity invariant)", () => {
    const inlinks = new Map<string, number>();
    for (const r of indexable) {
      for (const target of r.related_church_slugs ?? []) {
        inlinks.set(target, (inlinks.get(target) ?? 0) + 1);
      }
    }
    const orphaned = indexable.filter((r) => (inlinks.get(r.slug) ?? 0) === 0);
    if (orphaned.length > 0) {
      const sample = orphaned.slice(0, 10).map((r) => r.slug);
      throw new Error(
        `${orphaned.length} indexable churches RECEIVE 0 inlinks. The reciprocity pass failed for these. Sample: ${sample.join(", ")}`,
      );
    }
    expect(orphaned.length).toBe(0);
  });

  it("(c) emitted slugs are themselves indexable (no internal link to a noindexed page)", () => {
    const violations: Array<{ from: string; toNoindex: string }> = [];
    for (const r of indexable) {
      for (const target of r.related_church_slugs ?? []) {
        if (!indexableSet.has(target)) {
          violations.push({ from: r.slug, toNoindex: target });
          if (violations.length >= 10) break;
        }
      }
      if (violations.length >= 10) break;
    }
    if (violations.length > 0) {
      throw new Error(
        `Found internal links from indexable churches to non-indexable targets: ${JSON.stringify(violations)}`,
      );
    }
    expect(violations.length).toBe(0);
  });
});
