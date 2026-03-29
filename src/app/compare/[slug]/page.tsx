import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolActionCard, ToolChurchChips } from "@/components/tools/ToolCards";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { ToolTrackedLink } from "@/components/tools/ToolTrackedLink";
import { getChurchIndexData } from "@/lib/church";
import {
  buildCompareGuide,
  getCompareGuideBySlug,
  getCompareGuideSlugs,
} from "@/lib/tooling";

export const revalidate = 3600;

type CompareGuidePageProps = {
  params: Promise<{ slug: string }>;
};

function buildFaqSchema(guide: NonNullable<ReturnType<typeof buildCompareGuide>>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export async function generateStaticParams() {
  return getCompareGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CompareGuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getCompareGuideBySlug(slug);
  if (!guide) return { title: "Not Found" };

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `https://gospelchannel.com/compare/${slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `https://gospelchannel.com/compare/${slug}`,
      type: "article",
      siteName: "GospelChannel",
    },
  };
}

export default async function CompareGuidePage({ params }: CompareGuidePageProps) {
  const { slug } = await params;
  const guide = buildCompareGuide(slug, await getChurchIndexData());
  if (!guide) notFound();

  const faqSchema = buildFaqSchema(guide);
  const toolName = `compare_${guide.slug}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:space-y-12 sm:px-6 sm:py-10 lg:px-8">
      <ToolPageTracker toolName={toolName} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <nav>
        <Link href="/compare" className="inline-flex items-center gap-1 text-sm font-medium text-rose-gold transition-colors hover:text-rose-gold-deep">
          ← Compare guides
        </Link>
      </nav>

      <section className="rounded-[2rem] border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/45 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Compare guide</p>
        <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight text-espresso sm:text-5xl">{guide.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-warm-brown">{guide.summary}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <article className="rounded-2xl border border-rose-200/60 bg-white/80 p-6 shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-espresso">How to use this guide</h2>
          <p className="mt-3 text-sm leading-relaxed text-warm-brown">{guide.intro}</p>
        </article>
        <aside className="rounded-2xl border border-rose-200/60 bg-white/80 p-6 shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-espresso">Quick direction</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-warm-brown">
            {guide.checklist.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {guide.sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
            <h2 className="font-serif text-xl font-semibold text-espresso">{section.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-brown">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Choose your lane</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Open the side that sounds healthier for you</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {guide.choices.map((choice) => (
            <article key={choice.id} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mauve">{choice.bestFor}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-espresso">{choice.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown">{choice.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <ToolTrackedLink
                  href={choice.browse.href}
                  toolName={toolName}
                  resultType="browse_lane"
                  resultLabel={choice.id}
                  markComplete
                  className="inline-flex rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
                >
                  {choice.browse.label}
                </ToolTrackedLink>
                {choice.secondary ? (
                  <ToolTrackedLink
                    href={choice.secondary.href}
                    toolName={toolName}
                    resultType="browse_lane_secondary"
                    resultLabel={`${choice.id}:secondary`}
                    className="inline-flex rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light"
                  >
                    {choice.secondary.label}
                  </ToolTrackedLink>
                ) : null}
              </div>
              <ToolChurchChips churches={choice.sampleChurches} toolName={toolName} labelPrefix={choice.id} />
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Still unsure?</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Use the quiz instead of guessing</h2>
        </div>
        <ToolActionCard
          eyebrow="Fallback"
          title="Take the Church Fit Quiz"
          description="If both sides sound plausible, use the quiz to turn your Sunday preferences into three concrete church lanes."
          href="/tools/church-fit-quiz"
          label="Take the quiz"
          toolName={toolName}
          resultType="tool"
          resultLabel="church_fit_quiz"
          markComplete
        />
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">FAQ</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Common questions</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {guide.faqs.map((faq) => (
            <article key={faq.question} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
              <h3 className="font-serif text-xl font-semibold text-espresso">{faq.question}</h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
