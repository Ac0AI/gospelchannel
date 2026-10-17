import type { Metadata } from "next";
import Link from "next/link";
import { Familjen_Grotesk } from "next/font/google";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";
import styles from "./websites.module.css";
import { RequestForm } from "./RequestForm";

// GospelChannel Websites: done-for-you church websites, a paid service that is
// separate from the free church listing. The page has its own type and colors
// (the church sites use Familjen Grotesk too) inside the normal site chrome.
const grotesk = Familjen_Grotesk({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

const SITE_URL = "https://gospelchannel.com";
const PAGE_URL = `${SITE_URL}/websites`;
const PAGE_TITLE = "Church Websites, Done for You";
const PAGE_DESCRIPTION =
  "We rebuild your church website from your current one, host it, and make every change you send by text or email. $50 a month. See your new site before you subscribe.";
const CONTACT_EMAIL = "hi@gospelchannel.com";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: `${SITE_URL}/websites/site-desktop-1600.webp`, width: 1600, height: 1000 }],
    title: `${PAGE_TITLE} | GospelChannel`,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "GospelChannel",
  },
  twitter: {
    images: [`${SITE_URL}/websites/site-desktop-1600.webp`],
    card: "summary_large_image",
    title: `${PAGE_TITLE} | GospelChannel`,
    description: PAGE_DESCRIPTION,
  },
};

const COMPARISON = [
  { item: "Website and hosting", diy: "$19 to $99 a month", us: "Included" },
  { item: "Setup", diy: "Often $149 to $1,000", us: "No setup fee" },
  { item: "Moving your content", diy: "You, or a paid designer", us: "Included" },
  { item: "Contact, visit and prayer forms", diy: "Sometimes an add-on", us: "Included" },
  { item: "Keeping it current", diy: "Someone at church logs in", us: "Send us a text or email" },
];

const FEATURES = [
  {
    kind: "phone",
    image: "visit-phone",
    alt: "Plan a visit page of the example church on a phone: Sunday and Wednesday service times, the address, the service language and a map.",
    title: "Ready for someone's first Sunday.",
    body: "Service times and the address on every page, a real map with directions, and what to expect, kids and parking a tap away. Clear on a phone, where most visitors look first.",
  },
  {
    kind: "browser",
    image: "find-us",
    alt: "Find us section of the example church website: the street address, parking notes, directions and contact buttons, and a map with a pin on the church.",
    title: "Easy to find on Google, Maps and ChatGPT.",
    body: "Built the way search engines and AI assistants read a church: service times and address as real text, structured data, a sitemap and open doors for AI search. We can't promise rankings. We make sure your site isn't what's holding you back.",
  },
  {
    kind: "messages",
    title: "Send the change. We'll handle the website.",
    body: "A new service time, a new photo, an Easter page. Text or email it to us and we make the change. Nobody at church has to learn a website editor.",
  },
] as const;

const STEPS = [
  { title: "We build it first.", body: "Send us your current website. We move your words, photos and colors into a new site and send you a private preview link." },
  { title: "Take a look.", body: "Open it on your phone with your team. Tell us what to change, and we change it." },
  { title: "Subscribe when you're happy.", body: "$50 a month. We connect your domain, host the site and handle your updates from then on." },
];

const INCLUDED = [
  "Your new website, built from your current one",
  "Hosting, security and a fast, accessible site",
  "Contact, plan-a-visit and prayer forms",
  "A real map and directions",
  "Changes by text or email, as often as you need them",
  "Your domain stays in your name",
];

const FAQ = [
  {
    q: "Can we keep our domain?",
    a: "Yes. Your domain stays registered in your name. We help you point it at the new website.",
  },
  {
    q: "Do we need new photos or new text?",
    a: "No. We start from your current website and use your own words and photographs. If you send new ones, we add them. Photography and copywriting are not part of the service.",
  },
  {
    q: "What happens if we leave?",
    a: "You can cancel anytime. You keep your domain and your content, and you can take the website's code with you.",
  },
  {
    q: "Who makes the changes we send?",
    a: "The GospelChannel team, using tools that help us work quickly. Every change goes through the same checks before it is published: service times and address on every page, working links, and accessibility.",
  },
  {
    q: "What isn't included?",
    a: "New photography, copywriting, online stores, member logins and custom features. Online giving links to the giving service you already use.",
  },
  {
    q: "Does our GospelChannel listing change?",
    a: "No. Your church listing on GospelChannel stays free, with or without a website from us.",
  },
];

