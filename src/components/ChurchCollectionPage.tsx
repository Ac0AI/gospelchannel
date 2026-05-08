import Link from "next/link";
import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";

type ChurchCollectionPageItem = {
  slug: string;
  name: string;
  description: string;
  country: string;
  logo?: string;
  playlistCount?: number;
  updatedAt?: string;
  musicStyle?: string[];
  thumbnailUrl?: string;
  location?: string;
  enrichmentHint?: {
    summary?: string;
    serviceTimes?: string;
    location?: string;
  };
  matchReasons?: string[];
};

type Breadcrumb = {
  href: string;
  label: string;
};

type RelatedLink = {
  href: string;
  label: string;
  count?: number;
};

type RelatedSection = {
  title: string;
  links: RelatedLink[];
};

function buildPageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

/** Splits a collection title for the cinematic city/tradition headline:
 *  first word upright, rest go italic-rose-gold. Single-word titles render
 *  as one upright line (no fictional second word added). */
function splitCollectionTitle(title: string): { lead: string; tail: string } {
  const trimmed = title.trim();
  // Treat parenthesized suffixes like "Lutheran (Svenska kyrkan)" as a single block.
  // Try to find the most natural split — usually first word vs rest, but keep it simple.
  const space = trimmed.indexOf(" ");
  if (space === -1) return { lead: trimmed, tail: "" };
  return { lead: trimmed.slice(0, space), tail: trimmed.slice(space + 1) };
}

