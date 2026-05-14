import Link from "next/link";
import type { ForAudienceData } from "@/lib/for-audience-data";

type Props = {
  data: ForAudienceData;
  siblings: Array<{ slug: string; audience_name: string }>;
};

export function ForAudienceLayout({ data, siblings }: Props) {
  return (
    <article className="mx-auto max-w-[1080px] px-5 pb-24 sm:px-12">
      {/* Hero */}
      <section className="pt-14 sm:pt-20">
        <p className="gc-eyebrow">{data.hero_eyebrow}</p>
        <h1
          className="mt-4 max-w-[22ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
          style={{ fontSize: "clamp(40px, 6.5vw, 72px)" }}
        >
          {data.hero_h1}
        </h1>
        <p className="mt-6 max-w-[640px] text-base leading-relaxed text-warm-brown sm:text-lg">
          {data.hero_lede}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/church"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse the directory
          </Link>
          <Link
            href="/church/country"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Browse by country
          </Link>
        </div>
      </section>

      {/* Pains */}
      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.pain_h2}
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          {data.pain_lede}
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {data.pains.map((pain) => (
            <div
              key={pain.title}
              className="rounded-[18px] border border-rose-gold/[0.15] bg-white p-6 sm:p-7"
            >
              <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                {pain.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown sm:text-base">
                {pain.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Solutions */}
      <section className="mt-20">
        <p className="gc-eyebrow">How GospelChannel helps</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.solution_h2}
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          {data.solution_lede}
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {data.solutions.map((solution) => (
            <div
              key={solution.title}
              className="rounded-[18px] border border-rose-gold/[0.15] bg-white p-6 sm:p-7"
            >
              <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                {solution.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown sm:text-base">
                {solution.body}
              </p>
              <Link
                href={solution.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
              >
                {solution.cta} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Curated cards */}
      {data.curated_cards.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
            {data.curated_h2}
          </h2>
          <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
            {data.curated_lede}
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.curated_cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="block rounded-[16px] border border-rose-gold/[0.15] bg-white p-5 transition-colors hover:border-rose-gold/40 hover:bg-rose-gold/[0.03] sm:p-6"
              >
                <h3 className="font-serif text-lg font-semibold tracking-[-0.01em] text-espresso">
                  {card.title}
                </h3>
                {card.subtitle && (
                  <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-muted-warm">
                    {card.subtitle}
                  </p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-warm-brown">
                  {card.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.faq_h2}
        </h2>
        <div className="mt-8 space-y-6">
          {data.faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="font-serif text-lg font-semibold text-espresso">
                {faq.question}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="mt-20 rounded-[24px] border border-rose-gold/[0.18] p-8 sm:p-12"
        style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)" }}
      >
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.cta_h2}
        </h2>
        <p className="mt-3 max-w-[560px] text-base leading-relaxed text-warm-brown">
          {data.cta_lede}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/church"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse the directory
          </Link>
          <Link
            href="/guides/church-fit-quiz"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Take the fit quiz
          </Link>
        </div>
      </section>

      {/* Related links */}
      <section className="mt-16 border-t border-rose-gold/15 pt-10">
        <p className="gc-eyebrow">Keep exploring</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-serif text-base font-semibold text-espresso">Guides</h3>
            <ul className="mt-2 space-y-1.5">
              {data.related_guides.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-warm-brown transition-colors hover:text-rose-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {siblings.length > 0 && (
            <div>
              <h3 className="font-serif text-base font-semibold text-espresso">
                Other audiences
              </h3>
              <ul className="mt-2 space-y-1.5">
                {siblings.map((sibling) => (
                  <li key={sibling.slug}>
                    <Link
                      href={`/for/${sibling.slug}`}
                      className="text-sm text-warm-brown transition-colors hover:text-rose-gold"
                    >
                      For {sibling.audience_name.toLowerCase()}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
