import Link from "next/link";
import { ChurchGridFilter } from "@/components/ChurchGridFilter";
import { HomeHero } from "@/components/HomeHero";
import { getPrayers } from "@/lib/prayer";
import { PrayerFeed } from "@/components/PrayerFeed";
import {
  getChurchNamesBySlugsAsync,
  getChurchStatsAsync,
  getHomepageShowcaseChurches,
} from "@/lib/content";
import { getClaimedChurchSlugs } from "@/lib/church";
import { buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;

const TRADITIONS: Array<{ slug: string; name: string; vibe: string; example: string; swatch: string }> = [
  { slug: "pentecostal", name: "Pentecostal", vibe: "Anthemic · raised hands", example: "Hillsong, Bethel", swatch: "#b06a50" },
  { slug: "charismatic", name: "Charismatic", vibe: "Spirit-led · spontaneous", example: "Bethel · Jesus Culture", swatch: "#c08a4f" },
  { slug: "baptist", name: "Baptist", vibe: "Sermon-led · gospel choir", example: "Saddleback", swatch: "#a07050" },
  { slug: "non-denominational", name: "Non-denom", vibe: "Modern · no labels", example: "Elevation, Passion", swatch: "#3a6fb0" },
  { slug: "evangelical", name: "Evangelical", vibe: "Bible-led · contemporary", example: "The Village · Redeemer", swatch: "#6b7a99" },
  { slug: "reformed", name: "Reformed", vibe: "Word-centred · hymns", example: "Grace Community", swatch: "#c89b58" },
];

const TOP_CITIES: Array<{ name: string; country: string; slug: string }> = [
  { name: "London", country: "UK", slug: "london" },
  { name: "New York", country: "US", slug: "new-york" },
  { name: "Austin", country: "US", slug: "austin" },
  { name: "Paris", country: "FR", slug: "paris" },
  { name: "Berlin", country: "DE", slug: "berlin" },
  { name: "Stockholm", country: "SE", slug: "stockholm" },
  { name: "Amsterdam", country: "NL", slug: "amsterdam" },
];

const HOME_DECISION_PATHS = [
  {
    question: "I want a church near me this Sunday.",
    answer: "Start with churches you can reach, then compare recorded service times and the details that shape a first visit.",
    guideHref: "/guides/first-visit-guide",
    guideLabel: "Plan my first visit",
    proofHref: "/church-near-me#nearby-church-finder",
    proofLabel: "Find nearby churches",
  },
  {
    question: "I'm not sure what kind of church is right for me.",
    answer: "Take the Church Fit Quiz to narrow down what matters, then explore churches that match.",
    guideHref: "/guides/church-fit-quiz",
    guideLabel: "Take the Church Fit Quiz",
    proofHref: "/church",
    proofLabel: "Browse all churches",
  },
  {
    question: "Worship style matters most to me.",
    answer: "Find the worship style that feels familiar, then listen to music and explore matching churches.",
    guideHref: "/guides/worship-style-match",
    guideLabel: "Find my worship style",
    proofHref: "/church/churches-with-worship-music",
    proofLabel: "Churches with worship music",
  },
  {
    question: "Tradition or theology matters to me.",
    answer: "Compare denominations in plain language, then explore churches in that tradition.",
    guideHref: "/guides/denominations-comparison",
    guideLabel: "Compare denominations",
    proofHref: "/church/denomination",
    proofLabel: "Browse by denomination",
  },
];

function buildHomeFaqSchema(churchCountLabel: string, countryCount: number) {
  const questions: Array<{ q: string; a: string }> = [
    {
      q: "What is GospelChannel?",
      a: "GospelChannel is The Church Guide. It helps you find the right church before your first visit by comparing worship style, tradition, language, service times, location, and visitor details before Sunday.",
    },
    {
      q: "Can churches list themselves on GospelChannel?",
      a: "Yes. Churches can suggest a missing page or claim an existing one. A claimed page shows service times, contact information, and details straight from the church itself, which helps first-time visitors feel confident before they arrive.",
    },
    {
      q: "What churches are featured on GospelChannel?",
      a: `GospelChannel features ${churchCountLabel} churches across ${countryCount} countries. Each church page helps you compare worship style, tradition, service times, and community life before your first visit. Anyone can suggest their church to be added.`,
    },
    {
      q: "Is GospelChannel free to browse?",
      a: "Yes. GospelChannel is completely free. Compare churches before your first visit, then hear each one for yourself through its music, videos, and service details.",
    },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    description: `Answers to common questions about GospelChannel, The Church Guide, across ${churchCountLabel} churches in ${countryCount} countries.`,
    mainEntity: questions.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      text: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function buildHomeSchema(churchCountLabel: string, countryCount: number) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "GospelChannel",
      url: "https://gospelchannel.com",
      description: `GospelChannel is The Church Guide, covering ${churchCountLabel} churches across ${countryCount} countries.`,
      potentialAction: {
        "@type": "SearchAction",
        target: "https://gospelchannel.com/church?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
      about: [
        { "@type": "Thing", name: "Church directory" },
        { "@type": "Thing", name: "Church service times and visitor information" },
        { "@type": "Thing", name: "Worship style" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "GospelChannel",
      url: "https://gospelchannel.com",
      description: `GospelChannel is the global church guide for finding the right church across ${churchCountLabel} churches in ${countryCount} countries.`,
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
    },
    buildItemListSchema({
      name: "GospelChannel church search options",
      items: HOME_DECISION_PATHS.map((path) => ({
        name: path.question,
        url: `https://gospelchannel.com${path.guideHref}`,
      })),
    }),
    buildHomeFaqSchema(churchCountLabel, countryCount),
  ];
}

export default async function HomePage() {
  const [showcaseChurches, stats, recentPrayers, claimedSlugs] = await Promise.all([
    getHomepageShowcaseChurches(),
    getChurchStatsAsync(),
    getPrayers({ limit: 5 }),
    getClaimedChurchSlugs(),
  ]);
  const churchCountLabel = stats.churchCountLabel;
  const countryCount = stats.countryCount;
  const homeSchema = buildHomeSchema(churchCountLabel, countryCount);
  const featured = showcaseChurches.slice(0, 48);
  const surpriseSlugs = showcaseChurches.slice(0, 48).map((church) => church.slug);
  const churchNames = await getChurchNamesBySlugsAsync(recentPrayers.map((prayer) => prayer.churchSlug));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeSchema) }} />

      {/* 1. Cinematic full-bleed hero */}
      <HomeHero surpriseSlugs={surpriseSlugs} churchCountLabel={churchCountLabel} />

      {/* 2. Stats strip */}
      <div className="border-y border-rose-gold/[0.12] bg-linen-deep px-5 py-5 text-center sm:px-12">
        <p className="m-0 text-sm tracking-wide text-warm-brown">
          <strong className="font-bold text-espresso">{churchCountLabel}</strong> churches
          <span className="mx-3.5 opacity-40">·</span>
          <strong className="font-bold text-espresso">{countryCount}</strong> countries
          <span className="mx-3.5 opacity-40">·</span>
          Free, no ads, no tracking
        </p>
      </div>

      {/* Find your church */}
      <section className="mx-auto max-w-[1280px] px-5 pt-16 sm:px-12 sm:pt-20">
        <div className="rounded-[28px] border border-rose-gold/[0.16] bg-white p-6 shadow-[0_18px_55px_rgba(72,39,24,0.06)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="gc-eyebrow">Find your church</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-[44px]">
                Start with what matters to you.
              </h2>
              <p className="mt-4 max-w-[520px] text-base leading-relaxed text-warm-brown">
                Choose the part of church life that matters most right now, from worship style and tradition
                to location, language, and service times. We&apos;ll help you explore churches that fit.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["worship style", "location", "tradition", "this Sunday"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-rose-gold/20 bg-linen px-3 py-1 text-xs font-semibold text-warm-brown"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {HOME_DECISION_PATHS.map((path) => (
                <article key={path.question} className="rounded-[18px] border border-rose-gold/[0.14] bg-linen-deep p-5">
                  <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                    {path.question}
                  </h3>
                  <p className="mt-2 text-sm leading-[1.65] text-warm-brown">
                    {path.answer}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={path.guideHref}
                      prefetch={false}
                      className="text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
                    >
                      {path.guideLabel} &rarr;
                    </Link>
                    <Link
                      href={path.proofHref}
                      prefetch={false}
                      className="text-sm font-semibold text-warm-brown transition-colors hover:text-espresso"
                    >
                      {path.proofLabel}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured churches — magazine grid */}
      <section className="mx-auto max-w-[1280px] px-5 pt-20 sm:px-12">
        <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="gc-eyebrow">This week&rsquo;s editorial picks</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-[44px]">
              Featured churches
            </h2>
          </div>
          <Link
            href="/church"
            prefetch={false}
            className="self-start rounded-full border border-rose-gold/30 bg-transparent px-5 py-2.5 text-sm font-semibold text-rose-gold transition-colors hover:bg-rose-gold/[0.06]"
          >
            Browse all {churchCountLabel} &rarr;
          </Link>
        </div>

        <ChurchGridFilter
          churches={featured.map((church) => ({
            slug: church.slug,
            name: church.name,
            description: church.description,
            country: church.country,
            location: church.location,
            logo: church.logo,
            playlistCount: church.playlistCount,
            updatedAt: church.updatedAt,
            musicStyle: church.musicStyle,
            thumbnailUrl: church.thumbnailUrl,
            serviceTimes: undefined,
            enrichmentSummary: undefined,
            verified: claimedSlugs.has(church.slug),
          }))}
          totalCount={stats.churchCount}
        />
      </section>

      {/* 4. Browse by tradition — magazine cards */}
      <section className="mx-auto max-w-[1280px] px-5 pt-20 sm:px-12">
        <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="gc-eyebrow">Or browse by</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-[44px]">
              Tradition
            </h2>
            <p className="mt-2.5 max-w-[460px] text-[15px] text-warm-brown">
              Six ways the same gospel sounds. Pick the one that already feels like home.
            </p>
          </div>
          <Link
            href="/church"
            prefetch={false}
            className="self-start text-sm font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep"
          >
            See all traditions &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
          {TRADITIONS.map((t, i) => (
            <Link
              key={t.slug}
              href={`/church/denomination/${t.slug}`}
              prefetch={false}
              className="group flex flex-col overflow-hidden rounded-[20px] border border-rose-gold/[0.12] bg-white transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(59,42,34,0.10)]"
            >
              <div
                className="relative flex h-[140px] items-end overflow-hidden px-5 pb-3"
                style={{ background: t.swatch }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: "radial-gradient(circle at 75% 30%, rgba(255,255,255,0.18), transparent 55%)" }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-7 -right-3 font-serif text-[200px] font-semibold italic leading-none tracking-[-0.04em] text-white/[0.18]"
                >
                  {t.name[0]}
                </span>
                <span className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-white/95">
                  No. {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="flex flex-1 flex-col px-5 pt-[18px] pb-5">
                <div className="font-serif text-2xl font-semibold leading-[1.1] tracking-[-0.01em] text-espresso">
                  {t.name}
                </div>
                <div className="mt-1.5 font-serif text-sm italic text-warm-brown">{t.vibe}</div>
                <div className="mt-3.5 flex items-baseline justify-between border-t border-rose-gold/10 pt-3">
                  <span className="text-[11px] tracking-wider text-muted-warm">e.g. {t.example}</span>
                  <span className="text-[13px] font-bold text-espresso transition-colors group-hover:text-rose-gold">
                    Browse &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Prayer wall + Cities side-by-side */}
      <section className="mx-auto max-w-[1280px] gap-12 px-5 pt-20 sm:px-12 lg:grid lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="m-0 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
              Prayer Wall
            </h2>
            <Link
              href="/prayerwall"
              prefetch={false}
              className="text-sm font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep"
            >
              See all &rarr;
            </Link>
          </div>
          {recentPrayers.length > 0 ? (
            <PrayerFeed initialPrayers={recentPrayers} churchNames={churchNames} limit={5} showChurch />
          ) : (
            <div className="rounded-[18px] border border-rose-gold/[0.14] bg-white p-6 text-center">
              <p className="text-sm text-warm-brown">No prayers yet &mdash; be the first to share one.</p>
              <Link
                href="/prayerwall"
                prefetch={false}
                className="mt-3 inline-flex rounded-full bg-rose-gold px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
              >
                Share a prayer
              </Link>
            </div>
          )}
        </div>

        <div className="mt-12 lg:mt-0">
          <h2 className="mb-6 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
            By city
          </h2>
          <div className="flex flex-col">
            {TOP_CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/church/city/${city.slug}`}
                prefetch={false}
                className="flex items-baseline justify-between border-b border-rose-gold/[0.12] py-4 transition-colors hover:bg-linen-deep/40"
              >
                <span>
                  <span className="font-serif text-[22px] font-semibold text-espresso">{city.name}</span>
                  <span className="ml-2 text-xs uppercase tracking-wider text-muted-warm">{city.country}</span>
                </span>
                <span className="text-sm text-rose-gold">&rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Browse-by hub links — feed the spine */}
      <section className="mx-auto mt-16 max-w-[1280px] px-5 sm:px-12">
        <p className="gc-eyebrow">More ways to browse</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { href: "/church/country", label: "By country" },
            { href: "/church/style", label: "By worship style" },
            { href: "/church/denomination", label: "By denomination" },
            { href: "/church/city", label: "By city" },
            { href: "/guides", label: "Free guides" },
            { href: "/for/expats", label: "For expats" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="inline-flex rounded-full border border-rose-gold/20 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:bg-rose-gold/[0.04] hover:text-espresso"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      {/* 6. Suggest CTA */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 sm:px-12">
        <div
          className="grid items-center gap-12 rounded-[28px] border border-rose-gold/[0.18] p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]"
          style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)" }}
        >
          <div>
            <p className="gc-eyebrow">For pastors &amp; church leaders</p>
            <h2 className="mt-2.5 mb-3.5 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-[44px]">
              Your church should be here.
            </h2>
            <p className="mb-6 max-w-[480px] text-base leading-relaxed text-warm-brown">
              People are already searching for a church like yours. Add it so the next first-time visitor finds the right info before they walk through your doors.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/church/suggest"
                prefetch={false}
                className="rounded-full bg-rose-gold px-6 py-3.5 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
              >
                Add a church
              </Link>
              <Link
                href="/for-churches"
                prefetch={false}
                className="rounded-full border border-rose-gold/30 bg-transparent px-6 py-3.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
              >
                Claim existing
              </Link>
            </div>
          </div>

          <div className="rounded-[18px] border border-rose-gold/[0.15] bg-white p-7">
            <div className="gc-eyebrow" style={{ color: "var(--muted-warm)" }}>
              What you get
            </div>
            <ul className="mt-3.5 flex list-none flex-col gap-3 p-0">
              {[
                "A premium church page (like the ones you see featured)",
                "Spotify, YouTube & service times in one place",
                "Verified badge once claimed",
                "Free forever — no ads, no tracking",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-espresso">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a50" strokeWidth="2.5" className="shrink-0">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
