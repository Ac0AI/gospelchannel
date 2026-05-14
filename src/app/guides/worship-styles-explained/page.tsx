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
    slug: "contemporary-worship",
    name: "Contemporary worship",
    oneLine: "The default sound of most younger free-church congregations today.",
    body:
      "Full-band worship with electric guitars, drums, keys, and modern songs written in the last 20-30 years. Service tends to flow band-set → preaching → response, with screens for lyrics and a stage-and-rows seating layout. Volume varies congregation to congregation, but the sonic vocabulary is recognisable: chord progressions you've heard on the radio, song structures that build, lead singers carrying melody while the room sings along. The Hillsong, Elevation, and Bethel-style lineages all sit under this umbrella — congregations vary in how slick the production is and how much spontaneous space they leave inside the set.",
    examples:
      "Songs from Elevation Worship, Maverick City, Hillsong, Bethel Music, Phil Wickham, Brandon Lake, and similar artists are common. Most non-denominational, Pentecostal, and many Baptist and Anglican evangelical congregations sit here. Includes the high-production Hillsong-network style as well as more spontaneous Bethel-shaped sets.",
    fits:
      "Easiest landing point if you grew up with modern worship and want a service that sounds like the playlists you listen to all week. Also a comfortable starting point for someone new to church — the structure is uncomplicated and you don't need to know hymn melodies.",
    href: "/church/style/contemporary-worship",
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
    name: "Charismatic / Spirit-led worship",
    oneLine: "Expressive, open to the unplanned, prophetic-leaning.",
    body:
      "Charismatic worship overlaps with contemporary musically but adds a posture: raised hands are common, time is given for spontaneous prayer or song, people may speak in tongues, and prayer for healing is normal. Services often have less rigid structure — the set list is a starting point, not a script — and the room participates in shaping where the worship goes. Volume and intensity vary widely between congregations. Pentecostal congregations broadly sit here too, since their century-old tradition shares the same expressive, Spirit-expectant posture.",
    examples:
      "Vineyard, Pentecostal, newer charismatic networks, and many non-denominational churches. The Hillsong and Bethel sonic catalogues are deeply represented here as well — many Hillsong-style churches are charismatic in practice even if the music tag reads contemporary.",
    fits:
      "Natural home if you grew up in Pentecostal or charismatic settings, or if you want a worship service that leaves room for the unexpected. Worth trying once even if you didn't grow up in it — many people who think they want contemporary actually want charismatic.",
    href: "/church/style/charismatic",
  },
  {
    slug: "african",
    name: "African and diaspora worship",
    oneLine: "Rich vocal harmony, percussive rhythm, deep musical traditions across the continent and diaspora.",
    body:
      "Worship rooted in African musical traditions — full vocal harmony, layered percussion, energetic praise, and an unhurried sense of time. Includes Nigerian, Ghanaian, Kenyan, Ugandan, South African township gospel, and many other regional traditions, plus the diaspora congregations carrying those traditions into the United Kingdom, the United States, the Nordics, and beyond.",
    examples:
      "Strong across African Pentecostal and Anglican congregations, as well as diaspora churches in major Western cities. The Redeemed Christian Church of God, Winners Chapel, Christ Embassy, and many independent African-led congregations are common examples internationally.",
    fits:
      "If you're part of the African Christian diaspora and looking for a congregation that carries the sound of home, or you're an expat moving to or from Africa and want a service that bridges traditions. Also a strong fit for visitors drawn to expressive, full-voiced worship in any background.",
    href: "/church/style/african",
  },
  {
    slug: "latin",
    name: "Latin and Spanish worship",
    oneLine: "Spanish-language and Latin-rooted worship across the Americas, Iberia, and the diaspora.",
    body:
      "Spanish-language worship, plus Latin-rooted musical traditions — from Mexican and Central American congregational singing to Brazilian Portuguese-language worship and the wider Latin American Pentecostal traditions. Services often run in Spanish (or Portuguese) and weave traditional Christian hymnody with contemporary Latin worship songs.",
    examples:
      "Hispanic and Latin congregations across the United States, Latin America, Spain, and the diaspora. Includes Pentecostal, charismatic, and Catholic-rooted evangelical congregations. Artists shaping the sound include Marcos Witt, Christine D'Clario, Marcela Gandara, and many regional worship leaders.",
    fits:
      "If you speak Spanish (or Portuguese) and want a Sunday in your first language, or you're looking for a culturally Latin congregation. Also a strong fit for bilingual families wanting their children to grow up worshipping in both languages.",
    href: "/church/style/latin",
  },
  {
    slug: "acoustic",
    name: "Acoustic and folk-rooted worship",
    oneLine: "Stripped-back, often acoustic-guitar-led, sometimes Celtic or Nordic in feel.",
    body:
      "Worship led by acoustic guitar, piano, sometimes a small string section — smaller, quieter, and more intimate than a full-band contemporary set. Often draws from folk, Celtic, or Nordic musical traditions. Suits smaller rooms and congregations who want the lyrics carried by voices rather than amplification.",
    examples:
      "Many smaller free-church plants, church gatherings inside cafés or community spaces, and the Nordic Pingst tradition that often leans acoustic. Also a common style at student services and prayer meetings inside larger churches.",
    fits:
      "If you want worship that breathes — fewer layers, more space — or you find full-band sets overwhelming. Also a good fit for visitors who want to focus on the words rather than the production. Acoustic congregations tend to feel close-knit by design.",
    href: "/church/style/acoustic",
  },
  {
    slug: "kids",
    name: "Family and kids-forward worship",
    oneLine: "Worship designed so children are present and participating, not separate.",
    body:
      "Worship shaped so that kids stay in the room — songs the whole family can sing, shorter sermons or family-friendly preaching, age-aware leadership from the stage. Distinct from churches where children are sent to a separate stream; here the kids ministry is integrated into the main service.",
    examples:
      "Common at family-focused free-church congregations and many smaller Pentecostal churches. Also a feature of many international and diaspora congregations where multi-generational worship is the default rather than an option.",
    fits:
      "If you have young children and you'd rather worship together than split for the morning. Also a good fit for grandparents who want to bring grandchildren to a service that doesn't feel like a kids party or an adults-only event.",
    href: "/church/style/kids",
  },
  {
    slug: "rock",
    name: "High-energy and Christian rock",
    oneLine: "Loud, driving, often guitar-forward — for congregations who want Sunday to feel like a release.",
    body:
      "High-energy worship — heavier guitars, driving drums, strong build-and-release dynamics, lighting and stage culture that often borrow from secular concert design. Distinct from standard contemporary worship in intensity rather than song catalogue. Common in larger free-church plants targeting younger demographics and in congregations with a strong creative-arts ministry.",
    examples:
      "Christian rock-influenced congregations, many newer non-denominational plants, and the more energetic end of the Hillsong-network and Elevation Worship lineage. Christian EDM-influenced services also sit here when they exist.",
    fits:
      "If you want worship that runs loud and pushes hard. Also a good fit for visitors who find quieter services hard to settle into and want a Sunday that channels the same energy a great concert does.",
    href: "/church/style/rock",
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
