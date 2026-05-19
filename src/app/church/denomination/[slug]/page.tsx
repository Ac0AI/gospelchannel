import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import { getChurchFacetPageData } from "@/lib/church";

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

const loadDenomination = cache((slug: string, page: number) =>
  getChurchFacetPageData({ kind: "denomination", slug, page, pageSize: PAGE_SIZE }),
);

export async function generateMetadata({ params, searchParams }: DenominationPageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadDenomination(slug, page);
  if (!data) return { title: "Not Found" };

  const basePath = `https://gospelchannel.com/church/denomination/${slug}`;
  const title = `${data.label} Churches, Playlists & Service Times`;
  const description = `Explore ${data.totalCount.toLocaleString("en-US")} ${data.label.toLowerCase()} churches. Browse worship playlists, live videos, service times, and community pages on GospelChannel.`;

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
  const data = await loadDenomination(slug, page);
  if (!data) notFound();

  const { currentPage, totalCount, totalPages, pageItems, label, relatedLinks } = data;
  const basePath = `/church/denomination/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by Tradition"
      title={`${label} Churches`}
      description={`Explore churches with ${label.toLowerCase()} roots, playlists, service times, and community pages.`}
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
        { title: `${label} by Country`, links: relatedLinks.country },
        { title: `${label} by City`, links: relatedLinks.city },
        { title: `${label} Worship Styles`, links: relatedLinks.style },
      ]}
    />
  );
}
