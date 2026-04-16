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
    body: "Spotted something wrong on a page, or want a page removed? Email us and we will sort it out within a few days.",
    cta: { href: `mailto:${contactEmail}?subject=Correction`, label: contactEmail },
  },
  {
    heading: "Press, partnerships, and everything else",
    body: "For partnerships, press, or a question that does not fit the boxes above, email us directly.",
    cta: { href: `mailto:${contactEmail}`, label: contactEmail },
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-14 lg:px-8">
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Contact</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-espresso sm:text-4xl lg:text-5xl">
          Get in touch
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-warm-brown">
          GospelChannel is a small, independent project. Emails reach a real person and we usually reply within a few days.
        </p>
        <p className="max-w-2xl text-base leading-relaxed text-warm-brown">
          General email:{" "}
          <a href={`mailto:${contactEmail}`} className="font-semibold text-rose-gold hover:text-rose-gold-deep">
            {contactEmail}
          </a>
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        {topics.map((topic) => (
          <article
            key={topic.heading}
            className="rounded-2xl border border-rose-200/60 bg-white/70 p-6 shadow-sm"
          >
            <h2 className="font-serif text-xl font-semibold text-espresso">{topic.heading}</h2>
            <p className="mt-3 text-sm leading-relaxed text-warm-brown">{topic.body}</p>
            <Link
              href={topic.cta.href}
              prefetch={false}
              className="mt-4 inline-flex rounded-full border border-blush px-3 py-1.5 text-xs font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              {topic.cta.label}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
