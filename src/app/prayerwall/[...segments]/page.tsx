import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPrayersFiltered } from "@/lib/prayer";
import { PrayerFeed } from "@/components/PrayerFeed";
import { PrayerWallHero } from "@/components/PrayerWallHero";
import { PrayerWallFilters } from "@/components/PrayerWallFilters";
import { PrayerWallBreadcrumbs } from "@/components/PrayerWallBreadcrumbs";
import { PrayerWallChurchSection } from "@/components/PrayerWallChurchSection";
import {
  getChurchNamesBySlugs,
  getAvailableCities,
  getAvailableChurches,
  getPrayerFilterIndex,
  type PrayerFilterIndex,
  getNormalizedCountrySlug,
} from "@/lib/prayer-filters";
export const dynamicParams = true;

type FilterState = {
  type: "country" | "city" | "church";
  slug: string;
  displayName: string;
  countrySlug?: string;
  requestedSlug?: string;
};

function parseSegments(
  segments: string[],
  index: PrayerFilterIndex,
): FilterState | null {
  if (segments.length !== 2) return null;
  const [prefix, slug] = segments;

  if (prefix === "country") {
    const normalizedSlug = getNormalizedCountrySlug(slug);
    const display = normalizedSlug ? index.countryLabelBySlug[normalizedSlug] : undefined;
    if (!display) return null;
    return { type: "country", slug: normalizedSlug!, requestedSlug: slug, displayName: display };
  }

  if (prefix === "city") {
    const display = index.cityLabelBySlug[slug];
    if (!display) return null;
    return { type: "city", slug, displayName: display };
  }

  if (prefix === "church") {
    const displayName = index.churchNameBySlug[slug];
    if (!displayName) return null;
    return {
      type: "church",
      slug,
      displayName,
      countrySlug: index.countrySlugByChurchSlug[slug],
    };
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}): Promise<Metadata> {
  const { segments } = await params;
  const filterIndex = await getPrayerFilterIndex();
  const filter = parseSegments(segments, filterIndex);
  if (!filter) return { title: "Not Found" };

  const titles: Record<string, string> = {
    country: `Prayer Wall ${filter.displayName} — GospelChannel`,
    city: `Prayer Wall ${filter.displayName} — GospelChannel`,
    church: `Prayer Wall — ${filter.displayName} — GospelChannel`,
  };

  const descriptions: Record<string, string> = {
    country: `Prayers from churches in ${filter.displayName}. Join the ${filter.displayName} prayer community.`,
    city: `Prayers from churches in ${filter.displayName}. Join in faith.`,
    church: `Pray for ${filter.displayName} and their community.`,
  };

  // Empty filter pages all look identical to Google (same shell, "No prayers"
  // body) and trigger "Duplicate without user-selected canonical" issues.
  // Tell crawlers to skip them until they have at least one prayer. Same
  // unstable_cache entry as the page render so this is a free DB call.
  const samplePrayers = await getPrayersFiltered({
    country: filter.type === "country" ? filter.slug : undefined,
    city: filter.type === "city" ? filter.slug : undefined,
    churchSlug: filter.type === "church" ? filter.slug : undefined,
    limit: 1,
  });
  const isEmpty = samplePrayers.length === 0;

  return {
    title: titles[filter.type],
    description: descriptions[filter.type],
    robots: isEmpty ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: `https://gospelchannel.com/prayerwall/${segments.join("/")}`,
    },
    openGraph: {
      title: titles[filter.type],
      description: descriptions[filter.type],
      url: `https://gospelchannel.com/prayerwall/${segments.join("/")}`,
      images: [{ url: "https://gospelchannel.com/images/prayerwall-hero.jpg" }],
    },
  };
}

