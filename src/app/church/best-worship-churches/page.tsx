import type { Metadata } from "next";
import Link from "next/link";
import { getBestWorshipChurches } from "@/lib/discovery-churches";

// Proof-of-concept discovery page #2: intercepts the "[topic] reddit"-shaped
// search pattern (e.g. "best worship church reddit") the way the approved
// GEO design doc recommends for the cautious, small-sample track — matching
// the query intent with our own honestly-disclosed curation, NOT fabricated
// Reddit citations. We have no way to verify real Reddit threads right now
// (Reddit blocks anonymous search/API access), so this page never claims to
// summarize Reddit — it's GospelChannel's own directory-score ranking, and
// says so plainly in the methodology line below the table.
export const dynamic = "force-dynamic";

const PATH = "/church/best-worship-churches";
const CANONICAL = `https://gospelchannel.com${PATH}`;
const MIN_INDEXABLE = 3;

const FAQS = [
  {
    question: "What makes a church known for its worship?",
    answer:
      "Churches known for worship typically produce original worship music, stream services with a strong live-band format, and draw visitors specifically for the music and atmosphere as well as the teaching. Many on this list, such as Hillsong, Planetshakers and Jesus Culture, have worship ministries that reach far beyond their home congregation through recordings and tours.",
  },
  {
    question: "How is this list put together?",
    answer:
      "This is GospelChannel's own curated list, ranked by our internal directory score (a measure of profile completeness and data quality), filtered to churches tagged as contemporary, charismatic or gospel worship. It is not sourced from Reddit, reviews, or any third-party ranking.",
  },
  {
    question: "Are these churches Pentecostal or charismatic?",
    answer:
      "Most are Pentecostal, charismatic or non-denominational congregations with a contemporary worship style, though a few well-known worship-focused churches on the list (like CityAlight) come from other traditions such as Anglican.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const churches = await getBestWorshipChurches();
  const count = churches.length;
  const title = "Best Worship Churches — What People Recommend";
  const description =
    count > 0
      ? `${count} churches known for their worship, from Hillsong and Planetshakers to Jesus Culture and Kensington Temple, ranked by GospelChannel's directory data.`
      : "Churches known for their worship, ranked by GospelChannel's directory data.";

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
    openGraph: { title, description, url: CANONICAL, type: "website", siteName: "GospelChannel" },
    ...(count < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BestWorshipChurchesPage() {
  const churches = await getBestWorshipChurches();
  const count = churches.length;
  const topNames = churches.slice(0, 2).map((c) => c.name);
  const leadIn =
    topNames.length === 2
      ? `${topNames[0]} and ${topNames[1]}`
      : topNames[0] ?? "Hillsong and Planetshakers";
  const intro =
    `Searching for churches people recommend for worship? Here are ${count} congregations ` +
    `known for their worship, from ${leadIn} to Kensington Temple and Jesus Culture, drawn from ` +
    `GospelChannel's own directory and ranked by how complete and well-documented each church's ` +
    `profile is. Each entry links to its full profile.`;

  const updatedIso = new Date().toISOString();
  const updatedLabel = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const breadcrumbs = [
    { href: "/", label: "Home" },
    { href: "/church", label: "Churches" },
    { href: PATH, label: "Best worship churches" },
  ];

  const jsonLd: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Best Worship Churches — What People Recommend",
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
      name: "Best Worship Churches",
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
          ...(church.website ? { sameAs: church.website } : {}),
          ...(church.logo ? { image: church.logo } : {}),
          address: {
            "@type": "PostalAddress",
            addressLocality: church.location ?? undefined,
            addressCountry: church.country ?? undefined,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
            Worship guide
          </p>
          <h1
            className="mt-3 mb-0 font-serif font-semibold leading-[0.95] tracking-[-0.02em]"
            style={{ fontSize: "clamp(38px, 6vw, 68px)" }}
          >
            Best Worship <em className="gc-italic">Churches</em> — What People Recommend
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
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Tradition</th>
                      <th className="px-4 py-3 font-semibold">Worship style</th>
                      <th className="px-4 py-3 font-semibold">Site</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churches.map((church) => {
                      const style = church.musicStyle && church.musicStyle.length > 0
                        ? church.musicStyle.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")
                        : null;
                      const place = church.location ?? church.country ?? null;
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
                          <td className="px-4 py-3 text-espresso/75">{place ?? "—"}</td>
                          <td className="px-4 py-3 text-espresso/75">{church.denomination ?? "—"}</td>
                          <td className="px-4 py-3 text-espresso/75">{style ?? "—"}</td>
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

              <p className="mt-4 text-xs text-muted-warm">
                How we chose: churches tagged as contemporary, charismatic or gospel worship, ranked by
                GospelChannel&rsquo;s own directory score (a measure of profile completeness, not an
                independent or user-submitted rating). Data from church profiles on GospelChannel.
              </p>
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
            <Link href="/church/style/contemporary-worship" className="underline underline-offset-2 hover:text-espresso">
              Browse all contemporary worship churches
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
