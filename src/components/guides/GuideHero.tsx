interface GuideHeroProps {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  intro: string;
}

export function GuideHero({ eyebrow, title, titleAccent, intro }: GuideHeroProps) {
  return (
    <header className="text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
        {eyebrow}
      </p>
      <h1 className="font-serif text-3xl font-bold text-espresso sm:text-4xl">
        {title}
        {titleAccent && (
          <>
            <br />
            <em className="text-rose-gold">{titleAccent}</em>
          </>
        )}
      </h1>
      <p className="mx-auto max-w-md text-base text-warm-brown">{intro}</p>
    </header>
  );
}
