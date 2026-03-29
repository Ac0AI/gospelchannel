import type { ChurchUpdateItem } from "@/types/gospel";

type ChurchLatestUpdatesSectionProps = {
  items: ChurchUpdateItem[];
};

function formatPublishedDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function ChurchLatestUpdatesSection({
  items,
}: ChurchLatestUpdatesSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">
          Latest updates
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
          What they have posted lately
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-warm-brown">
          Recent articles, videos, and mentions pulled into one place so you can see what is active right now.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => {
          const publishedAt = formatPublishedDate(item.publishedAt);

          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className="rounded-full bg-blush-light px-2.5 py-1 text-rose-gold-deep">
                  {item.sourceLabel || item.sourceKind}
                </span>
                {publishedAt && (
                  <span className="text-muted-warm">{publishedAt}</span>
                )}
              </div>

              <h3 className="mt-3 text-lg font-semibold leading-snug text-espresso transition-colors group-hover:text-rose-gold-deep">
                {item.title}
              </h3>

              {item.summary && (
                <p className="mt-2 text-sm leading-relaxed text-warm-brown">
                  {item.summary}
                </p>
              )}

              <div className="mt-4 text-sm font-semibold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
                Open update ↗
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
