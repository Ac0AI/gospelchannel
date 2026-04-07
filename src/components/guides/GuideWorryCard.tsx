interface GuideWorryCardProps {
  question: string;
  answer: string;
  tags?: string[];
}

export function GuideWorryCard({ question, answer, tags }: GuideWorryCardProps) {
  return (
    <details className="group mb-3 rounded-2xl border border-blush bg-white px-5 py-4">
      <summary className="cursor-pointer list-none font-serif text-base text-espresso [&::-webkit-details-marker]:hidden">
        <span className="font-bold text-rose-gold group-open:hidden">+ </span>
        <span className="hidden font-bold text-rose-gold group-open:inline">- </span>
        {question}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-warm-brown">{answer}</p>
      {tags && tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-blush bg-linen-deep/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mauve"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </details>
  );
}
