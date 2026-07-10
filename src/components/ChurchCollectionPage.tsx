import Link from "next/link";
import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";
import { extractCity } from "@/lib/church-directory";
import type { HubEditorial } from "@/lib/hub-content";
import { serializeJsonLd } from "@/lib/json-ld";

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

function getCollectionTarget(title: string): string {
  return title.trim().replace(/\s+churches$/i, "").trim();
}

function truncateText(value: string | undefined, maxLength = 140): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function getChurchDetailsLine(church: ChurchCollectionPageItem): string {
  const serviceTimes = truncateText(church.enrichmentHint?.serviceTimes, 96);
  if (serviceTimes) return `Service times: ${serviceTimes}`;

  const styles = church.musicStyle?.filter(Boolean).slice(0, 2);
  if (styles && styles.length > 0) return `Worship style: ${styles.join(", ")}`;

  const location = church.enrichmentHint?.location || church.location || church.country;
  if (location) return `Location signal: ${location}`;

  return truncateText(church.enrichmentHint?.summary || church.description, 120);
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
  editorial,
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
  editorial?: HubEditorial;
}) {
  const currentUrl = buildPageHref(basePath, currentPage);
  const canonicalUrl = `https://gospelchannel.com${basePath}`;
  const { lead: titleLead, tail: titleTail } = splitCollectionTitle(title);
  // Tradition pages get the dark editorial hero; geo pages (city/country/style)
  // get the lighter linen-deep treatment with the stat strip.
  const isTradition = basePath.startsWith("/church/denomination/") || basePath.startsWith("/church/style/");
  const decisionSections = currentPage === 1
    ? relatedSections
        .filter((section) => section.links.length > 0)
        .slice(0, 3)
        .map((section) => ({ ...section, links: section.links.slice(0, 6) }))
    : [];
  const quickAnswerSections = currentPage === 1
    ? relatedSections
        .filter((section) => section.links.length > 0)
        .slice(0, 2)
        .map((section) => ({ ...section, links: section.links.slice(0, 4) }))
    : [];
  const quickAnswerChurches = currentPage === 1 ? churches.slice(0, 3) : [];
  const target = getCollectionTarget(title);
  const quickAnswerLead = target
    ? `GospelChannel lists ${totalCount.toLocaleString("en-US")} churches for ${target}. This list uses published location, worship, service-time, language, music, and visitor information where available. Open church profiles for the details that matter to your visit.`
    : `GospelChannel lists ${totalCount.toLocaleString("en-US")} churches in this collection. This list uses published location, worship, service-time, language, music, and visitor information where available. Open church profiles for the details that matter to your visit.`;
  const showQuickAnswer = currentPage === 1 && (quickAnswerSections.length > 0 || quickAnswerChurches.length > 0);

  const jsonLd: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: `https://gospelchannel.com${currentUrl}`,
      mainEntity: { "@id": `${canonicalUrl}#itemlist` },
      about: [
        { "@type": "Thing", name: "Church choice" },
        { "@type": "Thing", name: "Church details" },
        ...quickAnswerSections.map((section) => ({ "@type": "Thing", name: section.title })),
      ],
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
                  ...(extractCity(church.location) ? { addressLocality: extractCity(church.location) } : {}),
                  ...(church.country ? { addressCountry: church.country } : {}),
                },
              }
            : {}),
        },
      })),
    },
  ];

  if (editorial && editorial.faqs.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: editorial.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

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

      {/* Editorial intro */}
      {editorial && editorial.intro.length > 0 && (
        <section className="mx-auto max-w-[760px] px-5 pt-12 sm:px-12 sm:pt-14">
          <div className="space-y-4 text-base leading-relaxed text-warm-brown sm:text-lg">
            {editorial.intro.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}

      {/* Quick answer */}
      {showQuickAnswer && (
        <section className="mx-auto max-w-[1080px] px-5 pt-12 sm:px-12 sm:pt-14">
          <div className="border-y border-rose-gold/[0.12] py-8">
            <p className="gc-eyebrow">Quick answer</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
              How to choose from this list.
            </h2>
            <p className="mt-3 max-w-[800px] text-sm leading-[1.7] text-warm-brown sm:text-base">
              {quickAnswerLead}
            </p>
            <div className="mt-7 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              {quickAnswerSections.length > 0 && (
                <div>
                  <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-muted-warm">
                    Best next filters
                  </h3>
                  <div className="mt-4 space-y-4">
                    {quickAnswerSections.map((section) => (
                      <div key={section.title}>
                        <p className="text-sm font-semibold text-espresso">{section.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {section.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-gold/20 bg-white px-3.5 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {quickAnswerChurches.length > 0 && (
                <div>
                  <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-muted-warm">
                    Church details to inspect first
                  </h3>
                  <div className="mt-4 divide-y divide-rose-gold/[0.12] border-t border-rose-gold/[0.12]">
                    {quickAnswerChurches.map((church) => (
                      <div key={church.slug} className="py-3.5">
                        <Link
                          href={`/church/${church.slug}`}
                          className="text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
                        >
                          {church.name} &rarr;
                        </Link>
                        <p className="mt-1 text-sm leading-[1.55] text-warm-brown">
                          {getChurchDetailsLine(church)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Decision filters */}
      {decisionSections.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
          <div className="border-y border-rose-gold/[0.12] py-8">
            <p className="gc-eyebrow">Narrow this search</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
              Start with the signal that matters most.
            </h2>
            <p className="mt-3 max-w-[700px] text-sm leading-[1.7] text-warm-brown sm:text-base">
              Use these filters before opening individual church profiles. They turn a broad list into
              a practical shortlist by location, worship style, tradition, and fit.
            </p>
            <div className="mt-7 grid gap-7 lg:grid-cols-3">
              {decisionSections.map((section) => (
                <div key={section.title}>
                  <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-muted-warm">
                    {section.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {section.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-gold/20 bg-white px-3.5 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
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
                </div>
              ))}
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

      {/* FAQ */}
      {editorial && editorial.faqs.length > 0 && (
        <section className="mx-auto mt-20 max-w-[820px] px-5 sm:px-12">
          <p className="gc-eyebrow">Good to know</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Frequently asked <em className="gc-italic">questions</em>.
          </h2>
          <dl className="mt-7 divide-y divide-rose-gold/[0.12] border-t border-rose-gold/[0.12]">
            {editorial.faqs.map((faq) => (
              <div key={faq.question} className="py-6">
                <dt className="font-semibold text-espresso">{faq.question}</dt>
                <dd className="mt-2 leading-relaxed text-warm-brown">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
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
