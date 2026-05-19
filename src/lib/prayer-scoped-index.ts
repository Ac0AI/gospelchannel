/**
 * ONE prayer-scoped PrayerFilterIndex, shared by the prayer sitemap AND the
 * prayerwall pages. Built over ONLY the ~723 churches/campuses that actually
 * have prayers (1,086 prayers total) instead of getPrayerFilterIndex()'s
 * ~56 MB all-entity (~73k) structure that OOM'd the 128 MB Cloudflare Worker
 * and 503'd both the sitemap chunks and the prayerwall pages.
 *
 * Same `buildPrayerFilterIndex` + same shape → page logic unchanged. Small
 * (<2 MB) so unstable_cache actually caches it cross-isolate (no rebuild
 * storm). Replaces the 4th-and-final copy of the "materialize everything in
 * the Worker" anti-pattern; getPrayerFilterIndex has no remaining consumers
 * after this and can be deleted.
 *
 * In its own module (not prayer-filters.ts) because prayer.ts already imports
 * prayer-filters.ts — colocating here would be a circular import. This is a
 * leaf module: it imports from prayer-filters/content/church-networks/prayer,
 * nothing imports back.
 */
import { unstable_cache } from "next/cache";
import { CHURCH_INDEX_TAG, getChurchDirectorySeedsBySlugs, getApprovedChurchCountries } from "@/lib/content";
import { getAllPublishedCampuses } from "@/lib/church-networks";
import { getChurchSlugsWithPrayers } from "@/lib/prayer";
import { buildPrayerFilterIndex, buildKnownCountrySlugs, type PrayerFilterIndex } from "@/lib/prayer-filters";

export async function buildScopedPrayerIndex(): Promise<PrayerFilterIndex> {
  const prayerSlugs = await getChurchSlugsWithPrayers();
  const slugArr = [...prayerSlugs];
  const [churches, churchCountries, allCampuses] = await Promise.all([
    getChurchDirectorySeedsBySlugs(slugArr),
    getApprovedChurchCountries(),
    getAllPublishedCampuses().catch(() => []),
  ]);
  // Full approved-church+campus known-country set so extractPrayerCity
  // rejects the same "city looks like a country" entries the old full-index
  // path did (DISTINCT countries == full set, it's a Set).
  const knownCountrySlugs = buildKnownCountrySlugs([
    ...churchCountries.map((country) => ({ country })),
    ...allCampuses.map((c) => ({ country: c.country })),
  ]);
  const foundSlugs = new Set(churches.map((c) => c.slug));
  const orphanSet = new Set(slugArr.filter((s) => !foundSlugs.has(s)));
  // Prayer slugs absent from churches are campus slugs — buildPrayerFilterIndex
  // registers campuses too (registerEntity). Same source it uses.
  const campusSeeds: Array<{ slug: string; name: string; city?: string; country?: string }> =
    orphanSet.size > 0
      ? allCampuses
          .filter((c) => orphanSet.has(c.slug))
          .map((c) => ({ slug: c.slug, name: c.name, city: c.city, country: c.country }))
      : [];
  return buildPrayerFilterIndex(churches, campusSeeds, knownCountrySlugs);
}

// Cross-isolate cache for the prayerwall pages (slug→label lookups +
// countryOptions nav). <2 MB so it actually caches. 1 h revalidate +
// CHURCH_INDEX_TAG — same invalidation contract the old getPrayerFilterIndex
// had. The sitemap calls buildScopedPrayerIndex() directly (it has its own
// outer unstable_cache wrapper).
export const getPrayerNavIndex = unstable_cache(
  buildScopedPrayerIndex,
  ["prayer-nav-index-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);
