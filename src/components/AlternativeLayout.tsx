import Link from "next/link";
import type {
  AlternativeData,
  CellState,
  ComparisonCell,
} from "@/lib/alternatives-data";

function CellGlyph({ state }: { state: CellState }) {
  if (state === "yes") return <span className="text-rose-gold">✓</span>;
  if (state === "no") return <span className="text-muted-warm">—</span>;
  if (state === "partial") return <span className="text-warm-brown">◐</span>;
  return null;
}

function CellContent({ cell }: { cell: ComparisonCell }) {
  if (cell.state === "text") {
    return <span className="text-sm text-espresso">{cell.note}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <CellGlyph state={cell.state} />
      {cell.note && <span className="text-xs text-muted-warm">{cell.note}</span>}
    </span>
  );
}

type Props = {
  data: AlternativeData;
  siblings: Array<{ slug: string; competitor_name: string }>;
};

export function AlternativeLayout({ data, siblings }: Props) {
  return (
    <article className="mx-auto max-w-[1080px] px-5 pb-24 sm:px-12">
      {/* Hero */}
      <section className="pt-14 sm:pt-20">
        <p className="gc-eyebrow">{data.hero_eyebrow}</p>
        <h1
          className="mt-4 max-w-[20ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
          style={{ fontSize: "clamp(40px, 6.5vw, 72px)" }}
        >
          {data.hero_h1}
        </h1>
        <p className="mt-6 max-w-[640px] text-base leading-relaxed text-warm-brown sm:text-lg">
          {data.hero_lede}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/church"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse the directory
          </Link>
          <Link
            href="/guides/church-fit-quiz"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Take the fit quiz
          </Link>
        </div>
      </section>

      {/* Comparison table */}
      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.table_h2}
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          {data.table_lede}
        </p>

        <div className="mt-8 overflow-hidden rounded-[20px] border border-rose-gold/[0.18] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rose-gold/[0.18] bg-linen-deep/40">
                <th className="px-5 py-4 font-serif text-base font-semibold text-espresso sm:px-7">
                  Feature
                </th>
                <th className="px-5 py-4 font-serif text-base font-semibold text-espresso sm:px-7">
                  GospelChannel
                </th>
                <th className="px-5 py-4 font-serif text-base font-semibold text-espresso sm:px-7">
                  {data.competitor_name}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.comparison_rows.map((row) => (
                <tr key={row.feature} className="border-b border-rose-gold/[0.08] last:border-b-0">
                  <td className="px-5 py-4 align-top font-medium text-espresso sm:px-7">
                    {row.feature}
                  </td>
                  <td className="px-5 py-4 align-top text-warm-brown sm:px-7">
                    <CellContent cell={row.yours} />
                  </td>
                  <td className="px-5 py-4 align-top text-warm-brown sm:px-7">
                    <CellContent cell={row.theirs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Switch reasons */}
      <section className="mt-20">
        <p className="gc-eyebrow">Why switch</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.switch_h2}
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          {data.switch_lede}
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {data.switch_reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-[18px] border border-rose-gold/[0.15] bg-white p-6 sm:p-7"
            >
              <h3 className="font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                {reason.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown sm:text-base">
                {reason.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Honesty */}
      <section className="mt-20">
        <p className="gc-eyebrow">Honest tradeoffs</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.honesty_h2}
        </h2>
        <p className="mt-4 max-w-[720px] text-base leading-relaxed text-warm-brown">
          {data.honesty_lede}
        </p>
        <div className="mt-8 space-y-5">
          {data.honesty_rows.map((row) => (
            <div
              key={row.feature}
              className="rounded-[16px] border border-rose-gold/[0.12] bg-linen-deep/30 p-5 sm:p-6"
            >
              <p className="font-serif text-base font-semibold text-espresso">
                {row.feature}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                {row.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.faq_h2}
        </h2>
        <div className="mt-8 space-y-6">
          {data.faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="font-serif text-lg font-semibold text-espresso">
                {faq.question}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 rounded-[24px] border border-rose-gold/[0.18] p-8 sm:p-12"
        style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)" }}
      >
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          {data.cta_h2}
        </h2>
        <p className="mt-3 max-w-[560px] text-base leading-relaxed text-warm-brown">
          {data.cta_lede}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/church"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Browse all churches
          </Link>
          <Link
            href="/guides/church-fit-quiz"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Take the quiz
          </Link>
        </div>
      </section>

      {/* Internal-link spine */}
      <section className="mt-16 border-t border-rose-gold/15 pt-10">
        <p className="gc-eyebrow">Keep exploring</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-serif text-base font-semibold text-espresso">Find a church</h3>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/church/country" className="text-sm text-warm-brown transition-colors hover:text-rose-gold">
                  Browse by country
                </Link>
              </li>
              <li>
                <Link href="/church/style" className="text-sm text-warm-brown transition-colors hover:text-rose-gold">
                  Browse by worship style
                </Link>
              </li>
              <li>
                <Link href="/church/denomination" className="text-sm text-warm-brown transition-colors hover:text-rose-gold">
                  Browse by denomination
                </Link>
              </li>
              <li>
                <Link href="/guides/first-visit-guide" className="text-sm text-warm-brown transition-colors hover:text-rose-gold">
                  First visit guide
                </Link>
              </li>
            </ul>
          </div>
          {siblings.length > 0 && (
            <div>
              <h3 className="font-serif text-base font-semibold text-espresso">Other alternatives</h3>
              <ul className="mt-2 space-y-1.5">
                {siblings.map((sibling) => (
                  <li key={sibling.slug}>
                    <Link
                      href={`/alternatives/${sibling.slug}`}
                      className="text-sm text-warm-brown transition-colors hover:text-rose-gold"
                    >
                      {sibling.competitor_name} alternative
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
