import type { Metadata } from "next";
import Link from "next/link";
import { NearbyChurchFinder } from "@/components/NearbyChurchFinder";
import { getChurchStatsAsync } from "@/lib/content";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";

export const revalidate = 3600;

const PAGE_URL = "https://gospelchannel.com/church-near-me";
const META_TITLE = "Church Near Me: Find a Church for This Sunday";
const META_DESCRIPTION =
  "Find churches near you by distance, then compare recorded service times, worship style, denomination, language, kids details, and first-visit information.";

const FAQS = [
  {
    question: "How do I find the best church near me?",
    answer:
      "Start with churches you can realistically reach, then compare the things that shape a real Sunday: current service time, worship style, tradition, language, kids needs, and first-visit details. Best should mean a church you can understand, participate in, and return to, not the church with the most reviews.",
  },
  {
    question: "How do I know whether a nearby church is still active?",
    answer:
      "Treat every directory listing as a starting point. Check the church's official website or social channel for a recent service, current address, and this week's time. If those signals conflict, contact the church before traveling.",
  },
  {
    question: "How can I find a family-friendly church near me?",
    answer:
      "Use the kids or youth filter to find profiles with recorded family details. Before visiting, confirm age groups, check-in timing, accessibility, safeguarding information, and whether children stay in the main service or join a separate program.",
  },
  {
    question: "What should I ask a pastor before joining a church?",
    answer:
      "Ask how the church describes its core beliefs, how pastoral care works, what membership means, how leaders are accountable, how children are safeguarded, and what a healthy next step looks like without pressure.",
  },
  {
    question: "Should ratings decide which church I visit?",
    answer:
      "No. Ratings can reflect hospitality or a single experience, but they do not prove theological fit, healthy leadership, current service details, or whether the church works for your family. Use observable facts to choose a first visit, then judge the community in person.",
  },
  {
    question: "Can AI reliably recommend a church near me?",
    answer:
      "AI can help create a shortlist when it cites current church profiles and official sources. It should not invent service times, pastoral care, doctrine, accessibility, or whether a church is active. Verify those details with the church before you go.",
  },
] as const;

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    url: PAGE_URL,
    siteName: "GospelChannel",
    type: "website",
    images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
  },
  twitter: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    card: "summary_large_image",
    images: ["https://gospelchannel.com/hero-worship.jpg"],
  },
};

function buildPageSchema(churchCountLabel: string, countryCount: number) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: META_TITLE,
      description: META_DESCRIPTION,
      inLanguage: "en",
      isPartOf: { "@id": "https://gospelchannel.com/#website" },
      about: [
        { "@type": "Thing", name: "Church near me" },
        { "@type": "Thing", name: "Church service times" },
        { "@type": "Thing", name: "First church visit" },
      ],
      mainEntity: {
        "@type": "Dataset",
        name: "GospelChannel nearby church profiles",
        description: `Location-searchable church profile data covering ${churchCountLabel} churches across ${countryCount} countries.`,
        creator: { "@id": "https://gospelchannel.com/#organization" },
        isAccessibleForFree: true,
      },
    },
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: "https://gospelchannel.com" },
      { name: "Church near me", url: PAGE_URL },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
}

const SITUATIONS = [
  {
    title: "New to the city or country",
    text: "Prioritize travel time, service language, and a Sunday you can repeat. Then compare worship and tradition.",
    href: "/for/expats",
    label: "Church search for expats",
  },
  {
    title: "Starting university",
    text: "Look beyond the nearest building. Check transit, student community, service time, and whether you can attend consistently.",
    href: "/for/students",
    label: "Church search for students",
  },
  {
    title: "Visiting with children",
    text: "Confirm age groups, check-in, safeguarding, accessibility, and what happens during the main service.",
    href: "/for/families",
    label: "Church search for families",
  },
  {
    title: "Exploring Christianity",
    text: "Choose a church where questions are welcome and the first step is clear. One visit is not a commitment.",
    href: "/for/new-believers",
    label: "A starting point for new believers",
  },
  {
    title: "Returning after a hard season",
    text: "Start with a low-pressure visit. Read visitor details first and do not rush membership or disclosure.",
    href: "/for/deconstructing",
    label: "A lower-pressure church search",
  },
  {
    title: "Changing denomination",
    text: "Compare beliefs, sacraments, governance, and worship before using the denomination label as a filter.",
    href: "/guides/denominations-comparison",
    label: "Compare denominations",
  },
] as const;

