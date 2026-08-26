import type { Metadata } from "next";
import Link from "next/link";
import { buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

const SITE_URL = "https://gospelchannel.com";
const PAGE_URL = `${SITE_URL}/contact`;
const PAGE_TITLE = "Contact GospelChannel";
const PAGE_DESCRIPTION =
  "Contact GospelChannel for church page claims, corrections, information updates, partnerships, or press.";

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

const contactEmail = "hi@gospelchannel.com";

const topics = [
  {
    heading: "Claim or edit a church page",
    body: "If the church is yours, claim the page directly so its service times, worship links, language, contact details, and visitor information stay accurate.",
    cta: { href: "/church", label: "Find your church" },
  },
  {
    heading: "Suggest a missing church",
    body: "Add a church that is missing from the directory. We review submissions so visitors can compare service times, worship, location, language, and contact details before a first visit.",
    cta: { href: "/church/suggest", label: "Suggest a church" },
  },
  {
    heading: "Corrections and takedowns",
    body: "Spotted incorrect information on a church page, or want a page removed? Email us and we'll sort it out within a few days.",
    cta: { href: `mailto:${contactEmail}?subject=Correction`, label: contactEmail },
  },
  {
    heading: "Press, partnerships, everything else",
    body: "For partnerships, press, or a question that doesn't fit the boxes above, email us directly.",
    cta: { href: `mailto:${contactEmail}`, label: contactEmail },
  },
];

export default function ContactPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: PAGE_URL,
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: SITE_URL,
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: contactEmail,
        contactType: "Church profile claims and corrections",
      },
    },
    buildItemListSchema({
      name: "GospelChannel contact routes",
      items: [
        { name: "Find and claim a church profile", url: `${SITE_URL}/church` },
        { name: "Suggest a missing church", url: `${SITE_URL}/church/suggest` },
        { name: "For churches", url: `${SITE_URL}/for-churches` },
      ],
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <section className="px-5 pt-14 sm:px-12 sm:pt-16">
        <div className="mx-auto max-w-[1100px]">
          <p className="gc-eyebrow">Contact</p>
          <h1
            className="mt-3.5 m-0 font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
          >
            Get in <em className="gc-italic">touch</em>.
          </h1>
          <p className="mt-5 max-w-[640px] text-lg leading-relaxed text-warm-brown">
            GospelChannel is a small, independent project. Send church page claims, corrections, takedown requests, and partnership notes here; emails reach a real person.
          </p>
          <p className="mt-8 font-serif text-2xl italic text-rose-gold sm:text-3xl">
            <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-rose-gold-deep">
              {contactEmail}
            </a>
          </p>
          <p className="mt-5 max-w-[640px] text-sm leading-relaxed text-warm-brown">
            Operated by AC0 AI, S.L.U., NIF B26808741, Maestranza 25, planta 1, 29016 Málaga, Spain.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-14 pb-24 sm:px-12 sm:py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {topics.map((topic, i) => (
            <article
              key={topic.heading}
              className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7 shadow-[var(--shadow-sm)]"
            >
              <p className="font-serif text-3xl font-medium italic leading-none text-rose-gold">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-4 font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                {topic.heading}
              </h2>
              <p className="mt-3 text-sm leading-[1.6] text-warm-brown">{topic.body}</p>
              <Link
                href={topic.cta.href}
                prefetch={false}
                className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
              >
                {topic.cta.label} &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
