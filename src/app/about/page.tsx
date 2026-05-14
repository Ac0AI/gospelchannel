import type { Metadata } from "next";
import Link from "next/link";
import { getChurchStatsAsync } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { churchCountLabel } = await getChurchStatsAsync();
  return {
    title: "About GospelChannel",
    description: `GospelChannel helps you find the right church before your first visit by comparing worship style, tradition, language, and service details across ${churchCountLabel} churches.`,
    alternates: { canonical: "https://gospelchannel.com/about" },
  };
}

const PRINCIPLES = [
  { n: "I.", t: "Free, always.", b: "Charging churches to be found is wrong. We'd rather grow slowly." },
  { n: "II.", t: "No ads.", b: "Not now, not ever. Not even tasteful ones. Not even from publishers." },
  { n: "III.", t: "No data sold.", b: "We don't track visitors, we don't share emails, we don't have a CRM to leak. Less data is more peace." },
  { n: "IV.", t: "Every tradition welcome.", b: "Catholic and Pentecostal. Lutheran and non-denominational. We don't editorialize on theology." },
  { n: "V.", t: "Beauty is part of the mission.", b: "A page can be a sermon. We design like every visitor is making up their mind in 90 seconds — because they are." },
];

export default async function AboutPage() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();

  return (
    <>
      {/* Manifesto hero */}
      <section className="px-5 pt-24 pb-16 text-center sm:px-12 sm:pt-32 sm:pb-20">
        <div className="mx-auto max-w-[920px]">
          <p className="gc-eyebrow">A short manifesto</p>
          <h1
            className="m-0 mt-4 font-serif font-semibold leading-[1.02] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(48px, 9vw, 96px)" }}
          >
            People find God <em className="gc-italic">differently</em>.
          </h1>
          <p className="mt-8 font-serif text-xl font-medium italic leading-[1.45] text-warm-brown sm:text-2xl lg:text-[28px]">
            Some through hymns. Some through Hillsong. Some through silence in a stone cathedral. Some through a guitar in a school gym. We believe every one of those rooms deserves a beautiful door.
          </p>
        </div>
      </section>

      {/* Long-form story */}
      <section className="mx-auto max-w-[720px] px-5 sm:px-12">
        <div className="font-serif text-lg leading-[1.7] text-espresso sm:text-[19px]">
          <p className="m-0">
            <span
              className="float-left mr-3.5 mt-2 font-serif text-7xl font-semibold italic leading-[0.85] text-rose-gold sm:text-[96px]"
            >
              G
            </span>
            ospelChannel started because two of us moved to a new city and couldn&rsquo;t find a church we&rsquo;d want to walk into. Not because there weren&rsquo;t any &mdash; there were dozens &mdash; but because every one of their websites looked like it was designed by someone who didn&rsquo;t believe people would actually visit.
          </p>
          <p className="mt-5">
            The information we needed &mdash; what time, what kind of music, will I be the only person under 60, do they have anything for kids &mdash; was buried. Or missing. Or last updated in 2014.
          </p>
          <p className="mt-5">
            We&rsquo;re not pastors. We&rsquo;re designers and engineers who love the church. And we kept asking: <em className="text-rose-gold-deep">why does the place that&rsquo;s supposed to welcome strangers have the worst onboarding on the internet?</em>
          </p>
          <p className="mt-5">
            So we built one page. Then five. Then we asked thirty pastors if we could rebuild theirs. They said yes. Then they said please. Then they sent it to other pastors.
          </p>
          <p className="mt-5">
            This is a directory of churches, made by people who think the front door matters. It&rsquo;s free because we think charging churches to be findable is wrong. It&rsquo;s ad-free because we think putting a Coca-Cola banner next to a prayer is also wrong.
          </p>
          <p className="mt-5">
            We&rsquo;re small. We&rsquo;re independent. We&rsquo;re <em className="text-rose-gold-deep">{churchCountLabel} churches in</em>. Most days we still can&rsquo;t believe it.
          </p>
        </div>
      </section>

      {/* Numbers */}
      <section className="mx-auto mt-24 max-w-[1280px] px-5 sm:px-12 sm:mt-28">
        <div className="grid grid-cols-2 border-y border-rose-gold/[0.14] sm:grid-cols-4">
          {[
            { n: churchCountLabel, l: "Churches listed" },
            { n: `${countryCount}`, l: "Countries" },
            { n: "Free", l: "Forever, no ads" },
            { n: "Open", l: "Source on GitHub" },
          ].map((s, i) => (
            <div
              key={s.l}
              className={`px-6 py-12 text-center sm:px-8 sm:py-14 ${
                i === 0 || i === 2 ? "border-r border-rose-gold/[0.14]" : ""
              } ${i < 2 ? "border-b border-rose-gold/[0.14] sm:border-b-0" : ""} ${
                i === 1 ? "" : ""
              } ${i < 3 ? "sm:border-r sm:border-rose-gold/[0.14]" : ""}`}
            >
              <p className="m-0 font-serif font-semibold tracking-[-0.02em] text-espresso" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
                {s.n}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-warm sm:text-[12px]">
                {s.l}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="mx-auto mt-24 max-w-[1280px] px-5 sm:px-12 sm:mt-28">
        <p className="gc-eyebrow text-center">What we believe</p>
        <h2
          className="mt-3 text-center font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(36px, 6vw, 56px)" }}
        >
          Five things we won&rsquo;t <em className="gc-italic">compromise</em>.
        </h2>
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {PRINCIPLES.map((p, i) => {
            const isLast = i === PRINCIPLES.length - 1;
            return (
              <div
                key={p.n}
                className={`flex items-start gap-6 rounded-[22px] px-9 py-8 ${
                  isLast
                    ? "bg-espresso text-linen lg:col-span-2"
                    : "border border-rose-gold/[0.10] bg-white text-espresso"
                }`}
              >
                <p
                  className={`m-0 min-w-[60px] font-serif text-4xl font-medium italic leading-none sm:text-[44px] ${
                    isLast ? "text-blush" : "text-rose-gold"
                  }`}
                >
                  {p.n}
                </p>
                <div>
                  <h3 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] sm:text-[28px]">
                    {p.t}
                  </h3>
                  <p className={`mt-2 text-[15px] leading-[1.55] ${isLast ? "text-linen/80" : "text-warm-brown"}`}>
                    {p.b}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Explore links */}
      <section className="mx-auto mt-20 max-w-[920px] px-5 sm:px-12">
        <p className="gc-eyebrow">Explore</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { href: "/church/country", label: "Browse by country" },
            { href: "/church/style", label: "Browse by worship style" },
            { href: "/church/denomination", label: "Browse by denomination" },
            { href: "/church/city", label: "Browse by city" },
            { href: "/guides", label: "Free guides" },
            { href: "/for-churches", label: "For churches" },
            { href: "/european-church-tech-2026", label: "European Church Tech 2026" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex rounded-full border border-rose-gold/20 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:bg-rose-gold/[0.04] hover:text-espresso"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Closing CTA + scripture */}
      <section className="mx-auto mt-24 max-w-[920px] px-5 pb-24 text-center sm:px-12 sm:mt-28 sm:pb-32">
        <h2
          className="font-serif font-semibold tracking-[-0.01em] text-espresso"
          style={{ fontSize: "clamp(36px, 6vw, 56px)" }}
        >
          Get in <em className="gc-italic">touch</em>.
        </h2>
        <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-warm-brown sm:text-lg">
          We read every email. Press, partnerships, pastors with questions, theologians with concerns &ndash; all welcome.
        </p>
        <p className="mt-8 font-serif text-2xl font-medium italic text-rose-gold sm:text-3xl lg:text-[32px]">
          hello@gospelchannel.com
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link
            href="/church"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse churches
          </Link>
          <Link
            href="/church/suggest"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Suggest a church
          </Link>
        </div>

        <p className="mx-auto mt-14 max-w-[520px] font-serif text-base italic leading-relaxed text-muted-warm sm:text-lg">
          &ldquo;For where two or three gather in my name, there am I with them.&rdquo; &ndash; Matthew 18:20
        </p>
      </section>
    </>
  );
}
