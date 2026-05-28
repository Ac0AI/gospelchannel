import type { Metadata } from "next";
import { FacetIndexPage } from "@/components/FacetIndexPage";
import { getAllChurchFacetLinks } from "@/lib/church";

export const revalidate = 3600;

const CANONICAL = "https://gospelchannel.com/church/city";
const TITLE = "Browse Churches by City";
const DESCRIPTION =
  "Find churches by city. Browse worship playlists, live videos, service times, and community pages for congregations in cities around the world.";

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
    />
  );
}
