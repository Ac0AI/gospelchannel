import Link from "next/link";

type GuideProofLink = {
  href: string;
  label: string;
  description: string;
};

export function GuideProofLinks({
  title = "Use profile proof as evidence",
  intro,
  links,
}: {
  title?: string;
  intro: string;
  links: GuideProofLink[];
}) {
  return (
    <section className="mt-12 rounded-[18px] border border-rose-gold/[0.14] bg-linen-deep p-6 sm:p-7">
      <p className="gc-eyebrow">Profile proof</p>
      <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-[720px] text-sm leading-[1.7] text-warm-brown sm:text-base">
        {intro}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group border-t border-rose-gold/[0.14] pt-4 transition-colors hover:border-rose-gold/40"
          >
            <span className="block text-sm font-bold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
              {link.label} &rarr;
            </span>
            <span className="mt-1.5 block text-sm leading-[1.6] text-warm-brown">
              {link.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
