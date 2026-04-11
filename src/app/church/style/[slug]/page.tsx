import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import {
  filterChurchDirectory,
  getCountryLinks,
  getStyleFilterBySlug,
  paginateChurches,
} from "@/lib/church-directory";
import { getChurchIndexData } from "@/lib/church";

export const revalidate = 3600;

const PAGE_SIZE = 48;

type StylePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readPositivePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({ params, searchParams }: StylePageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const filter = getStyleFilterBySlug(slug);
  if (!filter) return { title: "Not Found" };

  const churches = await getChurchIndexData();
  const matches = filterChurchDirectory(churches, { styleSlug: slug });
  if (matches.length === 0) return { title: "Not Found" };

  const page = readPositivePage(qs?.page);
  const basePath = `https://gospelchannel.com/church/style/${slug}`;
  const title = `${filter.seoLabel} Churches, Playlists & Videos`;
  const description = `Explore ${matches.length.toLocaleString("en-US")} ${filter.seoLabel.toLowerCase()} churches. Browse worship playlists, live videos, service times, and community pages on GospelChannel.`;

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

export default async function StylePage({ params, searchParams }: StylePageProps) {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const filter = getStyleFilterBySlug(slug);
  if (!filter) notFound();

  const churches = await getChurchIndexData();
  const filtered = filterChurchDirectory(churches, { styleSlug: slug });
  if (filtered.length === 0) notFound();

  const { currentPage, totalCount, totalPages, pageItems } = paginateChurches(filtered, page, PAGE_SIZE);
  const basePath = `/church/style/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by Worship Style"
      title={`${filter.seoLabel} Churches`}
      description={`Explore churches whose pages reflect ${filter.seoLabel.toLowerCase()} music, playlists, service times, and community.`}
      basePath={basePath}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
      churches={pageItems}
      breadcrumbs={[
        { href: "/church", label: "Churches" },
        { href: basePath, label: filter.seoLabel },
      ]}
      relatedSections={[
        { title: `${filter.seoLabel} by Country`, links: getCountryLinks(filtered, 12) },
      ]}
    />
  );
}
