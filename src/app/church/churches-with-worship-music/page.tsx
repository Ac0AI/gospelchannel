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
      "Start with churches that have music signals on their profile, then open the individual church page for playlists, style tags, videos, service context, and location. Music proof helps you test whether the room will be easy to participate in.",
  },
  {
    question: "Does worship music prove a church is the right fit?",
    answer:
      "No. Worship music is one signal. Use it alongside service times, location, language, denomination, kids or youth needs, and first-visit cues before choosing where to visit.",
  },
  {
    question: "Why use a worship-music proof route?",
    answer:
      "Many people ask for churches by sound: contemporary, gospel, charismatic, acoustic, Latin, or African worship. A music proof route connects that preference to real church profiles rather than a generic style label.",
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
      ? `${totalCount.toLocaleString("en-US")} church profiles with worship music signals, playlists, style tags, service context, and profile proof.`
      : "Church profiles with worship music signals, playlists, style tags, service context, and profile proof.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description },
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
      eyebrow="Worship proof route"
      title="Churches with"
      titleAccent="Worship Music"
      description="Church profiles with worship music proof for people who need to hear the sound before choosing a first visit."
      answer={`Trying to hear the room before visiting? GospelChannel currently surfaces ${totalCount.toLocaleString("en-US")} profiles with worship music signals. Use this page as the music proof layer, then open church profiles for playlists, style tags, videos, service times, language, location, and visitor context.`}
      methodology="How we chose: churches where the public profile includes worship music evidence such as playlists, music links, or related signals. This is a proof route, not a ranking; inspect each church profile before deciding where to visit."
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