const LOOKS = [
  { id: "chapel", name: "Chapel", text: "Navy and gold." },
  { id: "clay", name: "Clay", text: "Terracotta and warm sand." },
  { id: "sage", name: "Sage", text: "Deep green and gold." },
  { id: "own", name: "Your colors", text: "Taken from your logo. Looks finished even before you have photos." },
];

// A sharp iPhone frame drawn in CSS around a real screenshot: titanium edge,
// side buttons, Dynamic Island and a status bar, so the site reads as a phone
// without a stock device image.
function IPhone({ src, srcSet, sizes, alt, eager = false }: { src: string; srcSet: string; sizes: string; alt: string; eager?: boolean }) {
  return (
    <div className={styles.iphone}>
      <span className={styles.btnAction} aria-hidden="true" />
      <span className={styles.btnUp} aria-hidden="true" />
      <span className={styles.btnDown} aria-hidden="true" />
      <span className={styles.btnPower} aria-hidden="true" />
      <div className={styles.iphoneScreen}>
        <div className={styles.statusBar} aria-hidden="true">
          <span>9:41</span>
          <span className={styles.statusIcons}>
            <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
            <svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z" /><path d="M3.5 6.9a6.4 6.4 0 0 1 9 0l-1.4 1.4a4.4 4.4 0 0 0-6.2 0Z" /><path d="M1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0Z" /></svg>
            <svg viewBox="0 0 27 12" width="27" height="12"><rect x="0.5" y="0.5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2.2" y="2.2" width="16" height="7.6" rx="1.8" /><rect x="24" y="4" width="1.8" height="4" rx="0.9" opacity="0.4" /></svg>
          </span>
        </div>
        <span className={styles.island} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} srcSet={srcSet} sizes={sizes} width={600} height={1298} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
      </div>
    </div>
  );
}

