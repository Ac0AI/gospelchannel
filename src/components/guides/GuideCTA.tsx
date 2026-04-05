import Link from "next/link";

interface GuideCTAProps {
  links: Array<{ label: string; href: string }>;
}

export function GuideCTA({ links }: GuideCTAProps) {
  return (
    <nav className="my-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      {links.map((link, i) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            i === 0
              ? "rounded-full bg-rose-gold px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-gold-deep hover:shadow-md"
              : "rounded-full border border-blush px-6 py-2.5 text-sm font-semibold text-warm-brown hover:border-rose-gold hover:text-espresso"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
