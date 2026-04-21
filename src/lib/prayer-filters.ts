import { getChurchDirectorySeedAsync, type ChurchDirectorySeed } from "@/lib/content";
import {
  getAllPublishedCampuses,
  getNetworkForWorshipChurch,
  getNetworkCampuses,
} from "@/lib/church-networks";
import type { ChurchCampus } from "@/types/gospel";

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  "united-states": "United States",
  uk: "United Kingdom",
  "united-kingdom": "United Kingdom",
};

const MAX_CITY_LENGTH = 60;
const PRAYER_FILTER_CACHE_SECONDS = 60 * 60;
const COUNTRY_CITY_DELIMITER = "::";

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

function buildKnownCountrySlugs(sources: Array<{ country?: string }>): Set<string> {
  return new Set(
    sources
      .map((source) => getNormalizedCountrySlug(source.country))
      .filter((slug): slug is string => Boolean(slug))
  );
}

function getCountryCityKey(countrySlug?: string, citySlug?: string): string {
  return `${countrySlug ?? ""}${COUNTRY_CITY_DELIMITER}${citySlug ?? ""}`;
}

function normalizeCountrySlugInput(countrySlug?: string): string | undefined {
  return countrySlug ? getNormalizedCountrySlug(countrySlug) : undefined;
}

type CampusSeed = Pick<ChurchCampus, "slug" | "name" | "city" | "country">;
type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

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

export type FilterOption = { slug: string; label: string; count?: number };

export type PrayerFilterIndex = {
  countryOptions: FilterOption[];
  allCityOptions: FilterOption[];
  allChurchOptions: FilterOption[];
  countryLabelBySlug: Record<string, string>;
  cityLabelBySlug: Record<string, string>;
  churchNameBySlug: Record<string, string>;
  countrySlugByChurchSlug: Record<string, string>;
  churchSlugsByCountry: Record<string, string[]>;
  churchSlugsByCity: Record<string, string[]>;
  citiesByCountry: Record<string, FilterOption[]>;
  churchOptionsByCountry: Record<string, FilterOption[]>;
  churchOptionsByCountryAndCity: Record<string, FilterOption[]>;
};

function setLabel(map: Map<string, string>, slug: string | undefined, label: string | undefined) {
  if (!slug || !label || map.has(slug)) return;
  map.set(slug, label);
}

function addOption(
  store: Map<string, Map<string, FilterOption>>,
  key: string,
  option: FilterOption,
) {
  const options = store.get(key) ?? new Map<string, FilterOption>();
  if (!options.has(option.slug)) {
    options.set(option.slug, option);
  }
  store.set(key, options);
}

function addSlug(store: Map<string, Set<string>>, key: string, slug: string) {
  const values = store.get(key) ?? new Set<string>();
  values.add(slug);
  store.set(key, values);
}

function sortOptions(options: Iterable<FilterOption>): FilterOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

function mapToSortedOptionRecord(store: Map<string, Map<string, FilterOption>>): Record<string, FilterOption[]> {
  return Object.fromEntries(
    [...store.entries()].map(([key, values]) => [key, sortOptions(values.values())]),
  );
}

function mapToSortedSlugRecord(store: Map<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries(
    [...store.entries()].map(([key, values]) => [key, [...values].sort()]),
  );
}