export default function WebsitesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "GospelChannel Websites",
      serviceType: "Church website design, hosting and updates",
      description: PAGE_DESCRIPTION,
      url: PAGE_URL,
      provider: { "@type": "Organization", name: "GospelChannel", url: SITE_URL },
      offers: {
        "@type": "Offer",
        price: "50",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", price: "50", priceCurrency: "USD", unitText: "MONTH" },
      },
    },
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "Church websites", url: PAGE_URL },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <div className={`${grotesk.className} ${styles.page}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <section className={`${styles.wrap} ${styles.hero}`}>
        <div>
          <p className={styles.eyebrow}>GospelChannel Websites</p>
          <h1>Your church website, done for you.</h1>
          <p className={styles.intro}>
            Your words, your photos and your colors on a clear, welcoming website. We build it from your current site, host it, and make every change you send us by text or email.
          </p>
          <div className={styles.actions}>
            <a className={styles.button} href="#request">See your new site</a>
            <span className={styles.price}><strong>$50</strong> a month</span>
          </div>
          <p className={styles.quiet}>We build it first. You subscribe only if you like it.</p>
        </div>
        <figure className={styles.showcase}>
          <div className={styles.browser}>
            <div className={styles.browserBar} aria-hidden="true"><span /><span /><span /><em>yourchurch.org</em></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/websites/site-desktop-1600.webp"
              srcSet="/websites/site-desktop-960.webp 960w, /websites/site-desktop-1600.webp 1600w"
              sizes="(min-width: 960px) 600px, 92vw"
              width={1600}
              height={1000}
              alt="Home page of the example church website on a laptop: a photo of people talking over coffee, the headline You're welcome here this Sunday, service times and the street address, and buttons to plan a visit and get directions."
              fetchPriority="high"
            />
          </div>
          <div className={styles.heroPhone}>
            <IPhone
              src="/websites/site-phone-600.webp"
              srcSet="/websites/site-phone-390.webp 390w, /websites/site-phone-600.webp 600w"
              sizes="170px"
              alt="The same home page on an iPhone."
              eager
            />
          </div>
          <figcaption className={styles.caption}>A real site from our template, for a fictional example church.</figcaption>
        </figure>
      </section>

      <section className={styles.compare} aria-labelledby="compare-heading">
        <div className={styles.wrap}>
          <h2 id="compare-heading">A website builder is a tool. We do the work.</h2>
          <p className={styles.lead}>
            Church website builders like Clover, Sharefaith and Tithely Sites rent you the software. Someone at church still has to log in, learn it and keep the site current. That&apos;s the part we take off your plate.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Running your own church website builder compared with GospelChannel Websites</caption>
              <thead>
                <tr><th scope="col"><span className={styles.srOnly}>What you need</span></th><th scope="col">Doing it yourself</th><th scope="col">With GospelChannel</th></tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.item}><th scope="row">{row.item}</th><td>{row.diy}</td><td>{row.us}</td></tr>
                ))}
                <tr className={styles.total}><th scope="row">Every month</th><td>$19 to $99, plus your time</td><td>$50, all of it</td></tr>
              </tbody>
            </table>
          </div>
          <p className={styles.note}>Builder prices are typical published or reported prices in 2026 and vary by plan.</p>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.looks}`} aria-labelledby="looks-heading">
        <h2 id="looks-heading">Pick a look. We make it yours.</h2>
        <p className={styles.lead}>
          Every look shares one layout, built around what a first-time visitor needs. We set it in your logo&apos;s colors with your own photos, or start you on one of ours. Switching later is one message.
        </p>
        <ul className={styles.looksGrid}>
          {LOOKS.map((look) => (
            <li key={look.id}>
              <div className={styles.browser}>
                <div className={styles.browserBar} aria-hidden="true"><span /><span /><span /></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/websites/look-${look.id}-1040.webp`}
                  srcSet={`/websites/look-${look.id}-560.webp 560w, /websites/look-${look.id}-1040.webp 1040w`}
                  sizes="(min-width: 760px) 520px, 92vw"
                  width={1040}
                  height={650}
                  alt={`The example church home page in the ${look.name} look.`}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className={styles.lookName}><strong>{look.name}</strong> {look.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.wrap} ${styles.features}`} aria-label="What you get">
        {FEATURES.map((f) => (
          <article key={f.title} className={styles.feature}>
            {f.kind === "phone" && (
              <div className={styles.featurePhone}>
                <IPhone
                  src={`/websites/${f.image}-600.webp`}
                  srcSet={`/websites/${f.image}-390.webp 390w, /websites/${f.image}-600.webp 600w`}
                  sizes="240px"
                  alt={f.alt}
                />
              </div>
            )}
            {f.kind === "browser" && (
              <div className={styles.browser}>
                <div className={styles.browserBar} aria-hidden="true"><span /><span /><span /><em>yourchurch.org</em></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/websites/${f.image}-1600.webp`}
                  srcSet={`/websites/${f.image}-960.webp 960w, /websites/${f.image}-1600.webp 1600w`}
                  sizes="(min-width: 760px) 520px, 92vw"
                  width={1600}
                  height={618}
                  alt={f.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
            {f.kind === "messages" && (
              <div className={styles.messages} role="img" aria-label="Example text messages: a pastor asks to add a Christmas Eve service on December 24 at 6 PM, and GospelChannel replies that it is on the events page and the home page.">
                <p className={styles.them}>Can you add our Christmas Eve service? Dec 24, 6 PM, same address.</p>
                <p className={styles.us}>Done. It&apos;s on your Events page and on the home page until Christmas.</p>
              </div>
            )}
            <div>
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </div>
          </article>
        ))}
        <p className={styles.note}>Screens show our fictional example church. Your website uses your own words and photographs.</p>
      </section>

      <section className={styles.steps} aria-labelledby="how-heading">
        <div className={styles.wrap}>
          <h2 id="how-heading">From your current site to your new one.</h2>
          <ol>
            {STEPS.map((s) => (
              <li key={s.title}><h3>{s.title}</h3><p>{s.body}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.pricing}`} aria-labelledby="price-heading">
        <div>
          <h2 id="price-heading">$50 a month.<br />One less thing to manage.</h2>
          <ul className={styles.included}>
            {INCLUDED.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className={styles.faq}>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="request" className={styles.cta} aria-labelledby="request-heading">
        <div className={`${styles.wrap} ${styles.ctaInner}`}>
          <div>
            <p className={styles.ctaEyebrow}>Free preview</p>
            <h2 id="request-heading">See your church&apos;s new website.</h2>
            <p>Tell us where your current site is. We build the new one from it and send you a private link. You subscribe only if you like it.</p>
            <p className={styles.ctaMail}>Prefer email? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </div>
          <RequestForm />
        </div>
      </section>

      <div className={styles.wrap}>
        <p className={styles.listing}>
          Looking for the free church listing? <Link href="/for-churches">Claim your church page</Link>.
        </p>
      </div>
    </div>
  );
}
