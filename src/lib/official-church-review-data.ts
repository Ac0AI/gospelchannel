import "server-only";
import { unstable_cache } from "next/cache";
import { getSql } from "@/db";
import { CHURCH_INDEX_TAG } from "@/lib/content";
import { parseOfficialChurchReview } from "@/lib/official-church-review";
import { getFirstServiceTimeLabel, sanitizeServiceTimes } from "@/lib/content-quality";
import { rewriteLegacyMediaUrl } from "@/lib/media";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import { resolveChurchPrimaryImage } from "@/lib/church";
import type { ServiceTime } from "@/types/gospel";

type ReviewedChurchRow = {
  slug: string; name: string; description: string; country: string;
  location: string | null; logo: string | null; header_image: string | null;
  cover_image_url: string | null; logo_image_url: string | null;
  sources: unknown; service_times: ServiceTime[] | null;
};

async function loadReviewedChurches(citySlug: string) {
  if (isOfflinePublicBuild()) return [];
  const rows = (await getSql().query(`
    SELECT c.slug, c.name, c.description, c.country, c.location, c.logo,
      c.header_image, e.cover_image_url, e.logo_image_url, e.sources, e.service_times
    FROM churches c
    JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.city_slug = $1 AND c.status = 'approved'
      AND c.directory_ready IS NOT FALSE
      AND e.sources ? 'official_review'
    ORDER BY c.name ASC
    LIMIT 30
  `, [citySlug])) as ReviewedChurchRow[];
  return rows.flatMap((row) => {
    const review = parseOfficialChurchReview(row.sources);
    if (!review) return [];
    return [{
      slug: row.slug,
      name: row.name,
      description: row.description,
      country: row.country,
      location: row.location ?? undefined,
      logo: rewriteLegacyMediaUrl(row.logo || row.logo_image_url),
      updatedAt: review.checkedAt,
      thumbnailUrl: resolveChurchPrimaryImage({ headerImage: row.header_image, coverImageUrl: row.cover_image_url }),
      enrichmentHint: {
        location: review.facts.address!.value,
        serviceTimes: getFirstServiceTimeLabel(sanitizeServiceTimes(row.service_times)) ?? undefined,
      },
      matchReasons: [`Sources checked ${review.checkedAt}`],
    }];
  });
}

export const getOfficiallyReviewedChurches = unstable_cache(
  loadReviewedChurches,
  ["officially-reviewed-city-churches-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);

export type ReviewedCityChurch = Awaited<ReturnType<typeof loadReviewedChurches>>[number];
