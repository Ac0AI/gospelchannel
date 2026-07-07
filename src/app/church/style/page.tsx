import type { Metadata } from "next";
import { FacetIndexPage } from "@/components/FacetIndexPage";
import { getAllChurchFacetLinks } from "@/lib/church";

export const revalidate = 3600;

const CANONICAL = "https://gospelchannel.com/church/style";
const TITLE = "Browse Churches by Worship Style";
const DESCRIPTION =
  "Use worship style as a church decision route. Compare contemporary, hymns, gospel, acoustic, and liturgical churches, then prove the fit with profiles showing music, videos, and service times.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    type: "website",
    siteName: "GospelChannel",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function StyleIndexPage() {
  const { style } = await getAllChurchFacetLinks();

  return (
    <FacetIndexPage
      eyebrow="Browse by Worship Style"
      titleLead="Churches by"
      titleTail="worship style"
      description={DESCRIPTION}
      basePath="/church/style"
      breadcrumbLabel="By worship style"
      itemNoun="worship styles"
      links={style}
    />
  );
}
