import type { Metadata } from "next";
import Link from "next/link";
import { getAllNetworks } from "@/lib/church-networks";

export const dynamic = "force-dynamic";

const CANONICAL = "https://gospelchannel.com/network";

export const metadata: Metadata = {
  title: "Church Networks & Campuses",
  description:
    "Compare multi-campus church networks by location, campus pages, service details, worship evidence, and profile proof before choosing where to visit.",
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: "Church Networks & Campuses",
    description:
      "Compare church networks and campus proof routes before choosing which local campus to visit.",
    url: CANONICAL,
    type: "website",
    siteName: "GospelChannel",
  },
  twitter: {
    card: "summary_large_image",
    title: "Church Networks & Campuses",
    description:
      "Compare church networks and campus proof routes before choosing which local campus to visit.",
  },
};

export default async function NetworkIndexPage() {
  const networks = await getAllNetworks();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Church Networks & Campuses",
      url: CANONICAL,
      description:
        "Network proof hub for comparing multi-campus churches before opening local campus profile evidence.",
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
      about: [
        { "@type": "Thing", name: "Church networks" },
        { "@type": "Thing", name: "Multi-campus church choice" },
        { "@type": "Thing", name: "Campus profile proof" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Church network proof routes",
      numberOfItems: networks.length,
      itemListElement: networks.map((network, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: network.name,
        url: `https://gospelchannel.com/network/${network.slug}`,
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="bg-linen text-espresso">
        <section className="bg-espresso px-5 py-16 text-linen sm:px-12 sm:py-20">
          <div className="mx-auto max-w-[1180px]">
            <Link
              href="/church"
              className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.22em] text-blush/70 no-underline transition-colors hover:text-blush"
            >
              &larr; All churches
            </Link>
            <p className="mt-6 gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
              Network proof hub
            </p>
            <h1
              className="mt-3.5 m-0 max-w-[16ch] font-serif font-semibold leading-[1] tracking-[-0.02em] text-linen"
              style={{ fontSize: "clamp(42px, 7vw, 84px)" }}
            >
              Choose the campus, then prove the visit.
            </h1>
            <p className="mt-5 max-w-[720px] text-base leading-relaxed text-linen/75 sm:text-lg">
              Multi-campus churches can share a worship identity while each location feels different.
              Use network pages to compare countries, cities, service details, language, worship evidence,
              and campus profile links before choosing where to visit.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[1180px] px-5 py-14 pb-24 sm:px-12 sm:py-16">
          <section className="rounded-[22px] border border-rose-gold/[0.14] bg-white p-6 shadow-sm sm:p-7">
            <p className="gc-eyebrow">Quick answer</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
              Start with the network, decide by the local campus.
            </h2>
            <p className="mt-3 max-w-[820px] text-sm leading-[1.7] text-warm-brown sm:text-base">
              A network name can tell you the worship family and shared identity. The actual visit decision
              depends on the local campus: city, address, service rhythm, language, kids cues, and profile proof.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["campus location", "service times", "worship music", "languages", "profile proof"].map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-rose-gold/20 bg-linen px-3 py-1 text-xs font-semibold text-warm-brown"
                >
                  {signal}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
              Church networks
            </h2>
            {networks.length > 0 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {networks.map((network) => (
                  <Link
                    key={network.slug}
                    href={`/network/${network.slug}`}
                    className="group rounded-[18px] border border-rose-gold/[0.14] bg-white p-5 shadow-sm transition-all hover:border-rose-gold/35 hover:shadow-md"
                  >
                    <h3 className="font-serif text-xl font-semibold text-espresso group-hover:text-rose-gold">
                      {network.name}
                    </h3>
                    {network.headquartersCountry && (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-warm">
                        HQ {network.headquartersCountry}
                      </p>
                    )}
                    {network.description && (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-warm-brown">
                        {network.description}
                      </p>
                    )}
                    <span className="mt-4 inline-flex text-sm font-bold text-rose-gold">
                      Compare campuses &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[18px] border border-rose-gold/[0.14] bg-white p-6">
                <p className="font-serif text-xl font-semibold text-espresso">
                  Network pages are being prepared.
                </p>
                <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-warm-brown">
                  Use the church profile database while network campus proof routes are loading.
                </p>
                <Link
                  href="/church"
                  className="mt-4 inline-flex rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
                >
                  Browse church profiles
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
