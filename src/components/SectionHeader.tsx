type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function SectionHeader({ eyebrow, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-mauve">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-2xl font-semibold leading-snug text-espresso sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-warm">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
