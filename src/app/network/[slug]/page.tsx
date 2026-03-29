import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNetworkBySlug, getNetworkCampuses } from "@/lib/church-networks";
import { getChurchBySlugAsync } from "@/lib/content";

type NetworkPageProps = {
  params: Promise<{ slug: string }>;
};

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
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav>
        <Link href="/church" className="inline-flex items-center gap-1 text-sm font-medium text-rose-gold transition-colors hover:text-rose-gold-deep">
          ← Churches
        </Link>
      </nav>

      {/* Hero */}
      <section className="rounded-[2rem] border border-rose-200/60 bg-gradient-to-br from-espresso to-warm-brown px-5 py-10 shadow-sm sm:px-8 sm:py-12 lg:px-10 lg:py-14">
        <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
          {network.name}
        </h1>
        {network.description && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/82 sm:text-base">
            {network.description}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/80">
          {network.headquartersCountry && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              HQ: {network.headquartersCountry}
            </span>
          )}
          {network.founded && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              Founded {network.founded}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
            {campuses.length} {campuses.length === 1 ? "campus" : "campuses"}
          </span>
        </div>
      </section>

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
        <section className="flex items-center gap-3 rounded-2xl border border-rose-200/60 bg-white px-5 py-4 shadow-sm">
          <a
            href={network.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
          >
            Visit {network.name} →
          </a>
          <span className="text-xs text-muted-warm">
            {new URL(network.website).hostname.replace(/^www\./, "")}
          </span>
        </section>
      )}
    </div>
  );
}
