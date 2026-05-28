import Link from "next/link";
import type { FacetLink } from "@/lib/church-directory";

/**
 * "Hub of hubs" index for a single facet kind (city / country / denomination /
 * worship style). Lists every facet value with its church count and links down
 * to the corresponding /church/{kind}/{slug} page. Reached from the homepage
 * "Browse by ..." buttons and indexed for crawl-path depth.
 */
export function FacetIndexPage({
  eyebrow,
  titleLead,
  titleTail,
  description,
  basePath,
  breadcrumbLabel,
  itemNoun,
  links,
}: {
  eyebrow: string;
  titleLead: string;
  titleTail: string;
  description: string;
  basePath: string;
  breadcrumbLabel: string;
  itemNoun: string;
  links: FacetLink[];
}) {
  const canonicalUrl = `https://gospelchannel.com${basePath}`;
  const totalChurches = links.reduce((sum, link) => sum + link.count, 0);

  const jsonLd: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${titleLead} ${titleTail}`.trim(),
      description,
      url: canonicalUrl,
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Churches", item: "https://gospelchannel.com/church" },
        { "@type": "ListItem", position: 2, name: breadcrumbLabel, item: canonicalUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${titleLead} ${titleTail}`.trim(),
      numberOfItems: links.length,
      itemListElement: links.map((link, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: link.label,
        url: `https://gospelchannel.com${link.href}`,
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="border-b border-rose-gold/[0.12] bg-linen px-5 pt-14 pb-10 sm:px-12 sm:pt-16 sm:pb-12">
        <div className="mx-auto max-w-[1280px]">
          <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-warm">
            <Link href="/church" className="text-muted-warm transition-colors hover:text-espresso">
              Churches
            </Link>
            <span>/</span>
            <span className="font-medium text-espresso">{breadcrumbLabel}</span>
          </nav>
          <p className="gc-eyebrow">{eyebrow}</p>
          <h1
            className="mt-3.5 m-0 font-serif font-semibold leading-[0.95] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 7vw, 96px)" }}
          >
            {titleLead} <em className="gc-italic">{titleTail}</em>
          </h1>
          <p className="mt-4 max-w-[640px] text-base leading-relaxed text-warm-brown sm:text-lg">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <span className="font-serif text-3xl font-semibold text-rose-gold sm:text-4xl">
                {links.length.toLocaleString("en-US")}
              </span>
              <span className="ml-1.5 text-xs uppercase tracking-[0.06em] text-muted-warm">
                {itemNoun}
              </span>
            </div>
            <div>
              <span className="font-serif text-3xl font-semibold text-mauve sm:text-4xl">
                {totalChurches.toLocaleString("en-US")}
              </span>
              <span className="ml-1.5 text-xs uppercase tracking-[0.06em] text-muted-warm">
                churches listed
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Link grid */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-2 rounded-full border border-rose-gold/20 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
              >
                {link.label}
                <span className="text-xs font-normal text-muted-warm">
                  ({link.count.toLocaleString("en-US")})
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-warm-brown">Nothing to show here yet. Check back soon.</p>
        )}
      </section>

      {/* Suggest CTA */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 pb-20 sm:px-12">
        <div
          className="flex flex-col items-start justify-between gap-6 rounded-[24px] border border-rose-gold/[0.18] px-8 py-8 sm:flex-row sm:items-center sm:px-12"
          style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)" }}
        >
          <div>
            <p className="gc-eyebrow">Don&rsquo;t see yours?</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
              Suggest a <em className="gc-italic">church</em>.
            </h2>
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
