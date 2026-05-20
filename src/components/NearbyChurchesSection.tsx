import { NearbyChurches } from "@/components/NearbyChurches";
import { getRelatedChurches } from "@/lib/church";

type NearbyChurchesSectionProps = {
  churchSlug: string;
};

/**
 * Data wrapper for the related-churches block. Reads the precomputed
 * `related_church_slugs` column via getRelatedChurches (orphan-pages plan,
 * deploy 1, 2026-05-20). No coord gating — the previous lat/long-gated
 * Nearby fetch was the root cause of mass orphaning at 66k scale.
 *
 * Empty/NULL column → renders nothing gracefully (fresh church not yet
 * covered by the nightly backfill). The presentational component is shared
 * with the historical Nearby render; distance is intentionally omitted.
 */
export async function NearbyChurchesSection({ churchSlug }: NearbyChurchesSectionProps) {
  const churches = await getRelatedChurches(churchSlug);
  if (churches.length === 0) return null;

  return <NearbyChurches churches={churches} />;
}
