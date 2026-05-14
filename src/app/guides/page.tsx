import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";
import { COMPARE_CARDS, GUIDE_CARDS } from "@/lib/tooling";

export async function generateMetadata(): Promise<Metadata> {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  return {
    title: "Free Guides to Help You Find the Right Church",
    description:
      `Honest, step-by-step guides for church seekers. Reduce first-visit uncertainty and find the right fit across ${churchCountLabel} churches in ${countryCount} countries.`,
    alternates: { canonical: "https://gospelchannel.com/guides" },
  };
}

export default async function GuidesPage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();

  const guides = GUIDE_CARDS.filter((g) => !g.href.includes("quiz") && !g.href.includes("match"));
  const quizzes = GUIDE_CARDS.filter((g) => g.href.includes("quiz") || g.href.includes("match"));

  return (
    <>
      {/* Editorial dark hero */}
      <section className="bg-espresso px-5 py-20 text-linen sm:px-12 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
            Free guides
          </p>
          <h1
            className="mt-3.5 m-0 max-w-[20ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-linen"
            style={{ fontSize: "clamp(40px, 7vw, 72px)" }}
          >
            Know what to expect before your <em className="gc-italic">first visit</em>.
          </h1>
          <p className="mt-5 max-w-[640px] text-lg leading-relaxed text-linen/75 sm:text-xl">
            Step-by-step guides for church seekers. Honest, practical, and written in your language &mdash; not church jargon. Across {churchCountLabel} churches in {countryCount} countries.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/guides/first-visit-guide"
              className="rounded-full bg-linen px-6 py-3 text-sm font-bold text-espresso transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)]"
            >
              Read the first-visit guide
            </Link>
            <Link
              href="/compare"
              className="rounded-full border border-linen/25 px-6 py-3 text-sm font-semibold text-linen transition-colors hover:bg-linen/10"
            >
              Compare church styles
            </Link>
          </div>
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
