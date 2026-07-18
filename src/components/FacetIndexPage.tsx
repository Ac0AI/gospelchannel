import Link from "next/link";
import type { FacetLink } from "@/lib/church-directory";
import { serializeJsonLd } from "@/lib/json-ld";

type FacetDecisionCard = {
  title: string;
  body: string;
  href: string;
  label: string;
};

type FacetDecisionModel = {
  quickAnswer: string;
  decisionCards: FacetDecisionCard[];
  detailSignals: string[];
};

function singularizeFacetNoun(itemNoun: string): string {
  if (itemNoun === "cities") return "city";
  if (itemNoun === "countries") return "country";
  if (itemNoun === "denominations") return "denomination";
  if (itemNoun === "worship styles") return "worship style";
  return itemNoun.replace(/s$/, "");
}

function getFacetDecisionModel(basePath: string): FacetDecisionModel {
  if (basePath === "/church/city") {
    return {
      quickAnswer:
        "Start with the city you can actually get to on a Sunday morning. Pick yours first, then compare worship style, tradition, language, and service times on each church's page.",
      detailSignals: ["service times", "location", "worship music", "language", "first-visit details"],
      decisionCards: [
        {
          title: "Start with realistic geography",
          body: "A church only helps if you can keep showing up. Start with your city so the shortlist stays close to home before style or tradition narrows it further.",
          href: "/church/city",
          label: "Browse by city",
        },
        {
          title: "Then compare worship feel",
          body: "Once the city is right, decide how you want Sunday to sound: contemporary, gospel, acoustic, charismatic, or rooted in hymns.",
          href: "/church/style",
          label: "Browse worship styles",
        },
        {
          title: "Check the practical details",
          body: "Open each church's page for service times, music, videos, directions, and what a first visit is like.",
          href: "/church/churches-with-service-times",
          label: "See churches with service times",
        },
      ],
    };
  }

  if (basePath === "/church/country") {
    return {
      quickAnswer:
        "Start with a country when you are getting to know the church landscape of a whole region, maybe before a move. See which cities, worship styles, and traditions are represented, then narrow down to a city.",
      detailSignals: ["cities covered", "traditions", "worship styles", "languages", "service times"],
      decisionCards: [
        {
          title: "Start with the country",
          body: `See where churches are listed across a country: which cities, which traditions, and which worship styles you will find there.`,
          href: "/church/country",
          label: "Browse countries",
        },
        {
          title: "Move down to cities",
          body: "Pick the city you will actually live in or near. That turns a country-sized question into a Sunday morning you can plan.",
          href: "/church/city",
          label: "Browse cities",
        },
        {
          title: "Check the practical details",
          body: "Open each church's page for service times, language, worship music, location, and the church's own website before you visit.",
          href: "/church",
          label: "Browse all churches",
        },
      ],
    };
  }

  if (basePath === "/church/style") {
    return {
      quickAnswer:
        "Start with worship style when the real question is what kind of room will make you want to come back. Pick the sound first, then check each church's music, videos, service times, and location.",
      detailSignals: ["worship styles", "playlists", "videos", "service times", "real examples"],
      decisionCards: [
        {
          title: "Start with the sound",
          body: "Choose the worship you are most likely to return to: contemporary, gospel, charismatic, acoustic, rooted, or global.",
          href: "/guides/worship-styles-explained",
          label: "Read the style guide",
        },
        {
          title: "Browse matching churches",
          body: "Compare churches that worship the same way before narrowing by city or tradition.",
          href: "/church/style",
          label: "Browse styles",
        },
        {
          title: "Listen before you visit",
          body: "Many churches share their actual playlists and worship videos. Hearing them tells you more than any label.",
          href: "/church/churches-with-worship-music",
          label: "Hear churches with music",
        },
      ],
    };
  }

  return {
    quickAnswer:
      "Start with denomination when theology, governance, sacraments, or Sunday expectations drive the decision. Narrow by tradition first, then see how each church actually worships, teaches, and welcomes visitors.",
    detailSignals: ["tradition", "worship style", "teaching emphasis", "service times", "first-visit details"],
    decisionCards: [
      {
        title: "Start with tradition",
        body: "Browse by denomination when Baptist, Pentecostal, Anglican, Lutheran, non-denominational, or charismatic roots matter to you.",
        href: "/guides/denominations-comparison",
        label: "Read the denomination guide",
      },
      {
        title: "Compare close choices",
        body: "If two traditions both seem plausible, read a side-by-side comparison before spending Sundays finding out the hard way.",
        href: "/compare",
        label: "Open comparisons",
      },
      {
        title: "Check the practical details",
        body: "A label only says so much. Open each church's page to see its worship style, service times, music, location, and community.",
        href: "/church/denomination",
        label: "Browse denominations",
      },
    ],
  };
}

