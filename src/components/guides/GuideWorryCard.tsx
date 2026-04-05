interface GuideWorryCardProps {
  question: string;
  answer: string;
}

export function GuideWorryCard({ question, answer }: GuideWorryCardProps) {
  return (
    <details className="group mb-3 rounded-2xl border border-blush bg-white px-5 py-4">
      <summary className="cursor-pointer list-none font-serif text-base text-espresso [&::-webkit-details-marker]:hidden">
        <span className="font-bold text-rose-gold group-open:hidden">+ </span>
        <span className="hidden font-bold text-rose-gold group-open:inline">- </span>
        {question}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-warm-brown">{answer}</p>
    </details>
  );
}
