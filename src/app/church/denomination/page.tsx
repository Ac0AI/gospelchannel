import type { Metadata } from "next";
import { FacetIndexPage } from "@/components/FacetIndexPage";
import { getAllChurchFacetLinks } from "@/lib/church";

export const revalidate = 3600;

const CANONICAL = "https://gospelchannel.com/church/denomination";
const TITLE = "Browse Churches by Denomination";
const DESCRIPTION =
  "Browse churches by denomination, including Baptist, Pentecostal, Lutheran, non-denominational, and other traditions, then compare worship, service times, locations, and church details.";

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

export default async function DenominationIndexPage() {
  const { denomination } = await getAllChurchFacetLinks();

  return (
    <FacetIndexPage
      eyebrow="Browse by Denomination"
      titleLead="Churches by"
      titleTail="denomination"
      description={DESCRIPTION}
      basePath="/church/denomination"
      breadcrumbLabel="By denomination"
      itemNoun="denominations"
      links={denomination}
    />
  );
}
