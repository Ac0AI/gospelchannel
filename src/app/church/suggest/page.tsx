import type { Metadata } from "next";
import Link from "next/link";
import { SuggestChurchForm } from "@/components/SuggestChurchForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add Your Church",
  description:
    "Give your church a page on GospelChannel. Share your playlist, website, and contact details - and help people discover your community.",
  alternates: { canonical: "https://gospelchannel.com/church/suggest" },
};

export default function SuggestChurchPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Church onboarding</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-espresso sm:text-4xl lg:text-5xl">
          Give your church
          <br />
          <span className="italic text-rose-gold">a home on GospelChannel</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-warm-brown">
          Share your playlist, website, and contact email - and we&apos;ll create a page where people
          can tune in to your church.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Send one strong link",
            body: "A Spotify playlist is the clearest starting signal. You can also send a YouTube playlist or channel.",
          },
          {
            title: "Add real church context",
            body: "Website, city, country, and contact email help us verify that the page points to a real church.",
          },
          {
            title: "Improve discoverability",
            body: "Once listed, your church becomes easier to share, easier to find, and easier to connect with.",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/45 p-5 shadow-sm"
          >
            <h2 className="font-serif text-2xl font-semibold text-espresso">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-brown">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Already in the catalog?</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-espresso">Claim it instead of submitting a duplicate</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-brown">
              If your church already has a page, open it and use the claim flow there. That is the best path for
              corrections and ownership signals.
            </p>
            <Link
              href="/church"
              className="mt-5 inline-flex rounded-full border border-blush px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              Browse church pages
            </Link>
          </div>

          <div className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-blush-light/70 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">What helps approval faster</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-warm-brown">
              <li>Spotify playlist URL</li>
              <li>Official website domain</li>
              <li>Contact email from the church</li>
              <li>City and country</li>
              <li>Short description of the worship sound</li>
            </ul>
          </div>
        </aside>

        <SuggestChurchForm />
      </section>

      <div className="mt-10 text-center">
        <p className="font-serif text-sm italic text-muted-warm">
          &ldquo;For where two or three gather in my name, there am I with them.&rdquo; — Matthew 18:20
        </p>
      </div>
    </div>
  );
}
