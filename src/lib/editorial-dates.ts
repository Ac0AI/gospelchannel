// Content dates for editorial pages whose copy does not change when church
// data changes. The page's Article JSON-LD and the sitemap <lastmod> both read
// from here, so the two freshness signals cannot drift apart. Bump the date in
// the same edit as any real content change to the page.
export const EDITORIAL_CONTENT_DATES = {
  "/worship-songs-2026": { published: "2026-07-26", modified: "2026-07-26" },
  "/worship-by-denomination": { published: "2026-07-26", modified: "2026-07-26" },
} as const satisfies Record<string, { published: string; modified: string }>;

export type EditorialPath = keyof typeof EDITORIAL_CONTENT_DATES;

export function getEditorialContentDate(path: string): string | null {
  return path in EDITORIAL_CONTENT_DATES
    ? EDITORIAL_CONTENT_DATES[path as EditorialPath].modified
    : null;
}
