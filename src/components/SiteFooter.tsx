import Link from "next/link";
import { COPYRIGHT_YEAR } from "@/lib/utils";
import { getChurchStatsAsync } from "@/lib/content";

const cols = [
  {
    title: "Discover",
    links: [
      { label: "Browse all churches", href: "/church" },
      { label: "Prayer Wall", href: "/prayerwall" },
      { label: "Guides", href: "/guides" },
      { label: "Compare", href: "/compare" },
    ],
  },
  {
    title: "By tradition",
    links: [
      { label: "Pentecostal", href: "/church/denomination/pentecostal" },
      { label: "Anglican", href: "/church/denomination/anglican" },
      { label: "Baptist", href: "/church/denomination/baptist" },
      { label: "Lutheran", href: "/church/denomination/lutheran" },
      { label: "Catholic", href: "/church/denomination/catholic" },
    ],
  },
  {
    title: "For churches",
    links: [
      { label: "Add your church", href: "/church/suggest" },
      { label: "Why list with us", href: "/for-churches" },
      { label: "Church admin", href: "/church-admin/login" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

export async function SiteFooter() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  return (
    <footer className="mt-24 bg-espresso px-5 pt-20 pb-10 text-[rgba(253,248,244,0.7)] sm:px-12">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 border-b border-[rgba(253,248,244,0.12)] pb-15 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          {/* Brand col */}
          <div>
            <div className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] text-linen">
              GospelChannel
            </div>
            <p className="mt-3.5 max-w-[320px] text-sm leading-relaxed">
              A directory for the world&rsquo;s churches. Free, no ads, no tracking. Built for the people who haven&rsquo;t found a church yet &mdash; and the ones already serving one.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.08em] text-[rgba(253,248,244,0.55)]">
              {churchCountLabel} churches &middot; {countryCount} countries
            </p>
            <p className="mt-3 font-serif text-xs italic text-[rgba(253,248,244,0.45)]">
              &ldquo;Praise the Lord. Praise God in his sanctuary.&rdquo; &mdash; Psalm 150:1
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="font-serif text-lg font-semibold tracking-[-0.01em] text-linen">
                {col.title}
              </h4>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="text-[rgba(253,248,244,0.7)] transition-colors hover:text-blush"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 pt-8 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <span>© {COPYRIGHT_YEAR} GospelChannel &mdash; made with love.</span>
          <span className="flex gap-4 text-[rgba(253,248,244,0.7)]">
            <span className="text-linen">English</span>
            <span className="cursor-default opacity-50">Svenska</span>
            <span className="cursor-default opacity-50">Español</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