export function buildPrayerFilterIndex(
  churches: ChurchDirectorySeed[],
  campuses: CampusSeed[],
): PrayerFilterIndex {
  const knownCountrySlugs = buildKnownCountrySlugs([...churches, ...campuses]);
  const countryLabelBySlug = new Map<string, string>();
  const cityLabelBySlug = new Map<string, string>();
  const churchNameBySlug = new Map<string, string>();
  const countrySlugByChurchSlug = new Map<string, string>();
  const churchSlugsByCountry = new Map<string, Set<string>>();
  const churchSlugsByCity = new Map<string, Set<string>>();
  const citiesByCountry = new Map<string, Map<string, FilterOption>>();
  const churchOptionsByCountry = new Map<string, Map<string, FilterOption>>();
  const churchOptionsByCountryAndCity = new Map<string, Map<string, FilterOption>>();
  const allCityOptions = new Map<string, FilterOption>();
  const allChurchOptions = new Map<string, FilterOption>();

  function registerEntity(input: {
    slug: string;
    name: string;
    country?: string;
    city?: string;
  }) {
    churchNameBySlug.set(input.slug, input.name);
    allChurchOptions.set(input.slug, { slug: input.slug, label: input.name });

    const countrySlug = getNormalizedCountrySlug(input.country);
    const countryLabel = getNormalizedCountryLabel(input.country);

    setLabel(countryLabelBySlug, countrySlug, countryLabel);

    if (countrySlug) {
      countrySlugByChurchSlug.set(input.slug, countrySlug);
      addSlug(churchSlugsByCountry, countrySlug, input.slug);
      addOption(churchOptionsByCountry, countrySlug, { slug: input.slug, label: input.name });
    }

    if (!input.city) {
      return;
    }

    const citySlug = slugify(input.city);
    if (!citySlug) {
      return;
    }

    setLabel(cityLabelBySlug, citySlug, input.city);
    allCityOptions.set(citySlug, { slug: citySlug, label: input.city });
    addSlug(churchSlugsByCity, citySlug, input.slug);
    addOption(churchOptionsByCountryAndCity, getCountryCityKey(undefined, citySlug), {
      slug: input.slug,
      label: input.name,
    });

    if (!countrySlug) {
      return;
    }

    addOption(citiesByCountry, countrySlug, { slug: citySlug, label: input.city });
    addOption(churchOptionsByCountryAndCity, getCountryCityKey(countrySlug, citySlug), {
      slug: input.slug,
      label: input.name,
    });
  }

  for (const church of churches) {
    registerEntity({
      slug: church.slug,
      name: church.name,
      country: church.country,
      city: extractPrayerCity(church.location, church.country, knownCountrySlugs),
    });
  }

  for (const campus of campuses) {
    registerEntity({
      slug: campus.slug,
      name: campus.name,
      country: campus.country,
      city: extractPrayerCity(campus.city, campus.country, knownCountrySlugs),
    });
  }

  return {
    countryOptions: sortOptions(
      [...countryLabelBySlug.entries()].map(([slug, label]) => ({ slug, label })),
    ),
    allCityOptions: sortOptions(allCityOptions.values()),
    allChurchOptions: sortOptions(allChurchOptions.values()),
    countryLabelBySlug: Object.fromEntries(countryLabelBySlug),
    cityLabelBySlug: Object.fromEntries(cityLabelBySlug),
    churchNameBySlug: Object.fromEntries(churchNameBySlug),
    countrySlugByChurchSlug: Object.fromEntries(countrySlugByChurchSlug),
    churchSlugsByCountry: mapToSortedSlugRecord(churchSlugsByCountry),
    churchSlugsByCity: mapToSortedSlugRecord(churchSlugsByCity),
    citiesByCountry: mapToSortedOptionRecord(citiesByCountry),
    churchOptionsByCountry: mapToSortedOptionRecord(churchOptionsByCountry),
    churchOptionsByCountryAndCity: mapToSortedOptionRecord(churchOptionsByCountryAndCity),
  };
}

async function buildPrayerFilterIndexFromSource(): Promise<PrayerFilterIndex> {
  const [churches, campuses] = await Promise.all([
    getChurchDirectorySeedAsync(),
    getAllPublishedCampuses().catch(() => []),
  ]);

  return buildPrayerFilterIndex(churches, campuses);
}

async function expandChurchSlugsForNetwork(churchSlug: string): Promise<string[]> {
  const slugs = new Set([churchSlug]);

  try {
    const network = await getNetworkForWorshipChurch(churchSlug);
    if (!network) {
      return [churchSlug];
    }

    const campuses = await getNetworkCampuses(network.id);
    for (const campus of campuses) {
      slugs.add(campus.slug);
    }
  } catch {}

  return [...slugs].sort();
}

let prayerFilterIndexCache: CacheEntry<PrayerFilterIndex> | null = null;
let prayerFilterIndexPromise: Promise<PrayerFilterIndex> | null = null;
const networkChurchSlugsCache = new Map<string, CacheEntry<string[]>>();
const networkChurchSlugsPromises = new Map<string, Promise<string[]>>();

