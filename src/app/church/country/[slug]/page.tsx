import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import { getChurchFacetPageData } from "@/lib/church";

export const revalidate = 3600;

const PAGE_SIZE = 48;

type CountryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readPositivePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const loadCountry = cache((slug: string, page: number) =>
  getChurchFacetPageData({ kind: "country", slug, page, pageSize: PAGE_SIZE }),
);

export async function generateMetadata({ params, searchParams }: CountryPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadCountry(slug, page);
  if (!data) return { title: "Not Found" };

  const basePath = `https://gospelchannel.com/church/country/${slug}`;
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

export default async function CountryPage({ params, searchParams }: CountryPageProps) {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadCountry(slug, page);
  if (!data) notFound();

  const { currentPage, totalCount, totalPages, pageItems, label, relatedLinks } = data;
  const basePath = `/church/country/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by Country"
      title={`${label} Churches`}
      description={`Explore worship playlists, live videos, service times, and community pages from churches across ${label}.`}
      basePath={basePath}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      churches={pageItems}
      breadcrumbs={[
        { href: "/church", label: "Churches" },
        { href: basePath, label },
      ]}
      relatedSections={[
        { title: `Cities in ${label}`, links: relatedLinks.city },
        { title: `Worship Styles in ${label}`, links: relatedLinks.style },
        { title: `Denominations in ${label}`, links: relatedLinks.denomination },
      ]}
    />
  );
}
