import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChurchCollectionPage } from "@/components/ChurchCollectionPage";
import { getChurchFacetPageData } from "@/lib/church";

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

const loadStyle = cache((slug: string, page: number) =>
  getChurchFacetPageData({ kind: "style", slug, page, pageSize: PAGE_SIZE }),
);

export async function generateMetadata({ params, searchParams }: StylePageProps): Promise<Metadata> {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadStyle(slug, page);
  if (!data) return { title: "Not Found" };

  const basePath = `https://gospelchannel.com/church/style/${slug}`;
  const title = `${data.label} Churches: Music, Service Times & Locations`;
  const description = `Compare ${data.totalCount.toLocaleString("en-US")} churches with ${data.label.toLowerCase()} worship: playlists, videos, service times, and location. Hear how they worship before your first visit.`;

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
    ...(page > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function StylePage({ params, searchParams }: StylePageProps) {
  const [{ slug }, qs] = await Promise.all([params, searchParams]);
  const page = readPositivePage(qs?.page);
  const data = await loadStyle(slug, page);
  if (!data) notFound();

  const { currentPage, totalCount, totalPages, pageItems, label, relatedLinks } = data;
  const basePath = `/church/style/${slug}`;

  return (
    <ChurchCollectionPage
      eyebrow="Browse by Worship Style"
      title={`${label} Churches`}
      description={`Explore churches with ${label.toLowerCase()} worship, then compare music, videos, service times, location, and community details before visiting.`}
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
        { title: `${label} by Denomination`, links: relatedLinks.denomination },
      ]}
    />
  );
}
