import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPrayersFiltered } from "@/lib/prayer";
import { PrayerFeed } from "@/components/PrayerFeed";
import { PrayerWallHero } from "@/components/PrayerWallHero";
import { PrayerWallFilters } from "@/components/PrayerWallFilters";
import { PrayerWallBreadcrumbs } from "@/components/PrayerWallBreadcrumbs";
import { PrayerWallChurchSection } from "@/components/PrayerWallChurchSection";
import { buildItemListSchema } from "@/lib/seo-schema";
import {
  getChurchNamesBySlugs,
  getAvailableCities,
  getAvailableChurches,
  type PrayerFilterIndex,
  getNormalizedCountrySlug,
} from "@/lib/prayer-filters";
import { getPrayerNavIndex } from "@/lib/prayer-scoped-index";
import { serializeJsonLd } from "@/lib/json-ld";
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
  const filterIndex = await getPrayerNavIndex();
  const filter = parseSegments(segments, filterIndex);
  if (!filter) return { title: "Not Found" };

  const titles: Record<string, string> = {
    country: `Prayer Wall ${filter.displayName} — GospelChannel`,
    city: `Prayer Wall ${filter.displayName} — GospelChannel`,
    church: `Prayer Wall — ${filter.displayName} — GospelChannel`,
  };

  const descriptions: Record<string, string> = {
    country: `Prayers from churches in ${filter.displayName}. Use them as a community signal, then verify fit in church profiles.`,
    city: `Prayers from churches in ${filter.displayName}. Use them as a community signal, then verify fit in church profiles.`,
    church: `Pray for ${filter.displayName} and use the church profile for service times, location, worship, and first-visit proof.`,
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
    twitter: {
      card: "summary_large_image",
      title: titles[filter.type],
      description: descriptions[filter.type],
      images: ["https://gospelchannel.com/images/prayerwall-hero.jpg"],
    },
  };
}

export default async function FilteredPrayerWallPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const filterIndex = await getPrayerNavIndex();
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
    country: `Prayers from churches in ${filter.displayName}. Read them as a community signal, then use church pages for visit details.`,
    city: `Prayers from churches in ${filter.displayName}. Read them as a community signal, then use church pages for visit details.`,
    church: `Pray for ${filter.displayName} and use the church page for service times, worship, location, and first-visit information.`,
  };

  const emptyMessages: Record<string, string> = {
    country: `No prayers from churches in ${filter.displayName} yet. Be the first — visit a church page to share your prayer.`,
    city: `No prayers from ${filter.displayName} yet.`,
    church: `No prayers for ${filter.displayName} yet. Be the first!`,
  };

  const churchRoute =
    filter.type === "church"
      ? {
          name: `${filter.displayName} church page`,
          url: `https://gospelchannel.com/church/${filter.slug}`,
          href: `/church/${filter.slug}`,
          label: "Open the church profile",
        }
      : {
          name: "Church profiles with service times",
          url: "https://gospelchannel.com/church/churches-with-service-times",
          href: "/church/churches-with-service-times",
          label: "Profiles with service times",
        };

  const jsonLd = [
    {
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
      about: [
        { "@type": "Thing", name: "Church community signal" },
        { "@type": "Thing", name: "Prayer and first-visit discernment" },
        { "@type": "Thing", name: "Church page details" },
      ],
    },
    buildItemListSchema({
      name: `${filter.displayName} prayer resources`,
      items: [
        { name: "Prayer guide", url: "https://gospelchannel.com/guides/prayer-guide" },
        { name: "First visit guide", url: "https://gospelchannel.com/guides/first-visit-guide" },
        { name: churchRoute.name, url: churchRoute.url },
      ],
    }),
  ];

  const heroEyebrows: Record<string, string> = {
    country: `Prayer Wall · ${filter.displayName}`,
    city: `Prayer Wall · ${filter.displayName}`,
    church: `Prayer Wall · ${filter.displayName}`,
  };

  const supportTitle =
    filter.type === "church"
      ? "Prayer is one signal; check the church details before you visit."
      : "Use prayer as a community signal, then explore church pages.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <PrayerWallHero
        eyebrow={heroEyebrows[filter.type]}
        title={filter.type === "church" ? `Pray for ${filter.displayName}.` : `Prayers from ${filter.displayName}.`}
        accentWord={filter.displayName.split(" ")[0]}
        subtitle={subtitles[filter.type]}
      />

      <div className="sticky top-[64px] z-30 border-y border-rose-gold/10 bg-linen-deep/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-5 py-5 sm:px-12">
          <PrayerWallFilters
            countries={countries}
            cities={cities}
            churches={churchOptions}
            activeCountry={filter.type === "country" ? filter.slug : filter.countrySlug}
            activeCity={filter.type === "city" ? filter.slug : undefined}
            activeChurch={filter.type === "church" ? filter.slug : undefined}
          />
        </div>
      </div>

      <section className="mx-auto max-w-[1280px] px-5 pt-10 sm:px-12 sm:pt-12">
        <PrayerWallBreadcrumbs crumbs={crumbs} />
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-6 pb-20 sm:px-12">
        <div className="mb-8 rounded-[18px] border border-rose-gold/[0.14] bg-white px-6 py-6 shadow-sm sm:px-7">
          <p className="gc-eyebrow">Visitor information</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            {supportTitle}
          </h2>
          <p className="mt-3 max-w-[840px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            Prayer activity can show life around a church community, but it is not a
            ranking, score, or endorsement. Use it with church details: service times,
            location, worship, language, contact details, and first-visit cues.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/guides/prayer-guide"
              className="rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep"
            >
              Read the prayer guide
            </Link>
            <Link
              href={churchRoute.href}
              className="rounded-full border border-rose-gold/30 px-5 py-2.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              {churchRoute.label}
            </Link>
          </div>
        </div>
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
              <div className="rounded-[18px] border border-rose-gold/[0.14] bg-white px-6 py-10 text-center text-sm text-warm-brown">
                {emptyMessages[filter.type]}
              </div>
            )}
            <div className="mt-8 rounded-[18px] border border-rose-gold/[0.14] bg-white/70 px-6 py-5 text-center text-sm text-warm-brown">
              Want to share a prayer?{" "}
              <Link href="/church" prefetch={false} className="font-bold text-rose-gold transition-colors hover:text-rose-gold-deep">
                Find a church
              </Link>{" "}
              and post your prayer on their page.
            </div>
          </>
        )}
      </section>
    </>
  );
}
