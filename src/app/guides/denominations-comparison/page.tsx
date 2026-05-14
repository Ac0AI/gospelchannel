/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import Link from "next/link";
import { GuideHero, GuideRelated } from "@/components/guides";
import { buildGuideSchema } from "@/lib/seo-schema";

export const revalidate = 86400;

const META_TITLE = "Free-Church Denominations Compared — A Plain-Spoken Guide";
const META_DESCRIPTION =
  "Baptist, Pentecostal, charismatic, non-denominational, Vineyard, Methodist, Anglican — how the major free-church and evangelical traditions differ and who tends to land where.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: "https://gospelchannel.com/guides/denominations-comparison" },
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    url: "https://gospelchannel.com/guides/denominations-comparison",
    siteName: "GospelChannel",
    type: "article",
  },
};

const DENOMINATIONS: Array<{
  slug: string;
  name: string;
  oneLine: string;
  shape: string;
  worship: string;
  fits: string;
  href: string;
}> = [
  {
    slug: "baptist",
    name: "Baptist",
    oneLine: "Believer's baptism, congregational governance, a wide range of expressions.",
    shape:
      "Baptists hold to baptism by full immersion of believers (rather than infant baptism), local-church autonomy, and a strong emphasis on Scripture. Beyond those shared distinctives the family is wide: Southern Baptist, American Baptist, Independent Baptist, Reformed Baptist, and many independent congregations each have their own texture. Worship styles range from hymn-led traditional to contemporary band-led, depending on the congregation.",
    worship:
      "Highly variable across congregations. Older Baptist churches often lean hymn-led or blended; newer Baptist plants frequently lean contemporary. Reformed Baptist churches typically run more sermon-centred services with simpler music.",
    fits:
      "If you want a tradition with strong roots in believer's baptism and clear teaching, with a wide range of worship styles available across congregations. Often a comfortable fit for visitors who want sermons that go deep into Scripture.",
    href: "/church/denomination/baptist",
  },
  {
    slug: "pentecostal",
    name: "Pentecostal",
    oneLine: "Spirit-empowered worship, expectation of the gifts, deep tradition.",
    shape:
      "Pentecostal denominations share an emphasis on the work of the Holy Spirit — baptism in the Spirit, the contemporary use of spiritual gifts including tongues and prophecy, and prayer for healing as a normal part of church life. Includes Assemblies of God, Foursquare, Church of God (Cleveland), Pingst (Sweden), and many international Pentecostal movements. Often intergenerational, with children visible in the main service.",
    worship:
      "Expressive and Spirit-led. Strong tradition of expectant prayer, altar response, and full-voiced worship. Ranges from traditional Pentecostal hymnody to contemporary charismatic worship.",
    fits:
      "If you grew up Pentecostal or you're looking for a service where the Spirit's work is named and expected. Also a good landing point for visitors who want intergenerational worship and aren't put off by expressiveness.",
    href: "/church/denomination/pentecostal",
  },
  {
    slug: "non-denominational",
    name: "Non-denominational",
    oneLine: "Each congregation defines itself; no formal denomination above the local church.",
    shape:
      "Non-denominational churches don't formally belong to a denomination. Each congregation defines its own doctrinal statement, governance, and culture — though most sit broadly in the evangelical tradition. This gives enormous variation: a non-denominational church might be charismatic, Reformed, family-focused, or seeker-friendly. The denomination label tells you less than it would for, say, a Baptist congregation.",
    worship:
      "Almost always contemporary, often charismatic or charismatic-adjacent. Many of the larger non-denominational churches in North America and beyond lean heavily on the contemporary worship songbook.",
    fits:
      "If you want a tradition-flexible church or you don't have a denominational background to anchor on. Read individual profiles carefully — non-denominational covers a wider range of expressions than most other labels.",
    href: "/church/denomination/non-denominational",
  },
  {
    slug: "vineyard",
    name: "Vineyard",
    oneLine: "Warm, charismatic-but-grounded, born out of the 1970s Jesus movement.",
    shape:
      "The Vineyard movement emerged from the broader charismatic renewal in California in the 1970s and 1980s, shaped by leaders like John Wimber. Vineyard churches hold a charismatic theology of the Spirit's gifts, an emphasis on the Kingdom of God breaking into the present, and a famously warm, low-jargon culture. The Vineyard songbook has shaped modern worship significantly.",
    worship:
      "Contemporary, often charismatic, with extended worship sets and intentional space for spontaneous prayer or prophecy. Less concert-feel than Hillsong-style; more emphasis on a worshipping room than a performing stage.",
    fits:
      "If you want charismatic substance without the high-production-value tone, or you've found big-stage Sundays distracting. Vineyard congregations tend to be unusually welcoming to people new to faith or processing church history.",
    href: "/church/denomination/vineyard",
  },
  {
    slug: "methodist",
    name: "Methodist",
    oneLine: "Wesleyan tradition emphasising sanctification, social holiness, and gracious teaching.",
    shape:
      "Methodist churches trace back to the Wesley brothers in 18th-century England, with an emphasis on sanctification (growing in holiness), small-group accountability, and an active concern for social justice and personal piety. Includes United Methodist, Free Methodist, Wesleyan, Nazarene, and many international Methodist bodies. Methodist worship varies but often retains hymn-led elements alongside contemporary songs.",
    worship:
      "Often blended — hymn-led with contemporary songs added. Free Methodist and Wesleyan congregations sometimes lean fully contemporary. Communion is typically more frequent than in Baptist or non-denominational settings.",
    fits:
      "If you want a tradition with strong roots in personal holiness and small-group discipleship, with a flexible approach to worship style. Often a comfortable fit for visitors who want sermons that take seriously how faith shapes daily life.",
    href: "/church/denomination/methodist",
  },
  {
    slug: "anglican",
    name: "Anglican / Episcopal",
    oneLine: "Liturgical structure, broad theological range, deep historical roots.",
    shape:
      "Anglican churches (called Episcopal in the United States) share a liturgical tradition rooted in the Book of Common Prayer and the historic creeds. Within Anglicanism the theological range is wide — from evangelical and charismatic congregations to Anglo-Catholic and broad-church streams. Many evangelical Anglican churches sit comfortably in free-church-adjacent space, with strong contemporary worship and serious Scripture preaching.",
    worship:
      "Liturgical structure as a foundation, with worship style varying from traditional hymn-led with organ to fully contemporary with a band. Communion is typically weekly and central to the service.",
    fits:
      "If you want the rhythm and depth of a liturgical service, or you've found unstructured services overwhelming. Evangelical Anglican congregations are also a common landing point for people processing church history — the tradition handles questions well.",
    href: "/church/denomination/anglican",
  },
  {
    slug: "lutheran",
    name: "Lutheran",
    oneLine: "Reformation roots, strong on grace, liturgical or evangelical depending on stream.",
    shape:
      "Lutheran churches trace to Martin Luther and the Reformation, with a strong emphasis on justification by faith, the centrality of grace, and Word-and-Sacrament worship. Internationally Lutheran churches range from state churches (like Svenska Kyrkan) to free-church Lutheran movements (like LCMS in the US or the EFCA's Lutheran roots). Free-church Lutheran congregations are the ones most often listed on free-church directories.",
    worship:
      "Liturgical and Word-centred, with hymn-led music in most traditional congregations and contemporary or blended music in newer or evangelical Lutheran plants. Strong tradition of catechesis and intentional teaching.",
    fits:
      "If you grew up Lutheran or you want a service grounded in the Reformation's emphasis on grace and Scripture. Free-church Lutheran congregations are a common landing point for people who want Reformation depth without state-church culture.",
    href: "/church/denomination/lutheran",
  },
  {
    slug: "reformed",
    name: "Reformed",
    oneLine: "Calvinist theology, robust teaching, strong confessional clarity.",
    shape:
      "Reformed churches share a Calvinist theological framework — God's sovereignty in salvation, the historic Reformation confessions (Westminster, Belgic, Heidelberg), and an emphasis on doctrinal precision. Includes Presbyterian, Reformed Baptist, Free Reformed, and many Reformed evangelical congregations. Sermon-centred services are typical, with serious expositional preaching as the heart of Sunday worship.",
    worship:
      "Often hymn-led or simple worship — psalms in traditional congregations, hymns in most, sometimes contemporary songs in newer Reformed plants. Music typically serves the Word rather than carrying the service.",
    fits:
      "If you want clear, robust teaching with strong confessional clarity and a service centred on the sermon. Reformed congregations tend to be a comfortable fit for visitors who value theological precision and intellectual engagement with Scripture.",
    href: "/church/denomination/reformed",
  },
];

