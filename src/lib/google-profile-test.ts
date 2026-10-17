// Google profile test, started 2026-10-17.
//
// Google indexes about 8% of church profiles, and the one profile feature tied
// to being indexed is verified music (22% vs 7.4% in a 240-profile sample).
// The test asks whether showing Google fewer thin profiles lifts the rest.
//
// Profiles with music, or with any Google impressions in the 84 days before
// the start, always stay. Of the other indexable profiles, a fixed half chosen
// by a hash of the slug gets a Googlebot-only noindex. The page is identical
// for everyone and every other engine (Bing first) still indexes all of them.
// Read the result at week 8-10; to stop the test, make this return false.
import cohort from "@/data/google-profile-test-2026-10-17.json";

const KEEP_BY_IMPRESSIONS = new Set<string>(cohort.keepByImpressions);

// 32-bit FNV-1a: stable across runtimes, so a profile never switches group.
export function slugHash(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function isGoogleHoldoutProfile(slug: string, hasMusic: boolean): boolean {
  if (hasMusic || KEEP_BY_IMPRESSIONS.has(slug)) return false;
  return slugHash(slug) % 2 === 0;
}
