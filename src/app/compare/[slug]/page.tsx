import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GuideHero,
  GuideIllustration,
  GuideQuote,
  GuideCTA,
  GuideWorryCard,
} from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { getCompareGuideBySlug, getCompareGuideContent } from "@/lib/tooling";

export const revalidate = 3600;

type CompareGuidePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CompareGuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getCompareGuideBySlug(slug);
  if (!guide) return {};
  const content = getCompareGuideContent(slug);
  return {
    title: `${guide.title} - Compare Guide`,
    description: content?.intro || guide.description,
    alternates: { canonical: `https://gospelchannel.com/compare/${slug}` },
    openGraph: {
      title: guide.title,
      description: content?.intro || guide.description,
      url: `https://gospelchannel.com/compare/${slug}`,
      siteName: "GospelChannel",
      type: "article",
    },
  };
}

export default async function CompareGuidePage({ params }: CompareGuidePageProps) {
  const { slug } = await params;
  const guide = getCompareGuideBySlug(slug);
  const content = getCompareGuideContent(slug);
  if (!guide || !content) notFound();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <article className="mx-auto max-w-[880px] px-5 pb-24 sm:px-12">
      <ToolPageTracker toolName={`compare_${slug}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <GuideHero
        eyebrow={content.eyebrow}
        title={content.title}
        intro={content.intro}
      />

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
