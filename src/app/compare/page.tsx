import type { Metadata } from "next";
import Link from "next/link";
import { COMPARE_CARDS } from "@/lib/tooling";

export const metadata: Metadata = {
  title: "Compare Church Styles and Traditions",
  description:
    "Compare worship styles, church traditions, and Sunday room feel before your first visit.",
  alternates: { canonical: "https://gospelchannel.com/compare" },
};

export default function CompareHubPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:space-y-12 sm:px-6 sm:py-10 lg:px-8">
      <section className="rounded-[2rem] border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/45 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Compare guides</p>
        <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight text-espresso sm:text-5xl">
          Compare church lanes before your first visit
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-warm-brown">
          These guides are written for church seekers, not insiders. Use them to reduce uncertainty around worship style, tradition, and room feel, then move into church channels that match the direction you choose.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/tools/church-fit-quiz"
            className="rounded-full bg-rose-gold px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
          >
            Take the fit quiz
          </Link>
          <Link
            href="/tools"
            className="rounded-full border border-rose-200/80 px-5 py-3 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light"
          >
            Browse all tools
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {COMPARE_CARDS.map((guide) => (
          <article key={guide.href} className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
            <h2 className="font-serif text-2xl font-semibold text-espresso">{guide.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-brown">{guide.description}</p>
            <Link
              href={guide.href}
              className="mt-4 inline-flex rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              Open guide
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
