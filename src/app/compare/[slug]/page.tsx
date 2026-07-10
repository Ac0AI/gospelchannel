import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GuideHero,
  GuideIllustration,
  GuideQuote,
  GuideCTA,
  GuideWorryCard,
} from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { ToolChurchGrid } from "@/components/tools/ToolCards";
import { getChurchIndexPageData } from "@/lib/church";
import { buildArticleSchema, buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";
import { getCompareGuideBySlug, getCompareGuideContent, toToolChurchPreview } from "@/lib/tooling";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;

type CompareGuidePageProps = {
  params: Promise<{ slug: string }>;
};

type CompareChoice = NonNullable<ReturnType<typeof getCompareGuideBySlug>>["choices"][number];

function getChoiceDirectoryFilters(choice: CompareChoice) {
  const styleSlug = choice.matchRules.find((rule) => rule.styleSlug)?.styleSlug;
  const denominationSlug = choice.matchRules.find((rule) => rule.denominationSlug)?.denominationSlug;

  return {
    styleSlug,
    denominationSlug: styleSlug ? undefined : denominationSlug,
  };
}

export async function generateMetadata({ params }: CompareGuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getCompareGuideBySlug(slug);
  if (!guide) return {};
  const content = getCompareGuideContent(slug);
  const pageUrl = `https://gospelchannel.com/compare/${slug}`;
  const description = content?.intro || guide.description;
  return {
    title: `${guide.title} - Compare Guide`,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: guide.title,
      description,
      url: pageUrl,
      siteName: "GospelChannel",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description,
    },
  };
}

