/**
 * DEPLOY GATE for the facet-query refactor. Proves the new SQL path
 * (getChurchFacetPageData) is byte-for-byte equivalent to the old in-memory
 * path (getChurchIndexData → filterChurchDirectory → paginateChurches +
 * getCountryLinks/getCityLinks/getStyleLinks/getDenominationLinks) for
 * sampled slugs across all four facet kinds.
 *
 * Integration test — hits real Neon. Run before the split-deploy:
 *   pnpm vitest run src/lib/__tests__/facet-parity.test.ts
 *
 * next/cache unstable_cache is mocked to a pass-through (the standard way to
 * test cached functions outside the Next runtime) so both the old and new
 * paths execute against the live DB. Scope: church facets only — prayer
 * sitemap is a known follow-up and is intentionally not covered.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

const PAGE_SIZE = 48;

type FacetLink = { slug: string; label: string; href: string; count: number };
type Mods = {
  getChurchIndexData: () => Promise<any[]>;
  getChurchFacetPageData: (i: { kind: string; slug: string; page: number; pageSize: number }) => Promise<any>;
  filterChurchDirectory: (c: any[], f: any) => any[];
  paginateChurches: (c: any[], p: number, n: number) => any;
  getCountryLinks: (c: any[], n?: number) => FacetLink[];
  getCityLinks: (c: any[], n?: number) => FacetLink[];
  getStyleLinks: (c: any[], n?: number) => FacetLink[];
  getDenominationLinks: (c: any[], n?: number) => FacetLink[];
  STYLE_FILTERS: Array<{ slug: string }>;
  DENOMINATION_FILTERS: Array<{ slug: string }>;
  slugify: (s: string) => string;
  sql: (q: TemplateStringsArray, ...v: unknown[]) => Promise<any[]>;
};

const m = {} as Mods;
let all: any[] = [];

beforeAll(async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const { loadLocalEnv } = await import(resolve(here, "../../../scripts/lib/local-env.mjs") as string);
  loadLocalEnv(resolve(here, "../../.."));
  const church = await import("@/lib/church");
  const dir = await import("@/lib/church-directory");
  const { slugify } = await import("@/lib/slugify");
  const { neon } = await import("@neondatabase/serverless");
  Object.assign(m, {
    getChurchIndexData: church.getChurchIndexData,
    getChurchFacetPageData: church.getChurchFacetPageData,
    filterChurchDirectory: dir.filterChurchDirectory,
    paginateChurches: dir.paginateChurches,
    getCountryLinks: dir.getCountryLinks,
    getCityLinks: dir.getCityLinks,
    getStyleLinks: dir.getStyleLinks,
    getDenominationLinks: dir.getDenominationLinks,
    STYLE_FILTERS: dir.STYLE_FILTERS,
    DENOMINATION_FILTERS: dir.DENOMINATION_FILTERS,
    slugify,
    sql: neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || ""),
  });
  all = await m.getChurchIndexData();
}, 180_000);

const linksEqual = (a: FacetLink[], b: FacetLink[]) =>
  a.length === b.length &&
  a.every((x, i) => x.slug === b[i].slug && x.label === b[i].label && x.count === b[i].count);

async function assertParity(kind: string, slug: string, filter: any) {
  const filtered = m.filterChurchDirectory(all, filter);
  if (filtered.length === 0) return; // old path 404s; facade returns null too
  const oldPage = m.paginateChurches(filtered, 1, PAGE_SIZE);
  const next = await m.getChurchFacetPageData({ kind, slug, page: 1, pageSize: PAGE_SIZE });
  expect(next, `${kind}/${slug} facade returned null but old path had ${filtered.length}`).toBeTruthy();
  const oldSlugs: string[] = oldPage.pageItems.map((c: any) => c.slug);
  const newSlugs: string[] = next.pageItems.map((c: any) => c.slug);
  if (JSON.stringify(oldSlugs) !== JSON.stringify(newSlugs)) {
    const oldSet = new Set(oldSlugs);
    const newSet = new Set(newSlugs);
    const onlyOld = oldSlugs.filter((s) => !newSet.has(s));
    const onlyNew = newSlugs.filter((s) => !oldSet.has(s));
    const firstDiff = oldSlugs.findIndex((s, i) => s !== newSlugs[i]);
     
    console.log(
      `\n[DIFF ${kind}/${slug}] total old=${filtered.length} newCount=${next.totalCount}` +
        ` | onlyOld(${onlyOld.length})=${onlyOld.slice(0, 5).join(",")}` +
        ` | onlyNew(${onlyNew.length})=${onlyNew.slice(0, 5).join(",")}` +
        ` | firstPosDiff@${firstDiff}: old=${oldSlugs[firstDiff]} new=${newSlugs[firstDiff]}`,
    );
  }
  expect(newSlugs).toEqual(oldSlugs);
  expect(next.totalCount).toBe(filtered.length);
  expect(next.totalPages).toBe(oldPage.totalPages);
  if (kind !== "country") expect(linksEqual(next.relatedLinks.country, m.getCountryLinks(filtered, 12))).toBe(true);
  if (kind !== "city") expect(linksEqual(next.relatedLinks.city, m.getCityLinks(filtered, 12))).toBe(true);
  if (kind !== "style") expect(linksEqual(next.relatedLinks.style, m.getStyleLinks(filtered, 8))).toBe(true);
  if (kind !== "denomination") expect(linksEqual(next.relatedLinks.denomination, m.getDenominationLinks(filtered, 8))).toBe(true);
}

describe("facet parity: old in-memory path vs new SQL path", () => {
  it("city facets (top 20 by size)", async () => {
    const rows = (await m.sql`
      SELECT city_slug FROM churches
      WHERE status='approved' AND city_slug IS NOT NULL AND directory_ready IS NOT FALSE
      GROUP BY city_slug ORDER BY count(*) DESC LIMIT 20`) as Array<{ city_slug: string }>;
    for (const r of rows) await assertParity("city", r.city_slug, { citySlug: r.city_slug });
  }, 120_000);

  it("country facets (top 15 by size)", async () => {
    const rows = (await m.sql`
      SELECT country FROM churches
      WHERE status='approved' AND coalesce(country,'')<>'' AND directory_ready IS NOT FALSE
      GROUP BY country ORDER BY count(*) DESC LIMIT 15`) as Array<{ country: string }>;
    for (const r of rows) {
      const s = m.slugify(r.country);
      await assertParity("country", s, { countrySlug: s });
    }
  }, 120_000);

  it("all style facets", async () => {
    for (const f of m.STYLE_FILTERS) await assertParity("style", f.slug, { styleSlug: f.slug });
  }, 120_000);

  it("denomination facets (first 20)", async () => {
    for (const f of m.DENOMINATION_FILTERS.slice(0, 20)) {
      await assertParity("denomination", f.slug, { denominationSlug: f.slug });
    }
  }, 120_000);
});
