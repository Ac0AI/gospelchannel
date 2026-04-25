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
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-warm">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.href} className="inline-flex items-center gap-2">
            {index > 0 ? <span>/</span> : null}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-espresso">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-espresso">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/45 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-warm-brown">{description}</p>
        <div className="mt-5 inline-flex rounded-full border border-rose-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-espresso shadow-sm">
          {totalCount.toLocaleString("en-US")} churches
        </div>
      </section>

      <ChurchDirectoryGrid churches={churches} />

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-rose-200/60 bg-white/80 px-4 py-4 shadow-sm">
          {currentPage > 1 ? (
            <Link
              href={buildPageHref(basePath, currentPage - 1)}
              className="rounded-full border border-rose-200/70 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-full border border-rose-100 px-4 py-2 text-sm font-semibold text-muted-warm/70">
              Previous
            </span>
          )}
          <span className="text-sm text-warm-brown">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildPageHref(basePath, currentPage + 1)}
              className="rounded-full border border-rose-200/70 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-full border border-rose-100 px-4 py-2 text-sm font-semibold text-muted-warm/70">
              Next
            </span>
          )}
        </nav>
      )}

      {relatedSections
        .filter((section) => section.links.length > 0)
        .map((section) => (
          <section key={section.title} className="space-y-4">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-espresso">{section.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex rounded-full border border-rose-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light hover:text-espresso"
                >
                  {link.label}
                  {typeof link.count === "number" ? ` (${link.count})` : ""}
                </Link>
              ))}
            </div>
          </section>
        ))}

      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-blush-light/70 to-white p-6 text-center shadow-sm">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Don&apos;t see your church?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-warm-brown">
          If your church has a playlist, service times, or a story worth sharing, send it in and we&apos;ll review it for the directory.
        </p>
        <Link
          href="/church/suggest"
          className="mt-5 inline-flex rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
        >
          Suggest a church
        </Link>
      </section>
    </div>
  );
}
