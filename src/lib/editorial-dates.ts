// Content dates for editorial pages whose copy does not change when church
// data changes. The page's Article JSON-LD and the sitemap <lastmod> both read
// from here, so the two freshness signals cannot drift apart. Bump `modified`
// in the same edit as any real content change to the page.
export const EDITORIAL_CONTENT_DATES = {
  "/worship-songs-2026": { published: "2026-07-26", modified: "2026-10-17" },
  "/worship-by-denomination": { published: "2026-07-26", modified: "2026-10-17" },
  "/guides/church-choice-answers": { published: "2026-07-07", modified: "2026-10-17" },
  "/guides/church-fit-quiz": { published: "2026-03-29", modified: "2026-10-17" },
  "/guides/denominations-comparison": { published: "2026-05-14", modified: "2026-10-17" },
  "/guides/faith-faq": { published: "2026-04-07", modified: "2026-10-17" },
  "/guides/first-visit-guide": { published: "2026-03-29", modified: "2026-10-17" },
  "/guides/how-to-find-the-right-church": { published: "2026-05-14", modified: "2026-10-17" },
  "/guides/worship-style-match": { published: "2026-03-29", modified: "2026-08-26" },
  "/guides/worship-styles-explained": { published: "2026-05-14", modified: "2026-10-17" },
  "/alternatives/churchfinder": { published: "2026-05-14", modified: "2026-10-17" },
  "/alternatives/gospel-coalition": { published: "2026-05-14", modified: "2026-10-17" },
  "/alternatives/mychurchfinder": { published: "2026-05-14", modified: "2026-10-17" },
  "/for/expats": { published: "2026-05-14", modified: "2026-10-17" },
  "/for/students": { published: "2026-05-14", modified: "2026-10-17" },
  "/for/young-adults": { published: "2026-05-14", modified: "2026-10-17" },
  "/for/families": { published: "2026-05-14", modified: "2026-10-17" },
  "/for/new-believers": { published: "2026-05-14", modified: "2026-10-17" },
  "/for/deconstructing": { published: "2026-05-14", modified: "2026-10-17" },
  "/compare/baptist-vs-pentecostal": { published: "2026-03-29", modified: "2026-10-17" },
} as const satisfies Record<string, { published: string; modified: string }>;

export type EditorialPath = keyof typeof EDITORIAL_CONTENT_DATES;

export function getEditorialDates(path: string): { published: string; modified: string } | null {
  return path in EDITORIAL_CONTENT_DATES ? EDITORIAL_CONTENT_DATES[path as EditorialPath] : null;
}

export function getEditorialContentDate(path: string): string | null {
  return getEditorialDates(path)?.modified ?? null;
}