export function ChurchCollectionPage({
  eyebrow,
  title,
  description,
  basePath,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  churches,
  breadcrumbs,
  relatedSections = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  churches: ChurchCollectionPageItem[];
  breadcrumbs: Breadcrumb[];
  relatedSections?: RelatedSection[];
}) {
  const currentUrl = buildPageHref(basePath, currentPage);
  const canonicalUrl = `https://gospelchannel.com${basePath}`;
  const { lead: titleLead, tail: titleTail } = splitCollectionTitle(title);
  // Tradition pages get the dark editorial hero; geo pages (city/country/style)
  // get the lighter linen-deep treatment with the stat strip.
  const isTradition = basePath.startsWith("/church/denomination/") || basePath.startsWith("/church/style/");

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: `https://gospelchannel.com${currentUrl}`,
      mainEntity: { "@id": `${canonicalUrl}#itemlist` },
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: `https://gospelchannel.com${crumb.href}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${canonicalUrl}#itemlist`,
      name: title,
      numberOfItems: totalCount,
      itemListElement: churches.map((church, index) => ({
        "@type": "ListItem",
        position: (currentPage - 1) * pageSize + index + 1,
        url: `https://gospelchannel.com/church/${church.slug}`,
        item: {
          "@type": "Church",
          "@id": `https://gospelchannel.com/church/${church.slug}`,
          name: church.name,
          url: `https://gospelchannel.com/church/${church.slug}`,
          ...(church.logo ? { image: church.logo } : {}),
          ...(church.location || church.country
            ? {
                address: {
                  "@type": "PostalAddress",
                  ...(church.location ? { addressLocality: church.location } : {}),
                  ...(church.country ? { addressCountry: church.country } : {}),
                },
              }
            : {}),
        },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Editorial hero */}
      {isTradition ? (
        <section className="bg-espresso text-linen">
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-15">
            <div>
              <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-blush/60">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.href} className="inline-flex items-center gap-2">
                    {i > 0 && <span>/</span>}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-blush">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="text-blush/60 transition-colors hover:text-blush">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>
              <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
                {eyebrow}
              </p>
              <h1
                className="mt-3.5 m-0 font-serif font-semibold leading-[0.92] tracking-[-0.02em] text-linen"
                style={{ fontSize: "clamp(48px, 8vw, 96px)" }}
              >
                {titleLead}
                {titleTail && (
                  <>
                    {" "}
                    <em className="gc-italic">{titleTail}</em>
                  </>
                )}
                .
              </h1>
              <p className="mt-5 max-w-[520px] text-lg leading-relaxed text-linen/75 sm:text-xl">
                {description}
              </p>
              <div className="mt-7 inline-flex rounded-full border border-blush/25 bg-blush/[0.08] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blush backdrop-blur-sm">
                {totalCount.toLocaleString("en-US")} churches listed
              </div>
            </div>
            <div className="relative aspect-[1/1.2] overflow-hidden rounded-[20px] bg-[#2a1f17]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden font-serif font-bold leading-[0.8] tracking-[-0.05em]"
                style={{ color: "rgba(217,179,144,0.15)", fontSize: "min(60vw, 600px)" }}
              >
                {titleLead[0]}
              </div>
              <div className="absolute inset-0 flex flex-col justify-end p-10 text-linen">
                <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
                  The numbers
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-serif text-5xl font-semibold leading-none text-rose-gold sm:text-[56px]">
                      {totalCount.toLocaleString("en-US")}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.06em] text-linen/70">
                      churches listed
                    </div>
                  </div>
                  <div>
                    <div className="font-serif text-5xl font-semibold leading-none text-rose-gold sm:text-[56px]">
                      {totalPages}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.06em] text-linen/70">
                      pages
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-b border-rose-gold/[0.12] bg-linen px-5 pt-14 pb-10 sm:px-12 sm:pt-16 sm:pb-12">
          <div className="mx-auto max-w-[1280px]">
            <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-warm">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.href} className="inline-flex items-center gap-2">
                  {i > 0 && <span>/</span>}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="font-medium text-espresso">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="text-muted-warm transition-colors hover:text-espresso">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
            <p className="gc-eyebrow">{eyebrow}</p>
            <h1
              className="mt-3.5 m-0 font-serif font-semibold leading-[0.95] tracking-[-0.02em] text-espresso"
              style={{ fontSize: "clamp(40px, 7vw, 96px)" }}
            >
              {titleLead}
              {titleTail && (
                <>
                  {" "}
                  <em className="gc-italic">{titleTail}</em>
                </>
              )}
            </h1>
            <p className="mt-4 max-w-[640px] text-base leading-relaxed text-warm-brown sm:text-lg">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap items-baseline gap-x-8 gap-y-3">
              <div>
                <span className="font-serif text-3xl font-semibold text-rose-gold sm:text-4xl">
                  {totalCount.toLocaleString("en-US")}
                </span>
                <span className="ml-1.5 text-xs uppercase tracking-[0.06em] text-muted-warm">
                  churches listed
                </span>
              </div>
              <div>
                <span className="font-serif text-3xl font-semibold text-mauve sm:text-4xl">{totalPages}</span>
                <span className="ml-1.5 text-xs uppercase tracking-[0.06em] text-muted-warm">
                  pages
                </span>
              </div>
              <div>
                <span className="font-serif text-3xl font-semibold text-sage sm:text-4xl">
                  {pageSize}
                </span>
                <span className="ml-1.5 text-xs uppercase tracking-[0.06em] text-muted-warm">
                  per page
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <ChurchDirectoryGrid churches={churches} />
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mx-auto mt-12 flex max-w-[1280px] flex-wrap items-center justify-center gap-3 border-t border-rose-gold/[0.12] px-5 py-7 sm:px-12 sm:py-8">
          {currentPage > 1 ? (
            <Link
              href={buildPageHref(basePath, currentPage - 1)}
              className="rounded-full border border-rose-gold/20 bg-white px-5 py-2.5 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
            >
              &larr; Previous
            </Link>
          ) : (
            <span className="rounded-full border border-rose-gold/10 bg-white px-5 py-2.5 text-sm font-semibold text-muted-warm/60">
              &larr; Previous
            </span>
          )}
          <span className="px-3 text-sm text-warm-brown">
            Page <strong className="text-espresso">{currentPage}</strong> of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildPageHref(basePath, currentPage + 1)}
              className="rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep"
            >
              Next &rarr;
            </Link>
          ) : (
            <span className="rounded-full border border-rose-gold/10 bg-white px-5 py-2.5 text-sm font-semibold text-muted-warm/60">
              Next &rarr;
            </span>
          )}
        </nav>
      )}

      {/* Related links */}
      {relatedSections.filter((section) => section.links.length > 0).length > 0 && (
        <div
          className="mt-20 px-5 py-15 sm:px-12 sm:py-16"
          style={{ background: "var(--linen-deep)" }}
        >
          <div className="mx-auto max-w-[1280px] space-y-12">
            {relatedSections
              .filter((section) => section.links.length > 0)
              .map((section) => (
                <section key={section.title}>
                  <p className="gc-eyebrow">Explore other {section.title.toLowerCase()}</p>
                  <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
                    {section.title}
                  </h2>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {section.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-gold/20 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
                      >
                        {link.label}
                        {typeof link.count === "number" && (
                          <span className="text-xs font-normal text-muted-warm">
                            ({link.count.toLocaleString("en-US")})
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </div>
      )}

      {/* Suggest CTA */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 pb-20 sm:px-12">
        <div
          className="flex flex-col items-start justify-between gap-6 rounded-[24px] border border-rose-gold/[0.18] px-8 py-8 sm:flex-row sm:items-center sm:px-12"
          style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)" }}
        >
          <div>
            <p className="gc-eyebrow">Don&rsquo;t see yours?</p>
            <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
              Suggest a <em className="gc-italic">church</em>.
            </h3>
          </div>
          <Link
            href="/church/suggest"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Suggest a church &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
