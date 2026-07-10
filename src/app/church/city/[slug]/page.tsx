import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import { getChurchFacetPageData } from "@/lib/church";
import { MIN_INDEXABLE_CITY_CHURCHES } from "@/lib/church-directory";
import { buildCityHubContent } from "@/lib/hub-content";

export const revalidate = 3600;

const PAGE_SIZE = 48;

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

export async function generateMetadata({ params, searchParams }: CityPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadCity(slug, page);
  if (!data) return { title: "Not Found" };

  const basePath = `https://gospelchannel.com/church/city/${slug}`;
  const title = `Churches in ${data.label}: Service Times, Worship & Location`;
  const description = `A list of ${data.totalCount.toLocaleString("en-US")} churches in ${data.label} based on published location, service-time, worship, language, and visitor details.`;

  return {
    title,
    description,
    alternates: { canonical: basePath },
    openGraph: {
      title,
      description,
      url: basePath,
      type: "website",
      siteName: "GospelChannel",
    },
    twitter: {
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
  const data = await loadCity(slug, page);
  if (!data) notFound();

  const { currentPage, totalCount, totalPages, pageItems, label, relatedLinks, breadcrumbCountry } = data;
  const countryLinks = relatedLinks.country;
  const basePath = `/church/city/${slug}`;

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
        })
      : null;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by City"
      title={`${label} Churches`}
      description={`Use ${label} as the practical Sunday decision route, then verify the fit in church profiles with location, service times, worship style, denomination, and visitor cues.`}
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
        { title: countryLinks.length > 1 ? "Countries" : "Country", links: countryLinks },
        { title: `Worship Styles in ${label}`, links: relatedLinks.style },
        { title: `Denominations in ${label}`, links: relatedLinks.denomination },
      ]}
      editorial={editorial ?? undefined}
    />
  );
}
