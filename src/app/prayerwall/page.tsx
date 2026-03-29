import type { Metadata } from "next";
import { getPrayers } from "@/lib/prayer";
import { getChurchDirectorySeedAsync } from "@/lib/content";
import { PrayerFeed } from "@/components/PrayerFeed";
import { PrayerWallHero } from "@/components/PrayerWallHero";
import { PrayerWallFilters } from "@/components/PrayerWallFilters";
import {
  getAvailableCountries,
  getAvailableCities,
} from "@/lib/prayer-filters";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Prayer Wall",
  description:
    "Prayers from churches around the world. Share yours and join others in faith.",
  alternates: { canonical: "https://gospelchannel.com/prayerwall" },
  openGraph: {
    title: "Prayer Wall",
    description: "Prayers from churches around the world. Share yours and join others in faith.",
    url: "https://gospelchannel.com/prayerwall",
    images: [{ url: "https://gospelchannel.com/images/prayerwall-hero.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prayer Wall",
    description: "Prayers from churches around the world. Share yours and join others in faith.",
    images: ["https://gospelchannel.com/images/prayerwall-hero.jpg"],
  },
};

export default async function PrayerWallPage() {
  const [prayers, countries, cities, churchSeed] = await Promise.all([
    getPrayers({ limit: 20 }),
    getAvailableCountries(),
    getAvailableCities(),
    getChurchDirectorySeedAsync(),
  ]);
  const visiblePrayerSlugs = new Set(prayers.map((prayer) => prayer.churchSlug));
  const churchNames = Object.fromEntries(
    churchSeed
      .filter((church) => visiblePrayerSlugs.has(church.slug))
      .map((church) => [church.slug, church.name]),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Prayer Wall",
    description: "A global prayer wall connecting churches worldwide.",
    url: "https://gospelchannel.com/prayerwall",
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
        subtitle="Prayers from churches around the world. Join in faith."
      />

      <div className="rounded-2xl border border-rose-200/60 bg-linen px-5 py-4 text-center text-sm text-warm-brown">
        Want to share a prayer?{" "}
        <Link href="/church" prefetch={false} className="font-semibold text-rose-gold hover:underline">
          Find a church
        </Link>{" "}
        and post your prayer on their page.
      </div>

      <PrayerWallFilters
        countries={countries}
        cities={cities}
        churches={[]}
      />

      <PrayerFeed
        initialPrayers={prayers}
        churchNames={churchNames}
        limit={20}
        showChurch
      />
    </div>
  );
}
