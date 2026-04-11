import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import {
  filterChurchDirectory,
  getCountryLinks,
  getDenominationFilterBySlug,
  getStyleLinks,
  paginateChurches,
} from "@/lib/church-directory";
import { getChurchIndexData } from "@/lib/church";

export const revalidate = 3600;

const PAGE_SIZE = 48;

type DenominationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readPositivePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({ params, searchParams }: DenominationPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const filter = getDenominationFilterBySlug(slug);
  if (!filter) return { title: "Not Found" };

  const churches = await getChurchIndexData();
  const matches = filterChurchDirectory(churches, { denominationSlug: slug });
  if (matches.length === 0) return { title: "Not Found" };

  const page = readPositivePage(qs?.page);
  const basePath = `https://gospelchannel.com/church/denomination/${slug}`;
  const title = `${filter.label} Churches, Playlists & Service Times`;
  const description = `Explore ${matches.length.toLocaleString("en-US")} ${filter.label.toLowerCase()} churches. Browse worship playlists, live videos, service times, and community pages on GospelChannel.`;

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

export default async function DenominationPage({ params, searchParams }: DenominationPageProps) {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const filter = getDenominationFilterBySlug(slug);
  if (!filter) notFound();

  const churches = await getChurchIndexData();
  const filtered = filterChurchDirectory(churches, { denominationSlug: slug });
  if (filtered.length === 0) notFound();

  const { currentPage, totalCount, totalPages, pageItems } = paginateChurches(filtered, page, PAGE_SIZE);
  const basePath = `/church/denomination/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by Tradition"
      title={`${filter.label} Churches`}
      description={`Explore churches with ${filter.label.toLowerCase()} roots, playlists, service times, and community pages.`}
      basePath={basePath}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      churches={pageItems}
      breadcrumbs={[
        { href: "/church", label: "Churches" },
        { href: basePath, label: filter.label },
      ]}
      relatedSections={[
        { title: `${filter.label} by Country`, links: getCountryLinks(filtered, 12) },
        { title: `${filter.label} Worship Styles`, links: getStyleLinks(filtered, 8) },
      ]}
    />
  );
}
