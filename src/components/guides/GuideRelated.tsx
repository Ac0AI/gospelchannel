import Link from "next/link";

type GuideSlug =
  | "church-fit-quiz"
  | "first-visit-guide"
  | "worship-style-match"
  | "prayer-guide"
  | "faith-faq"
  | "worship-styles-explained"
  | "denominations-comparison"
  | "how-to-find-the-right-church";

const ALL_GUIDES: Record<GuideSlug, { href: string; label: string }> = {
  "church-fit-quiz": { href: "/guides/church-fit-quiz", label: "Church Fit Quiz" },
  "first-visit-guide": { href: "/guides/first-visit-guide", label: "First Visit Guide" },
  "worship-style-match": { href: "/guides/worship-style-match", label: "Worship Style Match" },
  "prayer-guide": { href: "/guides/prayer-guide", label: "How to Start Praying" },
  "faith-faq": { href: "/guides/faith-faq", label: "Common Questions About Faith" },
  "worship-styles-explained": { href: "/guides/worship-styles-explained", label: "Worship Styles Explained" },
  "denominations-comparison": { href: "/guides/denominations-comparison", label: "Denominations Compared" },
  "how-to-find-the-right-church": { href: "/guides/how-to-find-the-right-church", label: "How to Find the Right Church" },
};

const HUB_ROUTES: Array<{ href: string; label: string }> = [
  { href: "/church/country", label: "Browse by country" },
  { href: "/church/style", label: "Browse by worship style" },
  { href: "/church/denomination", label: "Browse by denomination" },
  { href: "/church/city", label: "Browse by city" },
];

interface GuideRelatedProps {
  current: GuideSlug;
  siblingCount?: number;
}

export function GuideRelated({ current, siblingCount = 3 }: GuideRelatedProps) {
  const siblings = (Object.keys(ALL_GUIDES) as GuideSlug[])
    .filter((slug) => slug !== current)
    .slice(0, siblingCount)
    .map((slug) => ALL_GUIDES[slug]);

  return (
    <section className="mt-16 border-t border-rose-gold/15 pt-10">
      <p className="gc-eyebrow">Keep exploring</p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-serif text-base font-semibold text-espresso">Find a church</h3>
          <ul className="mt-2 space-y-1.5">
            {HUB_ROUTES.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-warm-brown transition-colors hover:text-rose-gold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-serif text-base font-semibold text-espresso">Other guides</h3>
          <ul className="mt-2 space-y-1.5">
            {siblings.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-warm-brown transition-colors hover:text-rose-gold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
