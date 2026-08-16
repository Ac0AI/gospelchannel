import type { Metadata } from "next";
import { cache } from "react";
import { ChurchProofRouteLandingPage } from "@/components/ChurchProofRouteLandingPage";
import { getChurchIndexPageData } from "@/lib/church";
import { getFreshestChurchUpdatedAtAsync } from "@/lib/content";
import { formatContentFreshness } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PATH = "/church/english-speaking-churches";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const PAGE_SIZE = 48;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "How do I find an English-speaking church?",
    answer:
      "Start with English-language details, then narrow by country, city, worship style, denomination, and service time. Language matters because it determines whether you can follow the sermon, ask questions, understand kids check-in, and return without relying on translation.",
  },
  {
    question: "Are English-speaking churches always international churches?",
    answer:
      "No. Some are international congregations, some are local churches with English services, and some are bilingual communities. Use language as the first filter, then read individual profiles for service details and church context.",
  },
  {
    question: "Should expats start with country or language?",
    answer:
      "Use both. Country and city make the Sunday realistic; language makes the visit understandable. A strong shortlist usually combines English-language details with a specific city or country.",
  },
];

const getPageData = cache(async () =>
  getChurchIndexPageData({
    filters: { language: "English" },
    page: 1,
    pageSize: PAGE_SIZE,
  })
);

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();
  const title = "English-Speaking Churches";
  const description =
    totalCount > 0
      ? `${totalCount.toLocaleString("en-US")} English-language church profiles with location, service, worship, tradition, and visitor details.`
      : "English-speaking church profiles with location, service, worship, tradition, and visitor details.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description },
    ...(totalCount < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function EnglishSpeakingChurchesPage() {
  const { totalCount, pageItems } = await getPageData();
  const { updatedIso, updatedLabel } = formatContentFreshness(
    await getFreshestChurchUpdatedAtAsync(),
  );

  return (
    <ChurchProofRouteLandingPage
      canonicalPath={PATH}
      eyebrow="English-language churches"
      title="English-Speaking"
      titleAccent="Churches"
      description="A list of English-language church profiles for people choosing a church they can realistically understand and visit."
      answer={`Looking for an English-speaking church? GospelChannel currently lists ${totalCount.toLocaleString("en-US")} church profiles with published English-language details. Open individual profiles for service times, worship style, location, denomination, and visitor details before Sunday.`}
      methodology="This list is based on published English-language data in church profiles or enrichment data. This is not a ranking; inspect each church profile before deciding where to visit."
      count={totalCount}
      churches={pageItems}
      updatedIso={updatedIso}
      updatedLabel={updatedLabel}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/church", label: "Churches" },
        { href: PATH, label: "English-speaking churches" },
      ]}
      faqs={FAQS}
      relatedLinks={[
        { href: "/church/english-speaking-churches-in-zurich", label: "English-speaking churches in Zurich" },
        { href: "/for/expats", label: "Guide for expats" },
        { href: "/church/country", label: "Browse by country" },
        { href: "/church/city", label: "Browse by city" },
        { href: "/church?language=English", label: "Open filterable database" },
      ]}
    />
  );
}
