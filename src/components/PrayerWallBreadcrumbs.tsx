import Link from "next/link";

type Crumb = { label: string; href: string };

type PrayerWallBreadcrumbsProps = {
  crumbs: Crumb[];
};

export function PrayerWallBreadcrumbs({ crumbs }: PrayerWallBreadcrumbsProps) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-warm-brown">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-warm">›</span>}
          {i < crumbs.length - 1 ? (
            <Link href={crumb.href} className="hover:text-rose-gold transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-semibold text-espresso">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
