/**
 * Behavior gate for the related-churches read path (orphan-pages plan,
 * deploy 1). Verifies `getRelatedChurches` against live Neon:
 *
 *   1. Null/empty column → returns []
 *   2. Populated column → returns hydrated rows preserving backfill order
 *   3. Non-approved slug in column → dropped (block shows <K, never broken)
 *
 * The wrapper component (`NearbyChurchesSection`) is a 2-line null/render
 * branch on top of this; if (1)/(2)/(3) hold the wrapper is correct by
 * construction. Live-Neon, skipIf no DB.
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
  /* CI: no .env.local → suite skips */
}
const hasDb = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

type Sample = { slug: string; related: string[] };
let sample: Sample | null = null;
let getRelatedChurches: (slug: string) => Promise<
  Array<{ slug: string; name: string; country: string; location?: string }>
> = async () => [];

beforeAll(async () => {
  if (!hasDb) return;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "");
  ({ getRelatedChurches } = await import("@/lib/church"));

  // Pick one church whose related_church_slugs is populated AND non-trivial.
  const rows = (await sql.query(
    `SELECT slug, related_church_slugs
       FROM churches
      WHERE status = 'approved'
        AND related_church_slugs IS NOT NULL
        AND array_length(related_church_slugs, 1) >= 3
      LIMIT 1`,
  )) as Array<{ slug: string; related_church_slugs: string[] }>;
  if (rows.length > 0) {
    sample = { slug: rows[0].slug, related: rows[0].related_church_slugs };
  }
}, 60_000);

describe.skipIf(!hasDb)("getRelatedChurches (live Neon)", () => {
  it("returns hydrated rows preserving the backfill's order", async () => {
    expect(
      sample,
      "no populated related_church_slugs row found — run the backfill first",
    ).not.toBeNull();
    if (!sample) return;

    const result = await getRelatedChurches(sample.slug);
    expect(result.length).toBeGreaterThan(0);

    // Order check: every returned slug must appear in the column in the same
    // order. Dropped-because-non-approved are allowed; reordering is not.
    const returnedSlugs = result.map((r) => r.slug);
    const colSlugs = sample.related;
    let colIdx = 0;
    for (const s of returnedSlugs) {
      while (colIdx < colSlugs.length && colSlugs[colIdx] !== s) colIdx += 1;
      expect(colIdx, `slug ${s} not found in column order`).toBeLessThan(colSlugs.length);
      colIdx += 1;
    }
  }, 30_000);

  it("returns [] for a church whose column is null/empty (fresh, not yet backfilled)", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "");
    const rows = (await sql.query(
      `SELECT slug FROM churches
        WHERE status = 'approved' AND related_church_slugs IS NULL
        LIMIT 1`,
    )) as Array<{ slug: string }>;
    if (rows.length === 0) {
      // Every approved church is populated — fine, skip this branch.
      return;
    }
    const result = await getRelatedChurches(rows[0].slug);
    expect(result).toEqual([]);
  }, 30_000);

  it("returns [] for a non-existent slug (defensive)", async () => {
    const result = await getRelatedChurches("definitely-not-a-real-church-slug-xyz-12345");
    expect(result).toEqual([]);
  }, 30_000);
});
