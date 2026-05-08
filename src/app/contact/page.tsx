import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact GospelChannel",
  description: "Get in touch with GospelChannel — for church claims, corrections, partnerships, or press.",
  alternates: { canonical: "https://gospelchannel.com/contact" },
};

const contactEmail = "hi@gospelchannel.com";

const topics = [
  {
    heading: "Claim or edit a church page",
    body: "If the church is yours, the fastest path is to claim the page directly so you can edit service times, links, and details yourself.",
    cta: { href: "/church", label: "Find your church" },
  },
  {
    heading: "Suggest a missing church",
    body: "Add any church that is not on GospelChannel yet. We review each submission before it goes live.",
    cta: { href: "/church/suggest", label: "Suggest a church" },
  },
  {
    heading: "Corrections and takedowns",
    body: "Spotted something wrong on a page, or want a page removed? Email us and we'll sort it out within a few days.",
    cta: { href: `mailto:${contactEmail}?subject=Correction`, label: contactEmail },
  },
  {
    heading: "Press, partnerships, everything else",
    body: "For partnerships, press, or a question that doesn't fit the boxes above, email us directly.",
    cta: { href: `mailto:${contactEmail}`, label: contactEmail },
  },
];

export default function ContactPage() {
  return (
    <>
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
            GospelChannel is a small, independent project. Emails reach a real person and we usually reply within a few days.
          </p>
          <p className="mt-8 font-serif text-2xl italic text-rose-gold sm:text-3xl">
            <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-rose-gold-deep">
              {contactEmail}
            </a>
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
