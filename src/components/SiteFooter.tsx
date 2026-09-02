import Link from "next/link";
import { COPYRIGHT_YEAR } from "@/lib/utils";
import { getChurchStatsAsync } from "@/lib/content";
import { PRAYER_FEATURE_ENABLED } from "@/lib/features";

export const SITE_FOOTER_COLUMNS = [
  {
    title: "Discover",
    links: [
      { label: "Browse all churches", href: "/church" },
      { label: "Guides", href: "/guides" },
      { label: "Compare", href: "/compare" },
      ...(PRAYER_FEATURE_ENABLED
        ? [{ label: "Prayer Wall", href: "/prayerwall" }]
        : []),
    ],
  },
  {
    title: "Find a church",
    links: [
      { label: "Church Near Me", href: "/church-near-me" },
      { label: "Church Choice Answers", href: "/guides/church-choice-answers" },
      { label: "Church Fit Quiz", href: "/guides/church-fit-quiz" },
      { label: "Worship Style Match", href: "/guides/worship-style-match" },
      { label: "First Visit Guide", href: "/guides/first-visit-guide" },
      { label: "Denominations Compared", href: "/guides/denominations-comparison" },
      { label: "Churches with service times", href: "/church/churches-with-service-times" },
    ],
  },
  {
    title: "By tradition",
    links: [
      { label: "Pentecostal", href: "/church/denomination/pentecostal" },
      { label: "Charismatic", href: "/church/denomination/charismatic" },
      { label: "Baptist", href: "/church/denomination/baptist" },
      { label: "Non-denominational", href: "/church/denomination/non-denominational" },
      { label: "Evangelical", href: "/church/denomination/evangelical" },
    ],
  },
  {
    title: "For people",
    links: [
      { label: "Browse by life stage", href: "/for" },
      { label: "For expats", href: "/for/expats" },
      { label: "For students", href: "/for/students" },
      { label: "For young adults", href: "/for/young-adults" },
      { label: "For families", href: "/for/families" },
      { label: "For new believers", href: "/for/new-believers" },
      { label: "For deconstructing seekers", href: "/for/deconstructing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Add your church", href: "/church/suggest" },
      { label: "For church teams", href: "/for-churches" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export async function SiteFooter() {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  return (
    <footer className="mt-24 bg-espresso px-5 pt-20 pb-10 text-[rgba(253,248,244,0.7)] sm:px-12">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 border-b border-[rgba(253,248,244,0.12)] pb-15 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[1.45fr_repeat(5,1fr)]">
          {/* Brand col */}
          <div>
            <div className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] text-linen">
              GospelChannel
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-blush">
              The Church Guide
            </p>
            <p className="mt-4 max-w-[320px] text-sm leading-relaxed">
              Find the right church with worship style, tradition, service times, music, location, language, and visitor information.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.08em] text-[rgba(253,248,244,0.55)]">
              {churchCountLabel} churches &middot; {countryCount} countries
            </p>
            <p className="mt-3 font-serif text-xs italic text-[rgba(253,248,244,0.45)]">
              &ldquo;Praise the Lord. Praise God in his sanctuary.&rdquo; &mdash; Psalm 150:1
            </p>
          </div>

          {/* Link columns */}
          {SITE_FOOTER_COLUMNS.map((col) => (
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
          <span>
            © {COPYRIGHT_YEAR} GospelChannel &ndash; made with love. Built by{" "}
            <a
              href="https://ac0.ai"
              target="_blank"
              rel="noopener"
              className="text-linen underline underline-offset-2 transition-colors hover:text-blush"
            >
              ac0.ai
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
