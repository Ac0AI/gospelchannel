/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import Link from "next/link";
import { getWorshipByDenominationReport } from "@/lib/worship-by-denomination-report";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 86400;

const PAGE_URL = "https://gospelchannel.com/worship-by-denomination";
const PLAYLIST_CHURCH = "https://playlist.church";
const SIBLING = "https://gospelchannel.com/worship-songs-2026";

const META_TITLE =
  "Do Different Denominations Sing Different Worship Songs? (2026 Data)";
const META_DESCRIPTION =
  "We joined the real Spotify playlists of 258 churches to their denomination. Everyone sings the megachurch anthems, but modern-hymn adoption splits hard by tradition: Baptist 60%, Pentecostal 11%.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    title: "Do different denominations sing different worship songs?",
    description:
      "Everyone sings the megachurch anthems. Whether they also sing the new hymns depends entirely on their tradition. Measured from real church playlists.",
    url: PAGE_URL,
    siteName: "GospelChannel",
    type: "article",
  },
  twitter: {
    images: ["https://gospelchannel.com/hero-worship.jpg"],
    card: "summary_large_image",
    title: "Do different denominations sing different worship songs?",
    description:
      "Megachurch anthems are near-universal. Modern hymns split by tradition: Baptist 60%, Pentecostal 11%.",
  },
  robots: { index: true, follow: true },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do different denominations sing different worship songs?",
    a: "Partly. In this data, the big megachurch anthems (Hillsong, Bethel, Elevation, Passion) reach a large majority of churches in every tradition, from 60% to 84%, and 73% overall. What splits by denomination is the modern hymn: Baptist churches carry a Getty, CityAlight, or Sovereign Grace hymn 60% of the time; Pentecostal churches only 11%. So the divide is not the anthems everyone shares, it is whether a tradition also sings the new hymns.",
  },
  {
    q: "Which denominations sing the most modern hymns?",
    a: "In this sample, Baptist churches lead at 60%; evangelical (50%) and Anglican/Episcopal (48%) follow close behind and are within sampling range of each other. Pentecostal (11%) and non-denominational (24%) churches sing them least. Modern hymns here means songs from CityAlight, Keith & Kristyn Getty, or Sovereign Grace Music (classified by publisher, not by musical form).",
  },
  {
    q: "What worship songs do non-denominational churches sing?",
    a: "Almost entirely megachurch anthems. The most common in non-denominational churches are Praise (Elevation), What A Beautiful Name (Hillsong), Goodness of God (Bethel), and I Speak Jesus. None of their top songs is a modern hymn.",
  },
  {
    q: "What counts as a modern hymn?",
    a: "The lyric-first, theologically dense songs of the modern-hymn movement, associated with Keith & Kristyn Getty, CityAlight, and Sovereign Grace Music. Well-known examples include In Christ Alone, Yet Not I But Through Christ in Me, and Behold Our God. The movement began as a reaction to repetitive contemporary worship and is rooted in Reformed, word-centered theology.",
  },
  {
    q: "How was this measured?",
    a: "By joining two independent sources: each church's denomination (from directory data) and the songs in its public Spotify worship playlists (the playlist.church corpus). Nothing here is guessed by an AI worship-style classifier. It covers 258 English-speaking churches with a recognizable denomination.",
  },
];

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-3xl font-semibold tabular-nums text-espresso sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-warm">
        {label}
      </p>
    </div>
  );
}

