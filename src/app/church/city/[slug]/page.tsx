import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import {
  filterChurchDirectory,
  getCityLabelFromSlug,
  getCountryLinks,
  getStyleLinks,
  paginateChurches,
} from "@/lib/church-directory";
import { getChurchIndexData } from "@/lib/church";

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

export async function generateMetadata({ params, searchParams }: CityPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const churches = await getChurchIndexData();
  const cityLabel = getCityLabelFromSlug(churches, slug);
  if (!cityLabel) return { title: "Not Found" };

  const matches = filterChurchDirectory(churches, { citySlug: slug });
  const page = readPositivePage(qs?.page);
  const basePath = `https://gospelchannel.com/church/city/${slug}`;
  const title = `${cityLabel} Churches, Worship Playlists & Service Times`;
  const description = `Explore ${matches.length.toLocaleString("en-US")} churches in ${cityLabel}. Browse worship playlists, live videos, service times, and community pages on GospelChannel.`;

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
  const churches = await getChurchIndexData();
  const cityLabel = getCityLabelFromSlug(churches, slug);
  if (!cityLabel) notFound();

  const filtered = filterChurchDirectory(churches, { citySlug: slug });
  if (filtered.length === 0) notFound();

  const countryLinks = getCountryLinks(filtered, 12);
  const breadcrumbCountry = countryLinks.length === 1 ? countryLinks[0] : null;

  const { currentPage, totalCount, totalPages, pageItems } = paginateChurches(filtered, page, PAGE_SIZE);
  const basePath = `/church/city/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by City"
      title={`${cityLabel} Churches`}
      description={`Explore worship playlists, live videos, service times, and community pages from churches in ${cityLabel}.`}
      basePath={basePath}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      churches={pageItems}
      breadcrumbs={[
        { href: "/church", label: "Churches" },
        ...(breadcrumbCountry ? [{ href: breadcrumbCountry.href, label: breadcrumbCountry.label }] : []),
        { href: basePath, label: cityLabel },
      ]}
      relatedSections={[
        { title: countryLinks.length > 1 ? "Countries" : "Country", links: countryLinks },
        { title: `Worship Styles in ${cityLabel}`, links: getStyleLinks(filtered, 8) },
      ]}
    />
  );
}
