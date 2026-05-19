import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import { getChurchFacetPageData } from "@/lib/church";

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
  const title = `${data.label} Churches, Worship Playlists & Service Times`;
  const description = `Explore ${data.totalCount.toLocaleString("en-US")} churches in ${data.label}. Browse worship playlists, live videos, service times, and community pages on GospelChannel.`;

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
    ...(page > 1 ? { robots: { index: false, follow: true } } : {}),
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

  return (
    <ChurchCollectionPage
      eyebrow="Browse by City"
      title={`${label} Churches`}
      description={`Explore worship playlists, live videos, service times, and community pages from churches in ${label}.`}
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
    />
  );
}
