interface GuideWorryCardProps {
  question: string;
  answer: string;
  tags?: string[];
}

export function GuideWorryCard({ question, answer, tags }: GuideWorryCardProps) {
  return (
    <details className="group border-b border-rose-gold/[0.10] py-6 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-serif text-xl font-semibold leading-[1.25] tracking-[-0.01em] text-espresso sm:text-[22px]">
        <span>{question}</span>
        <span className="shrink-0 text-2xl font-light text-rose-gold transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.65] text-warm-brown">{answer}</p>
      {tags && tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-rose-gold/20 bg-linen-deep/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mauve"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </details>
  );
}
