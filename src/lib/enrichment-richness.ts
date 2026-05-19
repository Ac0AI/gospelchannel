/**
 * Single source of truth for `dataRichnessScore` — the enrichment-substance
 * signal that feeds both the index `enrichmentHint` and `directory_score`
 * (see facet-scoring.ts / getDirectoryScore). Previously duplicated verbatim
 * in church.ts (getEnrichmentMeta + mapEnrichmentMetaRow); extracted so the
 * facet-column backfill computes the identical value (zero-drift) and the
 * two prior copies can't silently diverge.
 *
 * Formula (unchanged): summary >= 80 chars +40, has service times +30,
 * has street address +20, has any social (ig/fb/yt) +10. Max 100.
 */
export type RichnessInputs = {
  summaryLength: number;
  hasServiceTimes: boolean;
  hasStreetAddress: boolean;
  hasSocial: boolean;
};

export function computeDataRichnessScore(input: RichnessInputs): number {
  let score = 0;
  if (input.summaryLength >= 80) score += 40;
  if (input.hasServiceTimes) score += 30;
  if (input.hasStreetAddress) score += 20;
  if (input.hasSocial) score += 10;
  return score;
}
