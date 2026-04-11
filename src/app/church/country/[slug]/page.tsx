import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import {
  filterChurchDirectory,
  getCityLinks,
  getCountryLabelFromSlug,
  getStyleLinks,
  paginateChurches,
} from "@/lib/church-directory";
import { getChurchIndexData } from "@/lib/church";

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

export async function generateMetadata({ params, searchParams }: CountryPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const churches = await getChurchIndexData();
  const countryLabel = getCountryLabelFromSlug(churches, slug);
  if (!countryLabel) return { title: "Not Found" };

  const matches = filterChurchDirectory(churches, { countrySlug: slug });
  const page = readPositivePage(qs?.page);
  const basePath = `https://gospelchannel.com/church/country/${slug}`;
  const title = `${countryLabel} Churches, Worship Playlists & Service Times`;
  const description = `Explore ${matches.length.toLocaleString("en-US")} churches in ${countryLabel}. Browse worship playlists, live videos, service times, and community pages on GospelChannel.`;

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
  const churches = await getChurchIndexData();
  const countryLabel = getCountryLabelFromSlug(churches, slug);
  if (!countryLabel) notFound();

  const filtered = filterChurchDirectory(churches, { countrySlug: slug });
  if (filtered.length === 0) notFound();

  const { currentPage, totalCount, totalPages, pageItems } = paginateChurches(filtered, page, PAGE_SIZE);
  const basePath = `/church/country/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by Country"
      title={`${countryLabel} Churches`}
      description={`Explore worship playlists, live videos, service times, and community pages from churches across ${countryLabel}.`}
      basePath={basePath}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      churches={pageItems}
      breadcrumbs={[
        { href: "/church", label: "Churches" },
        { href: basePath, label: countryLabel },
      ]}
      relatedSections={[
        { title: `Cities in ${countryLabel}`, links: getCityLinks(filtered, 12) },
        { title: `Worship Styles in ${countryLabel}`, links: getStyleLinks(filtered, 8) },
      ]}
    />
  );
}
