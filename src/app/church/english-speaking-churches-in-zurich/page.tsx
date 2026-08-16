import type { Metadata } from "next";
import { cache } from "react";
import { ChurchProofRouteLandingPage } from "@/components/ChurchProofRouteLandingPage";
import { getChurchIndexPageData } from "@/lib/church";
import { getFreshestChurchUpdatedAtAsync } from "@/lib/content";
import { formatContentFreshness } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PATH = "/church/english-speaking-churches-in-zurich";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const PAGE_SIZE = 48;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "Are there English-speaking churches in Zurich?",
    answer:
      "Yes. Zurich has international and local churches that publish English as a service language. Some are English-first congregations, while others offer English alongside German or another language.",
  },
  {
    question: "Does every service at these churches use English?",
    answer:
      "Not necessarily. A church can appear here when its published profile includes English, even if only one service, gathering, or ministry uses it. Check the individual church page and official website for the current English service time before visiting.",
  },
  {
    question: "What should I compare before choosing a church in Zurich?",
    answer:
      "Start with the language of the specific service, then compare the venue, Sunday time, worship style, denomination, and visitor information. Some churches use venues in the wider Zurich area, so check the address as well as the church name.",
  },
];

const getPageData = cache(async () =>
  getChurchIndexPageData({
    filters: { citySlug: "zurich", language: "English" },
    page: 1,
    pageSize: PAGE_SIZE,
  })
);

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();
  const title = "English-Speaking Churches in Zurich";
  const description =
    totalCount > 0
      ? `Compare ${totalCount.toLocaleString("en-US")} English-speaking church profiles in Zurich by service details, location, worship style, and tradition.`
      : "Compare English-speaking churches in Zurich by service details, location, worship style, and tradition.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description },
    ...(totalCount < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function EnglishSpeakingChurchesInZurichPage() {
  const { totalCount, pageItems } = await getPageData();
  const { updatedIso, updatedLabel } = formatContentFreshness(
    await getFreshestChurchUpdatedAtAsync(),
  );

  return (
    <ChurchProofRouteLandingPage
      canonicalPath={PATH}
      eyebrow="Zurich church guide"
      title="English-Speaking"
      titleAccent="Churches in Zurich"
      description="English-speaking church profiles in Zurich with service, location, worship, language, and visitor details."
      answer={`Looking for an English-speaking church in Zurich? GospelChannel currently lists ${totalCount.toLocaleString("en-US")} Zurich church profiles whose published language data includes English. Some are English-first; others are multilingual. Compare the details below, then confirm the current English service on the church's official website before visiting.`}
      methodology="This list includes published church profiles whose city field resolves to Zurich and whose church or enrichment language data includes English. English may be one of several languages, and some venues are in the wider Zurich area. This is not a ranking or endorsement."
      count={totalCount}
      churches={pageItems}
      updatedIso={updatedIso}
      updatedLabel={updatedLabel}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/church", label: "Churches" },
        { href: "/church/city/zurich", label: "Zurich" },
        { href: PATH, label: "English-speaking churches in Zurich" },
      ]}
      faqs={FAQS}
      relatedLinks={[
        { href: "/church/city/zurich", label: "All churches in Zurich" },
        { href: "/church/english-speaking-churches", label: "English-speaking churches" },
        { href: "/for/expats", label: "Church guide for expats" },
        { href: "/church?country=Switzerland&language=English", label: "English-language churches in Switzerland" },
      ]}
    />
  );
}
