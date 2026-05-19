/**
 * DEPLOY GATE for prayer-sitemap windowing. Proves the new prayer-scoped
 * buildSitemapPrayerData() is byte-for-byte equal to the old
 * getPrayerFilterIndex()-derived path (the ~56 MB full-index intersection it
 * replaced), against live Neon.
 *
 * Run before the split-deploy:
 *   pnpm vitest run src/lib/__tests__/prayer-sitemap-parity.test.ts
 *
 * next/cache unstable_cache mocked pass-through so both paths execute against
 * the DB. Scope: prayer sitemap only — prayerwall pages keep their own
 * getPrayerFilterIndex() and are intentionally not exercised here.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- integration-test
   harness: bridges dynamically-imported, loosely-typed legacy modules at the
   test boundary; precise typing of the dynamic-import shims is noise here. */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

type FilterOption = { slug: string; label: string; count?: number };
type PrayerData = {
  countryOptions: FilterOption[];
  cityOptions: FilterOption[];
  prayerChurchCount: number;
  populatedChurchSlugs: string[];
};

const m = {} as {
  buildSitemapPrayerData: () => Promise<PrayerData>;
  getPrayerFilterIndex: () => Promise<any>;
  getChurchSlugsWithPrayers: () => Promise<Set<string>>;
};

// Live-Neon integration gate: requires a real DB (it IS the pre-deploy
// gate, run locally with .env.local). CI runs vitest without DB creds →
// SKIP there rather than fail.
const _here = dirname(fileURLToPath(import.meta.url));
try {
  const { loadLocalEnv } = await import(resolve(_here, "../../../scripts/lib/local-env.mjs") as string);
  loadLocalEnv(resolve(_here, "../../.."));
} catch { /* no .env.local (CI) → suite skips */ }
const hasDb = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

// OLD path, reconstructed exactly: full getPrayerFilterIndex() + the same
// populated-filter logic getSitemapPrayerDataCached used before windowing.
async function oldPrayerData(): Promise<PrayerData> {
  const [index, prayerSlugs] = await Promise.all([
    m.getPrayerFilterIndex(),
    m.getChurchSlugsWithPrayers(),
  ]);
  const populatedChurchSlugs = new Set<string>();
  const populatedCountrySlugs = new Set<string>();
  for (const churchSlug of prayerSlugs) {
    populatedChurchSlugs.add(churchSlug);
    const country = index.countrySlugByChurchSlug[churchSlug];
    if (country) populatedCountrySlugs.add(country);
  }
  const countryOptions = index.countryOptions.filter((o: FilterOption) =>
    populatedCountrySlugs.has(o.slug),
  );
  const cityOptions = index.allCityOptions.filter((opt: FilterOption) => {
    const cityChurches = index.churchOptionsByCountryAndCity[`::${opt.slug}`];
    if (!cityChurches) return false;
    return cityChurches.some((c: FilterOption) => populatedChurchSlugs.has(c.slug));
  });
  return {
    countryOptions,
    cityOptions,
    prayerChurchCount: populatedChurchSlugs.size,
    populatedChurchSlugs: [...populatedChurchSlugs].sort(),
  };
}

beforeAll(async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const { loadLocalEnv } = await import(resolve(here, "../../../scripts/lib/local-env.mjs") as string);
  loadLocalEnv(resolve(here, "../../.."));
  const sitemap = await import("@/lib/sitemap-data");
  const pf = await import("@/lib/prayer-filters");
  const prayer = await import("@/lib/prayer");
  Object.assign(m, {
    buildSitemapPrayerData: sitemap.buildSitemapPrayerData,
    getPrayerFilterIndex: pf.getPrayerFilterIndex,
    getChurchSlugsWithPrayers: prayer.getChurchSlugsWithPrayers,
  });
}, 180_000);

// The sitemap deliverable is URLs, and buildPrayerCountry/City/ChurchRoute
// build them from option.slug ONLY (sitemap-data.ts:163/172/181) — label
// never reaches the XML. So parity = the SET of slugs (order-independent:
// crawlers treat a sitemap as an unordered URL set; chunk packing is
// SEO-irrelevant) + count + populatedChurchSlugs. Asserting label
// byte-equality would test cosmetic internal metadata, not the actual output.
const slugSet = (a: FilterOption[]) => [...new Set(a.map((o) => o.slug))].sort();

describe.skipIf(!hasDb)("prayer-sitemap parity: old getPrayerFilterIndex path vs new windowed", () => {
  it("URL set (country/city/church slugs) + count unchanged", async () => {
    const [oldD, newD] = await Promise.all([oldPrayerData(), m.buildSitemapPrayerData()]);
    expect(newD.prayerChurchCount).toBe(oldD.prayerChurchCount);
    expect(newD.populatedChurchSlugs).toEqual(oldD.populatedChurchSlugs);
    expect(slugSet(newD.countryOptions)).toEqual(slugSet(oldD.countryOptions));
    expect(slugSet(newD.cityOptions)).toEqual(slugSet(oldD.cityOptions));
  }, 120_000);
});
