import type { Metadata } from "next";
import { FacetIndexPage } from "@/components/FacetIndexPage";
import { getAllChurchFacetLinks } from "@/lib/church";

export const revalidate = 3600;

const CANONICAL = "https://gospelchannel.com/church/city";
const TITLE = "Browse Churches by City";
const DESCRIPTION =
  "Find churches in your city and compare service times, worship style, denomination, and location before choosing where to go on Sunday. Cities around the world.";
const MAX_RENDERED_CITY_LINKS = 500;

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

export default async function CityIndexPage() {
  const { city } = await getAllChurchFacetLinks();

  return (
    <FacetIndexPage
      eyebrow="Browse by City"
      titleLead="Churches by"
      titleTail="city"
      description={DESCRIPTION}
      basePath="/church/city"
      breadcrumbLabel="By city"
      itemNoun="cities"
      links={city}
      maxRenderedLinks={MAX_RENDERED_CITY_LINKS}
    />
  );
}
