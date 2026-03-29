import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { churchCountLabel } = await getChurchStatsAsync();
  return {
    title: "About GospelChannel",
    description: `GospelChannel helps you find the right church before your first visit by comparing worship style, tradition, language, and service details across ${churchCountLabel} churches.`,
    alternates: { canonical: "https://gospelchannel.com/about" },
  };
}

export default async function AboutPage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:space-y-12 sm:px-6 sm:py-14 lg:px-8">
      <section className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">About</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-espresso sm:text-4xl lg:text-5xl">
          Why Gospel exists
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-warm-brown">
          Finding a church should feel clearer before Sunday. Gospel helps you compare fit first, then tune in to church channels across {churchCountLabel} churches in {countryCount} countries.
        </p>
      </section>

      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/40 p-5 shadow-sm sm:p-8">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Why This Exists</h2>
        <div className="mt-4 space-y-4 text-warm-brown leading-relaxed">
          <p>
            Most people are not looking for a church directory. They are trying to answer a harder question: where will I actually fit? That usually means comparing worship style, tradition, language, service details, and overall room feel before they ever walk through the door.
          </p>
          <p>
            So we built GospelChannel around two layers. The first is fit: helping you choose with more confidence before your first visit. The second is channel: once you are here, you can tune in to a church through playlists, videos, service details, and community signals on one page.
          </p>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-rose-200/60 bg-white/70 p-6 shadow-sm">
          <h3 className="font-serif text-xl font-semibold text-espresso">For Churchgoers</h3>
          <p className="mt-3 text-sm leading-relaxed text-warm-brown">
            New in town? Curious about a different tradition? Start with fit. Compare churches by location, tradition, worship style, and service details before you decide where to go.
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200/60 bg-white/70 p-6 shadow-sm">
          <h3 className="font-serif text-xl font-semibold text-espresso">For Churches</h3>
          <p className="mt-3 text-sm leading-relaxed text-warm-brown">
            Your church already has a page. Claim it to strengthen your channel for first-time visitors with better service details, official links, and clearer signals before they arrive.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/40 p-5 shadow-sm sm:p-8">
        <h2 className="font-serif text-2xl font-semibold text-espresso">How It Works</h2>
        <p className="mt-2 text-sm text-muted-warm">Three steps to finding the right fit before your first visit.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            {
              step: "1. Browse",
              body: "Filter by city, tradition, or worship style. Start by narrowing to churches that look like the right fit.",
              href: "/church",
              cta: "Browse churches",
            },
            {
              step: "2. Listen",
              body: "Tune in to each church channel through music, videos, and service details. Get a feel for the room before you visit.",
              href: "/church",
              cta: "Explore",
            },
            {
              step: "3. Connect",
              body: "Choose with more confidence, visit in person, and help improve pages so the next first-time visitor has fewer unknowns.",
              href: "/church/suggest",
              cta: "Suggest a church",
            },
          ].map((item) => (
            <article
              key={item.step}
              className="rounded-2xl border border-rose-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">{item.step}</p>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown">{item.body}</p>
              <Link
                href={item.href}
                className="mt-4 inline-flex rounded-full border border-blush px-3 py-1.5 text-xs font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="text-center">
        <p className="mx-auto max-w-lg font-serif text-xl italic leading-relaxed text-warm-brown">
          &ldquo;For where two or three gather in my name, there am I with them.&rdquo;
        </p>
        <p className="mt-2 text-sm text-muted-warm">- Matthew 18:20</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/church"
            className="rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-warm-brown hover:shadow-md"
          >
            Browse Churches
          </Link>
          <Link
            href="/church/suggest"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md"
          >
            Suggest a Church
          </Link>
        </div>
      </section>
    </div>
  );
}
