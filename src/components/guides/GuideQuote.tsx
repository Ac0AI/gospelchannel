interface GuideQuoteProps {
  text: string;
}

export function GuideQuote({ text }: GuideQuoteProps) {
  return (
    <blockquote className="my-6 rounded-r-xl border-l-[3px] border-rose-gold bg-white px-5 py-4">
      <p className="text-sm italic leading-relaxed text-warm-brown">{text}</p>
    </blockquote>
  );
}
