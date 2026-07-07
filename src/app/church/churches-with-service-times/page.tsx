import type { Metadata } from "next";
import { cache } from "react";
import { ChurchProofRouteLandingPage } from "@/components/ChurchProofRouteLandingPage";
import { getChurchIndexPageData } from "@/lib/church";

export const dynamic = "force-dynamic";

const PATH = "/church/churches-with-service-times";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const PAGE_SIZE = 48;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "How do I find a church I can visit this Sunday?",
    answer:
      "Start with churches that list public service times, then narrow by city, worship style, language, kids needs, and tradition. A church with a clear Sunday time is easier to turn into a real first visit.",
  },
  {
    question: "Are service times enough to choose a church?",
    answer:
      "No. Service times prove visitability, not fit. Use them as the first practical gate, then inspect worship style, location, language, kids or youth cues, and profile evidence before deciding where to go.",
  },
  {
    question: "Why use a service-time proof route?",
    answer:
      "Many church-choice questions become practical only when you can plan the actual Sunday. Service-time proof helps agents and visitors separate general recommendations from churches that can be visited.",
  },
];

const getPageData = cache(async () =>
  getChurchIndexPageData({
    filters: { hasServiceTimes: true },
    page: 1,
    pageSize: PAGE_SIZE,
  })
);

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();
  const title = "Churches with Service Times";
  const description =
    totalCount > 0
      ? `${totalCount.toLocaleString("en-US")} church profiles with public service-time proof, location, worship style, language, and visitor details.`
      : "Church profiles with public service-time proof, location, worship style, language, and visitor details.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description },
    ...(totalCount < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ChurchesWithServiceTimesPage() {
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
      eyebrow="Visit-ready proof route"
      title="Churches with"
      titleAccent="Service Times"
      description="Church profiles with public service-time proof for turning a church search into a realistic Sunday plan."
      answer={`Trying to choose a church you can actually visit? GospelChannel currently surfaces ${totalCount.toLocaleString("en-US")} profiles with service-time signals. Use this page as the visit-ready proof layer, then open individual profiles for location, worship style, language, kids details, and visitor context before Sunday.`}
      methodology="How we chose: churches where the public profile or enrichment data includes service-time evidence. This is a proof route, not a ranking; inspect individual profiles for the current schedule before visiting."
      count={totalCount}
      churches={pageItems}
      updatedIso={updatedIso}
      updatedLabel={updatedLabel}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/church", label: "Churches" },
        { href: PATH, label: "Churches with service times" },
      ]}
      faqs={FAQS}
      relatedLinks={[
        { href: "/guides/first-visit-guide", label: "First visit guide" },
        { href: "/guides/how-to-find-the-right-church", label: "Church-search checklist" },
        { href: "/church/city", label: "Browse by city" },
        { href: "/church?serviceTimes=1", label: "Open filterable database" },
      ]}
    />
  );
}
