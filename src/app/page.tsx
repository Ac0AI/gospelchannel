import Link from "next/link";
import { ChurchGridFilter } from "@/components/ChurchGridFilter";
import { HeroSearch } from "@/components/HeroSearch";
import { getPrayers } from "@/lib/prayer";
import { PrayerFeed } from "@/components/PrayerFeed";
import {
  getChurchDirectorySeedAsync,
  getChurchStatsAsync,
  getHomepageShowcaseChurches,
} from "@/lib/content";

export const revalidate = 3600;

function buildHomeFaqSchema(churchCountLabel: string, countryCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is GospelChannel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "GospelChannel helps you find the right church before your first visit. You can compare worship style, tradition, language, service details, and community signals, then tune in to each church's page for a clearer feel before Sunday.",
        },
      },
      {
        "@type": "Question",
        name: "What are the best gospel songs for worship in 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The top gospel worship songs in 2026 include 'Jireh' by Elevation Worship & Maverick City, 'Goodness of God' by Bethel Music, 'Way Maker' by Sinach, 'What A Beautiful Name' by Hillsong Worship, 'Oceans' by Hillsong UNITED, 'Reckless Love' by Cory Asbury, '10,000 Reasons' by Matt Redman, and 'Graves Into Gardens' by Elevation Worship. These songs are among the most played worship songs in churches worldwide.",
        },
      },
      {
        "@type": "Question",
        name: "Can churches list themselves on GospelChannel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Churches can suggest a missing page or claim an existing one. Claimed pages help first-time visitors feel more confident by showing official service details, contact information, and stronger church signals before they arrive.",
        },
      },
      {
        "@type": "Question",
        name: "What churches are featured on GospelChannel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `GospelChannel features ${churchCountLabel} churches across ${countryCount} countries. Each church page helps you compare worship style, tradition, service details, and community signals before your first visit. Anyone can suggest their church to be added.`,
        },
      },
      {
        "@type": "Question",
        name: "Is GospelChannel free to browse?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. GospelChannel is completely free. It helps you compare churches before your first visit, then tune in to each church's page through music, videos, service details, and community context.",
        },
      },
    ],
  };
}

export default async function HomePage() {
  const [showcaseChurches, stats, directorySeed, recentPrayers] = await Promise.all([
    getHomepageShowcaseChurches(),
    getChurchStatsAsync(),
    getChurchDirectorySeedAsync(),
    getPrayers({ limit: 5 }),
  ]);
  const churchCountLabel = stats.churchCountLabel;
  const countryCount = stats.countryCount;
  const homeFaqSchema = buildHomeFaqSchema(churchCountLabel, countryCount);
  const featured = showcaseChurches.slice(0, 24);
  const surpriseSlugs = showcaseChurches.slice(0, 48).map((church) => church.slug);
  const visiblePrayerSlugs = new Set(recentPrayers.map((prayer) => prayer.churchSlug));
  const churchNames = Object.fromEntries(
    directorySeed
      .filter((church) => visiblePrayerSlugs.has(church.slug))
      .map((church) => [church.slug, church.name]),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:space-y-12 sm:px-6 sm:py-10 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqSchema) }} />

      {/* Hero */}
      <section className="text-center">
        <p className="text-sm italic text-warm-brown/80">
          &ldquo;Let everything that has breath praise the Lord.&rdquo;{" "}
          <span className="not-italic">— Psalm 150:6</span>
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl lg:text-5xl">
          Find a church where you&apos;ll fit right in
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-warm-brown">
          Compare worship style, tradition, language, and service details before your first visit.
        </p>
        <div className="mx-auto mt-5 flex justify-center">
          <HeroSearch surpriseSlugs={surpriseSlugs} variant="page" />
        </div>
      </section>

      {/* Use cases — show what you can do */}
      <section className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        <Link
          href="/church?q="
          prefetch={false}
          className="group rounded-2xl border border-rose-200/60 bg-white/70 p-5 text-center transition-all hover:border-rose-300 hover:bg-blush-light/50 hover:shadow-sm"
        >
          <svg className="mx-auto h-8 w-8 text-rose-gold/70 transition-colors group-hover:text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
          </svg>
          <h2 className="mt-3 font-serif text-sm font-semibold text-espresso">Moving somewhere new?</h2>
          <p className="mt-1 text-xs leading-relaxed text-warm-brown">
            Narrow the search before Sunday and find a church that feels like the right fit before you arrive.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
            Browse by city →
          </span>
        </Link>
        <Link
          href="/church"
          prefetch={false}
          className="group rounded-2xl border border-rose-200/60 bg-white/70 p-5 text-center transition-all hover:border-rose-300 hover:bg-blush-light/50 hover:shadow-sm"
        >
          <svg className="mx-auto h-8 w-8 text-rose-gold/70 transition-colors group-hover:text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <h2 className="mt-3 font-serif text-sm font-semibold text-espresso">Traveling this Sunday?</h2>
          <p className="mt-1 text-xs leading-relaxed text-warm-brown">
            Compare service details, worship feel, and location fast so you can choose with confidence on the road.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
            Find nearby →
          </span>
        </Link>
        <Link
          href="/church"
          prefetch={false}
          className="group rounded-2xl border border-rose-200/60 bg-white/70 p-5 text-center transition-all hover:border-rose-300 hover:bg-blush-light/50 hover:shadow-sm"
        >
          <svg className="mx-auto h-8 w-8 text-rose-gold/70 transition-colors group-hover:text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
          <h2 className="mt-3 font-serif text-sm font-semibold text-espresso">Just want to explore?</h2>
          <p className="mt-1 text-xs leading-relaxed text-warm-brown">
            Browse church channels across {countryCount} countries by style, tradition, and city before you choose what to open.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
            Start exploring →
          </span>
        </Link>
      </section>

      {/* Church grid with filter tabs */}
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
        }))}
        totalCount={stats.churchCount}
      />

      {/* Prayer Wall */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-espresso">Prayer Wall</h2>
          <Link href="/prayerwall" prefetch={false} className="text-sm font-semibold text-rose-gold hover:text-rose-gold-deep">
            See all →
          </Link>
        </div>
        {recentPrayers.length > 0 ? (
          <PrayerFeed initialPrayers={recentPrayers} churchNames={churchNames} limit={5} showChurch />
        ) : (
          <div className="rounded-2xl border border-rose-200/60 bg-white/70 p-6 text-center shadow-sm">
            <p className="text-sm text-warm-brown">
              No prayers yet - be the first to share one.
            </p>
            <Link
              href="/prayerwall"
              prefetch={false}
              className="mt-3 inline-flex rounded-full bg-rose-gold px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
            >
              Share a prayer
            </Link>
          </div>
        )}
      </section>

      {/* Suggest CTA */}
      <section className="rounded-2xl border border-rose-200/60 bg-gradient-to-r from-blush-light/50 to-white px-5 py-5 text-center sm:px-8 sm:py-6">
        <h2 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">Don&apos;t see your church?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-warm-brown">
          If your church isn&apos;t here yet, let us know. A stronger directory means better first-visit confidence for the next person looking.
        </p>
        <Link
          href="/church/suggest"
          prefetch={false}
          className="mt-4 inline-flex rounded-full bg-rose-gold px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md"
        >
          Suggest a church
        </Link>
      </section>
    </div>
  );
}
