interface GuideHeroProps {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  intro: string;
}

export function GuideHero({ eyebrow, title, titleAccent, intro }: GuideHeroProps) {
  return (
    <header className="px-5 pt-14 pb-10 text-center sm:px-12 sm:pt-16">
      <p className="gc-eyebrow">{eyebrow}</p>
      <h1
        className="mx-auto mt-3.5 m-0 max-w-[18ch] font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
        style={{ fontSize: "clamp(36px, 6vw, 64px)" }}
      >
        {title}
        {titleAccent && (
          <>
            <br />
            <em className="gc-italic">{titleAccent}</em>
          </>
        )}
      </h1>
      <p className="mx-auto mt-5 max-w-[560px] text-base leading-relaxed text-warm-brown sm:text-lg">
        {intro}
      </p>
    </header>
  );
}