function getCachedValue<T>(entry: CacheEntry<T> | null): T | undefined {
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) return undefined;
  return entry.value;
}

export async function getPrayerFilterIndex(): Promise<PrayerFilterIndex> {
  const cached = getCachedValue(prayerFilterIndexCache);
  if (cached) {
    return cached;
  }

  if (prayerFilterIndexPromise) {
    return prayerFilterIndexPromise;
  }

  prayerFilterIndexPromise = buildPrayerFilterIndexFromSource()
    .then((value) => {
      prayerFilterIndexCache = {
        value,
        expiresAt: Date.now() + PRAYER_FILTER_CACHE_SECONDS * 1000,
      };
      return value;
    })
    .finally(() => {
      prayerFilterIndexPromise = null;
    });

  return prayerFilterIndexPromise;
}

export async function getChurchNamesBySlugs(
  churchSlugs: Iterable<string>,
): Promise<Record<string, string>> {
  const index = await getPrayerFilterIndex();
  const names: Record<string, string> = {};

  for (const slug of churchSlugs) {
    const name = index.churchNameBySlug[slug];
    if (name) {
      names[slug] = name;
    }
  }

  return names;
}

export async function countrySlugToDisplay(slug: string): Promise<string | undefined> {
  const index = await getPrayerFilterIndex();
  const normalizedSlug = normalizeCountrySlugInput(slug);
  if (!normalizedSlug) return undefined;
  return index.countryLabelBySlug[normalizedSlug];
}

export async function citySlugToDisplay(slug: string): Promise<string | undefined> {
  const index = await getPrayerFilterIndex();
  return index.cityLabelBySlug[slug];
}

export async function getChurchSlugsByCountry(countrySlug: string): Promise<string[]> {
  const index = await getPrayerFilterIndex();
  const normalizedSlug = normalizeCountrySlugInput(countrySlug);
  if (!normalizedSlug) return [];
  return index.churchSlugsByCountry[normalizedSlug] ?? [];
}

export async function getChurchSlugsByCity(citySlug: string): Promise<string[]> {
  const index = await getPrayerFilterIndex();
  return index.churchSlugsByCity[citySlug] ?? [];
}

export async function getChurchSlugsForNetwork(churchSlug: string): Promise<string[]> {
  const cached = networkChurchSlugsCache.get(churchSlug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = networkChurchSlugsPromises.get(churchSlug);
  if (inFlight) {
    return inFlight;
  }

  const promise = expandChurchSlugsForNetwork(churchSlug)
    .then((value) => {
      networkChurchSlugsCache.set(churchSlug, {
        value,
        expiresAt: Date.now() + PRAYER_FILTER_CACHE_SECONDS * 1000,
      });
      return value;
    })
    .finally(() => {
      networkChurchSlugsPromises.delete(churchSlug);
    });

  networkChurchSlugsPromises.set(churchSlug, promise);
  return promise;
}

export async function getAvailableCountries(): Promise<FilterOption[]> {
  const index = await getPrayerFilterIndex();
  return index.countryOptions;
}

export async function getAvailableCities(countrySlug?: string): Promise<FilterOption[]> {
  const index = await getPrayerFilterIndex();
  const normalizedCountrySlug = normalizeCountrySlugInput(countrySlug);

  if (!normalizedCountrySlug) {
    return index.allCityOptions;
  }

  return index.citiesByCountry[normalizedCountrySlug] ?? [];
}

export async function getAvailableChurches(countrySlug?: string, citySlug?: string): Promise<FilterOption[]> {
  const index = await getPrayerFilterIndex();
  const normalizedCountrySlug = normalizeCountrySlugInput(countrySlug);

  if (citySlug) {
    return (
      index.churchOptionsByCountryAndCity[getCountryCityKey(normalizedCountrySlug, citySlug)]
      ?? []
    );
  }

  if (normalizedCountrySlug) {
    return index.churchOptionsByCountry[normalizedCountrySlug] ?? [];
  }

  return index.allChurchOptions;
}
