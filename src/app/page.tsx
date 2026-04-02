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
import { getClaimedChurchSlugs } from "@/lib/church";

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
  const [showcaseChurches, stats, directorySeed, recentPrayers, claimedSlugs] = await Promise.all([
    getHomepageShowcaseChurches(),
    getChurchStatsAsync(),
    getChurchDirectorySeedAsync(),
    getPrayers({ limit: 5 }),
    getClaimedChurchSlugs(),
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
          &ldquo;Praise the Lord.&rdquo;{" "}
          <span className="not-italic">— Psalm 150:6</span>
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl lg:text-5xl">
          Find a church where you&apos;ll fit right in
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-warm-brown">
          Compare worship style, tradition, language, and service details before your first visit.
        </p>
        <div className="mx-auto mt-6 flex justify-center sm:mt-8">
          <HeroSearch surpriseSlugs={surpriseSlugs} variant="page" />
        </div>
      </section>

      {/* Stats */}
      <p className="text-center text-sm tracking-wide text-warm-brown/70">
        {churchCountLabel} churches · {countryCount} countries · Free
      </p>

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
          verified: claimedSlugs.has(church.slug),
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
