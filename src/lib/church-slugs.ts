const CHURCH_SLUG_REDIRECTS: Record<string, string> = {
  "partille-pingstforsamling": "vallhamrakyrkan",
  "pingstkyrkan-stockholm": "filadelfiakyrkan-stockholm",
};

const CANONICAL_CHURCH_SLUG_ALIASES = Object.entries(CHURCH_SLUG_REDIRECTS).reduce<Record<string, string[]>>(
  (acc, [aliasSlug, canonicalSlug]) => {
    const aliases = acc[canonicalSlug] ?? [];
    aliases.push(aliasSlug);
    acc[canonicalSlug] = aliases;
    return acc;
  },
  {}
);

export function resolveCanonicalChurchSlug(slug: string): string {
  return CHURCH_SLUG_REDIRECTS[slug] ?? slug;
}

export function getChurchSlugLookupCandidates(slug: string): string[] {
  const canonicalSlug = resolveCanonicalChurchSlug(slug);
  return [canonicalSlug, ...(CANONICAL_CHURCH_SLUG_ALIASES[canonicalSlug] ?? [])];
}

export function getChurchSlugRedirectAliases(): string[] {
  return Object.keys(CHURCH_SLUG_REDIRECTS);
}

export function isCanonicalChurchSlug(slug: string): boolean {
  return resolveCanonicalChurchSlug(slug) === slug;
}

export function filterCanonicalChurchSlugRecords<T extends { slug: string }>(rows: T[]): T[] {
  return rows.filter((row) => isCanonicalChurchSlug(row.slug));
}
