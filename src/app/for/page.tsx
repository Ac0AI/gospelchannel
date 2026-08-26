import type { Metadata } from "next";
import Link from "next/link";
import { FOR_AUDIENCE, getAudienceProofRoutes } from "@/lib/for-audience-data";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";

const SITE_URL = "https://gospelchannel.com";
const PAGE_URL = `${SITE_URL}/for`;
const PAGE_TITLE = "Church Search by Life Stage and Situation";
const PAGE_DESCRIPTION =
  "Start with the person's real church-choice situation, then use guides and church details to build a shortlist.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "GospelChannel",
  },
  twitter: {
    images: ["https://gospelchannel.com/hero-worship.jpg"],
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function ForIndexPage() {
  const audiences = Object.values(FOR_AUDIENCE);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: PAGE_TITLE,
      url: PAGE_URL,
      description: PAGE_DESCRIPTION,
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: SITE_URL,
      },
      about: [
        { "@type": "Thing", name: "Audience-specific church search" },
        { "@type": "Thing", name: "A way to find your church" },
        { "@type": "Thing", name: "Church details" },
      ],
    },
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "For", url: PAGE_URL },
    ]),
    buildItemListSchema({
      name: "Church search by life stage and situation",
      items: audiences.map((audience) => ({
        name: audience.hero_eyebrow,
        url: `${SITE_URL}/for/${audience.slug}`,
      })),
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <main className="bg-linen text-espresso">
        <section className="mx-auto max-w-[1180px] px-5 pt-16 pb-12 sm:px-12 sm:pt-20">
          <p className="gc-eyebrow">Find your starting point</p>
          <h1
            className="mt-4 max-w-[18ch] font-serif font-semibold leading-[1.03] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(42px, 7vw, 78px)" }}
          >
            Start with the person. Find their church.
          </h1>
          <p className="mt-6 max-w-[720px] text-base leading-relaxed text-warm-brown sm:text-lg">
            Different people need different details before a first visit. Start with your situation,
            whether you are an expat, student, parent, young adult, new believer, or looking for a
            lower-pressure next step, then find guidance and churches to explore.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/guides/church-choice-answers"
              className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
            >
              Church choice guide
            </Link>
            <Link
              href="/church"
              className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Open church profiles
            </Link>
          </div>
        </section>

        <section className="border-y border-rose-gold/[0.12] bg-white px-5 py-8 sm:px-12">
          <div className="mx-auto grid max-w-[1180px] gap-5 md:grid-cols-3">
            {[
              ["1", "Name the situation", "Language, campus life, children, trust, worship sound, or a fresh start."],
              ["2", "Use the matching guide", "Each audience page gives the answer shape before filters enter the conversation."],
              ["3", "Check the details", "Open church pages for service times, location, language, worship, and visitor information."],
            ].map(([num, title, body]) => (
              <div key={num} className="border-l border-rose-gold/[0.18] pl-5">
                <p className="font-serif text-3xl font-semibold text-rose-gold">{num}</p>
                <h2 className="mt-2 font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-warm-brown">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-14 pb-24 sm:px-12 sm:py-16">
          <p className="gc-eyebrow">Choose your situation</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
            Church search pages by intent
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map((audience) => {
              const proofRoutes = getAudienceProofRoutes(audience, 4);

              return (
                <article
                  key={audience.slug}
                  className="group flex h-full flex-col rounded-[18px] border border-rose-gold/[0.14] bg-white p-6 shadow-sm transition-all hover:border-rose-gold/35 hover:shadow-md"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-warm">
                    {audience.hero_eyebrow}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl font-semibold leading-tight tracking-[-0.01em] text-espresso">
                    <Link
                      href={`/for/${audience.slug}`}
                      className="transition-colors group-hover:text-rose-gold"
                    >
                      {audience.audience_name}
                    </Link>
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-warm-brown">
                    {audience.meta_description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {proofRoutes.map((route) => (
                      <Link
                        key={route.href}
                        href={route.href}
                        className="rounded-full border border-rose-gold/20 bg-linen px-3 py-1 text-xs font-semibold text-warm-brown transition-colors hover:border-rose-gold/45 hover:text-rose-gold-deep"
                      >
                        {route.label}
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/for/${audience.slug}`}
                    className="mt-6 inline-flex text-sm font-bold text-rose-gold transition-colors group-hover:text-rose-gold-deep"
                  >
                    See churches and guidance &rarr;
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
