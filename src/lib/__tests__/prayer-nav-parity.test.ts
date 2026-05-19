/**
 * DEPLOY GATE for the prayerwall simplification. Proves the new prayer-scoped
 * index (buildScopedPrayerIndex / getPrayerNavIndex) resolves EVERY
 * prayer-having slug byte-for-byte identically to the old ~56 MB
 * getPrayerFilterIndex — so no existing prayer page regresses.
 *
 * Intentional divergence (NOT asserted, user-approved): prayerless
 * country/city/church filters resolve in the old full index (→ empty
 * noindex page) but NOT in the prayer-scoped index (→ 404). And
 * countryOptions is intentionally the prayer-only subset (the nav must not
 * offer filters that now 404). We assert new.countryOptions ⊆ old and equals
 * exactly the prayer countries.
 *
 *   pnpm vitest run src/lib/__tests__/prayer-nav-parity.test.ts
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

type FilterOption = { slug: string; label: string };
type Idx = {
  countryLabelBySlug: Record<string, string>;
  cityLabelBySlug: Record<string, string>;
  churchNameBySlug: Record<string, string>;
  countrySlugByChurchSlug: Record<string, string>;
  countryOptions: FilterOption[];
};
const m = {} as {
  buildScopedPrayerIndex: () => Promise<Idx>;
  getPrayerFilterIndex: () => Promise<Idx>;
  getChurchSlugsWithPrayers: () => Promise<Set<string>>;
};

// Live-Neon integration gate: requires a real DB. Loaded from .env.local
// locally (it IS the pre-deploy gate); CI runs vitest WITHOUT DB creds
// (prod creds must not live in CI), so SKIP there rather than fail.
const _here = dirname(fileURLToPath(import.meta.url));
try {
  const { loadLocalEnv } = await import(resolve(_here, "../../../scripts/lib/local-env.mjs") as string);
  loadLocalEnv(resolve(_here, "../../.."));
} catch { /* no .env.local (CI) → hasDb stays false → suite skips */ }
const hasDb = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

beforeAll(async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const { loadLocalEnv } = await import(resolve(here, "../../../scripts/lib/local-env.mjs") as string);
  loadLocalEnv(resolve(here, "../../.."));
  const scoped = await import("@/lib/prayer-scoped-index");
  const pf = await import("@/lib/prayer-filters");
  const prayer = await import("@/lib/prayer");
  Object.assign(m, {
    buildScopedPrayerIndex: scoped.buildScopedPrayerIndex,
    getPrayerFilterIndex: pf.getPrayerFilterIndex,
    getChurchSlugsWithPrayers: prayer.getChurchSlugsWithPrayers,
  });
}, 180_000);

describe.skipIf(!hasDb)("prayer-nav parity: scoped index vs old getPrayerFilterIndex", () => {
  it("every prayer-having slug resolves identically; countryOptions = prayer subset", async () => {
    const [oldI, newI, prayerSlugSet] = await Promise.all([
      m.getPrayerFilterIndex(),
      m.buildScopedPrayerIndex(),
      m.getChurchSlugsWithPrayers(),
    ]);
    const prayerSlugs = [...prayerSlugSet];

    // 1. Every church that HAS prayers: name + countrySlug byte-identical.
    for (const slug of prayerSlugs) {
      if (oldI.churchNameBySlug[slug] === undefined) continue; // orphan: both omit
      expect(newI.churchNameBySlug[slug], `name ${slug}`).toBe(oldI.churchNameBySlug[slug]);
      expect(newI.countrySlugByChurchSlug[slug], `countrySlug ${slug}`).toBe(
        oldI.countrySlugByChurchSlug[slug],
      );
    }

    // 2. For every prayer church's country/city slug, the label matches old.
    const prayerCountrySlugs = new Set<string>();
    for (const slug of prayerSlugs) {
      const cs = newI.countrySlugByChurchSlug[slug];
      if (cs) {
        prayerCountrySlugs.add(cs);
        expect(newI.countryLabelBySlug[cs], `countryLabel ${cs}`).toBe(oldI.countryLabelBySlug[cs]);
      }
    }
    for (const citySlug of Object.keys(newI.cityLabelBySlug)) {
      expect(newI.cityLabelBySlug[citySlug], `cityLabel ${citySlug}`).toBe(
        oldI.cityLabelBySlug[citySlug],
      );
    }

    // 3. countryOptions = exactly the prayer countries, each present+equal in old.
    const newCountrySlugs = new Set(newI.countryOptions.map((o) => o.slug));
    expect(newCountrySlugs).toEqual(prayerCountrySlugs);
    const oldByCountrySlug = new Map(oldI.countryOptions.map((o) => [o.slug, o.label]));
    for (const o of newI.countryOptions) {
      expect(oldByCountrySlug.get(o.slug), `countryOption ${o.slug} in old`).toBe(o.label);
    }
  }, 120_000);
});