/**
 * "Hub of hubs" index for a single facet kind (city / country / denomination /
 * worship style). Lists facet values with their church count and links down to
 * the corresponding /church/{kind}/{slug} page. City can be capped because the
 * full city set is very large and canonical crawl discovery lives in sitemap.
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
  maxRenderedLinks,
}: {
  eyebrow: string;
  titleLead: string;
  titleTail: string;
  description: string;
  basePath: string;
  breadcrumbLabel: string;
  itemNoun: string;
  links: FacetLink[];
  maxRenderedLinks?: number;
}) {
  const canonicalUrl = `https://gospelchannel.com${basePath}`;
  const totalChurches = links.reduce((sum, link) => sum + link.count, 0);
  const decisionModel = getFacetDecisionModel(basePath);
  const singularNoun = singularizeFacetNoun(itemNoun);
  const renderedLinks = typeof maxRenderedLinks === "number" ? links.slice(0, maxRenderedLinks) : links;
  const hiddenLinkCount = Math.max(0, links.length - renderedLinks.length);
  const isCapped = hiddenLinkCount > 0;

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
      about: [
        { "@type": "Thing", name: "Church discovery" },
        { "@type": "Thing", name: "Church details" },
        { "@type": "Thing", name: `${titleTail} church search` },
      ],
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
      description: isCapped
        ? `The ${renderedLinks.length} largest of ${links.length.toLocaleString("en-US")} ${itemNoun}, each linking to the churches there.`
        : `Index of ${itemNoun}, each linking to the churches there.`,
      numberOfItems: links.length,
      itemListElement: renderedLinks.map((link, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: link.label,
        url: `https://gospelchannel.com${link.href}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${breadcrumbLabel} church search`,
      description: decisionModel.quickAnswer,
      numberOfItems: decisionModel.decisionCards.length,
      itemListElement: decisionModel.decisionCards.map((card, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: card.title,
        url: `https://gospelchannel.com${card.href}`,
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

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

      {/* Decision model */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <div className="rounded-[24px] border border-rose-gold/[0.16] bg-white p-6 shadow-[0_18px_55px_rgba(72,39,24,0.06)] sm:p-8">
          <p className="gc-eyebrow">Quick answer</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Narrow it down here, then open the churches that fit.
          </h2>
          <p className="mt-3 max-w-[860px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            {decisionModel.quickAnswer}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {decisionModel.detailSignals.map((signal) => (
              <span
                key={signal}
                className="rounded-full border border-rose-gold/20 bg-linen px-3 py-1 text-xs font-semibold text-warm-brown"
              >
                {signal}
              </span>
            ))}
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {decisionModel.decisionCards.map((card) => (
              <article key={card.title} className="rounded-[18px] border border-rose-gold/[0.14] bg-linen-deep p-5">
                <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.65] text-warm-brown">
                  {card.body}
                </p>
                <Link
                  href={card.href}
                  className="mt-4 inline-flex text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
                >
                  {card.label} &rarr;
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Link grid */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <div className="mb-5">
          <p className="gc-eyebrow">Church collections</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Choose a {singularNoun}, then open the churches behind it.
          </h2>
          <p className="mt-2 max-w-[760px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            Each link below opens the churches that match, with the practical details filled in
            where we have them: service times, music, videos, location, and language.
            {isCapped
              ? ` We show the ${renderedLinks.length.toLocaleString("en-US")} largest ${itemNoun} here; smaller ones have their own pages too.`
              : ""}
          </p>
        </div>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {renderedLinks.map((link) => (
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
        {isCapped ? (
          <div className="mt-5 rounded-[18px] border border-rose-gold/[0.14] bg-linen-deep px-5 py-4 text-sm leading-[1.65] text-warm-brown">
            {hiddenLinkCount.toLocaleString("en-US")} smaller {itemNoun} have their own pages too;
            this list just shows the largest. The fastest way to a smaller one is{" "}
            <Link href="/church" className="font-semibold text-rose-gold hover:text-rose-gold-deep">
              searching for the city or church by name
            </Link>
            .
          </div>
        ) : null}
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
