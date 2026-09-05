import {
  OFFICIAL_REVIEW_FIELDS,
  type OfficialChurchReview,
  type OfficialReviewField,
} from "@/lib/official-church-review";

export function OfficialVisitDetails({ review }: { review: OfficialChurchReview }) {
  const fields = Object.keys(OFFICIAL_REVIEW_FIELDS) as OfficialReviewField[];
  const checkedLabel = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${review.checkedAt}T00:00:00Z`));

  function details(items: OfficialReviewField[]) {
    return (
      <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((field) => {
          const fact = review.facts[field];
          return (
            <div key={field} className="border-t border-rose-gold/15 py-5">
              <dt className="text-sm font-bold text-espresso">{OFFICIAL_REVIEW_FIELDS[field]}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-warm-brown">
                {fact ? (
                  <>
                    <p>{fact.value}</p>
                    <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center font-semibold text-rose-gold underline underline-offset-4" aria-label={`Official source for ${OFFICIAL_REVIEW_FIELDS[field].toLowerCase()}`}>
                      Official source ↗
                    </a>
                  </>
                ) : <p>Not published</p>}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return (
    <section id="official-visit-details" aria-labelledby="official-visit-heading" className="scroll-mt-24 border-b border-rose-gold/15 bg-linen px-5 py-12 sm:px-12">
      <div className="mx-auto max-w-[1400px]">
        <p className="gc-eyebrow">Before you visit</p>
        <h2 id="official-visit-heading" className="mt-3 font-serif text-3xl font-semibold text-espresso">Visit details from official sources</h2>
        <p className="mb-6 mt-3 max-w-3xl text-sm leading-relaxed text-warm-brown">
          Checked by GospelChannel on <time dateTime={review.checkedAt}>{checkedLabel}</time>.
          {" "}Confirm this week&apos;s schedule with the church before travelling.
          {" "}&ldquo;Not published&rdquo; means we could not confirm a detail on the pages checked; ask the church about your needs.
        </p>
        {details(fields.slice(0, 6))}
        <details className="border-t border-rose-gold/15">
          <summary className="cursor-pointer py-5 text-sm font-bold text-espresso">Worship, youth, safeguarding and getting there</summary>
          {details(fields.slice(6))}
        </details>
      </div>
    </section>
  );
}
