const CHURCH_SLUG_REDIRECTS: Record<string, string> = {
  "partille-pingstforsamling": "vallhamrakyrkan",
  "pingstkyrkan-stockholm": "filadelfiakyrkan-stockholm",
};

export function resolveCanonicalChurchSlug(slug: string): string {
  return CHURCH_SLUG_REDIRECTS[slug] ?? slug;
}

export function isCanonicalChurchSlug(slug: string): boolean {
  return resolveCanonicalChurchSlug(slug) === slug;
}

export function filterCanonicalChurchSlugRecords<T extends { slug: string }>(rows: T[]): T[] {
  return rows.filter((row) => isCanonicalChurchSlug(row.slug));
}
