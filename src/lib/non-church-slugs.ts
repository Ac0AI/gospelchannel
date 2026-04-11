const NON_CHURCH_SLUGS = new Set([
  "glasgow-city-church-worship",
  "joyous-celebration",
  "miel-san-marcos",
  "oslo-church-music-festival",
  "outbreakband",
  "passion",
  "the-sound-of-audacious-church",
  "welcome-church-music",
]);

export function isExplicitNonChurchSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return NON_CHURCH_SLUGS.has(slug);
}

export function filterExplicitNonChurchRows<T extends { slug: string }>(rows: T[]): T[] {
  return rows.filter((row) => !isExplicitNonChurchSlug(row.slug));
}

export function getExplicitNonChurchSlugs(): string[] {
  return Array.from(NON_CHURCH_SLUGS);
}