function SplitRow({
  family,
  churches,
  hymn,
  anthem,
}: {
  family: string;
  churches: number;
  hymn: number;
  anthem: number;
}) {
  return (
    <div className="border-b border-espresso/10 py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold text-espresso">
          {family}
        </h3>
        <span className="text-xs text-muted-warm">n = {churches}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-warm-brown">Modern hymns</span>
            <span className="font-serif tabular-nums text-espresso">
              {hymn}%
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-linen-deep/70">
            <div
              className="h-full rounded-full bg-rose-gold"
              style={{ width: `${hymn}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-warm-brown">Megachurch anthems</span>
            <span className="font-serif tabular-nums text-espresso">
              {anthem}%
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-linen-deep/70">
            <div
              className="h-full rounded-full bg-espresso/45"
              style={{ width: `${anthem}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorshipByDenominationPage() {
  const data = getWorshipByDenominationReport();
  const reportable = data.families.reduce((n, f) => n + f.churches, 0);
  const byHymn = [...data.families].sort(
    (a, b) => b.modernHymnPct - a.modernHymnPct,
  );
  const baptist = data.families.find((f) => f.family === "Baptist");
  const pentecostal = data.families.find((f) => f.family === "Pentecostal");

  const articleSchema = buildArticleSchema({
    url: PAGE_URL,
    headline: "Do Different Denominations Sing Different Worship Songs?",
    description: META_DESCRIPTION,
    datePublished: "2026-07-26",
    dateModified: "2026-07-26",
    about: [
      "Worship music",
      "Christian denominations",
      "Congregational singing",
      { name: "Modern hymn movement" },
      { name: "CityAlight" },
      { name: "Keith & Kristyn Getty" },
    ],
    mentions: [
      { name: "playlist.church", url: PLAYLIST_CHURCH },
      { name: "The Worship Songs Churches Actually Sing", url: SIBLING },
    ],
  });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "GospelChannel", url: "https://gospelchannel.com" },
    { name: "Do different denominations sing different worship songs?", url: PAGE_URL },
  ]);
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Worship by Denomination 2026: playlist adoption by tradition",
    description:
      `Worship-song adoption by denomination across ${reportable} English-speaking churches in ${data.families.length} denomination families, ` +
      "joining directory denomination labels to real Spotify church-playlist data. " +
      "Song data is observed, not AI-inferred worship style; hymn/anthem indices classify by publishing house.",
    url: PAGE_URL,
    sameAs: [PLAYLIST_CHURCH, SIBLING],
    creator: {
      "@type": "Organization",
      name: "GospelChannel",
      url: "https://gospelchannel.com",
    },
    datePublished: data.generatedAt,
    dateModified: data.generatedAt,
    version: data.version,
    inLanguage: "en",
    isAccessibleForFree: true,
    license: "https://creativecommons.org/licenses/by/4.0/",
    keywords: [
      "worship songs",
      "denominations",
      "modern hymns",
      "contemporary worship",
      "church music",
      "open data",
    ],
    temporalCoverage: "2026",
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: "https://gospelchannel.com/api/worship-by-denomination.json",
      },
    ],
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            articleSchema,
            breadcrumbSchema,
            datasetSchema,
            faqSchema,
          ]),
        }}
      />

      <header>
        <p className="gc-eyebrow">Data study · 2026</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.01em] text-espresso sm:text-6xl">
          Do different denominations sing different worship songs?
        </h1>
        <p className="mt-5 max-w-[720px] text-lg leading-relaxed text-warm-brown">
          We took {reportable} English-speaking churches, joined each one to its
          denomination, and looked at what its Spotify worship playlists contain.
          A clear majority in every tradition share the same megachurch anthems.
          What splits along denominational lines is something else entirely.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-6 rounded-2xl border border-espresso/12 bg-linen-deep/30 p-6 sm:grid-cols-4 sm:p-8">
        <StatCell value={String(reportable)} label="churches" />
        <StatCell value={String(data.families.length)} label="traditions" />
        <StatCell value={`${data.overall.megachurchAnthemPct}%`} label="sing the anthems" />
        <StatCell value={`${data.overall.modernHymnPct}%`} label="sing modern hymns" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-warm">
        Denomination comes from directory data; song adoption from each church's
        playlists, so this is not the AI worship-style classifier repackaged. Of
        {" "}{data.population.churches} English-speaking, playlist-publishing
        churches, these {reportable} had a clear denomination. It leans
        contemporary and is not a census.
      </p>

      {/* Lead answer */}
      <section className="mt-14">
        <p className="max-w-[760px] text-lg leading-relaxed text-warm-brown">
          Across {reportable} churches, songs from the four big worship houses
          (Hillsong, Bethel, Elevation, and Passion) show up in{" "}
          {data.overall.megachurchAnthemPct}% of them, and in a clear majority of
          every tradition (from 60% of Anglican churches to 84% of
          non-denominational ones). The real denominational difference is the{" "}
          <strong className="text-espresso">modern hymn</strong>. Baptist
          churches carry a Getty, CityAlight, or Sovereign Grace hymn{" "}
          {baptist?.modernHymnPct}% of the time. Pentecostal churches, just{" "}
          {pentecostal?.modernHymnPct}%. So what separates traditions is not the
          anthems they share, it is whether they also sing the new hymns.
        </p>
      </section>

      {/* The split */}
      <section className="mt-16">
        <p className="gc-eyebrow">The split</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          One shared anthem canon, a hymn line that splits by tradition
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Share of each tradition's churches with at least one modern hymn
          (CityAlight, Getty, or Sovereign Grace) versus at least one megachurch
          anthem (Hillsong, Bethel, Elevation, or Passion) in their playlists. We
          sort songs by publishing house, not musical form. The anthem bars run
          long across the board, from 60% up. The hymn bars are where the
          traditions pull apart.
        </p>
        <div className="mt-7 rounded-2xl border border-espresso/12 bg-white p-5 sm:p-7">
          {byHymn.map((f) => (
            <SplitRow
              key={f.family}
              family={f.family}
              churches={f.churches}
              hymn={f.modernHymnPct}
              anthem={f.megachurchAnthemPct}
            />
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="mt-16">
        <p className="gc-eyebrow">Why the hymn line lands there</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          The modern hymn revival found a home in one kind of church
        </h2>
        <div className="mt-4 max-w-[720px] space-y-4 text-base leading-relaxed text-warm-brown">
          <p>
            The songs pulling those hymn bars up are not old. They belong to the
            modern-hymn movement that grew out of Keith and Kristyn Getty's In
            Christ Alone, joined later by CityAlight and Sovereign Grace Music.
            Christianity Today has described it as a self-consciously theological
            project, a reaction to worship its writers saw as repetitive and thin,
            built on dense, lyric-first, word-centered songs. In Christ Alone has
            sat on CCLI's Top 100 for more than fifteen years, and Getty songs
            alone account for a meaningful slice of the most-used titles in US and
            UK churches.
          </p>
          <p>
            Our data shows where that movement actually landed. Its natural home
            is the confessional, word-centered end of the church: Baptist,
            Reformed-leaning evangelical, and Anglican congregations sing these
            hymns roughly half the time or more. The experiential, charismatic end
            (Pentecostal and much of the non-denominational world) largely stayed
            with the anthems. Two very different sources, the movement's own
            theology and what churches actually saved to their playlists, point to
            the same map.
          </p>
        </div>
      </section>

      {/* Per-family */}
      <section className="mt-16">
        <p className="gc-eyebrow">In their own playlists</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          What each tradition sings most
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          The most common songs in each tradition's playlists. Read the top of
          the Non-denominational and Evangelical lists side by side and the whole
          study is right there.
        </p>
        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          {data.families.map((f) => (
            <div
              key={f.family}
              className="rounded-2xl border border-espresso/12 bg-white p-5 sm:p-6"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-serif text-xl font-semibold text-espresso">
                  {f.family}
                </h3>
                <span className="text-xs text-muted-warm">n = {f.churches}</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-warm">
                hymns {f.modernHymnPct}% · anthems {f.megachurchAnthemPct}%
              </p>
              <ol className="mt-4 space-y-2">
                {f.topSongs.slice(0, 6).map((s, i) => (
                  <li
                    key={`${f.family}-${i}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-espresso">
                      <span className="mr-2 font-serif tabular-nums text-muted-warm">
                        {i + 1}
                      </span>
                      {s.title}
                    </span>
                    <span className="tabular-nums text-muted-warm">{s.pct}%</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="mt-16 rounded-2xl border border-espresso/12 bg-linen-deep/30 p-6 sm:p-8">
        <p className="gc-eyebrow">How we measured this</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          Method, and what it does not cover
        </h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-warm-brown">
          <p>
            We started from the{" "}
            <a
              href={PLAYLIST_CHURCH}
              className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
            >
              playlist.church
            </a>{" "}
            corpus (built {data.builtOn}) of real church-curated Spotify worship
            playlists, and joined each church to its denomination from our
            directory. The denomination label is not derived from the songs, and
            the songs were chosen by the churches, not inferred by a worship-style
            model, so this is not that classifier repackaged. We sort songs into
            hymns and anthems by their publishing house (CityAlight, Getty, and
            Sovereign Grace on one side; Hillsong, Bethel, Elevation, and Passion
            on the other), not by musical form, so a hymn-shaped Hillsong song
            like King of Kings is counted on the anthem side. We restricted the
            comparison to{" "}
            {data.population.churches} churches in English-speaking countries so a
            language difference could not masquerade as a denominational one, then
            reported the {data.families.length} denomination families with at
            least {data.population.minFamilySize} churches ({reportable} churches
            in total).
          </p>
          <p>
            <strong className="text-espresso">Read it as a signal, not a
            verdict.</strong> The per-tradition samples are modest (25 to 80
            churches), a church "sings" a song if it is in a playlist rather than
            logged service by service, and the whole corpus skews toward
            contemporary, playlist-publishing churches. The gap between Baptist at{" "}
            {baptist?.modernHymnPct}% and Pentecostal at{" "}
            {pentecostal?.modernHymnPct}% is wide enough to be real; treat the
            smaller differences as directional.
          </p>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-warm">
          Cite &amp; download
        </p>
        <p className="mt-3 text-base leading-relaxed text-warm-brown">
          The aggregates are open under{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            CC BY 4.0
          </a>{" "}
          and available as raw JSON at{" "}
          <Link
            href="/api/worship-by-denomination.json"
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            /api/worship-by-denomination.json
          </Link>
          . This is the by-tradition companion to{" "}
          <Link
            href="/worship-songs-2026"
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            the overall worship-song chart
          </Link>
          . For methodology questions, write to press at gospelchannel dot com.
        </p>
        <p className="mt-4 text-xs text-muted-warm">
          Generated {data.generatedAt} · Data version {data.version} · Context:
          Christianity Today on the Getty modern-hymn movement (2024); benchmark:
          CCLI Top 100.
        </p>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          Questions people ask
        </h2>
        <div className="mt-6 space-y-6">
          {FAQS.map((f) => (
            <div key={f.q}>
              <h3 className="font-serif text-xl font-semibold text-espresso">
                {f.q}
              </h3>
              <p className="mt-2 max-w-[760px] text-base leading-relaxed text-warm-brown">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 border-t border-espresso/10 pt-10">
        <h2 className="font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          Find a church that sings your language of worship
        </h2>
        <p className="mt-3 max-w-[680px] text-base leading-relaxed text-warm-brown">
          Whether you want the modern hymns or the big anthems, you can browse by
          denomination or worship style and hear what a church actually sounds
          like before you visit.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/church/denomination"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse churches by denomination
          </Link>
          <Link
            href="/worship-songs-2026"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            The overall worship-song chart
          </Link>
          <Link
            href="/guides/worship-styles-explained"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Worship styles explained
          </Link>
        </div>
        <p className="mt-6 text-sm text-warm-brown">
          The live, always-current chart lives at{" "}
          <a
            href={PLAYLIST_CHURCH}
            className="font-semibold text-rose-gold underline decoration-rose-gold/40 underline-offset-2 hover:text-rose-gold-deep"
          >
            playlist.church
          </a>
          .
        </p>
      </section>
    </article>
  );
}