export default function DenominationsComparisonPage() {
  const schema = buildGuideSchema({
    slug: "denominations-comparison",
    headline: "Free-Church Denominations Compared",
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
        title="Free-church denominations,"
        titleAccent="compared plainly"
        intro="Eight traditions you'll meet across free-church and evangelical Christianity — what each emphasises, how Sunday usually feels, and who tends to land where. Every tradition described here is held warmly by the people who gather around it; none is presented as the right answer."
      />

      <section className="mt-12 max-w-[760px]">
        <p className="text-base leading-relaxed text-warm-brown sm:text-lg">
          Denominations are families of churches with shared theology, history, and culture. The
          labels can be intimidating if you didn't grow up using them, and the differences can
          feel bigger from a distance than they often are inside a Sunday morning. This guide
          describes each major free-church and evangelical tradition in plain language so you can
          read the directory with the right vocabulary in hand.
        </p>
        <p className="mt-4 text-base leading-relaxed text-warm-brown sm:text-lg">
          What you'll see below: a short summary of each tradition's shape, the kind of worship
          you'll usually find, who tends to land where, and the link to every church we list in
          that denomination. None of these traditions is ranked — they are different families,
          not better or worse versions of the same thing.
        </p>
        <p className="mt-4 text-base leading-relaxed text-warm-brown sm:text-lg">
          A note on scope: GospelChannel focuses on the free-church / evangelical / charismatic
          segment. Catholic, Orthodox, and state-church traditions are described elsewhere; this
          guide stays inside the part of the Christian family we're built around.
        </p>
      </section>

      <section className="mt-16 space-y-12">
        {DENOMINATIONS.map((denom, index) => (
          <div key={denom.slug} id={denom.slug} className="scroll-mt-24">
            <p className="gc-eyebrow">Tradition {String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-[40px]">
              {denom.name}
            </h2>
            <p className="mt-3 max-w-[720px] font-serif text-lg italic text-rose-gold">
              {denom.oneLine}
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">
                  Tradition and shape
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                  {denom.shape}
                </p>
              </div>
              <div>
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">
                  Worship on a Sunday
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                  {denom.worship}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">
                Who tends to land here
              </h3>
              <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-warm-brown sm:text-base">
                {denom.fits}
              </p>
            </div>
            <Link
              href={denom.href}
              className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
            >
              Browse {denom.name.split(" /")[0].toLowerCase()} churches &rarr;
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          A few honest notes
        </h2>
        <p className="mt-4 max-w-[760px] text-base leading-relaxed text-warm-brown">
          Denomination labels matter less inside a specific congregation than they might suggest
          from outside. Two Baptist churches three miles apart can feel completely different on
          a Sunday; two non-denominational churches in the same city often have more in common
          than the label implies. Use the denomination filter as a starting point, then read
          individual church profiles to find the actual fit.
        </p>
        <p className="mt-4 max-w-[760px] text-base leading-relaxed text-warm-brown">
          Worship style often matters more than denomination for week-to-week fit, especially for
          younger visitors and people moving between countries. If you want to filter on that
          first, the worship-styles guide is a better entry point. The two work together.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/church/denomination"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse all denominations
          </Link>
          <Link
            href="/guides/worship-styles-explained"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Worship styles guide
          </Link>
          <Link
            href="/guides/church-fit-quiz"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Take the fit quiz
          </Link>
        </div>
      </section>

      <GuideRelated current="denominations-comparison" />
    </article>
  );
}