export default async function ChurchNearMePage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  const schema = buildPageSchema(churchCountLabel, countryCount);

  return (
    <article className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />

      <header className="mx-auto max-w-[1120px] px-5 pb-10 pt-14 text-center sm:px-12 sm:pb-12 sm:pt-20">
        <p className="gc-eyebrow">GospelChannel · The Church Guide</p>
        <h1 className="mx-auto mt-4 max-w-[15ch] font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.025em] text-espresso sm:text-7xl">
          Find the best church near you for this Sunday.
        </h1>
        <p className="mx-auto mt-6 max-w-[760px] text-base leading-[1.75] text-warm-brown sm:text-lg">
          Start with distance, then compare recorded service times, worship style, church tradition, language, family details, and what to expect before your first visit.
        </p>
        <div className="mx-auto mt-8 max-w-[860px] rounded-[18px] border border-rose-gold/[0.16] bg-white px-6 py-5 text-left shadow-[0_16px_50px_rgba(72,39,24,0.05)] sm:px-8">
          <p className="gc-eyebrow">Quick answer</p>
          <p className="mt-2 text-base font-semibold leading-[1.7] text-espresso sm:text-lg">
            The best church near you is not automatically the most popular one. It is a church you can reach, understand, participate in, and realistically return to. Use proximity to make a shortlist, then verify the current service and official church details before you go.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-5 sm:px-12">
        <NearbyChurchFinder />
      </div>

      <section className="mx-auto max-w-[1040px] px-5 pt-20 sm:px-12 sm:pt-24">
        <p className="gc-eyebrow">How the match works</p>
        <h2 className="mt-3 max-w-[18ch] font-serif text-4xl font-semibold leading-tight tracking-[-0.02em] text-espresso sm:text-5xl">
          Facts first. No paid definition of “best.”
        </h2>
        <p className="mt-5 max-w-[760px] text-base leading-[1.75] text-warm-brown">
          GospelChannel searches mapped profiles in a global directory of {churchCountLabel} churches across {countryCount} countries. The nearby finder orders results by approximate distance. Your filters narrow that list using recorded profile facts.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[20px] border border-rose-gold/[0.14] bg-white p-6 sm:p-8">
            <h3 className="font-serif text-2xl font-semibold text-espresso">What the finder can use</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-warm-brown">
              <li><strong className="text-espresso">Approximate distance:</strong> enough to judge whether Sunday travel is realistic.</li>
              <li><strong className="text-espresso">Recorded profile facts:</strong> service times, worship style, denomination, and language when available.</li>
              <li><strong className="text-espresso">Visit signals:</strong> kids or youth details, first-visit notes, and parking or access notes when recorded.</li>
              <li><strong className="text-espresso">Source routes:</strong> the GospelChannel profile and the church&apos;s official site for final confirmation.</li>
            </ul>
          </div>
          <div className="rounded-[20px] border border-rose-gold/[0.14] bg-linen-deep p-6 sm:p-8">
            <h3 className="font-serif text-2xl font-semibold text-espresso">What the finder does not claim</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-warm-brown">
              <li>It does not score theology, pastoral health, or spiritual quality.</li>
              <li>It does not turn ratings, fame, or payment into a recommendation.</li>
              <li>It does not assume an old listing proves a congregation is active today.</li>
              <li>It does not invent service times, accessibility, family programs, or pastoral care.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1040px] px-5 pt-20 sm:px-12">
        <p className="gc-eyebrow">Before you leave home</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold tracking-[-0.02em] text-espresso sm:text-5xl">
          Turn a nearby result into a real first visit.
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ["1", "Confirm this week's service", "Open the official site or recent social post. Check the date, time, campus, and address."],
            ["2", "Check your practical constraints", "Confirm language, travel time, kids check-in, accessibility, parking, or public transport."],
            ["3", "Read the church's own beliefs", "Use its official statement and denomination sources. Do not infer doctrine from music or reviews."],
            ["4", "Plan a second visit", "If the first Sunday is broadly healthy and workable, return once before making a larger decision."],
          ].map(([number, title, text]) => (
            <li key={number} className="flex gap-4 rounded-[18px] border border-rose-gold/[0.14] bg-white p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-gold text-sm font-bold text-white">{number}</span>
              <div>
                <h3 className="font-serif text-xl font-semibold text-espresso">{title}</h3>
                <p className="mt-2 text-sm leading-[1.7] text-warm-brown">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link href="/guides/first-visit-guide" className="inline-flex min-h-11 items-center rounded-full bg-rose-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep">
            Read the first-visit guide
          </Link>
          <Link href="/guides/how-to-find-the-right-church" className="inline-flex min-h-11 items-center text-sm font-bold text-rose-gold underline decoration-rose-gold/35 underline-offset-4">
            Use the full church-search checklist
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1040px] px-5 pt-20 sm:px-12">
        <p className="gc-eyebrow">Your situation matters</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold tracking-[-0.02em] text-espresso sm:text-5xl">
          Use a different lens when life changes.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SITUATIONS.map((situation) => (
            <article key={situation.title} className="flex h-full flex-col rounded-[18px] border border-rose-gold/[0.14] bg-linen-deep p-6">
              <h3 className="font-serif text-xl font-semibold text-espresso">{situation.title}</h3>
              <p className="mt-3 text-sm leading-[1.7] text-warm-brown">{situation.text}</p>
              <Link href={situation.href} className="mt-auto inline-flex min-h-11 items-end pt-5 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep">
                {situation.label} &rarr;
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-[820px] text-sm leading-[1.75] text-warm-brown">
          Looking for baptism, a wedding church, or pastoral care after a loss? Use the finder for a local shortlist, then contact the church directly. Those needs depend on current staff, preparation requirements, availability, and care practices that a directory cannot safely assume.
        </p>
      </section>

      <section className="mx-auto max-w-[900px] px-5 pt-20 sm:px-12">
        <p className="gc-eyebrow">Church near me FAQ</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold tracking-[-0.02em] text-espresso sm:text-5xl">
          Questions worth answering before Sunday.
        </h2>
        <div className="mt-8 divide-y divide-rose-gold/[0.14] border-y border-rose-gold/[0.14]">
          {FAQS.map((item) => (
            <section key={item.question} className="py-7">
              <h3 className="font-serif text-2xl font-semibold text-espresso">{item.question}</h3>
              <p className="mt-3 text-base leading-[1.75] text-warm-brown">{item.answer}</p>
            </section>
          ))}
        </div>
      </section>
    </article>
  );
}
