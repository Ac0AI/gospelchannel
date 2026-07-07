import Link from "next/link";
import type { FacetLink } from "@/lib/church-directory";

type FacetDecisionCard = {
  title: string;
  body: string;
  href: string;
  label: string;
};

type FacetDecisionModel = {
  quickAnswer: string;
  decisionCards: FacetDecisionCard[];
  proofSignals: string[];
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
        "Use city when the main question is whether you can realistically show up this Sunday. Pick a city first, then verify style, tradition, language, service times, and visitor cues inside the church profiles.",
      proofSignals: ["service times", "map/location fit", "worship music", "language cues", "first-visit details"],
      decisionCards: [
        {
          title: "Start with realistic geography",
          body: "A church only helps if the Sunday route is sustainable. City pages keep the shortlist grounded before style or denomination filters take over.",
          href: "/church/city",
          label: "Browse city hubs",
        },
        {
          title: "Then compare worship feel",
          body: "After the city is right, use style hubs to decide whether the room sounds contemporary, gospel, acoustic, charismatic, or rooted.",
          href: "/church/style",
          label: "Browse worship styles",
        },
        {
          title: "Finish on profile proof",
          body: "Open individual profiles for service times, music, videos, address context, and visitor signals before planning the visit.",
          href: "/church/churches-with-service-times",
          label: "See visit-ready profiles",
        },
      ],
    };
  }

  if (basePath === "/church/country") {
    return {
      quickAnswer:
        "Use country when you are mapping the church landscape across a region before choosing a city. Country hubs expose the available cities, worship styles, and traditions, then profiles prove the actual visit details.",
      proofSignals: ["country coverage", "city options", "tradition mix", "worship styles", "profile freshness"],
      decisionCards: [
        {
          title: "Start with country coverage",
          body: `Country hubs show where GospelChannel has enough coverage to support a real search path across cities, styles, and traditions.`,
          href: "/church/country",
          label: "Browse countries",
        },
        {
          title: "Move down to cities",
          body: "Use city hubs to turn a national search into a practical Sunday route you can actually attend.",
          href: "/church/city",
          label: "Browse cities",
        },
        {
          title: "Check the profile evidence",
          body: "Use profiles to confirm service details, language, worship music, location, and official links before you visit.",
          href: "/church",
          label: "Open church profiles",
        },
      ],
    };
  }

  if (basePath === "/church/style") {
    return {
      quickAnswer:
        "Use worship style when the real decision is what kind of room will help you come back. Style hubs translate sound and Sunday energy into churches, then profiles prove it with music, videos, service details, and location.",
      proofSignals: ["worship style tags", "playlists", "videos", "service rhythm", "profile examples"],
      decisionCards: [
        {
          title: "Start with the sound",
          body: "Choose the worship room you are most likely to enter again: contemporary, gospel, charismatic, acoustic, rooted, or global.",
          href: "/guides/worship-styles-explained",
          label: "Read the style guide",
        },
        {
          title: "Browse matching churches",
          body: "Open a style hub to compare churches that share the same worship language before narrowing by city or tradition.",
          href: "/church/style",
          label: "Browse styles",
        },
        {
          title: "Verify with music",
          body: "Use profiles with music signals when worship sound is the decisive proof, not just a directory label.",
          href: "/church/churches-with-worship-music",
          label: "See profiles with music",
        },
      ],
    };
  }

  return {
    quickAnswer:
      "Use denomination when the decision is about theological family, governance, sacraments, or Sunday expectations. Tradition hubs narrow the field, then profiles prove how each church actually worships, teaches, and welcomes visitors.",
    proofSignals: ["denomination signal", "worship style", "teaching emphasis", "service times", "visitor fit"],
    decisionCards: [
      {
        title: "Start with tradition",
        body: "Use denomination hubs when Baptist, Pentecostal, Anglican, Lutheran, non-denominational, or charismatic roots matter to the decision.",
        href: "/guides/denominations-comparison",
        label: "Read the denomination guide",
      },
      {
        title: "Compare close choices",
        body: "If two traditions both seem plausible, use comparison pages before spending Sundays on visits.",
        href: "/compare",
        label: "Open comparisons",
      },
      {
        title: "Prove it in profiles",
        body: "Open church pages to confirm the tradition signal against worship style, service rhythm, music, location, and community cues.",
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
        { "@type": "Thing", name: "Church decision routing" },
        { "@type": "Thing", name: "Church profile database evidence" },
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
        ? `Top ${renderedLinks.length} ${itemNoun} used to narrow a church decision before opening profile evidence. The complete canonical city set is available through sitemap.xml and city detail pages.`
        : `Index of ${itemNoun} used to narrow a church decision before opening profile evidence.`,
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
      name: `${breadcrumbLabel} decision path`,
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

      {/* Decision model */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <div className="rounded-[24px] border border-rose-gold/[0.16] bg-white p-6 shadow-[0_18px_55px_rgba(72,39,24,0.06)] sm:p-8">
          <p className="gc-eyebrow">Quick answer</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Use this hub as a decision route, then let profiles prove the fit.
          </h2>
          <p className="mt-3 max-w-[860px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            {decisionModel.quickAnswer}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {decisionModel.proofSignals.map((signal) => (
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
          <p className="gc-eyebrow">Proof routes</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Choose a {singularNoun}, then open the churches behind it.
          </h2>
          <p className="mt-2 max-w-[760px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            Each link below leads to a filtered church collection with profile-level evidence:
            service details, music, videos, location, language, and visitor signals where available.
            {isCapped
              ? ` Showing the ${renderedLinks.length.toLocaleString("en-US")} largest ${itemNoun}; the full indexable city set remains available through sitemap.xml and city detail URLs.`
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
            {hiddenLinkCount.toLocaleString("en-US")} smaller {itemNoun} are not rendered on this index page
            to keep it fast for users and crawlers. They remain discoverable through{" "}
            <Link href="/sitemap.xml" className="font-semibold text-rose-gold hover:text-rose-gold-deep">
              sitemap.xml
            </Link>
            , internal profile links, and the city detail pages that meet the indexability threshold.
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
