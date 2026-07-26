/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import Link from "next/link";
import { getWorshipSongsReport } from "@/lib/worship-songs-report";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 86400;

const PAGE_URL = "https://gospelchannel.com/worship-songs-2026";
const JSON_URL = "https://gospelchannel.com/api/worship-songs-2026.json";
const PLAYLIST_CHURCH = "https://playlist.church";

const META_TITLE =
  "The Worship Songs Churches Actually Sing (2026): A Data Study";
const META_DESCRIPTION =
  "We read the real Spotify worship playlists of 825 churches in 31 countries. What A Beautiful Name and Great Are You Lord lead the chart, and four worship houses reach most churches. An independent, playlist-based measurement of modern worship.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "The worship songs churches actually sing (2026)",
    description:
      "825 churches, 31 countries, one shared songbook. Hillsong reaches 60% of them. Measured from real church playlists, not a licensing chart.",
    url: PAGE_URL,
    siteName: "GospelChannel",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "The worship songs churches actually sing (2026)",
    description:
      "825 churches, 31 countries. Four worship houses reach most of them. Measured from real church playlists.",
  },
  robots: { index: true, follow: true },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What is the most popular worship song in churches right now?",
    a: "In this sample of 825 churches, two songs tie for the top spot: What A Beautiful Name by Hillsong Worship and Great Are You Lord by All Sons & Daughters. Each appears in the worship playlists of 194 churches, about a quarter of the churches measured.",
  },
  {
    q: "Do most churches sing the same worship songs?",
    a: "Largely, yes, at the top. A small core of roughly 20 to 40 songs shows up across a large share of churches, and four worship houses plus one solo artist, Phil Wickham, account for just over half of the top 50 (26 songs). Below that core, repertoire spreads out quickly across thousands of songs.",
  },
  {
    q: "Is this the same as the CCLI Top 100?",
    a: "No, and that is the point. CCLI measures songs that churches report and license. This measures songs churches actually put in their public Spotify playlists. The two are independent, and they agree on the big picture: a handful of worship houses dominate. Where they differ is at the edges, where individual artists like Phil Wickham and modern-hymn writers show up strongly in playlists.",
  },
  {
    q: "How was this measured?",
    a: "From the playlist.church corpus, our sister catalog. A church is counted as singing a song if the track appears in one of that church's worship playlists. We did not survey anyone and we did not ask an AI to guess. It is direct observation of what churches curated themselves.",
  },
  {
    q: "Does this represent all churches?",
    a: "No. It represents churches that publish Spotify worship playlists, which skews contemporary, English-speaking, and Protestant, with most churches in the US and UK. It is a map of the modern-worship repertoire, not of gospel, traditional, or liturgical worship, and not of churches that do not post playlists.",
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

function HouseBar({
  name,
  pct,
  churches,
  max,
}: {
  name: string;
  pct: number;
  churches: number;
  max: number;
}) {
  const width = max > 0 ? (pct / max) * 100 : 0;
  return (
    <div className="border-b border-espresso/10 py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-lg font-semibold text-espresso">
          {name}
        </h3>
        <p className="font-serif text-lg font-semibold tabular-nums text-espresso">
          {pct}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-linen-deep/70">
        <div
          className="h-full rounded-full bg-rose-gold"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-warm">
        In the playlists of {churches} of 825 churches.
      </p>
    </div>
  );
}

export default function WorshipSongs2026Page() {
  const data = getWorshipSongsReport();
  const houseMax = Math.max(...data.houses.map((h) => h.pct), 1);
  const chart = data.topSongs.slice(0, 25);

  const articleSchema = buildArticleSchema({
    url: PAGE_URL,
    headline: "The Worship Songs Churches Actually Sing (2026)",
    description: META_DESCRIPTION,
    datePublished: "2026-07-26",
    dateModified: "2026-07-26",
    about: [
      "Contemporary worship music",
      "Worship songs",
      "Congregational singing",
      { name: "Hillsong Worship" },
      { name: "Bethel Music" },
      { name: "Elevation Worship" },
    ],
    mentions: [
      { name: "playlist.church", url: PLAYLIST_CHURCH },
      { name: "CCLI Top 100", url: "https://songselect.ccli.com/ccli-top-100" },
    ],
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "GospelChannel", url: "https://gospelchannel.com" },
    { name: "The worship songs churches actually sing (2026)", url: PAGE_URL },
  ]);

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Worship Songs 2026: church-playlist adoption data",
    description:
      `Song- and artist-level worship-adoption data measured across ${data.corpus.churchesSinging} churches in ${data.corpus.countries} countries. ` +
      "A church is counted as singing a song when the track appears in one of its public Spotify worship playlists. " +
      "Observed data, not a survey and not AI-inferred.",
    url: PAGE_URL,
    sameAs: [PLAYLIST_CHURCH],
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
      "contemporary worship",
      "church music",
      "worship leaders",
      "CCLI",
      "congregational singing",
      "open data",
    ],
    temporalCoverage: "2026",
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: JSON_URL,
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

      {/* ── Hero ── */}
      <header>
        <p className="gc-eyebrow">Data study · 2026</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.01em] text-espresso sm:text-6xl">
          The worship songs churches actually sing
        </h1>
        <p className="mt-5 max-w-[720px] text-lg leading-relaxed text-warm-brown">
          We read the real Spotify worship playlists of{" "}
          {data.corpus.churchesSinging} churches across {data.corpus.countries}{" "}
          countries. Here are the songs most of them gather around, the four
          worship houses behind most of the chart, and the point where the
          picture splits along national lines. No survey. No guesswork. Just
          what churches put in their own playlists.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-6 rounded-2xl border border-espresso/12 bg-linen-deep/30 p-6 sm:grid-cols-4 sm:p-8">
        <StatCell value={String(data.corpus.churchesSinging)} label="churches" />
        <StatCell value={String(data.corpus.countries)} label="countries" />
        <StatCell
          value={data.corpus.worshipSongs.toLocaleString("en-US")}
          label="worship songs"
        />
        <StatCell
          value={data.corpus.songChurchEdges.toLocaleString("en-US")}
          label="song-to-church links"
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-warm">
        Every church here publishes a public Spotify worship playlist, so this
        is a read on contemporary worship, and it leans heavily toward the US
        and UK. It is a map of one repertoire, not a census of all churches.
      </p>

      {/* ── Lead answer ── */}
      <section className="mt-14">
        <p className="max-w-[760px] text-lg leading-relaxed text-warm-brown">
          Across {data.corpus.churchesSinging} churches, two songs tie at the
          top: <strong className="text-espresso">What A Beautiful Name</strong>{" "}
          (Hillsong Worship) and{" "}
          <strong className="text-espresso">Great Are You Lord</strong> (All
          Sons &amp; Daughters), each in the playlists of {chart[0].churches}{" "}
          churches, about {chart[0].pct}% of the sample. Look past the individual
          songs and a sharper pattern appears: between them, songs from four
          worship houses (Hillsong, Bethel, Elevation, and Passion) reach most
          churches. Hillsong alone turns up in {data.houses[0].pct}% of them.
          That concentration echoes what analysts have long flagged on the CCLI
          licensing charts, measured here from a completely different source,
          real church playlists, and it means most churches, most Sundays, are
          drawing from a strikingly small shared songbook.
        </p>
      </section>

      {/* ── The chart ── */}
      <section className="mt-16">
        <p className="gc-eyebrow">The chart</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          The 25 most widely sung songs
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Ranked by how many of the {data.corpus.churchesSinging} churches carry
          the song in a worship playlist. Percentages are the share of those
          churches.
        </p>

        <div className="mt-7 overflow-x-auto rounded-2xl border border-espresso/12 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-espresso/12 text-left text-xs uppercase tracking-wider text-muted-warm">
                <th className="py-3 pl-5 pr-2 font-medium">#</th>
                <th className="py-3 pr-3 font-medium">Song</th>
                <th className="py-3 pr-3 font-medium">Artist</th>
                <th className="py-3 pr-5 text-right font-medium">Churches</th>
              </tr>
            </thead>
            <tbody>
              {chart.map((s) => (
                <tr
                  key={`${s.rank}-${s.title}`}
                  className="border-b border-espresso/8 last:border-b-0"
                >
                  <td className="py-3 pl-5 pr-2 font-serif tabular-nums text-muted-warm">
                    {s.rank}
                  </td>
                  <td className="py-3 pr-3 font-semibold text-espresso">
                    {s.title}
                  </td>
                  <td className="py-3 pr-3 text-warm-brown">{s.artist}</td>
                  <td className="py-3 pr-5 text-right tabular-nums text-espresso">
                    {s.churches}{" "}
                    <span className="text-muted-warm">({s.pct}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-warm">
          The full ranked list is available as{" "}
          <Link
            href="/api/worship-songs-2026.json"
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            open JSON
          </Link>
          . The live, always-current chart lives at{" "}
          <a
            href={PLAYLIST_CHURCH}
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            playlist.church
          </a>
          .
        </p>
      </section>

      {/* ── The four houses ── */}
      <section className="mt-16">
        <p className="gc-eyebrow">The concentration</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          Four worship houses dominate the chart
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Sort every church by which worship houses show up in its playlists and
          the modern-worship economy comes into focus. Four names reach a large
          share of the {data.corpus.churchesSinging} churches, and{" "}
          {data.houseConcentration.bigInTop50} of the top{" "}
          {data.houseConcentration.outOf} songs come from just those four houses
          plus Phil Wickham.
        </p>

        <div className="mt-7 rounded-2xl border border-espresso/12 bg-white p-5 sm:p-7">
          {data.houses.map((h) => (
            <HouseBar
              key={h.name}
              name={h.name}
              pct={h.pct}
              churches={h.churchesReached}
              max={houseMax}
            />
          ))}
        </div>

        <p className="mt-6 max-w-[720px] text-base leading-relaxed text-warm-brown">
          This is not a new worry inside worship circles. In 2023, Worship Leader
          Research found that nearly all of the 2010s CCLI Top 25 traced back to
          the same four megachurches: Bethel, Elevation, Hillsong, and Passion.
          What is striking is that our number comes from a different place
          entirely. They counted licensing reports; we counted what churches
          actually saved to their playlists. Two very different methods pointing
          the same way. The magnitudes are not identical, and they should not be,
          but the direction is unmistakable. The same analysis notes the
          concentration has started to loosen in the mid-2020s as individual
          artists and collectives gain ground, which is exactly what the next
          section shows.
        </p>
      </section>

      {/* ── The artists ── */}
      <section className="mt-16">
        <p className="gc-eyebrow">The artists</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          The names on the most playlists
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Reach is the number of churches with at least one song by that artist
          in a worship playlist. One name to watch at the top:{" "}
          <strong className="text-espresso">{data.topArtists[0].artist}</strong>
          , a solo songwriter with no megachurch behind him, sits in{" "}
          {data.topArtists[0].pct}% of churches, the highest reach of any single
          artist credit. Read the list carefully, though. It is keyed on how
          Spotify credits each track, so a worship house fragments across many
          rows (Hillsong shows up under several credits below) while a solo
          artist stays whole. The houses still reach more churches overall, as
          the previous section shows. What the artist view captures is how much
          modern worship now runs on individual writers and one-off
          collaborations, the decentralization worship analysts have started to
          describe.
        </p>

        <div className="mt-7 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {data.topArtists.slice(0, 16).map((a) => (
            <div
              key={a.rank}
              className="flex items-baseline justify-between gap-3 border-b border-espresso/8 py-2.5"
            >
              <span className="flex items-baseline gap-3">
                <span className="font-serif text-xs tabular-nums text-muted-warm">
                  {a.rank}
                </span>
                <span className="text-sm font-medium text-espresso">
                  {a.artist}
                </span>
              </span>
              <span className="text-sm tabular-nums text-warm-brown">
                {a.churchReach}{" "}
                <span className="text-muted-warm">({a.pct}%)</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── US vs UK ── */}
      <section className="mt-16">
        <p className="gc-eyebrow">The transatlantic split</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          American and British churches sing differently
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          The core canon is shared, but the tilt is real. American churches lean
          into the big Elevation and Bethel anthems. British churches put a
          modern hymn, King of Kings, at number one and rank writerly, lyric-first
          songs higher than their American counterparts do, like CityAlight's
          "Yet Not I but Through Christ in Me" and the modern hymn Cornerstone.
        </p>

        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-espresso/12 bg-white p-5 sm:p-6">
            <h3 className="font-serif text-xl font-semibold text-espresso">
              United States
            </h3>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-warm">
              {data.usChart.churches} churches
            </p>
            <ol className="mt-4 space-y-2">
              {data.usChart.songs.slice(0, 10).map((s) => (
                <li
                  key={s.rank}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-espresso">
                    <span className="mr-2 font-serif tabular-nums text-muted-warm">
                      {s.rank}
                    </span>
                    {s.title}
                  </span>
                  <span className="tabular-nums text-muted-warm">
                    {s.churches}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-espresso/12 bg-white p-5 sm:p-6">
            <h3 className="font-serif text-xl font-semibold text-espresso">
              United Kingdom
            </h3>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-warm">
              {data.ukChart.churches} churches
            </p>
            <ol className="mt-4 space-y-2">
              {data.ukChart.songs.slice(0, 10).map((s) => (
                <li
                  key={s.rank}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-espresso">
                    <span className="mr-2 font-serif tabular-nums text-muted-warm">
                      {s.rank}
                    </span>
                    {s.title}
                  </span>
                  <span className="tabular-nums text-muted-warm">
                    {s.churches}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Themes ── */}
      <section className="mt-16">
        <p className="gc-eyebrow">What the songs are about</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          A repertoire built on adoration
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          Tag the lyrics of every worship song in the corpus and the center of
          gravity is clear. The most common themes are adoration, God's majesty,
          and his presence, followed by grace and love. None of the twelve most
          common themes is about lament, justice, or the life of the church
          together. Whatever else modern worship is doing, it is overwhelmingly
          singing praise directly to God. (These theme labels are tagged
          automatically from each song's lyrics, so read them as a broad map, not
          a precise count.)
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {data.themes.map((t, i) => (
            <span
              key={t.theme}
              className={`rounded-full border px-4 py-2 text-sm ${
                i < 3
                  ? "border-rose-gold/40 bg-rose-gold/[0.08] font-semibold text-espresso"
                  : "border-espresso/12 bg-white text-warm-brown"
              }`}
            >
              {t.theme}
              <span className="ml-2 tabular-nums text-muted-warm">
                {t.songs}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Methodology ── */}
      <section className="mt-16 rounded-2xl border border-espresso/12 bg-linen-deep/30 p-6 sm:p-8">
        <p className="gc-eyebrow">How we measured this</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          Method, and what it does not cover
        </h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-warm-brown">
          <p>
            The data comes from{" "}
            <a
              href={PLAYLIST_CHURCH}
              className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
            >
              playlist.church
            </a>
            , our sister catalog, built on {data.builtOn} from the public Spotify
            worship playlists of churches in the GospelChannel network. A church
            counts as singing a song when the track sits in one of its worship
            playlists. We measured {data.corpus.churchesSinging} churches that
            had at least one such song, across{" "}
            {data.corpus.worshipSongs.toLocaleString("en-US")} worship songs and{" "}
            {data.corpus.songChurchEdges.toLocaleString("en-US")} song-to-church
            links.
          </p>
          <p>
            <strong className="text-espresso">Two honest limits.</strong> First,
            this is a sample of churches that publish Spotify playlists, which
            skews contemporary, English-speaking, and Protestant, with most
            churches in the US and UK. It is a map of the modern-worship
            repertoire, not of gospel, traditional, or liturgical worship, and
            not of the many churches that never post a playlist. Second, we merge
            live and studio cuts of the same recording, but different lead-artist
            versions of a song (say, Build My Life by Housefires and by Pat
            Barrett) are counted separately, so a song can appear twice in the
            full list.
          </p>
          <p>
            What we did not do matters too. We did not survey anyone, and we did
            not ask a model to guess a church's worship style. The song counts
            are exactly that: counts of what churches saved. Two smaller pieces do
            lean on automatic tagging, and we flag them where they appear:
            whether a track counts as a worship song rather than a sermon or an
            interlude, and the lyrical themes above.
          </p>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-warm">
          Cite &amp; download
        </p>
        <p className="mt-3 text-base leading-relaxed text-warm-brown">
          The aggregates on this page are open under{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            CC BY 4.0
          </a>{" "}
          and available as raw JSON at{" "}
          <Link
            href="/api/worship-songs-2026.json"
            className="underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
          >
            /api/worship-songs-2026.json
          </Link>
          . Per-church playlists stay with the churches. For methodology
          questions or a deeper cut of the data, write to press at gospelchannel
          dot com.
        </p>
        <p className="mt-4 text-xs text-muted-warm">
          Generated {data.generatedAt} · Data version {data.version} ·
          Corroboration: Worship Leader Research, "After the Big 4" (2023);
          benchmark: CCLI Top 100.
        </p>
      </section>

      {/* ── FAQ ── */}
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

      {/* ── CTA / related ── */}
      <section className="mt-16 border-t border-espresso/10 pt-10">
        <h2 className="font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          Hear it for yourself
        </h2>
        <p className="mt-3 max-w-[680px] text-base leading-relaxed text-warm-brown">
          If this is the sound you are looking for on a Sunday, the fastest way
          to find it is to browse by worship style. Every listed church has a
          profile with its music, so you can tell what the room sounds like
          before you walk in.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/church/style/contemporary-worship"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse contemporary-worship churches
          </Link>
          <Link
            href="/guides/worship-styles-explained"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Worship styles explained
          </Link>
          <Link
            href="/european-church-tech-2026"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            European church tech data
          </Link>
        </div>
        <p className="mt-6 text-sm text-warm-brown">
          Want the live chart that updates as playlists change? It lives at{" "}
          <a
            href={PLAYLIST_CHURCH}
            className="font-semibold text-rose-gold underline decoration-rose-gold/40 underline-offset-2 hover:text-rose-gold-deep"
          >
            playlist.church
          </a>
          . Between styles? Try the{" "}
          <Link
            href="/guides/worship-style-match"
            className="font-semibold text-rose-gold underline decoration-rose-gold/40 underline-offset-2 hover:text-rose-gold-deep"
          >
            worship style match
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
