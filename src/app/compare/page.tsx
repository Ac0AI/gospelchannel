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
    <>
      <section className="px-5 pt-14 sm:px-12 sm:pt-16">
        <div className="mx-auto max-w-[1280px]">
          <p className="gc-eyebrow">Side by side</p>
          <h1
            className="mt-3.5 m-0 max-w-[18ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
          >
            Compare worship before your <em className="gc-italic">first visit</em>.
          </h1>
          <p className="mt-5 max-w-[640px] text-lg leading-relaxed text-warm-brown">
            These guides are written for church seekers, not insiders. Reduce uncertainty around style, tradition, and room feel, then move into church channels that match the direction you choose.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/guides/church-fit-quiz"
              className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
            >
              Take the fit quiz
            </Link>
            <Link
              href="/guides"
              className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Browse all guides
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-14 pb-24 sm:px-12 sm:pt-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {COMPARE_CARDS.map((guide, i) => (
            <article
              key={guide.href}
              className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7 shadow-[var(--shadow-sm)]"
            >
              <p className="font-serif text-3xl font-medium italic leading-none text-rose-gold">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-4 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">
                {guide.title}
              </h2>
              <p className="mt-3 text-sm leading-[1.6] text-warm-brown">{guide.description}</p>
              <Link
                href={guide.href}
                className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
              >
                Open guide &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
