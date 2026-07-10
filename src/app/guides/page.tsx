import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";
import { COMPARE_CARDS, GUIDE_CARDS } from "@/lib/tooling";
import { buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

const PAGE_URL = "https://gospelchannel.com/guides";
const PAGE_TITLE = "Church Decision Guides to Choose and Verify the Right Church";

const GUIDE_DECISION_PATHS = [
  {
    title: "I just need a direct answer",
    body: "Use the church choice guide for common questions, then explore churches that fit.",
    guide: { href: "/guides/church-choice-answers", label: "Read the guide" },
    proof: { href: "/church", label: "Explore churches" },
  },
  {
    title: "I need a full church-search plan",
    body: "Start with the full guide, then explore churches to turn the plan into a shortlist.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "How to find the right church" },
    proof: { href: "/church", label: "Explore churches" },
  },
  {
    title: "I am choosing a worship sound",
    body: "Use the worship guide for vocabulary, then browse real churches by style.",
    guide: { href: "/guides/worship-styles-explained", label: "Worship styles explained" },
    proof: { href: "/church/style", label: "Browse worship styles" },
  },
  {
    title: "I am choosing a church tradition",
    body: "Compare denomination families in plain language, then inspect matching church profiles.",
    guide: { href: "/guides/denominations-comparison", label: "Denominations compared" },
    proof: { href: "/church/denomination", label: "Browse traditions" },
  },
  {
    title: "I am nervous about a first visit",
    body: "Read the first-visit guide, then prioritize profiles with service details before Sunday.",
    guide: { href: "/guides/first-visit-guide", label: "First-visit guide" },
    proof: { href: "/church/churches-with-service-times", label: "Profiles with service times" },
  },
  {
    title: "I want a faster match",
    body: "Use the quiz or worship match, then check the church details.",
    guide: { href: "/guides/church-fit-quiz", label: "Take the fit quiz" },
    proof: { href: "/church/churches-with-worship-music", label: "Profiles with worship music" },
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  const description = `Decision guides for church seekers: answer the church-choice question, then verify the fit across ${churchCountLabel} profiles in ${countryCount} countries.`;
  return {
    title: PAGE_TITLE,
    description,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: PAGE_TITLE,
      description,
      url: PAGE_URL,
      type: "website",
      siteName: "GospelChannel",
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description,
    },
  };
}

export default async function GuidesPage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();

  const guides = GUIDE_CARDS.filter((g) => !g.href.includes("quiz") && !g.href.includes("match"));
  const quizzes = GUIDE_CARDS.filter((g) => g.href.includes("quiz") || g.href.includes("match"));
  const allGuideItems = [...GUIDE_CARDS, ...COMPARE_CARDS];
  const decisionPathSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${PAGE_URL}#decision-paths`,
    name: "Ways to find your church",
    numberOfItems: GUIDE_DECISION_PATHS.length,
    itemListElement: GUIDE_DECISION_PATHS.map((path, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "HowTo",
        name: path.title,
        description: path.body,
        url: `https://gospelchannel.com${path.guide.href}`,
        about: {
          "@type": "WebPage",
          name: path.guide.label,
          url: `https://gospelchannel.com${path.guide.href}`,
        },
        mentions: {
          "@type": "WebPage",
          name: path.proof.label,
          url: `https://gospelchannel.com${path.proof.href}`,
        },
      },
    })),
  };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: PAGE_TITLE,
      description: `Step-by-step guides for finding the right fit across ${churchCountLabel} churches in ${countryCount} countries, with matching churches for each question.`,
      url: PAGE_URL,
      mainEntity: { "@id": `${PAGE_URL}#itemlist` },
      about: [
        { "@type": "Thing", name: "Church choice" },
        { "@type": "Thing", name: "First church visit" },
        { "@type": "Thing", name: "Worship style matching" },
        { "@type": "Thing", name: "Church tradition comparison" },
      ],
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
      hasPart: [
        { "@id": `${PAGE_URL}#decision-paths` },
        { "@id": `${PAGE_URL}#itemlist` },
      ],
    },
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: "https://gospelchannel.com" },
      { name: "Guides", url: PAGE_URL },
    ]),
    {
      ...buildItemListSchema({
        name: "GospelChannel church choice guides",
        items: allGuideItems.map((item) => ({
          name: item.title,
          url: `https://gospelchannel.com${item.href}`,
        })),
      }),
      "@id": `${PAGE_URL}#itemlist`,
    },
    decisionPathSchema,
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {/* Editorial dark hero */}
      <section className="bg-espresso px-5 py-20 text-linen sm:px-12 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
            Church decision guides
          </p>
          <h1
            className="mt-3.5 m-0 max-w-[20ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-linen"
            style={{ fontSize: "clamp(40px, 7vw, 72px)" }}
          >
            Answer the church question, then <em className="gc-italic">see what fits</em>.
          </h1>
          <p className="mt-5 max-w-[640px] text-lg leading-relaxed text-linen/75 sm:text-xl">
            Start with the decision you need to make: fit, worship, tradition, first visit, or location. Then verify it across {churchCountLabel} churches in {countryCount} countries.
          </p>
          <div className="mt-8 max-w-[860px] border-y border-blush/20 py-7">
            <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>Quick answer</p>
            <p className="mt-3 text-base leading-relaxed text-linen/75 sm:text-lg">
              Use the guides to decide what kind of church to try, then use GospelChannel&rsquo;s church pages to check worship style tags, service details, music, location, and first-visit cues.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/guides/church-choice-answers"
              className="rounded-full bg-linen px-6 py-3 text-sm font-bold text-espresso transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)]"
            >
              Read church choice answers
            </Link>
            <Link
              href="/church"
              className="rounded-full border border-linen/25 px-6 py-3 text-sm font-semibold text-linen transition-colors hover:bg-linen/10"
            >
              Explore churches
            </Link>
          </div>
        </div>
      </section>

      {/* Decision paths */}
      <section className="mx-auto max-w-[1280px] px-5 pt-16 sm:px-12 sm:pt-20">
        <p className="gc-eyebrow">Choose by question</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          Start with the decision you need to make.
        </h2>
        <p className="mt-3 max-w-[760px] text-sm leading-[1.7] text-warm-brown sm:text-base">
          Each guide answers one practical question. Then you can explore churches with the details that matter to you.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_DECISION_PATHS.map((path) => (
            <article key={path.title} className="border-t border-rose-gold/[0.14] pt-4">
              <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                {path.title}
              </h3>
              <p className="mt-2 text-sm leading-[1.6] text-warm-brown">{path.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={path.guide.href}
                  className="inline-flex rounded-full bg-rose-gold px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-gold-deep"
                >
                  {path.guide.label}
                </Link>
                <Link
                  href={path.proof.href}
                  className="inline-flex rounded-full border border-rose-gold/25 px-3.5 py-2 text-xs font-semibold text-warm-brown transition-colors hover:border-rose-gold/45 hover:text-espresso"
                >
                  {path.proof.label}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Start here */}
      <section className="mx-auto max-w-[1280px] px-5 pt-16 sm:px-12 sm:pt-20">
        <p className="gc-eyebrow">Start here</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          Guides for <em className="gc-italic">church seekers</em>.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {guides.map((guide, i) => (
            <article
              key={guide.href}
              className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7 shadow-[var(--shadow-sm)]"
            >
              <p className="font-serif text-3xl font-medium italic leading-none text-rose-gold">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-5 gc-eyebrow">{guide.eyebrow}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">
                {guide.title}
              </h3>
              <p className="mt-3 text-sm leading-[1.6] text-warm-brown">{guide.description}</p>
              <Link
                href={guide.href}
                className="mt-5 inline-flex rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep"
              >
                Read guide &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 sm:px-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="gc-eyebrow">Compare</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
              Compare before you visit.
            </h2>
          </div>
          <Link
            href="/compare"
            className="text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
          >
            See all &rarr;
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {COMPARE_CARDS.map((guide) => (
            <article
              key={guide.href}
              className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7"
            >
              <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                {guide.title}
              </h3>
              <p className="mt-2.5 text-sm leading-[1.6] text-warm-brown">{guide.description}</p>
              <Link
                href={guide.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
              >
                Read guide &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Comparing directories */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 sm:px-12">
        <p className="gc-eyebrow">Comparing directories</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          GospelChannel vs other church-finders.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <article className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7">
            <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
              ChurchFinder.com alternative
            </h3>
            <p className="mt-2.5 text-sm leading-[1.6] text-warm-brown">
              How GospelChannel compares with the largest US directory — what we cover better, where they still win.
            </p>
            <Link
              href="/alternatives/churchfinder"
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
            >
              Read comparison &rarr;
            </Link>
          </article>
          <article className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7">
            <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
              Gospel Coalition alternative
            </h3>
            <p className="mt-2.5 text-sm leading-[1.6] text-warm-brown">
              Why people use GospelChannel alongside The Gospel Coalition — broader than Reformed, music on every profile.
            </p>
            <Link
              href="/alternatives/gospel-coalition"
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
            >
              Read comparison &rarr;
            </Link>
          </article>
          <article className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7">
            <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
              MyChurchFinder alternative
            </h3>
            <p className="mt-2.5 text-sm leading-[1.6] text-warm-brown">
              The music-led, broader-spectrum alternative to MyChurchFinder&rsquo;s 45-point theological grading &ndash; you set the criteria.
            </p>
            <Link
              href="/alternatives/mychurchfinder"
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
            >
              Read comparison &rarr;
            </Link>
          </article>
        </div>
      </section>

      {quizzes.length > 0 && (
        <section className="mx-auto mt-20 max-w-[1280px] px-5 pb-24 sm:px-12">
          <p className="gc-eyebrow">Interactive</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
            Quick-match quizzes.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <article
                key={quiz.href}
                className="rounded-[18px] border border-rose-gold/[0.10] p-7"
                style={{ background: "var(--linen-deep)" }}
              >
                <p className="gc-eyebrow">{quiz.eyebrow}</p>
                <h3 className="mt-2 font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                  {quiz.title}
                </h3>
                <p className="mt-2.5 text-sm leading-[1.6] text-warm-brown">{quiz.description}</p>
                <Link
                  href={quiz.href}
                  className="mt-4 inline-flex rounded-full border border-rose-gold/30 px-5 py-2.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
                >
                  Take quiz &rarr;
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
