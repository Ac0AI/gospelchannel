import type { Metadata } from "next";
import Link from "next/link";
import { getCompareGuides } from "@/lib/tooling";
import { buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

const PAGE_URL = "https://gospelchannel.com/compare";
const PAGE_TITLE = "Compare Church Styles and Traditions";
const PAGE_DESCRIPTION =
  "Compare worship styles, church traditions, and Sunday room feel, then explore churches that match your choice.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "GospelChannel",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function CompareHubPage() {
  const guides = getCompareGuides();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: PAGE_URL,
      mainEntity: { "@id": `${PAGE_URL}#itemlist` },
      about: [
        { "@type": "Thing", name: "Church choice" },
        { "@type": "Thing", name: "Worship style comparison" },
        { "@type": "Thing", name: "Church tradition comparison" },
      ],
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: "https://gospelchannel.com",
      },
    },
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: "https://gospelchannel.com" },
      { name: "Compare", url: PAGE_URL },
    ]),
    {
      ...buildItemListSchema({
        name: "Church comparison guides",
        items: guides.map((guide) => ({
          name: guide.title,
          url: `https://gospelchannel.com/compare/${guide.slug}`,
        })),
      }),
      "@id": `${PAGE_URL}#itemlist`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <section className="px-5 pt-14 sm:px-12 sm:pt-16">
        <div className="mx-auto max-w-[1280px]">
          <p className="gc-eyebrow">Side by side</p>
          <h1
            className="mt-3.5 m-0 max-w-[18ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
          >
            Compare worship before your <em className="gc-italic">first visit</em>.
          </h1>
          <p className="mt-5 max-w-[640px] text-lg leading-relaxed text-warm-brown">
            These guides are written for church seekers, not insiders. Reduce uncertainty around style, tradition, and room feel, then explore churches with the details that matter to you.
          </p>
          <div className="mt-8 max-w-[860px] border-y border-rose-gold/[0.14] py-7">
            <p className="gc-eyebrow">Quick answer</p>
            <p className="mt-3 text-base leading-relaxed text-warm-brown sm:text-lg">
              Use comparisons when you are choosing between two church lanes, not when you already know a church name. Pick the side that makes a second visit more likely, then explore churches by worship style, service details, and music.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/guides/church-fit-quiz"
              className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
            >
              Take the fit quiz
            </Link>
            <Link
              href="/guides"
              className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Browse all guides
            </Link>
            <Link
              href="/church"
              className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Open church profile
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-14 sm:px-12 sm:pt-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {guides.map((guide, i) => (
            <article
              key={guide.slug}
              className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7 shadow-[var(--shadow-sm)]"
            >
              <p className="font-serif text-3xl font-medium italic leading-none text-rose-gold">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-4 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">
                {guide.title}
              </h2>
              <p className="mt-3 text-sm leading-[1.6] text-warm-brown">{guide.description}</p>
              <div className="mt-5 space-y-3 border-t border-rose-gold/[0.12] pt-5">
                {guide.choices.map((choice) => (
                  <div key={choice.id}>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-warm">
                      {choice.title}
                    </p>
                    <p className="mt-1 text-sm leading-[1.55] text-warm-brown">
                      {choice.bestFor}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={choice.browse.href}
                        className="inline-flex rounded-full border border-rose-gold/20 px-3 py-1.5 text-xs font-semibold text-rose-gold transition-colors hover:border-rose-gold/45 hover:text-rose-gold-deep"
                      >
                        {choice.browse.label}
                      </Link>
                      {choice.secondary && (
                        <Link
                          href={choice.secondary.href}
                          className="inline-flex rounded-full border border-rose-gold/20 px-3 py-1.5 text-xs font-semibold text-warm-brown transition-colors hover:border-rose-gold/45 hover:text-espresso"
                        >
                          {choice.secondary.label}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href={`/compare/${guide.slug}`}
                className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
              >
                Open guide &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-14 pb-24 sm:px-12 sm:pt-16">
        <div className="border-t border-rose-gold/[0.14] pt-10">
          <p className="gc-eyebrow">Churches to explore</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
            Compare, then explore churches that match.
          </h2>
          <p className="mt-3 max-w-[760px] text-sm leading-[1.7] text-warm-brown sm:text-base">
            Every comparison links to churches you can explore, not just the abstract difference between two traditions or styles.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {guides.map((guide) => (
              <div key={guide.slug} className="border-t border-rose-gold/[0.12] pt-4">
                <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                  {guide.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {guide.choices.map((choice) => (
                    <Link
                      key={choice.id}
                      href={choice.browse.href}
                      className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-warm-brown ring-1 ring-rose-gold/20 transition-colors hover:text-espresso hover:ring-rose-gold/45"
                    >
                      {choice.browse.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
