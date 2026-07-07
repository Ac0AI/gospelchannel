import type { Metadata } from "next";
import { getLatestPrayersWithChurch, getPrayerCountryOptions } from "@/lib/prayer";
import { PrayerFeed } from "@/components/PrayerFeed";
import { PrayerWallHero } from "@/components/PrayerWallHero";
import { PrayerWallFilters } from "@/components/PrayerWallFilters";
import Link from "next/link";
import { buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Prayer Wall: Community Prayers From Churches",
  description:
    "Prayers from churches around the world. Use the wall as a gentle community signal, then open church profiles for service details, worship, location, and first-visit proof.",
  alternates: { canonical: "https://gospelchannel.com/prayerwall" },
  openGraph: {
    title: "Prayer Wall: Community Prayers From Churches",
    description: "Prayers from churches around the world. Use the wall as a community signal, then verify fit in church profiles.",
    url: "https://gospelchannel.com/prayerwall",
    images: [{ url: "https://gospelchannel.com/images/prayerwall-hero.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prayer Wall: Community Prayers From Churches",
    description: "Prayers from churches around the world. Use the wall as a community signal, then verify fit in church profiles.",
    images: ["https://gospelchannel.com/images/prayerwall-hero.jpg"],
  },
};

export default async function PrayerWallPage() {
  const [prayersWithChurch, countryOptions] = await Promise.all([
    getLatestPrayersWithChurch(8),
    getPrayerCountryOptions(),
  ]);

  const prayers = prayersWithChurch.map((prayer) => ({
    id: prayer.id,
    content: prayer.content,
    authorName: prayer.authorName,
    churchSlug: prayer.churchSlug,
    prayedCount: prayer.prayedCount,
    createdAt: prayer.createdAt,
  }));
  const churchNames: Record<string, string> = {};
  for (const prayer of prayersWithChurch) {
    churchNames[prayer.churchSlug] = prayer.churchName;
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Prayer Wall",
      description: "A global prayer wall connecting churches worldwide as a community signal alongside church profile proof.",
      url: "https://gospelchannel.com/prayerwall",
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
      about: [
        { "@type": "Thing", name: "Church community signal" },
        { "@type": "Thing", name: "Prayer and first-visit discernment" },
        { "@type": "Thing", name: "Church profile proof" },
      ],
    },
    buildItemListSchema({
      name: "Prayer Wall decision support routes",
      items: [
        { name: "Prayer guide", url: "https://gospelchannel.com/guides/prayer-guide" },
        { name: "First visit guide", url: "https://gospelchannel.com/guides/first-visit-guide" },
        { name: "Church profiles with service times", url: "https://gospelchannel.com/church/churches-with-service-times" },
      ],
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <PrayerWallHero
        title="Carry someone's prayer today."
        accentWord="prayer"
        subtitle="Real prayers, posted by real people, from churches around the world. Read them as a community signal, then use church profiles for the practical proof before a first visit."
      />

      {/* Sticky filter bar */}
      <div className="sticky top-[64px] z-30 border-y border-rose-gold/10 bg-linen-deep/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-5 py-5 sm:px-12">
          <PrayerWallFilters
            countries={countryOptions}
            cities={[]}
            churches={[]}
          />
        </div>
      </div>

      {/* Decision support */}
      <section className="mx-auto max-w-[1280px] px-5 pt-10 sm:px-12 sm:pt-12">
        <div className="rounded-[22px] border border-rose-gold/[0.14] bg-white p-6 shadow-sm sm:p-7">
          <p className="gc-eyebrow">Community signal</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Prayer can inform a church choice, but profiles still prove the visit.
          </h2>
          <p className="mt-3 max-w-[820px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            A prayer wall shows life around a church; it is not a score or endorsement.
            Use it alongside the profile evidence that matters before Sunday: service times,
            worship, location, language, contact details, and first-visit cues.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/guides/prayer-guide"
              className="rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep"
            >
              Read the prayer guide
            </Link>
            <Link
              href="/church/churches-with-service-times"
              className="rounded-full border border-rose-gold/30 px-5 py-2.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Profiles with service times
            </Link>
          </div>
        </div>
      </section>

      {/* Wall */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <PrayerFeed
          initialPrayers={prayers}
          churchNames={churchNames}
          limit={8}
          showChurch
          expandable
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
