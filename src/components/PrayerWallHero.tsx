type PrayerWallHeroProps = {
  title: string;
  subtitle: string;
  /** Optional eyebrow above the title — defaults to "The Prayer Wall". */
  eyebrow?: string;
  /** Optional accent word(s) shown in italic rose-gold inside the H1.
   *  When provided, the title is rendered as `[before] <em>{accent}</em> [after]`
   *  (matching by first occurrence). When absent, the title renders verbatim. */
  accentWord?: string;
};

function splitTitleByAccent(title: string, accent?: string) {
  if (!accent) return { before: title, accent: "", after: "" };
  const idx = title.toLowerCase().indexOf(accent.toLowerCase());
  if (idx < 0) return { before: title, accent: "", after: "" };
  return {
    before: title.slice(0, idx),
    accent: title.slice(idx, idx + accent.length),
    after: title.slice(idx + accent.length),
  };
}

export function PrayerWallHero({
  title,
  subtitle,
  eyebrow = "The Prayer Wall",
  accentWord,
}: PrayerWallHeroProps) {
  const { before, accent, after } = splitTitleByAccent(title, accentWord);

  return (
    <section className="px-5 pt-16 pb-8 text-center sm:px-12 sm:pt-20 sm:pb-10">
      <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
        {eyebrow}
      </p>
      <h1
        className="mx-auto mt-3.5 max-w-[20ch] m-0 font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
        style={{ fontSize: "clamp(40px, 7vw, 88px)" }}
      >
        {accent ? (
          <>
            {before}
            <em className="gc-italic">{accent}</em>
            {after}
          </>
        ) : (
          title
        )}
      </h1>
      <p className="mx-auto mt-5 max-w-[580px] text-base leading-relaxed text-warm-brown sm:text-lg">
        {subtitle}
      </p>
    </section>
  );
}
