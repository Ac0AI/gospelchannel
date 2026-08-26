import type { Metadata } from "next";
import { cache } from "react";
import { ChurchProofRouteLandingPage } from "@/components/ChurchProofRouteLandingPage";
import { getChurchIndexPageData } from "@/lib/church";
import { getFreshestChurchUpdatedAtAsync } from "@/lib/content";
import { formatContentFreshness } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PATH = "/church/churches-with-worship-music";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const PAGE_SIZE = 48;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "How do I hear a church's worship before visiting?",
    answer:
      "Start with churches that share their music, then open each church's page for playlists, videos, worship style, service times, and location. Listening first makes it much easier to know whether you'll feel at home in the room.",
  },
  {
    question: "Does worship music mean a church is the right fit?",
    answer:
      "No. The music is one piece. Weigh it alongside service times, location, language, denomination, and kids or youth needs before choosing where to visit.",
  },
  {
    question: "Why use a worship-music list?",
    answer:
      "Many people ask for churches by sound: contemporary, gospel, charismatic, acoustic, Latin, or African worship. This list connects that preference to churches that have published their actual music, rather than a generic style label.",
  },
];

const getPageData = cache(async () =>
  getChurchIndexPageData({
    filters: { hasMusic: true },
    page: 1,
    pageSize: PAGE_SIZE,
  })
);

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();
  const title = "Churches with Worship Music";
  const description =
    totalCount > 0
      ? `${totalCount.toLocaleString("en-US")} churches where you can hear the worship first: playlists, videos, and service times before your first visit.`
      : "Churches where you can hear the worship first: playlists, videos, and service times before your first visit.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: {
      images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
      title,
      description,
      url: CANONICAL,
      type: "website",
      siteName: "GospelChannel",
    },
    twitter: {
      images: ["https://gospelchannel.com/hero-worship.jpg"],
      card: "summary_large_image",
      title,
      description,
    },
    ...(totalCount < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ChurchesWithWorshipMusicPage() {
  const { totalCount, pageItems } = await getPageData();
  const { updatedIso, updatedLabel } = formatContentFreshness(
    await getFreshestChurchUpdatedAtAsync(),
  );

  return (
    <ChurchProofRouteLandingPage
      canonicalPath={PATH}
      eyebrow="Worship music"
      title="Churches with"
      titleAccent="Worship Music"
      description="Churches that share their worship music, for people who want to hear the sound before a first visit."
      answer={`Trying to hear the room before visiting? GospelChannel currently lists ${totalCount.toLocaleString("en-US")} churches that share their worship music. Open any of them for playlists, videos, service times, language, and location.`}
      methodology="This list is based on worship music the churches themselves have published: playlists, music links, and videos. It is not a ranking; look at each church before deciding where to visit."
      count={totalCount}
      churches={pageItems}
      updatedIso={updatedIso}
      updatedLabel={updatedLabel}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/church", label: "Churches" },
        { href: PATH, label: "Churches with worship music" },
      ]}
      faqs={FAQS}
      relatedLinks={[
        { href: "/guides/worship-style-match", label: "Worship style match" },
        { href: "/guides/worship-styles-explained", label: "Worship styles explained" },
        { href: "/church/style", label: "Browse by worship style" },
        { href: "/church?music=1", label: "Open filterable database" },
      ]}
    />
  );
}
