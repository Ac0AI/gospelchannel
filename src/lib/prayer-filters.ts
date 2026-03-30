import { getChurchDirectorySeedAsync } from "@/lib/content";
import {
  getAllPublishedCampuses,
  getNetworkForWorshipChurch,
  getNetworkCampuses,
} from "@/lib/church-networks";

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  "united-states": "United States",
  uk: "United Kingdom",
  "united-kingdom": "United Kingdom",
};

const MAX_CITY_LENGTH = 60;

const INVALID_CITY_PATTERNS = [
  /^\d[\d\s-]*$/,
  /\bcountries?\b/i,
  /\bworldwide\b/i,
];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getNormalizedCountryLabel(country?: string): string | undefined {
  if (!country) return undefined;
  return COUNTRY_ALIASES[slugify(country)] || country;
}

export function getNormalizedCountrySlug(country?: string): string | undefined {
  const label = getNormalizedCountryLabel(country);
  return label ? slugify(label) : undefined;
}

function buildKnownCountrySlugs(churches: Array<{ country?: string }>): Set<string> {
  return new Set(
    churches
      .map((church) => getNormalizedCountrySlug(church.country))
      .filter((slug): slug is string => Boolean(slug))
  );
}

export function extractPrayerCity(
  location?: string,
  country?: string,
  knownCountrySlugs?: Set<string>
): string | undefined {
  if (!location) return undefined;
  const city = location.split(",")[0]?.trim();
  if (!city) return undefined;
  if (city.length > MAX_CITY_LENGTH) return undefined;
  if (INVALID_CITY_PATTERNS.some((pattern) => pattern.test(city))) return undefined;

  const citySlug = slugify(city);
  if (!citySlug) return undefined;
  if (citySlug === getNormalizedCountrySlug(country)) return undefined;
  if (knownCountrySlugs?.has(citySlug)) return undefined;

  return city;
}

export async function countrySlugToDisplay(slug: string): Promise<string | undefined> {
  const aliased = COUNTRY_ALIASES[slug];
  if (aliased) return aliased;
  const churches = await getChurchDirectorySeedAsync();
  const match = churches.find((c) => getNormalizedCountrySlug(c.country) === slug);
  return getNormalizedCountryLabel(match?.country) || undefined;
}

export async function citySlugToDisplay(slug: string): Promise<string | undefined> {
  const churches = await getChurchDirectorySeedAsync();
  const knownCountrySlugs = buildKnownCountrySlugs(churches);
  for (const c of churches) {
    const city = extractPrayerCity(c.location, c.country, knownCountrySlugs);
    if (city && slugify(city) === slug) return city;
  }
  return undefined;
}

export async function getChurchSlugsByCountry(countrySlug: string): Promise<string[]> {
  const displayName = await countrySlugToDisplay(countrySlug);
  if (!displayName) return [];
  const normalizedTarget = slugify(displayName);

  const churches = await getChurchDirectorySeedAsync();
  const slugs = new Set<string>();

  for (const c of churches) {
    if (getNormalizedCountrySlug(c.country) === normalizedTarget) {
      slugs.add(c.slug);
    }
  }

  try {
    const campuses = await getAllPublishedCampuses();
    for (const campus of campuses) {
      if (getNormalizedCountrySlug(campus.country) === normalizedTarget) {
        slugs.add(campus.slug);
      }
    }
  } catch {}

  return [...slugs];
}

export async function getChurchSlugsByCity(citySlug: string): Promise<string[]> {
  const churches = await getChurchDirectorySeedAsync();
  const knownCountrySlugs = buildKnownCountrySlugs(churches);
  const slugs = new Set<string>();

  for (const c of churches) {
    const city = extractPrayerCity(c.location, c.country, knownCountrySlugs);
    if (city && slugify(city) === citySlug) {
      slugs.add(c.slug);
    }
  }

  try {
    const campuses = await getAllPublishedCampuses();
    for (const campus of campuses) {
      if (campus.city && slugify(campus.city) === citySlug) {
        slugs.add(campus.slug);
      }
    }
  } catch {}

  return [...slugs];
}

export async function getChurchSlugsForNetwork(churchSlug: string): Promise<string[]> {
  const slugs = [churchSlug];

  try {
    const network = await getNetworkForWorshipChurch(churchSlug);
    if (network) {
      const campuses = await getNetworkCampuses(network.id);
      for (const campus of campuses) {
        slugs.push(campus.slug);
      }
    }
  } catch {}

  return slugs;
}

export type FilterOption = { slug: string; label: string; count?: number };

export async function getAvailableCountries(): Promise<FilterOption[]> {
  const churches = await getChurchDirectorySeedAsync();
  const seen = new Map<string, string>();

  for (const c of churches) {
    if (!c.country) continue;
    const slug = getNormalizedCountrySlug(c.country);
    const display = getNormalizedCountryLabel(c.country);
    if (!slug || !display) continue;
    if (!seen.has(slug)) {
      seen.set(slug, display);
    }
  }

  return [...seen.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getAvailableCities(countrySlug?: string): Promise<FilterOption[]> {
  const churches = await getChurchDirectorySeedAsync();
  const knownCountrySlugs = buildKnownCountrySlugs(churches);
  const seen = new Map<string, string>();

  for (const c of churches) {
    if (countrySlug && getNormalizedCountrySlug(c.country) !== countrySlug) continue;
    const city = extractPrayerCity(c.location, c.country, knownCountrySlugs);
    if (!city) continue;
    const slug = slugify(city);
    if (!seen.has(slug)) {
      seen.set(slug, city);
    }
  }

  return [...seen.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getAvailableChurches(countrySlug?: string, citySlug?: string): Promise<FilterOption[]> {
  const churches = await getChurchDirectorySeedAsync();
  const knownCountrySlugs = buildKnownCountrySlugs(churches);
  const results: FilterOption[] = [];

  for (const c of churches) {
    if (countrySlug && getNormalizedCountrySlug(c.country) !== countrySlug) continue;
    if (citySlug) {
      const city = extractPrayerCity(c.location, c.country, knownCountrySlugs);
      if (!city || slugify(city) !== citySlug) continue;
    }
    results.push({ slug: c.slug, label: c.name });
  }

  return results.sort((a, b) => a.label.localeCompare(b.label));
}
