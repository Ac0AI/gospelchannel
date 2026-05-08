import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNetworkBySlug, getNetworkCampuses } from "@/lib/church-networks";
import { getChurchBySlugAsync } from "@/lib/content";

type NetworkPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;

export async function generateMetadata({ params }: NetworkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const network = await getNetworkBySlug(slug);

  if (!network) {
    return { title: "Network Not Found" };
  }

  const pageUrl = `https://gospelchannel.com/network/${network.slug}`;

  return {
    title: `${network.name} — All Locations & Worship Music`,
    description: network.description
      || `Discover ${network.name} church locations worldwide. Find campuses, service times, and worship music.`,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${network.name} — Locations & Worship Music`,
      description: `Explore all ${network.name} campuses and listen to their worship music.`,
      type: "website",
      url: pageUrl,
      siteName: "GospelChannel",
    },
  };
}

export default async function NetworkPage({ params }: NetworkPageProps) {
  const { slug } = await params;
  const network = await getNetworkBySlug(slug);

  if (!network) {
    notFound();
  }

  const campuses = await getNetworkCampuses(network.id);
  const parentChurch = network.parentChurchSlug
    ? await getChurchBySlugAsync(network.parentChurchSlug)
    : null;

  // Group campuses by country
  const byCountry = new Map<string, typeof campuses>();
  for (const campus of campuses) {
    const country = campus.country || "Other";
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country)!.push(campus);
  }
  const sortedCountries = [...byCountry.keys()].sort();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: network.name,
    ...(network.website && { url: network.website }),
    ...(network.description && { description: network.description }),
    ...(network.founded && { foundingDate: `${network.founded}` }),
    ...(network.headquartersCountry && {
      address: {
        "@type": "PostalAddress",
        addressCountry: network.headquartersCountry,
      },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Editorial dark hero */}
      <section className="bg-espresso px-5 py-16 text-linen sm:px-12 sm:py-20">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/church"
            className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.22em] text-blush/70 no-underline transition-colors hover:text-blush"
          >
            &larr; All churches
          </Link>
          <p className="mt-6 gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
            Network
          </p>
          <h1
            className="mt-3.5 m-0 max-w-[18ch] font-serif font-semibold leading-[1] tracking-[-0.02em] text-linen"
            style={{ fontSize: "clamp(40px, 7vw, 88px)" }}
          >
            {network.name}.
          </h1>
          {network.description && (
            <p className="mt-5 max-w-[640px] text-base leading-relaxed text-linen/75 sm:text-lg">
              {network.description}
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-2 text-xs">
            {network.headquartersCountry && (
              <span className="rounded-full border border-blush/25 bg-blush/[0.08] px-3.5 py-2 font-bold uppercase tracking-[0.16em] text-blush backdrop-blur-sm">
                HQ &middot; {network.headquartersCountry}
              </span>
            )}
            {network.founded && (
              <span className="rounded-full border border-blush/25 bg-blush/[0.08] px-3.5 py-2 font-bold uppercase tracking-[0.16em] text-blush backdrop-blur-sm">
                Founded {network.founded}
              </span>
            )}
            <span className="rounded-full border border-blush/25 bg-blush/[0.08] px-3.5 py-2 font-bold uppercase tracking-[0.16em] text-blush backdrop-blur-sm">
              {campuses.length} {campuses.length === 1 ? "campus" : "campuses"}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] space-y-10 px-5 py-14 pb-24 sm:px-12 sm:py-16">

      {/* Worship music link */}
      {parentChurch && (
        <section className="rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-espresso">Worship Music</h2>
          <p className="mt-1 text-sm text-warm-brown">
            Listen to {parentChurch.name}&apos;s worship playlists and videos.
          </p>
          <Link
            href={`/church/${parentChurch.slug}`}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
          >
            Listen to {parentChurch.name} →
          </Link>
        </section>
      )}

      {/* Campuses by country */}
      {campuses.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl font-semibold text-espresso">
            Campuses
          </h2>
          <p className="mt-1 text-sm text-warm-brown">
            {network.name} has {campuses.length} {campuses.length === 1 ? "campus" : "campuses"} across {sortedCountries.length} {sortedCountries.length === 1 ? "country" : "countries"}.
          </p>

          <div className="mt-6 space-y-6">
            {sortedCountries.map((country) => (
              <div key={country}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-warm-brown/70">
                  {country}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byCountry.get(country)!.map((campus) => (
                    <Link
                      key={campus.slug}
                      href={`/church/${campus.slug}`}
                      className="group rounded-xl border border-rose-200/60 bg-white p-4 shadow-sm transition-all hover:border-rose-300 hover:shadow-md"
                    >
                      <h4 className="font-semibold text-espresso group-hover:text-rose-gold">
                        {campus.name}
                      </h4>
                      {campus.enrichment?.streetAddress && (
                        <p className="mt-1 text-xs text-warm-brown">
                          {campus.enrichment.streetAddress}
                        </p>
                      )}
                      {campus.city && (
                        <p className="mt-1 text-xs text-muted-warm">
                          {campus.city}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-rose-200/60 bg-white/70 p-8 text-center shadow-sm">
          <p className="font-serif text-lg font-semibold text-espresso">
            No campuses listed yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-warm-brown">
            We&apos;re working on adding {network.name} locations. Check back soon!
          </p>
        </section>
      )}

      {/* Network website link */}
      {network.website && (
        <section className="flex items-center gap-3 rounded-[18px] border border-rose-gold/[0.10] bg-white px-6 py-4">
          <a
            href={network.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-rose-gold/30 px-4 py-2 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Visit {network.name} &rarr;
          </a>
          <span className="text-xs text-muted-warm">
            {new URL(network.website).hostname.replace(/^www\./, "")}
          </span>
        </section>
      )}
    </div>
    </>
  );
}
