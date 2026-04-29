import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getEuropeanChurchTechReport,
  compositeScore,
  type CountryStats,
} from "@/lib/european-church-tech-report";

export const revalidate = 3600;

const PAGE_URL = "https://gospelchannel.com/european-church-tech-2026";
const OG_IMAGE_URL = "https://gospelchannel.com/european-church-tech/og-hero.png";

export const metadata: Metadata = {
  title: "European Church Tech Index 2026 — What 14 000 Churches Actually Run",
  description:
    "First observed-data report on European church technology. Measured across 14 000 churches in 12 countries. UK leads social presence at 84% Facebook adoption, Italy uses a federation model. Survey-free methodology.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "84% of UK churches are on Facebook. In Italy: 7%.",
    description:
      "The first measured, country-by-country map of European church tech. 14 000 churches, 12 countries, 0 surveys.",
    url: PAGE_URL,
    type: "article",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1456,
        height: 819,
        alt: "Editorial map of Europe with church-tech data points across 12 countries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "84% of UK churches are on Facebook. In Italy: 7%.",
    description:
      "First measured map of European church tech. 14 000 churches, 12 countries, 0 surveys.",
    images: [OG_IMAGE_URL],
  },
  robots: { index: true, follow: true },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CountryRow({
  rank,
  stats,
  maxScore,
}: {
  rank: number;
  stats: CountryStats;
  maxScore: number;
}) {
  const score = compositeScore(stats);
  const widthPct = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return (
    <div className="border-b border-espresso/10 py-5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-sm tabular-nums text-mauve">
            #{rank}
          </span>
          <h3 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">
            {stats.country}
          </h3>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl font-semibold tabular-nums text-espresso">
            {score}
          </p>
          <p className="text-xs uppercase tracking-wider text-espresso/60">
            score
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-linen-deep/60">
        <div
          className="h-full rounded-full bg-mauve"
          style={{ width: `${widthPct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
        <Signal label="Website" pct={stats.pct.website} />
        <Signal label="CMS" pct={stats.pct.cms} />
        <Signal label="Facebook" pct={stats.pct.facebook} />
        <Signal label="YouTube" pct={stats.pct.youtube} />
        <Signal label="Livestream" pct={stats.pct.livestream} />
      </div>

      <p className="mt-3 text-xs text-espresso/60">
        Based on {stats.total.toLocaleString("en-GB")} approved churches.
      </p>
    </div>
  );
}

function Signal({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <p className="text-espresso/60">{label}</p>
      <p className="font-serif text-base font-semibold tabular-nums text-espresso">
        {pct}%
      </p>
    </div>
  );
}

function SmallerMarketRow({ stats }: { stats: CountryStats }) {
  const score = compositeScore(stats);
  return (
    <tr className="border-b border-espresso/10 last:border-b-0">
      <td className="py-3 pr-3 font-medium text-espresso">{stats.country}</td>
      <td className="py-3 pr-3 text-right tabular-nums text-espresso/80">
        {stats.total}
      </td>
      <td className="py-3 pr-3 text-right tabular-nums text-espresso/80">
        {stats.pct.website}%
      </td>
      <td className="py-3 pr-3 text-right tabular-nums text-espresso/80">
        {stats.pct.facebook}%
      </td>
      <td className="py-3 pr-3 text-right tabular-nums text-espresso/80">
        {stats.pct.youtube}%
      </td>
      <td className="py-3 text-right">
        <span className="inline-block min-w-[2.5rem] rounded-full bg-linen-deep/70 px-2 py-1 text-center font-serif text-sm font-semibold tabular-nums text-espresso">
          {score}
        </span>
      </td>
    </tr>
  );
}

export default async function EuropeanChurchTechReportPage() {
  const data = await getEuropeanChurchTechReport();
  const maxScore = Math.max(...data.primary.map(compositeScore), 1);
  const maxPlatformCount = Math.max(
    ...data.topPlatforms.map((p) => p.count),
    1,
  );

  const ukStats = data.primary.find((s) => s.country === "United Kingdom");
  const italyStats = data.primary.find((s) => s.country === "Italy");

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* ── Visual anchor: Europe map ── */}
      <div className="relative mx-auto mb-10 max-w-3xl overflow-hidden rounded-2xl">
        <Image
          src="/european-church-tech/og-hero.png"
          alt="Map of Europe with church technology data points"
          width={1456}
          height={819}
          priority
          className="h-auto w-full"
        />
      </div>

      {/* ── Hero ── */}
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
          European Church Tech Index — {formatDate(data.generatedAt)}
        </p>
        <h1 className="mx-auto mt-4 max-w-4xl font-serif text-4xl font-semibold leading-[1.1] text-espresso sm:text-6xl">
          {ukStats ? `${ukStats.pct.facebook}% of UK churches are on Facebook.` : "UK leads on Facebook."}{" "}
          <span className="text-mauve">
            {italyStats ? `In Italy: ${italyStats.pct.facebook}%.` : "Italy is last."}
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-espresso/80">
          The first measured, country-by-country map of how European churches
          show up online. Built from{" "}
          {data.totals.churches.toLocaleString("en-GB")} churches across{" "}
          {data.totals.countries} countries.{" "}
          <strong className="text-espresso">
            We did not ask. We measured.
          </strong>
        </p>

        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-6">
          <Stat value={data.totals.churches.toLocaleString("en-GB")} label="churches measured" />
          <Stat value={data.totals.countries.toString()} label="countries" />
          <Stat value="0" label="surveys sent" />
        </div>
      </header>

      {/* ── Key findings ── */}
      <section className="mt-14 rounded-2xl border-l-4 border-mauve bg-linen-deep/40 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
          Key findings
        </p>
        <ul className="mt-4 space-y-3 text-base leading-relaxed text-espresso">
          {ukStats ? (
            <li>
              <strong className="text-espresso">
                The UK leads European church social adoption.
              </strong>{" "}
              {ukStats.pct.facebook}% of British churches have a verifiable
              Facebook presence; {ukStats.pct.youtube}% have an active
              YouTube channel — both far ahead of any other primary market.
            </li>
          ) : null}
          {italyStats ? (
            <li>
              <strong className="text-espresso">
                Italy looks last on paper, but it is not absent online.
              </strong>{" "}
              Just {italyStats.pct.facebook}% of Italian churches have an own
              Facebook page — because Italian Pentecostalism is federated,
              and most local congregations share their denomination&apos;s
              digital presence rather than maintaining their own.
            </li>
          ) : null}
          {data.smaller.length > 0 ? (
            <li>
              <strong className="text-espresso">
                The Nordics and Low Countries punch above their weight.
              </strong>{" "}
              The Netherlands, Denmark, Finland, and Belgium all show
              70-90% coverage on websites and social channels despite
              small church bases — small markets, mature digital habits.
            </li>
          ) : null}
          <li>
            <strong className="text-espresso">
              Every existing report on this surveys leaders.
            </strong>{" "}
            We did not. We measured what {data.totals.churches.toLocaleString("en-GB")}{" "}
            individual church URLs, Facebook pages, and YouTube channels
            actually show — a methodology no European church-tech report
            has used at this scale before.
          </li>
        </ul>
      </section>

      {/* ── Methodology callout ── */}
      <section className="mt-16 rounded-2xl border border-espresso/15 bg-linen-deep/30 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
          Methodology
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          We did not survey. We measured.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-espresso/80">
          Every existing report on church technology surveys leaders. Pastors
          self-report adoption. Survey responses for technology are notoriously
          generous — leaders over-report best practices and under-report
          legacy infrastructure. We took a different path: we measured what
          each church&apos;s public presence shows. CMS detection ran against
          live websites. Facebook and YouTube presence came from page-level
          signals, not surveys. If a church does not show a livestream URL,
          we counted zero.
        </p>
        <p className="mt-3 text-base leading-relaxed text-espresso/80">
          Coverage percentages reflect what is publicly verifiable.
          A church with no detected website may still have one we missed; a
          church without a detected Facebook page may run one under a
          denomination-shared account. Where we could not verify, we counted
          zero. The result is a conservative floor — and the first
          country-by-country comparison built this way.
        </p>
      </section>

      {/* ── Primary leaderboard ── */}
      <section className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
          Leaderboard
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
          UK leads. Italy is last. Everyone else, ranked.
        </h2>
        <p className="mt-3 text-base text-espresso/70">
          Composite score is the average of website, CMS detection, Facebook,
          YouTube, and livestream coverage rates. Score is 0–100. Ranked by
          composite.
        </p>

        <div className="mt-8 rounded-2xl border border-espresso/15 bg-white p-5 sm:p-7">
          {data.primary.map((stats, idx) => (
            <CountryRow
              key={stats.country}
              rank={idx + 1}
              stats={stats}
              maxScore={maxScore}
            />
          ))}
        </div>
      </section>

      {/* ── By the numbers (tech-flavoured) ── */}
      <section className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
          By the numbers
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
          Six things that surprised us
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <BigStat
            number={`${data.cmsBreakdown.wordpressShare}%`}
            headline="WordPress runs the European church web"
            body={`Of ${data.cmsBreakdown.totalDetected.toLocaleString("en-GB")} European church websites where we could detect a primary platform, ${data.cmsBreakdown.wordpressCount.toLocaleString("en-GB")} are running WordPress. No challenger comes close.`}
          />

          {(() => {
            const ukCms = data.cmsByCountry.find((r) => r.country === "United Kingdom");
            return ukCms ? (
              <BigStat
                number={`${ukCms.modernDiyPct}%`}
                headline="The UK leads on &lsquo;modern DIY&rsquo; web stacks"
                body={`${ukCms.modernDiyPct}% of detected UK church sites run on Squarespace, Wix, or Webflow — the highest rate in Europe. By contrast, most other primary markets sit at 7-15%. UK churches are clearly the early movers on no-code DIY tools.`}
              />
            ) : null;
          })()}

          <BigStat
            number={`${data.cmsBreakdown.churchPlatformCount}`}
            headline="Church-tech platforms have not crossed the Atlantic"
            body={`Subsplash, Faithlife, Tithe.ly, Pushpay, and PlanningCenter — the household names of US church tech — are running on just ${data.cmsBreakdown.churchPlatformCount} European church websites combined. In a market of ${data.cmsBreakdown.totalDetected.toLocaleString("en-GB")} detected sites, that is a rounding error.`}
          />

          {(() => {
            const nl = data.spotifyRates.find((r) => r.country === "Netherlands");
            const uk = data.spotifyRates.find((r) => r.country === "United Kingdom");
            return nl && uk ? (
              <BigStat
                number={`${nl.pct}%`}
                headline="The Netherlands tops Europe on church Spotify presence"
                body={`${nl.pct}% of mapped Dutch churches have a verifiable Spotify presence — ahead of the UK at ${uk.pct}% and Sweden at ${data.spotifyRates.find((r) => r.country === "Sweden")?.pct ?? "—"}%. ${nl.active} of ${nl.total} Dutch churches we measured were active on Spotify.`}
              />
            ) : null;
          })()}

          {ukStats && italyStats ? (
            <BigStat
              number={`${ukStats.pct.facebook - italyStats.pct.facebook}pp`}
              headline="The UK–Italy Facebook gap is a chasm"
              body={`UK churches: ${ukStats.pct.facebook}% on Facebook. Italian churches: ${italyStats.pct.facebook}%. The ${ukStats.pct.facebook - italyStats.pct.facebook} percentage-point gap is the largest single-platform gap between any two primary markets in the index.`}
            />
          ) : null}

          <BigStat
            number={`${data.cmsBreakdown.modernFrameworkCount}`}
            headline="A few European churches went modern frontend"
            body={`${data.cmsBreakdown.modernFrameworkCount} European church sites are running modern JS frameworks — Next.js, Nuxt, Gatsby, or Framer. Vanishingly small as a share, but striking that any churches at all are shipping React/Vue-based stacks.`}
          />
        </div>
      </section>

      {/* ── CMS-by-country detail ── */}
      {data.cmsByCountry.length > 0 ? (
        <section className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
            Stack by country
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
            Where the modern DIY tools have landed
          </h2>
          <p className="mt-3 text-base text-espresso/70">
            Share of detected church websites running Squarespace, Wix, or
            Webflow — versus the WordPress baseline. A rough proxy for how
            recently each country&apos;s churches refreshed their tooling.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-espresso/15 bg-white p-5 sm:p-7">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-espresso/15 text-left text-xs uppercase tracking-wider text-espresso/60">
                  <th className="pb-3 pr-3 font-medium">Country</th>
                  <th className="pb-3 pr-3 text-right font-medium">
                    Detected sites
                  </th>
                  <th className="pb-3 pr-3 text-right font-medium">
                    WordPress
                  </th>
                  <th className="pb-3 text-right font-medium">Modern DIY</th>
                </tr>
              </thead>
              <tbody>
                {data.cmsByCountry.map((row) => (
                  <tr
                    key={row.country}
                    className="border-b border-espresso/10 last:border-b-0"
                  >
                    <td className="py-3 pr-3 font-medium text-espresso">
                      {row.country}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-espresso/80">
                      {row.detected.toLocaleString("en-GB")}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-espresso/80">
                      {row.wordpressPct}%
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-block min-w-[2.5rem] rounded-full bg-linen-deep/70 px-2 py-1 text-center font-serif text-sm font-semibold tabular-nums text-espresso">
                        {row.modernDiyPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Top platforms ── */}
      {data.topPlatforms.length > 0 ? (
        <section className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
            Platform mix
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
            WordPress vs the rest
          </h2>
          <p className="mt-3 text-base text-espresso/70">
            Most-detected primary platforms across the eight primary-market
            countries. A reasonable proxy for &ldquo;modern&rdquo; tooling
            adoption.
          </p>

          <div className="mt-8 rounded-2xl border border-espresso/15 bg-white p-5 sm:p-7">
            {data.topPlatforms.map((p) => {
              const widthPct = (p.count / maxPlatformCount) * 100;
              return (
                <div
                  key={p.platform}
                  className="border-b border-espresso/10 py-4 last:border-b-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-espresso">{p.platform}</p>
                    <p className="font-serif text-base font-semibold tabular-nums text-espresso">
                      {p.count.toLocaleString("en-GB")}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-linen-deep/60">
                    <div
                      className="h-full rounded-full bg-mauve"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Italian federation case study ── */}
      {italyStats ? (
        <section className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
            Case study — Italy
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
            Italy&apos;s missing 90%: a federation, not a desert
          </h2>

          <div className="mt-6 overflow-hidden rounded-2xl">
            <Image
              src="/european-church-tech/italy-federation.png"
              alt="Network diagram showing one central node connected to many smaller satellite nodes — visualising a federation model"
              width={1456}
              height={819}
              className="h-auto w-full"
            />
          </div>

          <p className="mt-6 text-base leading-relaxed text-espresso/80">
            Italy ranks last on individual church digital presence: roughly
            {" "}{italyStats.pct.website}% have an own website,{" "}
            {italyStats.pct.facebook}% an own Facebook page. That is not
            because Italian churches are absent online. It is because
            Italian Pentecostalism is structured federally: most local
            Assemblee di Dio congregations share the national umbrella
            organisation&apos;s website, Facebook page, and YouTube
            channel. The local church is present digitally — through
            its denomination, not its own URL.
          </p>
          <p className="mt-3 text-base leading-relaxed text-espresso/80">
            We tested this directly. After running Google Places lookup +
            LLM extraction against all 918 unenriched Italian churches in
            our catalog, the country-level numbers did not move. Italian
            local congregations genuinely do not maintain their own
            websites, Facebook pages, or YouTube channels at any
            measurable rate. The digital presence lives at the federation
            layer, not the local one — and that is the structure, not a
            data gap.
          </p>

          <p className="mt-3 text-base leading-relaxed text-espresso/80">
            This pattern is invisible in surveys. A pastor asked
            &ldquo;does your church have a website?&rdquo; says no. Asked
            &ldquo;is your church online?&rdquo; says yes. The honest answer
            requires observed data — and reframes the question from
            &ldquo;is Italy behind?&rdquo; to &ldquo;does Italian Christianity
            organise its digital presence at a different layer of the
            denomination?&rdquo; The data says it does.
          </p>
        </section>
      ) : null}

      {/* ── Smaller markets ── */}
      {data.smaller.length > 0 ? (
        <section className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
            Smaller markets
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
            Small countries punching above their weight
          </h2>
          <p className="mt-3 text-base text-espresso/70">
            Smaller European church markets where our sample is too modest
            for direct ranking against the primary tier, but where coverage
            rates are striking.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-espresso/15 bg-white p-5 sm:p-7">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-espresso/15 text-left text-xs uppercase tracking-wider text-espresso/60">
                  <th className="pb-3 pr-3 font-medium">Country</th>
                  <th className="pb-3 pr-3 text-right font-medium">
                    Churches
                  </th>
                  <th className="pb-3 pr-3 text-right font-medium">Website</th>
                  <th className="pb-3 pr-3 text-right font-medium">Facebook</th>
                  <th className="pb-3 pr-3 text-right font-medium">YouTube</th>
                  <th className="pb-3 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.smaller.map((stats) => (
                  <SmallerMarketRow key={stats.country} stats={stats} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Press kit / sources ── */}
      <section className="mt-16 rounded-2xl border border-espresso/15 bg-linen-deep/30 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">
          For press
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          Cite, embed, ask
        </h2>
        <p className="mt-4 text-base leading-relaxed text-espresso/80">
          Numbers in this report are free to cite with attribution to{" "}
          <strong className="text-espresso">GospelChannel</strong> and a link
          to{" "}
          <Link
            href="/european-church-tech-2026"
            className="underline decoration-mauve/40 underline-offset-2 hover:decoration-mauve"
          >
            this report URL
          </Link>
          . Raw country-level figures available as JSON at{" "}
          <Link
            href="/api/european-church-tech-2026.json"
            className="underline decoration-mauve/40 underline-offset-2 hover:decoration-mauve"
          >
            /api/european-church-tech-2026.json
          </Link>
          . For methodology questions, sample-size queries, or per-country
          deep dives, write to press at gospelchannel dot com.
        </p>
        <p className="mt-3 text-xs text-espresso/60">
          Generated {formatDate(data.generatedAt)} · Data version{" "}
          {data.version} · Coverage updates as enrichment runs land.
        </p>
      </section>

      {/* ── CTA ── */}
      <section className="mt-16 text-center">
        <h2 className="font-serif text-3xl font-semibold text-espresso sm:text-4xl">
          Find your church
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-espresso/70">
          Every measured church has a public profile on GospelChannel. Search
          for yours, claim it, and improve what we measured.
        </p>
        <div className="mt-6">
          <Link
            href="/church"
            className="inline-block rounded-full bg-espresso px-7 py-3 text-sm font-semibold text-white transition hover:bg-espresso/90"
          >
            Browse churches
          </Link>
        </div>
      </section>
    </article>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-3xl font-semibold tabular-nums text-espresso sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-espresso/60">
        {label}
      </p>
    </div>
  );
}

function BigStat({
  number,
  headline,
  body,
}: {
  number: string;
  headline: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-espresso/15 bg-white p-6 sm:p-7">
      <p className="font-serif text-5xl font-semibold tabular-nums text-mauve sm:text-6xl">
        {number}
      </p>
      <h3
        className="mt-3 font-serif text-xl font-semibold leading-snug text-espresso"
        dangerouslySetInnerHTML={{ __html: headline }}
      />
      <p
        className="mt-3 text-sm leading-relaxed text-espresso/80"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  );
}

