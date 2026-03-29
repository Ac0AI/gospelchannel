import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";
import { COMPARE_CARDS, TOOL_CARDS } from "@/lib/tooling";

export async function generateMetadata(): Promise<Metadata> {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  return {
    title: "Free Tools to Help You Find the Right Church",
    description:
      `Use GospelChannel's free tools to compare church styles, reduce first-visit uncertainty, and find the right fit across ${churchCountLabel} churches in ${countryCount} countries.`,
    alternates: { canonical: "https://gospelchannel.com/tools" },
  };
}

export default async function ToolsPage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:space-y-12 sm:px-6 sm:py-10 lg:px-8">
      <section className="rounded-[2rem] border border-rose-200/60 bg-gradient-to-br from-espresso to-warm-brown px-6 py-10 text-white shadow-sm sm:px-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Free tools</p>
        <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-5xl">
          Use free tools that help you find the right fit before Sunday
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">
          These tools are built for church seekers, not random spiritual traffic. Use them to reduce uncertainty, compare church lanes, and move straight into relevant church channels across {churchCountLabel} churches in {countryCount} countries.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/tools/church-fit-quiz"
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-white/90"
          >
            Start with the quiz
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
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Core tools for church seekers</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {TOOL_CARDS.map((tool) => (
            <article key={tool.href} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mauve">{tool.eyebrow}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-espresso">{tool.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown">{tool.description}</p>
              <Link
                href={tool.href}
                className="mt-5 inline-flex rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
              >
                Open tool
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Decision guides</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Compare before you visit</h2>
          </div>
          <Link href="/compare" className="text-sm font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep">
            See all compare pages →
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
    </div>
  );
}
