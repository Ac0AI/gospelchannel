import type { Metadata } from "next";
import Link from "next/link";
import {
  buildDiscoveryChurchProofs,
  formatDiscoveryLanguage,
  formatDiscoveryStyles,
  getLondonCharismaticChurches,
} from "@/lib/discovery-churches";
import { getFreshestChurchUpdatedAtAsync } from "@/lib/content";
import { serializeJsonLd } from "@/lib/json-ld";
import { formatContentFreshness } from "@/lib/utils";

// Discovery page: an answer-shaped, citeable page for the exact
// query AI assistants (ChatGPT/Bing/Perplexity) get asked — "charismatic /
// gospel churches in London" — built on GospelChannel's own church data. Fully
// dynamic so it never prerenders against the DB during the offline build.
export const dynamic = "force-dynamic";

const PATH = "/church/charismatic-churches-in-london";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "What is a charismatic church?",
    answer:
      "A charismatic church emphasises the active work of the Holy Spirit in worship: expressive contemporary praise, prayer for healing, and spiritual gifts. In London this spans Pentecostal churches like Kensington Temple, the Vineyard churches, and non-denominational congregations such as Hillsong.",
  },
  {
    question: "Which is the largest Pentecostal church in London?",
    answer:
      "Kensington Temple in Notting Hill, part of the Elim Pentecostal movement, is one of the largest and best-known Pentecostal churches in London and across Europe.",
  },
  {
    question: "Are there English-speaking charismatic churches in London?",
    answer:
      "Yes. Most charismatic and Pentecostal churches in London hold their services in English, including Hillsong Church London, King's Church London and the Vineyard churches.",
  },
  {
    question: "How is this list ordered?",
    answer:
      "This list includes churches across Greater London in Pentecostal, Charismatic, Vineyard, or Elim traditions, or with charismatic, Pentecostal, or gospel worship details. GospelChannel orders entries by profile completeness: the amount and quality of published church information. This is not a review score, endorsement, popularity vote, or third-party recommendation.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const churches = await getLondonCharismaticChurches();
  const count = churches.length;
  const title = "Charismatic & Gospel Churches in London";
  const description =
    count > 0
      ? `A curated guide to ${count} charismatic, Pentecostal and gospel churches in London, including Hillsong, Kensington Temple and the Vineyard churches, with tradition, worship style and links.`
      : "Charismatic, Pentecostal and gospel churches in London, including Hillsong, Kensington Temple and the Vineyard churches.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description },
    // noindex,follow if too thin to add value over the church detail pages.
    ...(count < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CharismaticChurchesInLondonPage() {
  const churches = await getLondonCharismaticChurches();
  const count = churches.length;
  const topNames = churches.slice(0, 2).map((c) => c.name);
  const leadIn =
    topNames.length === 2
      ? `${topNames[0]} and ${topNames[1]}`
      : topNames[0] ?? "Hillsong Church London and Kensington Temple";
  const intro =
    `Looking for a charismatic, Pentecostal or gospel church in London? ${count} congregations ` +
    `across Greater London fit that description, from ${leadIn} to the city's Vineyard and Pentecostal ` +
    `fellowships. The guide below compares them by tradition, worship style and language, each linking ` +
    `to its full profile.`;

  const { updatedIso, updatedLabel } = formatContentFreshness(
    await getFreshestChurchUpdatedAtAsync(),
  );

  const breadcrumbs = [
    { href: "/", label: "Home" },
    { href: "/church", label: "Churches" },
    { href: PATH, label: "Charismatic & gospel churches in London" },
  ];

  const jsonLd: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Charismatic & Gospel Churches in London",
      url: CANONICAL,
      dateModified: updatedIso,
      mainEntity: { "@id": `${CANONICAL}#itemlist` },
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
      "@id": `${CANONICAL}#itemlist`,
      name: "Charismatic & Gospel Churches in London",
      numberOfItems: count,
      itemListElement: churches.map((church, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://gospelchannel.com/church/${church.slug}`,
        item: {
          "@type": "Church",
          "@id": `https://gospelchannel.com/church/${church.slug}`,
          name: church.name,
          url: `https://gospelchannel.com/church/${church.slug}`,
          description: buildDiscoveryChurchProofs(church).join("; "),
          ...(church.website ? { sameAs: church.website } : {}),
          ...(church.logo ? { image: church.logo } : {}),
          address: {
            "@type": "PostalAddress",
            addressLocality: church.location ?? "London",
            addressCountry: "GB",
          },
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <main className="bg-linen text-espresso">
        <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-12 sm:py-20">
          {/* Breadcrumbs */}
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-warm">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="inline-flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
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

          {/* Header + answer-first block (extractable by AI + search) */}
          <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
            London worship guide
          </p>
          <h1
            className="mt-3 mb-0 font-serif font-semibold leading-[0.95] tracking-[-0.02em]"
            style={{ fontSize: "clamp(38px, 6vw, 68px)" }}
          >
            Charismatic &amp; Gospel <em className="gc-italic">Churches</em> in London
          </h1>

          <p className="mt-6 max-w-[760px] text-lg leading-relaxed text-espresso/80 sm:text-xl">
            {intro}
          </p>

          <p className="mt-3 text-xs text-muted-warm">Updated {updatedLabel}</p>

          {count === 0 ? (
            <p className="mt-10 text-muted-warm">No churches found. Please try again shortly.</p>
          ) : (
            <>
              {/* Comparison table */}
              <div className="mt-10 overflow-x-auto rounded-2xl border border-rose-gold/20 bg-white/60">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-rose-gold/20 text-[11px] uppercase tracking-[0.08em] text-muted-warm">
                      <th className="px-4 py-3 font-semibold">Church</th>
                      <th className="px-4 py-3 font-semibold">Tradition</th>
                      <th className="px-4 py-3 font-semibold">Worship style</th>
                      <th className="px-4 py-3 font-semibold">Language</th>
                      <th className="px-4 py-3 font-semibold">Church details</th>
                      <th className="px-4 py-3 font-semibold">Site</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churches.map((church) => {
                      const style = formatDiscoveryStyles(church.musicStyle);
                      const language = formatDiscoveryLanguage(church.language);
                      const details = buildDiscoveryChurchProofs(church);
                      return (
                        <tr key={church.slug} className="border-b border-rose-gold/10 last:border-0 align-top">
                          <td className="px-4 py-3">
                            <Link
                              href={`/church/${church.slug}`}
                              className="font-medium text-espresso underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
                            >
                              {church.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-espresso/75">{church.denomination ?? "—"}</td>
                          <td className="px-4 py-3 text-espresso/75">{style ?? "—"}</td>
                          <td className="px-4 py-3 text-espresso/75">{language ?? "—"}</td>
                          <td className="px-4 py-3 text-espresso/75">
                            {details.length > 0 ? details.slice(0, 3).join(" · ") : "Church details available"}
                          </td>
                          <td className="px-4 py-3">
                            {church.website ? (
                              <a
                                href={church.website}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="text-rose-gold underline underline-offset-2 hover:text-espresso"
                              >
                                Visit
                              </a>
                            ) : (
                              <span className="text-muted-warm">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <p className="gc-eyebrow">How this list works</p>
                <p className="mt-1 text-xs text-muted-warm">
                  This list includes churches across Greater London in Pentecostal, Charismatic, Vineyard,
                  or Elim traditions, or with charismatic, Pentecostal, or gospel worship details. It is
                  based on published service times, worship playlists, videos, worship styles, language, official
                  sites, and location where available. GospelChannel orders entries by how much verified
                  information each church page holds. This is not a review score,
                  endorsement, popularity vote, or third-party recommendation.
                </p>
              </div>
            </>
          )}

          {/* FAQ */}
          <section className="mt-16">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">Frequently asked questions</h2>
            <dl className="mt-6 space-y-6">
              {FAQS.map((faq) => (
                <div key={faq.question} className="border-b border-rose-gold/10 pb-6 last:border-0">
                  <dt className="font-semibold text-espresso">{faq.question}</dt>
                  <dd className="mt-2 max-w-[760px] leading-relaxed text-espresso/80">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="mt-12 text-sm text-muted-warm">
            <Link href="/church/city/london" className="underline underline-offset-2 hover:text-espresso">
              Browse all churches in London
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
