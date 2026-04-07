import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";
import { COMPARE_CARDS, GUIDE_CARDS } from "@/lib/tooling";

const GUIDE_ICONS: Record<string, React.ReactNode> = {
  church: (
    <svg className="h-8 w-8 text-rose-gold/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 7l5 4v9H7V11l5-4Z" />
      <path d="M10 20v-4h4v4" />
      <path d="M3 20h18" />
      <path d="M9 7V3h6v4" />
    </svg>
  ),
  hands: (
    <svg className="h-8 w-8 text-rose-gold/60" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ),
  book: (
    <svg className="h-8 w-8 text-rose-gold/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h4" />
    </svg>
  ),
};

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
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:space-y-12 sm:px-6 sm:py-10 lg:px-8">
      <section className="rounded-[2rem] border border-rose-200/60 bg-gradient-to-br from-espresso to-warm-brown px-6 py-10 text-white shadow-sm sm:px-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Free guides</p>
        <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-5xl">
          Know what to expect before your first visit
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">
          Step-by-step guides for church seekers. Honest, practical, and written in your language - not church jargon. Across {churchCountLabel} churches in {countryCount} countries.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/guides/first-visit-guide"
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-white/90"
          >
            Read the first-visit guide
          </Link>
          <Link
            href="/compare"
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Compare church styles
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Start here</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Guides for church seekers</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => (
            <article key={guide.href} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
              {guide.icon && GUIDE_ICONS[guide.icon] && (
                <div className="mb-3">{GUIDE_ICONS[guide.icon]}</div>
              )}
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mauve">{guide.eyebrow}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-espresso">{guide.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown">{guide.description}</p>
              <Link
                href={guide.href}
                className="mt-5 inline-flex rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
              >
                Read guide
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Compare</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Compare before you visit</h2>
          </div>
          <Link href="/compare" className="text-sm font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep">
            See all compare guides →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPARE_CARDS.map((guide) => (
            <article key={guide.href} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
              <h3 className="font-serif text-xl font-semibold text-espresso">{guide.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-brown">{guide.description}</p>
              <Link
                href={guide.href}
                className="mt-4 inline-flex rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
              >
                Read guide
              </Link>
            </article>
          ))}
        </div>
      </section>

      {quizzes.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Interactive</p>
            <h2 className="mt-2 font-serif text-xl font-semibold text-espresso sm:text-2xl">Quick-match quizzes</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <article key={quiz.href} className="rounded-2xl border border-rose-200/40 bg-linen-deep/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-warm">{quiz.eyebrow}</p>
                <h3 className="mt-1.5 font-serif text-lg font-semibold text-espresso">{quiz.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-warm-brown">{quiz.description}</p>
                <Link
                  href={quiz.href}
                  className="mt-4 inline-flex rounded-full border border-rose-200/60 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold hover:text-espresso"
                >
                  Take quiz
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
