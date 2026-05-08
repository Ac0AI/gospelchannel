interface GuideQuoteProps {
  text: string;
}

export function GuideQuote({ text }: GuideQuoteProps) {
  return (
    <blockquote className="my-10 border-l-2 border-rose-gold pl-6 sm:my-12 sm:pl-8">
      <p className="m-0 font-serif text-xl font-medium italic leading-[1.45] text-espresso sm:text-2xl">
        {text}
      </p>
    </blockquote>
  );
}