export default async function CompareGuidePage({ params }: CompareGuidePageProps) {
  const { slug } = await params;
  const guide = getCompareGuideBySlug(slug);
  const content = getCompareGuideContent(slug);
  if (!guide || !content) notFound();

  const pageUrl = `https://gospelchannel.com/compare/${slug}`;
  const evidenceGroups = await Promise.all(
    guide.choices.slice(0, 2).map(async (choice) => {
      const page = await getChurchIndexPageData({
        filters: getChoiceDirectoryFilters(choice),
        page: 1,
        pageSize: 3,
      });

      return {
        choice,
        churches: page.pageItems.map(toToolChurchPreview),
      };
    }),
  );
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  const schema = [
    buildArticleSchema({
      url: pageUrl,
      headline: guide.title,
      description: content.intro || guide.description,
      about: [
        "Church choice",
        "Church comparison guide",
        "Church details",
      ],
      mentions: [
        { name: "GospelChannel church profile database", url: "https://gospelchannel.com/church" },
        { name: "Church comparison guides", url: "https://gospelchannel.com/compare" },
      ],
    }),
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: "https://gospelchannel.com" },
      { name: "Compare", url: "https://gospelchannel.com/compare" },
      { name: guide.title, url: pageUrl },
    ]),
    ...evidenceGroups
      .filter((group) => group.churches.length > 0)
      .map((group) =>
        buildItemListSchema({
        name: `${group.choice.title} example churches`,
          items: group.churches.map((church) => ({
          name: church.name,
          url: `https://gospelchannel.com${church.href}`,
        })),
        }),
      ),
    ...(content.faq.length > 0 ? [faqSchema] : []),
  ];

  return (
    <article className="mx-auto max-w-[880px] px-5 pb-24 sm:px-12">
      <ToolPageTracker toolName={`compare_${slug}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      />

      <GuideHero
        eyebrow={content.eyebrow}
        title={content.title}
        intro={content.intro}
      />

      <section className="mt-10 rounded-[18px] border border-rose-gold/[0.14] bg-white p-6 shadow-[var(--shadow-sm)] sm:p-7">
        <p className="gc-eyebrow">Quick answer</p>
        <p className="mt-3 font-serif text-2xl font-semibold leading-snug tracking-[-0.01em] text-espresso">
          {guide.summary}
        </p>
        <ul className="mt-5 space-y-3 text-sm leading-[1.6] text-warm-brown">
          {guide.checklist.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-gold" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {guide.choices.slice(0, 2).map((choice) => (
            <div key={choice.id} className="border-t border-rose-gold/[0.12] pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-warm">
                {choice.title}
              </p>
              <p className="mt-2 text-sm leading-[1.6] text-warm-brown">{choice.bestFor}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                <Link href={choice.browse.href} className="text-rose-gold transition-colors hover:text-rose-gold-deep">
                  {choice.browse.label} &rarr;
                </Link>
                {choice.secondary && (
                  <Link href={choice.secondary.href} className="text-espresso transition-colors hover:text-rose-gold">
                    {choice.secondary.label} &rarr;
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <p className="gc-eyebrow">Churches to explore</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          See how this choice looks in local churches.
        </h2>
        <p className="mt-3 max-w-[680px] text-sm leading-[1.7] text-warm-brown sm:text-base">
          These examples come from the GospelChannel church directory. Use them to explore worship music,
          service details, location, videos, and first-visit information for each church.
        </p>
        <div className="mt-8 space-y-10">
          {evidenceGroups.map((group) => (
            <section key={group.choice.id}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">
                    {group.choice.title}
                  </h3>
                  <p className="mt-1 text-sm leading-[1.6] text-warm-brown">
                    {group.choice.description}
                  </p>
                </div>
                <Link
                  href={group.choice.browse.href}
                  className="text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
                >
                  {group.choice.browse.label} &rarr;
                </Link>
              </div>
              <ToolChurchGrid
                churches={group.churches}
                toolName={`compare_${slug}`}
                labelPrefix={`compare_${slug}_${group.choice.id}`}
              />
            </section>
          ))}
        </div>
      </section>

      <div className="mt-10 space-y-16 sm:mt-12 sm:space-y-20">
        {content.aspects.map((aspect, i) => (
          <section key={aspect.title}>
            <p className="font-serif text-3xl font-medium italic leading-none text-rose-gold">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
              {aspect.title}
            </h2>

            <GuideIllustration src={aspect.illustration} alt={aspect.illustrationAlt} />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-6">
                <p className="gc-eyebrow">{content.labelA}</p>
                <p className="mt-3 text-sm leading-[1.6] text-warm-brown">{aspect.sideA}</p>
              </div>
              <div
                className="rounded-[18px] border border-rose-gold/[0.18] p-6"
                style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.5) 0%, white 70%)" }}
              >
                <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
                  {content.labelB}
                </p>
                <p className="mt-3 text-sm leading-[1.6] text-warm-brown">{aspect.sideB}</p>
              </div>
            </div>

            <p className="mt-5 text-base leading-[1.7] text-warm-brown sm:text-[17px]">
              {aspect.body}
            </p>
          </section>
        ))}
      </div>

      {(content.quoteA || content.quoteB) && (
        <div className="mt-16 space-y-6">
          {content.quoteA && <GuideQuote text={content.quoteA.text} />}
          {content.quoteB && <GuideQuote text={content.quoteB.text} />}
        </div>
      )}

      <p className="mx-auto mt-12 max-w-[640px] text-center font-serif text-xl italic leading-[1.5] text-warm-brown sm:text-2xl">
        {content.nudge}
      </p>

      <div className="mt-10">
        <GuideCTA links={[content.ctaA, content.ctaB]} />
      </div>

      {content.faq.length > 0 && (
        <section className="mt-20">
          <p className="gc-eyebrow text-center">Common questions</p>
          <h3
            className="mt-3 mb-8 text-center font-serif font-semibold tracking-[-0.01em] text-espresso"
            style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
          >
            Before you decide.
          </h3>
          <div>
            {content.faq.map((f) => (
              <GuideWorryCard key={f.question} question={f.question} answer={f.answer} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
