/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import Link from "next/link";
import { GuideHero, GuideRelated } from "@/components/guides";
import { buildGuideSchema } from "@/lib/seo-schema";

export const revalidate = 86400;

const META_TITLE = "Worship Styles Explained — Find Your Sunday Sound";
const META_DESCRIPTION =
  "A plain-spoken guide to contemporary, gospel, charismatic, Hillsong-style, Bethel-style, hymn-led, and blended worship — how each sounds and who tends to land where.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: "https://gospelchannel.com/guides/worship-styles-explained" },
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    url: "https://gospelchannel.com/guides/worship-styles-explained",
    siteName: "GospelChannel",
    type: "article",
  },
};

const STYLES: Array<{
  slug: string;
  name: string;
  oneLine: string;
  body: string;
  examples: string;
  fits: string;
  href: string;
}> = [
  {
    slug: "contemporary",
    name: "Contemporary worship",
    oneLine: "The default sound of most younger free-church congregations today.",
    body:
      "Full-band worship with electric guitars, drums, keys, and modern songs written in the last 20-30 years. Service tends to flow band-set → preaching → response, with screens for lyrics and a stage-and-rows seating layout. Volume varies congregation to congregation, but the sonic vocabulary is recognisable: chord progressions you've heard on the radio, song structures that build, lead singers carrying melody while the room sings along.",
    examples:
      "Songs from Elevation Worship, Maverick City, Hillsong, Bethel Music, Phil Wickham, Brandon Lake, and similar artists are common. Most non-denominational, Pentecostal, and many Baptist and Anglican evangelical congregations sit here.",
    fits:
      "Easiest landing point if you grew up with modern worship and want a service that sounds like the playlists you listen to all week. Also a comfortable starting point for someone new to church — the structure is uncomplicated and you don't need to know hymn melodies.",
    href: "/church/style/contemporary",
  },
  {
    slug: "gospel",
    name: "Gospel worship",
    oneLine: "Black-church-rooted, expressive, deeply musical.",
    body:
      "Traditional and contemporary gospel — choirs, organ, bass-heavy rhythm, soulful vocals, call-and-response between leader and congregation. Services often run longer than the average free-church Sunday and lean into a sustained musical build that's central to the experience, not a warm-up for the sermon. The line between worship and witness is intentionally blurred.",
    examples:
      "Strong in historically Black congregations in the United States and increasingly in international cities. Artists and choir traditions that shape the sound include CeCe Winans, Kirk Franklin, Maverick City, Tasha Cobbs Leonard, Brooklyn Tabernacle Choir, and many regional church choirs.",
    fits:
      "If you grew up in gospel-tradition churches or you're drawn to expressive, full-voiced worship and the kind of Sunday that doesn't rush. Also a strong fit for visitors who want music that's musically demanding and emotionally generous in equal measure.",
    href: "/church/style/gospel",
  },
  {
    slug: "charismatic",
    name: "Charismatic worship",
    oneLine: "Spirit-led, expressive, open to the unplanned.",
    body:
      "Charismatic worship overlaps with contemporary musically but adds a posture: raised hands are common, time is given for spontaneous prayer or song, people may speak in tongues, and prayer for healing is normal. Services often have less rigid structure — the set list is a starting point, not a script — and the room participates in shaping where the worship goes. Volume and intensity vary widely between congregations.",
    examples:
      "Vineyard, Pentecostal, newer charismatic networks, and many non-denominational churches. The Hillsong and Bethel sonic catalogues are deeply represented in this tradition.",
    fits:
      "Natural home if you grew up in Pentecostal or charismatic settings, or if you want a worship service that leaves room for the unexpected. Worth trying once even if you didn't grow up in it — many people who think they want contemporary actually want charismatic.",
    href: "/church/style/charismatic",
  },
  {
    slug: "hillsong",
    name: "Hillsong-network style",
    oneLine: "A specific, recognisable lineage of contemporary worship.",
    body:
      "Churches in the Hillsong Network, or congregations heavily shaped by Hillsong Worship's catalogue and stage culture. Recognisable by a slick production value, a tight band, modern lighting, a recognisable set of songs, and a service flow that's been honed across many campuses. Skews younger and tends to cluster in big cities.",
    examples:
      "Hillsong campuses worldwide, plus many independent churches that lean on the Hillsong Worship songbook and aesthetic. Sister-network influences include Elevation Worship, Planetshakers, and similar.",
    fits:
      "If you grew up on Hillsong music, want a high-production-value Sunday morning, or you're new to a city and want a church experience that's polished and predictable. Easy to recommend to someone joining you for the first time.",
    href: "/church/style/hillsong",
  },
  {
    slug: "bethel",
    name: "Bethel-influenced worship",
    oneLine: "Spontaneous, prophetic, sometimes contemplative.",
    body:
      "Churches shaped by Bethel Music's sound — extended spontaneous worship, prophetic singing, an emphasis on encountering the presence of God in the moment. Often less concert-like than Hillsong-style and more contemplative within a charismatic frame. The sermon is part of the service but the worship is often the centrepiece of the morning.",
    examples:
      "Bethel Church in Redding plus the wider network of churches and worship leaders influenced by Bethel Music — Jesus Culture, Brian and Jenn Johnson, Cory Asbury, Steffany Gretzinger, and many others.",
    fits:
      "If you're drawn to extended worship sets, spontaneous singing, and a charismatic-prophetic posture. Also worth trying if you've been frustrated by services where worship feels like a warm-up rather than the main thing.",
    href: "/church/style/bethel",
  },
  {
    slug: "pentecostal",
    name: "Pentecostal worship",
    oneLine: "Intergenerational, expressive, deep tradition.",
    body:
      "Pentecostal worship overlaps significantly with charismatic but carries its own century of tradition. Expect a strong intergenerational room — children visible alongside grandparents — expressive participation, prayer for healing, and a long Pentecostal songbook alongside contemporary songs. Sermon and altar response often anchor the service.",
    examples:
      "Assemblies of God, Foursquare, Church of God (Cleveland), classical Pentecostal denominations worldwide, and many Black-church Pentecostal traditions. In Sweden, Pingst (Pingströrelsen) carries this lineage.",
    fits:
      "If you grew up Pentecostal or you're looking for a congregation where the Spirit's work is named and expected. Also a strong fit for families looking for a church where children are present in the room rather than in a separate stream.",
    href: "/church/style/pentecostal",
  },
  {
    slug: "hymn",
    name: "Hymn-led worship",
    oneLine: "The classic tradition — organ or piano, sung verses, often shorter services.",
    body:
      "Worship led by hymns from a denomination's hymnal, often with organ or piano accompaniment, sometimes a small choir, and limited or no band. Songs are familiar across generations and carry theological weight in their lyrics — they teach as well as worship. Services tend to follow a stable structure and end on time.",
    examples:
      "Many Baptist, Methodist, Anglican, Presbyterian, and Lutheran congregations have a strong hymn-led tradition. Free-church congregations vary — some are hymn-led by default, others mix hymns with contemporary songs.",
    fits:
      "If you grew up singing hymns and miss them in contemporary services. Also a good fit if you want a Sunday where the music is dependable and the room sings together rather than listening to a band. Hymn-led services are deeply loved by their congregations and remain a healthy choice for any season of life.",
    href: "/church/style/hymn",
  },
  {
    slug: "blended",
    name: "Blended worship",
    oneLine: "Hymns and contemporary songs together in one service.",
    body:
      "Sunday morning includes both — sometimes a hymn opens the service and a contemporary song closes it, sometimes the two are woven through. Band and organ may share the stage. Many congregations land here intentionally because they have members across generations who want different things and they choose not to split the church into two services.",
    examples:
      "Common in Baptist, Methodist, Anglican, and many independent evangelical congregations. Often the default when a church serves a mixed-age congregation in a smaller town or city without enough volume to run a separate contemporary service.",
    fits:
      "If you want some musical variety on a Sunday, or you're part of a household where different generations want different worship and you'd rather sit together than separate. Also a good landing spot for someone who doesn't know yet what fits.",
    href: "/church/style/blended",
  },
];