export default async function FilteredPrayerWallPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const filterIndex = await getPrayerFilterIndex();
  const filter = parseSegments(segments, filterIndex);
  if (!filter) notFound();
  const shouldLoadChurchOptions = filter.type === "city";

  const [prayers, cities, churchOptions] = await Promise.all([
    getPrayersFiltered({
      country: filter.type === "country" ? filter.slug : undefined,
      city: filter.type === "city" ? filter.slug : undefined,
      churchSlug: filter.type === "church" ? filter.slug : undefined,
      limit: 20,
    }),
    getAvailableCities(
      filter.type === "country" ? filter.slug : filter.countrySlug,
    ),
    shouldLoadChurchOptions
      ? getAvailableChurches(
          filter.type === "country" ? filter.slug : filter.countrySlug,
          filter.type === "city" ? filter.slug : undefined,
        )
      : Promise.resolve([]),
  ]);
  const visiblePrayerSlugs = prayers.map((prayer) => prayer.churchSlug);
  if (filter.type === "church") visiblePrayerSlugs.push(filter.slug);
  const visibleChurchNames = await getChurchNamesBySlugs(visiblePrayerSlugs);

  const countries = filterIndex.countryOptions;

  const crumbs = [{ label: "Prayer Wall", href: "/prayerwall" }];
  if (filter.type === "country") {
    crumbs.push({ label: filter.displayName, href: `/prayerwall/country/${filter.requestedSlug ?? filter.slug}` });
  } else if (filter.type === "city") {
    crumbs.push({ label: filter.displayName, href: `/prayerwall/city/${filter.slug}` });
  } else if (filter.type === "church") {
    if (filter.countrySlug) {
      const countryDisplay = filterIndex.countryLabelBySlug[filter.countrySlug];
      if (countryDisplay) {
        crumbs.push({ label: countryDisplay, href: `/prayerwall/country/${filter.countrySlug}` });
      }
    }
    crumbs.push({ label: filter.displayName, href: `/prayerwall/church/${filter.slug}` });
  }

  const subtitles: Record<string, string> = {
    country: `Prayers from churches in ${filter.displayName}`,
    city: `Prayers from churches in ${filter.displayName}`,
    church: `Pray for ${filter.displayName} and their community`,
  };

  const emptyMessages: Record<string, string> = {
    country: `No prayers from churches in ${filter.displayName} yet. Be the first — visit a church page to share your prayer.`,
    city: `No prayers from ${filter.displayName} yet.`,
    church: `No prayers for ${filter.displayName} yet. Be the first!`,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Prayer Wall — ${filter.displayName}`,
    description: subtitles[filter.type],
    url: `https://gospelchannel.com/prayerwall/${segments.join("/")}`,
    isPartOf: {
      "@type": "WebSite",
      name: "GospelChannel",
      url: "https://gospelchannel.com",
    },
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PrayerWallHero
        title="Prayer Wall"
        subtitle={subtitles[filter.type]}
      />

      <PrayerWallFilters
        countries={countries}
        cities={cities}
        churches={churchOptions}
        activeCountry={filter.type === "country" ? filter.slug : filter.countrySlug}
        activeCity={filter.type === "city" ? filter.slug : undefined}
        activeChurch={filter.type === "church" ? filter.slug : undefined}
      />

      <PrayerWallBreadcrumbs crumbs={crumbs} />

      {filter.type === "church" ? (
        <PrayerWallChurchSection
          churchSlug={filter.slug}
          churchName={filter.displayName}
          initialPrayers={prayers}
          churchNames={visibleChurchNames}
        />
      ) : (
        <>
          {prayers.length > 0 ? (
            <PrayerFeed
              initialPrayers={prayers}
              churchNames={visibleChurchNames}
              limit={20}
              showChurch
              country={filter.type === "country" ? filter.slug : undefined}
              city={filter.type === "city" ? filter.slug : undefined}
            />
          ) : (
            <div className="rounded-2xl border border-rose-200/60 bg-white px-5 py-8 text-center text-sm text-warm-brown">
              {emptyMessages[filter.type]}
            </div>
          )}
          <div className="rounded-2xl border border-rose-200/60 bg-linen px-5 py-4 text-center text-sm text-warm-brown">
            Want to share a prayer?{" "}
            <Link href="/church" prefetch={false} className="font-semibold text-rose-gold hover:underline">
              Find a church
            </Link>{" "}
            and post your prayer on their page.
          </div>
        </>
      )}
    </div>
  );
}
