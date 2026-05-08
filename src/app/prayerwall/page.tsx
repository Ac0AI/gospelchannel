import type { Metadata } from "next";
import { getPrayers } from "@/lib/prayer";
import { PrayerFeed } from "@/components/PrayerFeed";
import { PrayerWallHero } from "@/components/PrayerWallHero";
import { PrayerWallFilters } from "@/components/PrayerWallFilters";
import {
  getChurchNamesBySlugs,
  getPrayerFilterIndex,
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
  const [prayers, filterIndex] = await Promise.all([
    getPrayers({ limit: 20 }),
    getPrayerFilterIndex(),
  ]);
  const churchNames = await getChurchNamesBySlugs(prayers.map((prayer) => prayer.churchSlug));

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PrayerWallHero
        title="Carry someone's prayer today."
        accentWord="prayer"
        subtitle="Real prayers, posted by real people, from churches around the world. Read them. Pray for them. Leave one of your own — anonymously or signed."
      />

      {/* Sticky filter bar */}
      <div className="sticky top-[64px] z-30 border-y border-rose-gold/10 bg-linen-deep/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-5 py-5 sm:px-12">
          <PrayerWallFilters
            countries={filterIndex.countryOptions}
            cities={filterIndex.allCityOptions}
            churches={[]}
          />
        </div>
      </div>

      {/* Wall */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <PrayerFeed
          initialPrayers={prayers}
          churchNames={churchNames}
          limit={20}
          showChurch
        />
      </section>

      {/* Closing CTA */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 pb-20 sm:px-12">
        <div
          className="rounded-[28px] border border-rose-gold/[0.18] px-8 py-14 text-center sm:px-12"
          style={{ background: "linear-gradient(135deg, var(--blush-light) 0%, white 70%)" }}
        >
          <p className="gc-eyebrow">A note about this place</p>
          <h2 className="mx-auto mt-3 max-w-[720px] m-0 font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.01em] text-espresso sm:text-4xl lg:text-[44px]">
            We pray for every prayer that&rsquo;s posted here. <em className="gc-italic">Every one.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-[580px] text-base leading-relaxed text-warm-brown">
            Posts are reviewed by volunteers from partner churches. No ads. No data sold. Names hidden by default. The wall is a reminder that no prayer goes into the void.
          </p>
          <Link
            href="/church"
            prefetch={false}
            className="mt-7 inline-flex rounded-full bg-rose-gold px-6 py-3.5 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Find a church &amp; share a prayer &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
