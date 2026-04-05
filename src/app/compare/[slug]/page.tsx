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
    <article className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
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

      {content.aspects.map((aspect, i) => (
        <div key={aspect.title}>
          <GuideIllustration src={aspect.illustration} alt={aspect.illustrationAlt} />

          <h2 className="font-serif text-2xl font-bold text-espresso">{aspect.title}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-blush bg-white/80 p-4">
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-mauve">
                {content.labelA}
              </p>
              <p className="text-sm leading-relaxed text-warm-brown">{aspect.sideA}</p>
            </div>
            <div className="rounded-2xl border border-blush bg-white/80 p-4">
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-rose-gold">
                {content.labelB}
              </p>
              <p className="text-sm leading-relaxed text-warm-brown">{aspect.sideB}</p>
            </div>
          </div>

          <p className="mt-4 text-base leading-relaxed text-warm-brown">{aspect.body}</p>

          {i < content.aspects.length - 1 && <div className="my-10 mx-auto h-px w-12 bg-blush" />}
        </div>
      ))}

      {(content.quoteA || content.quoteB) && (
        <div className="my-10 space-y-4">
          {content.quoteA && <GuideQuote text={content.quoteA.text} />}
          {content.quoteB && <GuideQuote text={content.quoteB.text} />}
        </div>
      )}

      <p className="my-8 text-center text-base leading-relaxed text-warm-brown">
        {content.nudge}
      </p>

      <GuideCTA links={[content.ctaA, content.ctaB]} />

      {content.faq.length > 0 && (
        <>
          <div className="my-12 h-px bg-blush" />
          <div className="mb-6 text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
              Common questions
            </p>
          </div>
          {content.faq.map((f) => (
            <GuideWorryCard key={f.question} question={f.question} answer={f.answer} />
          ))}
        </>
      )}
    </article>
  );
}
