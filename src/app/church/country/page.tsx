import type { Metadata } from "next";
import { FacetIndexPage } from "@/components/FacetIndexPage";
import { getAllChurchFacetLinks } from "@/lib/church";

export const revalidate = 3600;

const CANONICAL = "https://gospelchannel.com/church/country";
const TITLE = "Browse Churches by Country";
const DESCRIPTION =
  "Use country hubs to map the church landscape before choosing a city. Compare regions, worship styles, traditions, service times, and church details across every country we cover.";

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

export default async function CountryIndexPage() {
  const { country } = await getAllChurchFacetLinks();

  return (
    <FacetIndexPage
      eyebrow="Browse by Country"
      titleLead="Churches by"
      titleTail="country"
      description={DESCRIPTION}
      basePath="/church/country"
      breadcrumbLabel="By country"
      itemNoun="countries"
      links={country}
    />
  );
}
