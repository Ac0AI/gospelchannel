import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";

export const metadata: Metadata = {
  title: "For Churches",
  description:
    "People are looking for a church like yours. They'll hear your worship and watch your sermons before they visit. Claim your free page on GospelChannel.",
  alternates: { canonical: "https://gospelchannel.com/for-churches" },
};

/* ── tiny icon helpers (inline SVGs to avoid deps) ── */
const ClockIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const PinIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const GlobeIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
  </svg>
);
const MusicIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
  </svg>
);
const CheckBadgeIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
  </svg>
);

export default async function ForChurchesPage() {
  const { churchCount, countryCount } = await getChurchStatsAsync();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-10 sm:px-6 lg:px-8">
      {/* ─── Hero ─── */}
      <section className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">For churches</p>
        <h1 className="mx-auto mt-3 max-w-2xl font-serif text-3xl font-semibold leading-tight text-espresso sm:text-5xl">
          People are looking for a church like yours
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-warm-brown sm:text-lg">
          They&apos;ll hear your worship and watch your sermons before they ever visit. Make sure what they find is right. <strong className="text-espresso">Completely free.</strong>
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/church"
            prefetch={false}
            className="rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-warm-brown"
          >
            Find your church
          </Link>
          <Link
            href="/church/suggest"
            prefetch={false}
            className="rounded-full border border-espresso/15 px-6 py-3 text-sm font-semibold text-espresso transition-all duration-200 hover:border-espresso/30 hover:bg-linen-deep/50"
          >
            Submit a missing church
          </Link>
        </div>

        {/* Stats row */}
        <div className="mx-auto mt-10 flex max-w-md justify-center divide-x divide-espresso/10">
          {[
            { value: churchCount, label: "Churches" },
            { value: countryCount, label: "Countries" },
            { value: "Free", label: "To claim" },
          ].map((s) => (
            <div key={s.label} className="flex-1 px-4">
              <p className="font-serif text-2xl font-semibold text-espresso sm:text-3xl">{s.value}</p>
              <p className="mt-0.5 text-xs text-warm-brown/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Before / After ─── */}
      <section>
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Before and after</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
            What visitors see today vs what they could see
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* BEFORE — unclaimed */}
          <div className="relative">
            <span className="absolute -top-3 left-5 z-10 rounded-full bg-gray-400 px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Before
            </span>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
              {/* Bare header — no image */}
              <div className="h-24 rounded-t-2xl bg-gradient-to-br from-gray-200 via-gray-150 to-gray-100 sm:h-32" />
              <div className="space-y-4 p-5 sm:p-6">
                {/* Name — no badge */}
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-300">
                    ?
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-500">Hope Church</p>
                    <p className="text-xs text-gray-300">Unclaimed page</p>
                  </div>
                </div>

                {/* Partial info — some data but gaps */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-sm text-gray-400">
                    <PinIcon /> <span>London, United Kingdom</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-300">
                    <ClockIcon /> <span className="italic">No service times listed</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-300">
                    <GlobeIcon /> <span className="italic">No website linked</span>
                  </div>
                </div>

                {/* No playlists */}
                <div className="flex items-center gap-2.5 text-sm text-gray-300">
                  <MusicIcon /> <span className="italic">No playlists</span>
                </div>

                {/* No description */}
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm italic text-gray-300">
                  No story or description
                </div>

                {/* Outcome */}
                <p className="text-center text-xs text-gray-300">
                  First-time visitors land here with too many unanswered questions
                </p>
              </div>
            </div>
          </div>

          {/* AFTER — claimed & verified */}
          <div className="relative">
            <span className="absolute -top-3 left-5 z-10 rounded-full bg-rose-gold px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              After
            </span>
            <div className="rounded-2xl border border-rose-200/60 bg-white shadow-md ring-1 ring-rose-gold/15">
              {/* Hero header with real image */}
              <div className="relative h-28 overflow-hidden rounded-t-2xl sm:h-36">
                <Image src="/hero-worship.jpg" alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                {/* Name + verified badge */}
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-gold/12 text-xl font-bold text-rose-gold">
                    HC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-espresso">Hope Church London</p>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/12 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                        <CheckBadgeIcon />
                        Verified
                      </span>
                    </div>
                    <p className="text-xs text-warm-brown">London, United Kingdom</p>
                  </div>
                </div>

                {/* Complete info + map link */}
                <div className="space-y-2.5">
                  {[
                    { icon: <ClockIcon />, text: "Sundays 9:30 AM & 11:30 AM" },
                    { icon: <GlobeIcon />, text: "hopechurch.org.uk" },
                  ].map((f) => (
                    <div key={f.text} className="flex items-center gap-2.5 text-sm text-espresso">
                      <span className="text-rose-gold">{f.icon}</span>
                      <span>{f.text}</span>
                    </div>
                  ))}
                </div>

                {/* Mini map link */}
                <div className="flex items-center gap-3 rounded-xl border border-rose-200/40 bg-linen-deep/30 p-3">
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-rose-gold/10">
                    <PinIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-espresso">42 Worship Lane, London SE1</p>
                    <p className="text-xs text-warm-brown/60">Open in Google Maps</p>
                  </div>
                </div>

                {/* Description */}
                <div className="rounded-xl bg-blush-light/40 px-4 py-3 text-sm leading-relaxed text-warm-brown">
                  A welcoming community in the heart of South London. Contemporary worship, verse-by-verse teaching, and real fellowship every Sunday.
                </div>

                {/* Spotify playlists */}
                <div className="rounded-xl border border-rose-200/40 bg-white p-3">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-mauve">Playlists</p>
                  <div className="space-y-2.5">
                    {[
                      { name: "Sunday Worship 2026", tracks: "24 tracks" },
                      { name: "Acoustic Worship", tracks: "18 tracks" },
                      { name: "Youth Night Setlist", tracks: "12 tracks" },
                    ].map((pl) => (
                      <div key={pl.name} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gradient-to-br from-rose-gold/20 to-mauve-light/30">
                          <MusicIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-espresso">{pl.name}</p>
                          <p className="text-xs text-warm-brown/60">{pl.tracks}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verified badge embed preview */}
                <div className="rounded-xl border border-rose-200/40 bg-linen-deep/20 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mauve">Badge for your website</p>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/badges/concept-4-compact-light.svg"
                      alt="GospelChannel Verified badge"
                      width={130}
                      height={36}
                      className="shrink-0"
                    />
                    <p className="text-xs leading-snug text-warm-brown/70">
                      Embed this on your own site so first-time visitors know your page is verified
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How to get started (single section replacing 3 old ones) ─── */}
      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white via-blush-light/20 to-mauve-light/15 p-6 sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Get started</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
            Three steps. Then let your church speak for itself.
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Find or add your church",
              body: "Search for your church. If it's not listed yet, add it with your website and a short description.",
            },
            {
              step: "2",
              title: "Make it yours",
              body: "Claim your page. Add your Spotify playlists, YouTube channel, service times, and anything that shows who you are.",
            },
            {
              step: "3",
              title: "Let people find you",
              body: "Visitors hear your music and watch your sermons before Sunday. They arrive already knowing this is their kind of place.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-gold/12 font-serif text-lg font-semibold text-rose-gold">
                {item.step}
              </span>
              <h3 className="mt-4 font-serif text-lg font-semibold text-espresso">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-brown">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/church"
            className="rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-warm-brown"
          >
            Find your church
          </Link>
          <Link
            href="/church/suggest"
            className="rounded-full border border-espresso/15 px-6 py-3 text-sm font-semibold text-espresso transition-all duration-200 hover:border-espresso/30 hover:bg-linen-deep/50"
          >
            Submit a missing church
          </Link>
        </div>
      </section>
    </div>
  );
}
