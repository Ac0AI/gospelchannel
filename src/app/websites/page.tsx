import type { Metadata } from "next";
import Link from "next/link";
import { Familjen_Grotesk } from "next/font/google";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";
import styles from "./websites.module.css";

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
const REQUEST_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Our church website")}&body=${encodeURIComponent("Our current website: ")}`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: `${SITE_URL}/websites/devices-1536.webp`, width: 1536, height: 864 }],
    title: `${PAGE_TITLE} | GospelChannel`,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "GospelChannel",
  },
  twitter: {
    images: [`${SITE_URL}/websites/devices-1536.webp`],
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
    image: "phone",
    width: 900,
    height: 1125,
    alt: "Illustrative photograph of hands holding a phone showing an example church website at a café table.",
    title: "Ready for someone's first Sunday.",
    body: "Service times and the address on every page, a real map with directions, and what to expect, kids and parking a tap away. Clear on a phone, where most visitors look first.",
  },
  {
    image: "search",
    width: 900,
    height: 675,
    alt: "Illustrative photograph of a man who just moved, looking at a church website on his phone among moving boxes.",
    title: "Easy to find on Google, Maps and ChatGPT.",
    body: "Built the way search engines and AI assistants read a church: service times and address as real text, structured data, a sitemap and open doors for AI search. We can't promise rankings. We make sure your site isn't what's holding you back.",
  },
  {
    image: "text-a-change",
    width: 900,
    height: 1125,
    alt: "Illustrative photograph of a pastor typing a message on his phone in a small church office.",
    title: "Send the change. We'll handle the website.",
    body: "A new service time, a new photo, an Easter page. Text or email it to us and we make the change. Nobody at church has to learn a website editor.",
  },
];

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.heroImage}
          src="/websites/hero-1536.webp"
          srcSet="/websites/hero-800.webp 800w, /websites/hero-1536.webp 1536w"
          sizes="(min-width: 960px) 520px, 100vw"
          width={1536}
          height={864}
          alt="Illustrative photograph of a family walking to a small brick church, the father checking the church's website on his phone."
          fetchPriority="high"
        />
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

      <section className={`${styles.wrap} ${styles.features}`} aria-label="What you get">
        {FEATURES.map((f) => (
          <article key={f.title} className={styles.feature}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/websites/${f.image}-900.webp`}
              srcSet={`/websites/${f.image}-480.webp 480w, /websites/${f.image}-900.webp 900w`}
              sizes="(min-width: 760px) 280px, 100vw"
              width={f.width}
              height={f.height}
              alt={f.alt}
              loading="lazy"
              decoding="async"
            />
            <div>
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </div>
          </article>
        ))}
        <p className={styles.note}>Illustrative photographs. The screens show our fictional example church. Your website uses your own photographs.</p>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.devices}
            src="/websites/devices-1536.webp"
            srcSet="/websites/devices-800.webp 800w, /websites/devices-1536.webp 1536w"
            sizes="(min-width: 960px) 480px, 100vw"
            width={1536}
            height={864}
            alt="Illustrative photograph of a laptop, tablet and phone on a desk, each showing the same example church website."
            loading="lazy"
            decoding="async"
          />
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

      <section id="request" className={`${styles.wrap} ${styles.request}`} aria-labelledby="request-heading">
        <div>
          <h2 id="request-heading">Let&apos;s start with your current website.</h2>
          <p>Email us your church&apos;s website address. We&apos;ll build your preview and send you the link. No call needed.</p>
        </div>
        <div className={styles.requestActions}>
          <a className={styles.button} href={REQUEST_HREF}>Send us your website</a>
          <a className={styles.mail} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
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
