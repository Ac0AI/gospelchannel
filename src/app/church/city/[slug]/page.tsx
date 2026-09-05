import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import { CityChurchFinder } from "@/components/CityChurchFinder";
import { ReviewedCityChurches } from "@/components/ReviewedCityChurches";
import { getChurchFacetPageData } from "@/lib/church";
import { MIN_INDEXABLE_CITY_CHURCHES } from "@/lib/church-directory";
import { getCityFinderData, type CityFinderData } from "@/lib/city-finder-data";
import { getCityPageCopy, getCityGuideLinks } from "@/lib/city-page";
import { buildCityHubContent } from "@/lib/hub-content";
import { getOfficiallyReviewedChurches } from "@/lib/official-church-review-data";

export const revalidate = 3600;

const PAGE_SIZE = 48;

const AUSTIN_AREAS = [
  { id: "central", label: "Central Austin", latitude: 30.2672, longitude: -97.7431 },
  { id: "north", label: "North Austin", latitude: 30.3859, longitude: -97.7281 },
  { id: "south", label: "South Austin", latitude: 30.1738, longitude: -97.823 },
  { id: "east", label: "East Austin", latitude: 30.2621, longitude: -97.6926 },
  { id: "round-rock", label: "Round Rock", latitude: 30.5083, longitude: -97.6789 },
] as const;

type CityPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readPositivePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

// Deduped so generateMetadata + the page render share one DB pass per request.
const loadCity = cache((slug: string, page: number) =>
  getChurchFacetPageData({ kind: "city", slug, page, pageSize: PAGE_SIZE }),
);

async function loadOptionalFinder(slug: string, page: number): Promise<CityFinderData | null> {
  if (slug !== "austin" || page !== 1) return null;
  try {
    return await getCityFinderData(slug);
  } catch (error) {
    console.error("[city-finder] failed to load Austin finder data", error);
    return null;
  }
}

async function loadOptionalReviews(slug: string, page: number) {
  if (slug !== "austin" || page !== 1) return [];
  try {
    return await getOfficiallyReviewedChurches(slug);
  } catch (error) {
    console.error("[city-reviews] failed to load Austin source checks", error);
    return [];
  }
}

export async function generateMetadata({ params, searchParams }: CityPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadCity(slug, page);
  if (!data) return { title: "Not Found" };

  const basePath = `https://gospelchannel.com/church/city/${slug}`;
  const copy = getCityPageCopy({ slug, label: data.label, totalCount: data.totalCount });
  const title = copy.metadataTitle;
  const description = copy.description;

  return {
    title,
    description,
    alternates: { canonical: basePath },
    openGraph: {
      images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
      title,
      description,
      url: basePath,
      type: "website",
      siteName: "GospelChannel",
    },
    twitter: {
      images: ["https://gospelchannel.com/hero-worship.jpg"],
      card: "summary_large_image",
      title,
      description,
    },
    // noindex,follow when paginated OR when the city aggregates too few churches
    // to add value over the church detail pages it lists (kept in lockstep with
    // the sitemap city filter in lib/sitemap-data.ts). follow keeps link equity
    // flowing to the listed churches.
    ...(page > 1 || data.totalCount < MIN_INDEXABLE_CITY_CHURCHES
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export default async function CityPage({ params, searchParams }: CityPageProps) {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const [data, finderData, reviewedChurches] = await Promise.all([
    loadCity(slug, page), loadOptionalFinder(slug, page), loadOptionalReviews(slug, page),
  ]);
  if (!data) notFound();

  const { currentPage, totalCount, totalPages, pageItems, label, relatedLinks, breadcrumbCountry } = data;
  const countryLinks = relatedLinks.country;
  const cityGuideLinks = getCityGuideLinks(slug);
  const basePath = `/church/city/${slug}`;
  const copy = getCityPageCopy({ slug, label, totalCount });
  const hasFinder = Boolean(finderData?.churches.length);

  // Editorial + FAQ only on page 1 (paginated pages are noindex,follow). Woven
  // from this city's real denomination/worship-style mix so each hub is unique.
  const editorial =
    currentPage === 1
      ? buildCityHubContent({
          city: label,
          country: breadcrumbCountry?.label ?? null,
          totalCount,
          denominations: relatedLinks.denomination,
          styles: relatedLinks.style,
          hasLocalFinder: hasFinder,
        })
      : null;

  return (
    <ChurchCollectionPage
      eyebrow={copy.eyebrow}
      title={copy.pageTitle}
      description={copy.description}
      basePath={basePath}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      churches={pageItems}
      breadcrumbs={[
        { href: "/church", label: "Churches" },
        ...(breadcrumbCountry ? [{ href: breadcrumbCountry.href, label: breadcrumbCountry.label }] : []),
        { href: basePath, label },
      ]}
      relatedSections={[
        { title: `${label} Church Guides`, links: cityGuideLinks },
        { title: countryLinks.length > 1 ? "Countries" : "Country", links: countryLinks },
        { title: `Worship Styles in ${label}`, links: relatedLinks.style },
        { title: `Denominations in ${label}`, links: relatedLinks.denomination },
      ]}
      editorial={editorial ?? undefined}
      quickAnswerLead={copy.quickAnswer}
      featuredContent={slug === "austin" && page === 1 ? (
        <>
          {hasFinder && <CityChurchFinder
            city="Austin"
            cityCenter={{ label: "Central Austin", latitude: 30.2672, longitude: -97.7431 }}
            maxLocalDistanceMiles={90}
            churches={finderData!.churches}
            areas={[...AUSTIN_AREAS]}
            styleOptions={finderData!.styleOptions}
            denominationOptions={finderData!.denominationOptions}
            languageOptions={finderData!.languageOptions}
          />}
          <ReviewedCityChurches churches={reviewedChurches} cityName="Austin" />
        </>
      ) : undefined}
    />
  );
}
