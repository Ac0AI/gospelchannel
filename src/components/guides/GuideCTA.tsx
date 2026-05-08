import Link from "next/link";

interface GuideCTAProps {
  links: Array<{ label: string; href: string }>;
}

export function GuideCTA({ links }: GuideCTAProps) {
  return (
    <nav className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      {links.map((link, i) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            i === 0
              ? "rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
              : "rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
