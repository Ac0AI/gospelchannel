import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";
import { buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";
import { PRAYER_FEATURE_ENABLED } from "@/lib/features";

// Without ISR this page is prerendered once at build time, where the DB is
// unreachable — baking the tiny fallback church count into the HTML forever.
export const revalidate = 3600;

const SITE_URL = "https://gospelchannel.com";
const PAGE_URL = `${SITE_URL}/for-churches`;
const PAGE_TITLE = "Claim Your Church Page";
const PAGE_DESCRIPTION =
  "Claim or add a free GospelChannel church page so first-time visitors can find service times, worship, location, language, and visitor information before Sunday.";

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

const WHY = [
  {
    num: "01",
    title: "Show your soul, not just hours.",
    body: "Your music, your photos, your team, the feel of a Sunday. Help people see what to expect before they visit.",
  },
  {
    num: "02",
    title: "Help the right people find you.",
    body: "Filters by language, kids program, denomination, worship style, and service times. We surface you to people whose Sunday is incomplete without you.",
  },
  {
    num: "03",
    title: "Stay out of the way after.",
    body: "We don't email your visitors. We don't sell their data. We don't advertise. The page is a doorway — what happens inside is yours.",
  },
];

const FEATURES = [
  { ic: "01", t: "Music & playlists", d: "Your worship on Spotify and YouTube, right on the page. Visitors hear your sound before they walk in." },
  { ic: "02", t: "Sermons & live", d: "YouTube sermons on your page, plus a livestream link you control from your dashboard." },
  { ic: "03", t: "Service times that update", d: "Service times, languages, and service length. All editable from your dashboard." },
  { ic: "04", t: "Map & directions", d: "One tap to walking, transit or driving directions. Parking notes for first-timers." },
  { ic: "05", t: "Verified badge", d: "Once you claim and confirm, visitors see the verified mark. Trust-signal for new faces." },
  { ic: "06", t: "Visitor questions, answered", d: "Publish answers to what first-timers actually ask: what to wear, kids programs, parking." },
  { ic: "07", t: "Pastor & welcome", d: "A face, a title, and a short welcome from your leader. New visitors arrive knowing who they'll meet." },
  { ic: "08", t: "Multilingual", d: "Mark the languages spoken at your services so expats and internationals can find you." },
];

const STEPS = [
  { n: "1", t: "Find or add", d: "Search for your church. If we have it, claim it. If not, add it in 2 minutes." },
  { n: "2", t: "Verify", d: "Every claim gets a human review. We check it against your church's website or email and get back within 48 hours." },
  { n: "3", t: "Polish", d: "Add photos, service times, a pastor welcome, and visitor details from your dashboard." },
  { n: "4", t: "Publish", d: "Your page is live from day one. Submit edits anytime and we publish them after a quick review." },
];

const FAQ = [
  { q: "Who runs GospelChannel?", a: "A small independent team in Sweden. We're not affiliated with any single denomination or network." },
  { q: "What if my church doesn't have great photos?", a: "No problem. Pages without photos get a clean color layout based on your tradition's palette, and you can add photos whenever you're ready." },
  { q: "Can I edit the page anytime?", a: "Yes. Submit changes anytime from your dashboard and they go live after a quick review." },
  { q: "Will you email my visitors?", a: "Never. When a visitor contacts your church through the page, the message goes to you, not to a list. We don't run a newsletter." },
  ...(PRAYER_FEATURE_ENABLED
    ? [{ q: "What about prayer requests?", a: "Our community Prayer Wall lets visitors share a request and lets others mark that they prayed. It's open to everyone, your congregation included." }]
    : []),
  { q: "Can I delete my church anytime?", a: "Yes. One message to us and the page comes down. We don't keep a public archive." },
];

const TRUST_NAMES = ["Hillsong", "Bethel", "Elevation", "Holy Trinity", "Passion City", "Redeemer"];

// Real verified claims, shown instead of testimonials we don't have yet.
const CLAIMED_SHOWCASE = [
  { slug: "korskyrkan-umea", name: "Korskyrkan Umeå", place: "Umeå, Sweden" },
  { slug: "grace-church-stockholm", name: "Grace Church Stockholm", place: "Stockholm, Sweden" },
  { slug: "malaga-christian-church", name: "Malaga Christian Center", place: "Málaga, Spain" },
];

export default async function ForChurchesPage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: PAGE_URL,
      isPartOf: {
        "@type": "WebSite",
        name: "GospelChannel",
        url: SITE_URL,
      },
      about: [
        { "@type": "Thing", name: "Church page details" },
        { "@type": "Thing", name: "First-time visitor information" },
        { "@type": "Thing", name: "Church service times and worship" },
      ],
    },
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "For Churches", url: PAGE_URL },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to publish a GospelChannel church page",
      description: "Find or add a church, verify access, complete public details, and publish the page.",
      totalTime: "PT4M",
      step: STEPS.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.t,
        text: step.d,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    buildItemListSchema({
      name: "Church page fields",
      items: FEATURES.map((feature) => ({
        name: feature.t,
        url: PAGE_URL,
      })),
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Editorial split hero */}
      <section className="mx-auto max-w-[1280px] px-5 pt-20 pb-15 sm:px-12 sm:pt-24 sm:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <p className="gc-eyebrow">For pastors &amp; church leaders</p>
            <h1
              className="mt-3.5 m-0 font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
              style={{ fontSize: "clamp(48px, 8vw, 84px)" }}
            >
              The page your church <em className="gc-italic">deserves</em>.
            </h1>
            <p className="mt-6 max-w-[540px] text-lg leading-relaxed text-warm-brown sm:text-xl">
              A complete church page with Spotify, YouTube, service times, and visitor details in one place. Free forever. No ads. No tracking. Built so first-time visitors can learn what to expect before Sunday.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/church?intent=claim"
                className="rounded-full bg-rose-gold px-7 py-4 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
              >
                Claim your church page
              </Link>
              <Link
                href="/church/suggest"
                className="rounded-full border border-rose-gold/30 px-7 py-4 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
              >
                Add a new church
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-warm">Free forever. Claiming takes about two minutes.</p>
          </div>

          <div className="relative">
            <div
              className="aspect-[3/4] overflow-hidden rounded-[24px] shadow-[var(--shadow-lg)] bg-cover bg-center"
              style={{
                backgroundImage:
                  "url(/hero/intimate-worship.png)",
              }}
            />
            <div className="absolute -bottom-6 -left-6 max-w-[280px] rounded-[18px] border border-rose-gold/[0.10] bg-white px-6 py-5 shadow-[var(--shadow)]">
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.18em] text-mauve">Before Sunday</p>
              <p className="m-0 mt-1.5 font-serif text-xl font-semibold leading-[1.2] text-espresso">
                Service times, worship, and what to expect. In one place, before they visit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section
        className="border-y border-rose-gold/10 px-5 py-8 sm:px-12"
        style={{ background: "var(--linen-deep)" }}
      >
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-around gap-6">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.2em] text-muted-warm">
            Featuring churches in {countryCount}+ countries
          </p>
          {TRUST_NAMES.map((n) => (
            <span
              key={n}
              className="font-serif text-xl font-medium tracking-[-0.01em] text-warm-brown opacity-70 sm:text-[22px]"
            >
              {n}
            </span>
          ))}
        </div>
      </section>

      {/* Why list */}
      <section className="mx-auto max-w-[1280px] px-5 pt-24 sm:px-12 sm:pt-28">
        <div className="mb-14 text-center">
          <p className="gc-eyebrow">Why list with us</p>
          <h2
            className="mt-3 font-serif font-semibold tracking-[-0.01em] text-espresso"
            style={{ fontSize: "clamp(36px, 6vw, 56px)" }}
          >
            Three things every church page should do.
          </h2>
          <p className="mx-auto mt-5 max-w-[580px] text-lg text-warm-brown">
            And one thing they shouldn&rsquo;t.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {WHY.map((b) => (
            <div key={b.num} className="rounded-[18px] border border-rose-gold/[0.10] bg-white p-7 shadow-[var(--shadow-sm)]">
              <p className="m-0 font-serif text-5xl font-medium italic leading-none text-rose-gold">
                {b.num}
              </p>
              <h3 className="mt-3.5 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">
                {b.title}
              </h3>
              <p className="mt-2.5 text-sm leading-[1.6] text-warm-brown">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-[1280px] px-5 pt-24 sm:px-12 sm:pt-28">
        <p className="gc-eyebrow">What&rsquo;s on every page</p>
        <h2
          className="mt-3 font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(32px, 5vw, 44px)" }}
        >
          Everything in one place. <em className="gc-italic">Nothing</em> in the way.
        </h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.t}
              className="flex gap-5 rounded-[16px] border border-rose-gold/[0.10] bg-white px-6 py-6"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-rose-gold"
                style={{ background: "var(--linen-deep)" }}
              >
                {f.ic}
              </div>
              <div>
                <h4 className="m-0 font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">{f.t}</h4>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-warm-brown">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verified churches showcase */}
      <section className="mx-auto mt-24 max-w-[920px] px-5 text-center sm:px-12 sm:mt-28">
        <p className="gc-eyebrow">Already claimed</p>
        <h2
          className="mt-3 m-0 font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(28px, 4.5vw, 44px)" }}
        >
          Churches already running their <em className="gc-italic">own</em> page.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {CLAIMED_SHOWCASE.map((c) => (
            <Link
              key={c.slug}
              href={`/church/${c.slug}`}
              className="group rounded-2xl border border-rose-gold/[0.12] bg-white px-6 py-7 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-gold/30 hover:shadow-md"
            >
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">
                Verified
              </span>
              <p className="m-0 mt-3 font-serif text-xl font-semibold text-espresso transition-colors group-hover:text-rose-gold-deep">
                {c.name}
              </p>
              <p className="m-0 mt-1 text-sm text-warm-brown">{c.place}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-24 max-w-[1280px] px-5 sm:px-12 sm:mt-28">
        <p className="gc-eyebrow text-center">The four-step setup</p>
        <h2
          className="mt-3 text-center font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(32px, 5vw, 44px)" }}
        >
          From signup to <em className="gc-italic">live</em>.
        </h2>
        <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-gold font-serif text-xl font-semibold text-white">
                {s.n}
              </div>
              <h4 className="m-0 font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">{s.t}</h4>
              <p className="mt-2 text-sm leading-[1.55] text-warm-brown">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing-honest box */}
      <section className="mx-auto mt-24 max-w-[920px] px-5 sm:px-12 sm:mt-28">
        <div className="rounded-[28px] bg-espresso px-12 py-14 text-center text-linen sm:px-12 sm:py-16">
          <p className="gc-eyebrow" style={{ color: "var(--blush)" }}>
            Pricing
          </p>
          <h2
            className="mt-3 m-0 font-serif font-semibold tracking-[-0.01em] text-linen"
            style={{ fontSize: "clamp(36px, 6vw, 56px)" }}
          >
            Free. Forever. <em className="gc-italic">Truly</em>.
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-base leading-relaxed text-linen/75 sm:text-[17px]">
            We take a small donation from supporting churches who want to. We don&rsquo;t run ads. We don&rsquo;t sell data. We don&rsquo;t gate features. The same page a city megachurch gets, your village parish gets.
          </p>
          <Link
            href="/church?intent=claim"
            className="mt-8 inline-flex rounded-full bg-linen px-7 py-4 text-sm font-bold text-espresso transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)]"
          >
            Claim your church page
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-24 max-w-[920px] px-5 sm:px-12 sm:mt-28">
        <p className="gc-eyebrow text-center">Common questions</p>
        <h2
          className="mt-3 mb-8 text-center font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(32px, 5vw, 44px)" }}
        >
          Before you sign up.
        </h2>
        <div>
          {FAQ.map((f, i) => (
            <details
              key={i}
              className="group border-b border-rose-gold/[0.10] py-6 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-serif text-xl font-semibold tracking-[-0.01em] text-espresso sm:text-[22px]">
                <span>{f.q}</span>
                <span className="text-2xl font-light text-rose-gold transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-[720px] text-[15px] leading-[1.6] text-warm-brown">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto mt-24 max-w-[1280px] px-5 pb-24 text-center sm:px-12 sm:mt-28">
        <h2
          className="mx-auto m-0 max-w-[20ch] font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(36px, 6vw, 56px)" }}
        >
          Your next first-time visitor is searching <em className="gc-italic">tonight</em>.
        </h2>
        <p className="mt-4 text-sm text-muted-warm">
          Among {churchCountLabel} churches already listed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/church?intent=claim"
            className="rounded-full bg-rose-gold px-7 py-4 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Claim your church page
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-rose-gold/30 px-7 py-4 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Talk to us first
          </Link>
        </div>
      </section>
    </>
  );
}
