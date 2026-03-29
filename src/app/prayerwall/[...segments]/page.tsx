import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPrayersFiltered } from "@/lib/prayer";
import { getChurchDirectorySeedAsync, getChurchBySlugAsync } from "@/lib/content";
import { PrayerFeed } from "@/components/PrayerFeed";
import { PrayerWallHero } from "@/components/PrayerWallHero";
import { PrayerWallFilters } from "@/components/PrayerWallFilters";
import { PrayerWallBreadcrumbs } from "@/components/PrayerWallBreadcrumbs";
import { PrayerWallChurchSection } from "@/components/PrayerWallChurchSection";
import {
  countrySlugToDisplay,
  citySlugToDisplay,
  extractPrayerCity,
  getAvailableCountries,
  getAvailableCities,
  getAvailableChurches,
  getNormalizedCountrySlug,
  slugify,
} from "@/lib/prayer-filters";

export const dynamicParams = true;

export async function generateStaticParams() {
  const churches = await getChurchDirectorySeedAsync();
  const knownCountrySlugs = new Set(
    churches
      .map((church) => getNormalizedCountrySlug(church.country))
      .filter((slug): slug is string => Boolean(slug))
  );

  const countrySlugs = new Set<string>();
  const citySlugs = new Set<string>();

  for (const c of churches) {
    const countrySlug = getNormalizedCountrySlug(c.country);
    if (countrySlug) countrySlugs.add(countrySlug);

    const city = extractPrayerCity(c.location, c.country, knownCountrySlugs);
    if (city) citySlugs.add(slugify(city));
  }

  return [
    ...[...countrySlugs].map((s) => ({ segments: ["country", s] })),
    ...[...citySlugs].map((s) => ({ segments: ["city", s] })),
    ...churches.map((c) => ({ segments: ["church", c.slug] })),
  ];
}

type FilterState = {
  type: "country" | "city" | "church";
  slug: string;
  displayName: string;
  countrySlug?: string;
};

async function parseSegments(segments: string[]): Promise<FilterState | null> {
  if (segments.length !== 2) return null;
  const [prefix, slug] = segments;

  if (prefix === "country") {
    const display = await countrySlugToDisplay(slug);
    if (!display) return null;
    return { type: "country", slug, displayName: display };
  }

  if (prefix === "city") {
    const display = await citySlugToDisplay(slug);
    if (!display) return null;
    return { type: "city", slug, displayName: display };
  }

  if (prefix === "church") {
    const church = await getChurchBySlugAsync(slug);
    if (!church) return null;
    return {
      type: "church",
      slug,
      displayName: church.name,
      countrySlug: getNormalizedCountrySlug(church.country),
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
  const filter = await parseSegments(segments);
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

  return {
    title: titles[filter.type],
    description: descriptions[filter.type],
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
  const filter = await parseSegments(segments);
  if (!filter) notFound();

  const [prayers, countries, cities, churchOptions, churchSeed] = await Promise.all([
    getPrayersFiltered({
      country: filter.type === "country" ? filter.slug : undefined,
      city: filter.type === "city" ? filter.slug : undefined,
      churchSlug: filter.type === "church" ? filter.slug : undefined,
      limit: 20,
    }),
    getAvailableCountries(),
    getAvailableCities(
      filter.type === "country" ? filter.slug : filter.countrySlug
    ),
    getAvailableChurches(
      filter.type === "country" ? filter.slug : filter.countrySlug,
      filter.type === "city" ? filter.slug : undefined
    ),
    getChurchDirectorySeedAsync(),
  ]);
  const visiblePrayerSlugs = new Set(prayers.map((prayer) => prayer.churchSlug));
  if (filter.type === "church") {
    visiblePrayerSlugs.add(filter.slug);
  }
  const churchNames = Object.fromEntries(
    churchSeed
      .filter((church) => visiblePrayerSlugs.has(church.slug))
      .map((church) => [church.slug, church.name]),
  );

  const crumbs = [{ label: "Prayer Wall", href: "/prayerwall" }];
  if (filter.type === "country") {
    crumbs.push({ label: filter.displayName, href: `/prayerwall/country/${filter.slug}` });
  } else if (filter.type === "city") {
    crumbs.push({ label: filter.displayName, href: `/prayerwall/city/${filter.slug}` });
  } else if (filter.type === "church") {
    if (filter.countrySlug) {
      const countryDisplay = await countrySlugToDisplay(filter.countrySlug);
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
          churchNames={churchNames}
        />
      ) : (
        <>
          {prayers.length > 0 ? (
            <PrayerFeed
              initialPrayers={prayers}
              churchNames={churchNames}
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
