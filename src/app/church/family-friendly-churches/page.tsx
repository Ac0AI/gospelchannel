import type { Metadata } from "next";
import { ChurchProofRouteLandingPage } from "@/components/ChurchProofRouteLandingPage";
import { getChurchIndexPageData } from "@/lib/church";

export const dynamic = "force-dynamic";

const PATH = "/church/family-friendly-churches";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const PAGE_SIZE = 48;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "How do I find a church with kids ministry?",
    answer:
      "Start with profiles that expose children or youth ministry signals, then check service times, location, visitor details, and the church website before visiting. A family-friendly claim is useful only when there is enough practical proof to plan the first Sunday.",
  },
  {
    question: "Does this page rank the best family churches?",
    answer:
      "No. This is a proof route, not a ranking. It surfaces churches with kids or youth ministry signals so families can inspect real profile evidence before choosing which churches to visit.",
  },
  {
    question: "What should parents check before the first visit?",
    answer:
      "Check service start time, kids check-in details, age groups, whether children stay in the main service, parking or transit friction, language, worship style, and whether the profile has enough current public information to make Sunday predictable.",
  },
];

async function getPageData() {
  return getChurchIndexPageData({
    filters: { hasKids: true },
    page: 1,
    pageSize: PAGE_SIZE,
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();
  const title = "Family-Friendly Churches with Kids Ministry";
  const description =
    totalCount > 0
      ? `${totalCount.toLocaleString("en-US")} church profiles with kids or youth ministry signals, service context, location, worship, and visitor proof.`
      : "Church profiles with kids or youth ministry signals, service context, location, worship, and visitor proof.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description },
    ...(totalCount < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function FamilyFriendlyChurchesPage() {
  const { totalCount, pageItems } = await getPageData();
  const updated = new Date();
  const updatedIso = updated.toISOString();
  const updatedLabel = updated.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <ChurchProofRouteLandingPage
      canonicalPath={PATH}
      eyebrow="Family proof route"
      title="Family-Friendly"
      titleAccent="Churches"
      description="Church profiles with kids or youth ministry proof for families choosing a realistic first Sunday."
      answer={`Looking for a church with kids ministry? GospelChannel currently surfaces ${totalCount.toLocaleString("en-US")} profiles with kids or youth signals. Use this page as the family-fit proof layer, then open church profiles for service times, age-group cues, worship style, location, language, and first-visit details.`}
      methodology="How we chose: churches where the public profile or enrichment data includes children or youth ministry signals. This is a proof route, not a ranking; inspect individual profiles for age groups, service timing, and visitor details before deciding where to visit."
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