export default function WorshipStylesExplainedPage() {
  const schema = buildGuideSchema({
    slug: "worship-styles-explained",
    headline: "Worship Styles Explained",
    description: META_DESCRIPTION,
  });

  return (
    <article className="mx-auto max-w-[1080px] px-5 pb-24 sm:px-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <GuideHero
        eyebrow="Free guide"
        title="Worship styles,"
        titleAccent="without the jargon"
        intro="Eight worship styles you'll meet across free-church and evangelical congregations — how each sounds, who tends to land where, and the link to every church in that style. No tradition is ranked above another. Pick the one that fits your season and start there."
      />

      <section className="mt-12 max-w-[760px]">
        <p className="text-base leading-relaxed text-warm-brown sm:text-lg">
          Two free-church congregations on the same street can sound completely different on a
          Sunday morning. That isn't a bug — different worship traditions reach different people
          and meet different needs, and most of us know which fits us long before we can name it.
          This guide names the most common styles so you can search the directory with the right
          vocabulary in hand.
        </p>
        <p className="mt-4 text-base leading-relaxed text-warm-brown sm:text-lg">
          What you'll see below: a short description of each style, common examples of the music
          and lineage that shape it, who tends to land there, and a link to every church we list
          in that style. None of these styles is &ldquo;better&rdquo; — every one of them is
          loved by the congregations that gather around it.
        </p>
      </section>

      <section className="mt-16 space-y-12">
        {STYLES.map((style, index) => (
          <div key={style.slug} id={style.slug} className="scroll-mt-24">
            <p className="gc-eyebrow">Style {String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-[40px]">
              {style.name}
            </h2>
            <p className="mt-3 max-w-[720px] font-serif text-lg italic text-rose-gold">
              {style.oneLine}
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">
                  How it sounds
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                  {style.body}
                </p>
              </div>
              <div>
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">
                  Lineage and examples
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                  {style.examples}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">
                Who tends to land here
              </h3>
              <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-warm-brown sm:text-base">
                {style.fits}
              </p>
            </div>
            <Link
              href={style.href}
              className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
            >
              Browse {style.name.toLowerCase()} churches &rarr;
            </Link>
          </div>
        ))}
      </section>

      {/* Closing */}
      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          How to use this guide
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Read the style descriptions, pick one or two that sound closest to where you want to
          land this Sunday, and open the corresponding church listing. From there you can narrow
          by city, country, or denomination. If you're between styles, the church fit quiz takes
          seven questions and surfaces three churches calibrated to your answers.
        </p>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Worship style isn't the only thing that makes a church the right fit, but it's often
          the fastest filter — and the one most directories ignore. Use it as a starting point,
          not a verdict on a congregation you haven't visited.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/church/style"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse all worship styles
          </Link>
          <Link
            href="/guides/worship-style-match"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Try the worship style match
          </Link>
          <Link
            href="/guides/church-fit-quiz"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Take the fit quiz
          </Link>
        </div>
      </section>

      <GuideRelated current="worship-styles-explained" />
    </article>
  );
}
