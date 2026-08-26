import type { Metadata } from "next";
import { cache } from "react";
import { ChurchProofRouteLandingPage } from "@/components/ChurchProofRouteLandingPage";
import { getChurchIndexPageData } from "@/lib/church";
import { getFreshestChurchUpdatedAtAsync } from "@/lib/content";
import { formatContentFreshness } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PATH = "/church/family-friendly-churches";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const PAGE_SIZE = 48;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "How do I find a church with kids ministry?",
    answer:
      "Start with profiles that include children or youth ministry details, then check service times, location, visitor details, and the church website before visiting. A family-friendly claim is useful only when there is enough practical information to plan the first Sunday.",
  },
  {
    question: "Does this page rank the best family churches?",
    answer:
      "No. This is not a ranking. It lists churches with published kids or youth ministry details so families can inspect church information before choosing which churches to visit.",
  },
  {
    question: "What should parents check before the first visit?",
    answer:
      "Check service start time, kids check-in details, age groups, whether children stay in the main service, parking or transit friction, language, worship style, and whether the profile has enough current public information to make Sunday predictable.",
  },
];

const getPageData = cache(async () =>
  getChurchIndexPageData({
    filters: { hasKids: true },
    page: 1,
    pageSize: PAGE_SIZE,
  })
);

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();
  const title = "Family-Friendly Churches with Kids Ministry";
  const description =
    totalCount > 0
      ? `${totalCount.toLocaleString("en-US")} church profiles with kids or youth ministry details, service context, location, worship, and visitor details.`
      : "Church profiles with kids or youth ministry details, service context, location, worship, and visitor details.";

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

export default async function FamilyFriendlyChurchesPage() {
  const { totalCount, pageItems } = await getPageData();
  const { updatedIso, updatedLabel } = formatContentFreshness(
    await getFreshestChurchUpdatedAtAsync(),
  );

  return (
    <ChurchProofRouteLandingPage
      canonicalPath={PATH}
      eyebrow="Kids and youth"
      title="Family-Friendly"
      titleAccent="Churches"
      description="A list of church profiles with published kids or youth ministry details for families planning a realistic first Sunday."
      answer={`Looking for a church with kids ministry? GospelChannel currently lists ${totalCount.toLocaleString("en-US")} profiles with kids or youth ministry details. Open church profiles for service times, age-group cues, worship style, location, language, and first-visit details.`}
      methodology="This list is based on published children or youth ministry data in church profiles or enrichment data. This is not a ranking; inspect individual profiles for age groups, service timing, and visitor details before deciding where to visit."
      count={totalCount}
      churches={pageItems}
      updatedIso={updatedIso}
      updatedLabel={updatedLabel}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/church", label: "Churches" },
        { href: PATH, label: "Family-friendly churches" },
      ]}
      faqs={FAQS}
      relatedLinks={[
        { href: "/for/families", label: "Guide for families" },
        { href: "/guides/first-visit-guide", label: "First visit guide" },
        { href: "/church/city", label: "Browse by city" },
        { href: "/church?kids=1", label: "Open filterable database" },
      ]}
    />
  );
}
