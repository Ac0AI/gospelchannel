import type { ChurchConfig } from "@/types/gospel";
import { slugify } from "@/lib/slugify";

type ChurchDirectoryEnrichmentHint = {
  dataRichnessScore?: number;
  location?: string;
  serviceTimes?: string;
  summary?: string;
};

export type ChurchDirectoryEntry = {
  slug: string;
  name: string;
  aliases?: string[];
  description: string;
  country: string;
  location?: string;
  musicStyle?: string[];
  denomination?: string;
  displayReady?: boolean;
  promotionTier?: "promotable" | "catalog_only";
  displayScore?: number;
  qualityScore?: number;
  enrichmentHint?: ChurchDirectoryEnrichmentHint;
  spotifyPlaylistIds: string[];
  additionalPlaylists?: string[];
  playlistCount?: number;
  logo?: string;
  thumbnailUrl?: string;
  updatedAt?: string;
  songCount?: number;
  sourceKind?: ChurchConfig["sourceKind"];
};

export type FacetLink = {
  slug: string;
  label: string;
  href: string;
  count: number;
};

export type StyleFilter = {
  slug: string;
  label: string;
  seoLabel: string;
  match: string[];
};

export type DenominationFilter = {
  slug: string;
  label: string;
  match: string[];
};

export const STYLE_FILTERS: StyleFilter[] = [
  {
    slug: "contemporary-worship",
    label: "Congregational",
    seoLabel: "Contemporary Worship",
    match: ["contemporary worship", "modern worship", "contemporary christian", "ccm", "contemporary worship music"],
  },
  {
    slug: "gospel",
    label: "Gospel & Choir",
    seoLabel: "Gospel Choir",
    match: ["gospel", "contemporary gospel"],
  },
  {
    slug: "charismatic",
    label: "Spirit-Led",
    seoLabel: "Charismatic Worship",
    match: ["charismatic worship", "prophetic worship", "spontaneous worship", "prayer-fueled worship", "pentecostal", "praise and worship"],
  },
  {
    slug: "african",
    label: "African & Diaspora",
    seoLabel: "African Gospel",
    match: ["african worship", "igbo christian music", "south african township gospel"],
  },
  {
    slug: "latin",
    label: "Latin & Spanish",
    seoLabel: "Spanish and Latin Worship",
    match: ["latin worship", "latin ccm", "spanish worship", "latin christian"],
  },
  {
    slug: "acoustic",
    label: "Acoustic",
    seoLabel: "Acoustic Worship",
    match: ["acoustic worship", "folk rock", "celtic", "swedish worship"],
  },
  {
    slug: "kids",
    label: "Family & Kids",
    seoLabel: "Kids Worship",
    match: ["kids worship"],
  },
  {
    slug: "rock",
    label: "High Energy",
    seoLabel: "High Energy Worship",
    match: ["christian rock", "christian edm", "high-energy praise", "worship anthems"],
  },
];

export const DENOMINATION_FILTERS: DenominationFilter[] = [
  { slug: "non-denominational", label: "Non-denominational", match: ["non-denominational"] },
  { slug: "pentecostal", label: "Pentecostal", match: ["pentecostal", "assemblies of god", "disciples of christ"] },
  { slug: "evangelical", label: "Evangelical", match: ["evangelical"] },
  { slug: "charismatic", label: "Charismatic", match: ["charismatic"] },
  { slug: "baptist", label: "Baptist", match: ["baptist"] },
  { slug: "anglican", label: "Anglican", match: ["anglican", "church of england"] },
  { slug: "lutheran", label: "Lutheran", match: ["lutheran"] },
];

export function extractCity(location?: string): string | undefined {
  if (!location) return undefined;
  const city = location.split(",")[0]?.trim();
  if (!city || city.length > 60) return undefined;
  return city;
}

function getPlaylistCount(church: Pick<ChurchDirectoryEntry, "playlistCount" | "spotifyPlaylistIds" | "additionalPlaylists">): number {
  if (typeof church.playlistCount === "number" && church.playlistCount > 0) {
    return church.playlistCount;
  }
  return new Set([...(church.spotifyPlaylistIds ?? []), ...(church.additionalPlaylists ?? [])]).size;
}

/** Strip accents so "malaga" matches "Málaga", "église" matches "eglise" etc. */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Split query into words for multi-word matching ("hillsong stockholm" matches both fields) */
function getTextMatchScore(church: ChurchDirectoryEntry, query: string): number {
  const q = normalize(query.trim());
  if (!q) return 0;

  const name = normalize(church.name);
  const location = normalize(church.location ?? "");
  const country = normalize(church.country);
  const denomination = normalize(church.denomination ?? "");
  const styles = (church.musicStyle ?? []).map(normalize);
  const aliases = (church.aliases ?? []).map(normalize);
  const description = normalize(church.description ?? "");

  // Single-pass scoring for the full query
  let score = 0;
  if (name.startsWith(q)) score = Math.max(score, 100);
  else if (name.includes(q)) score = Math.max(score, 70);

  for (const alias of aliases) {
    if (alias.startsWith(q)) score = Math.max(score, 90);
    else if (alias.includes(q)) score = Math.max(score, 60);
  }

  // Location/city matches are highly relevant — a search for "göteborg"
  // should strongly prefer churches located there over churches that merely
  // mention the city in their description.
  if (location.startsWith(q)) score = Math.max(score, 85);
  else if (location.includes(q)) score = Math.max(score, 60);

  if (country.startsWith(q)) score = Math.max(score, 35);
  else if (country.includes(q)) score = Math.max(score, 30);
  if (denomination.includes(q)) score = Math.max(score, 35);
  if (styles.some((s) => s.includes(q))) score = Math.max(score, 30);
  // Description matches are weak signals — don't let them outrank location
  if (description.includes(q)) score = Math.max(score, 10);

  // Multi-word: if query has spaces, check if ALL words match somewhere
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 1) {
    const haystack = [name, location, country, denomination, ...styles, ...aliases, description].join(" ");
    const allMatch = words.every((w) => haystack.includes(w));
    if (allMatch) score = Math.max(score, 50 + words.length * 10);
  }

  return score;
}

function getDirectoryScore(church: ChurchDirectoryEntry): number {
  const playlistCount = getPlaylistCount(church);
  const richness = church.enrichmentHint?.dataRichnessScore ?? 0;
  const quality = church.qualityScore ?? 0;
  const display = church.displayScore ?? 0;
  const promotion = church.promotionTier === "promotable" ? 24 : 0;
  return promotion + display + quality + richness * 0.5 + playlistCount * 10;
}

export function matchesStyle(musicStyle: string[] | undefined, styleSlug: string): boolean {
  if (!musicStyle) return false;
  const filter = STYLE_FILTERS.find((item) => item.slug === styleSlug);
  if (!filter) return false;
  return musicStyle.some((value) => filter.match.some((candidate) => value.toLowerCase().includes(candidate)));
}

export function matchesDenomination(denomination: string | undefined, denominationSlug: string): boolean {
  if (!denomination) return false;
  const filter = DENOMINATION_FILTERS.find((item) => item.slug === denominationSlug);
  if (!filter) return false;
  const normalized = denomination.toLowerCase();
  return filter.match.some((candidate) => normalized.includes(candidate));
}

export function getStyleFilterBySlug(styleSlug: string): StyleFilter | undefined {
  return STYLE_FILTERS.find((filter) => filter.slug === styleSlug);
}

export function getDenominationFilterBySlug(denominationSlug: string): DenominationFilter | undefined {
  return DENOMINATION_FILTERS.find((filter) => filter.slug === denominationSlug);
}

export function getPrimaryStyleFilter(church: Pick<ChurchDirectoryEntry, "musicStyle">): StyleFilter | undefined {
  return STYLE_FILTERS.find((filter) => matchesStyle(church.musicStyle, filter.slug));
}

export function getPrimaryDenominationFilter(church: Pick<ChurchDirectoryEntry, "denomination">): DenominationFilter | undefined {
  return DENOMINATION_FILTERS.find((filter) => matchesDenomination(church.denomination, filter.slug));
}

export function filterChurchDirectory(
  churches: ChurchDirectoryEntry[],
  options: {
    query?: string;
    countrySlug?: string;
    citySlug?: string;
    styleSlug?: string;
    denominationSlug?: string;
  } = {},
): ChurchDirectoryEntry[] {
  const query = options.query?.trim() ?? "";

  // When actively searching, show all churches (even those without music).
  // When browsing (no query), hide churches that aren't display-ready.
  let filtered = query
    ? churches
    : churches.filter((church) => church.displayReady !== false);

  if (options.countrySlug) {
    filtered = filtered.filter((church) => church.country && slugify(church.country) === options.countrySlug);
  }

  if (options.citySlug) {
    filtered = filtered.filter((church) => {
      const city = extractCity(church.location);
      return Boolean(city && slugify(city) === options.citySlug);
    });
  }

  if (options.styleSlug) {
    filtered = filtered.filter((church) => matchesStyle(church.musicStyle, options.styleSlug!));
  }

  if (options.denominationSlug) {
    filtered = filtered.filter((church) => matchesDenomination(church.denomination, options.denominationSlug!));
  }

  if (query) {
    filtered = filtered.filter((church) => getTextMatchScore(church, query) > 0);
  }

  return [...filtered].sort((a, b) => {
    if (query) {
      const scoreDiff = getTextMatchScore(b, query) - getTextMatchScore(a, query);
      if (scoreDiff !== 0) return scoreDiff;
    }

    const directoryDiff = getDirectoryScore(b) - getDirectoryScore(a);
    if (directoryDiff !== 0) return directoryDiff;

    const playlistDiff = getPlaylistCount(b) - getPlaylistCount(a);
    if (playlistDiff !== 0) return playlistDiff;

    return a.name.localeCompare(b.name);
  });
}

export function paginateChurches(churches: ChurchDirectoryEntry[], page: number, pageSize: number) {
  const totalCount = churches.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    currentPage,
    totalCount,
    totalPages,
    pageItems: churches.slice(start, start + pageSize),
  };
}

export function getCountryLinks(churches: Pick<ChurchDirectoryEntry, "country">[], limit?: number): FacetLink[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const church of churches) {
    if (!church.country) continue;
    const slug = slugify(church.country);
    const entry = counts.get(slug);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(slug, { label: church.country, count: 1 });
    }
  }

  const links = [...counts.entries()]
    .map(([slug, value]) => ({
      slug,
      label: value.label,
      href: `/church/country/${slug}`,
      count: value.count,
    }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  return typeof limit === "number" ? links.slice(0, limit) : links;
}

export function getCityLinks(churches: Pick<ChurchDirectoryEntry, "location">[], limit?: number): FacetLink[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const church of churches) {
    const city = extractCity(church.location);
    if (!city) continue;
    const slug = slugify(city);
    const entry = counts.get(slug);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(slug, { label: city, count: 1 });
    }
  }

  const links = [...counts.entries()]
    .map(([slug, value]) => ({
      slug,
      label: value.label,
      href: `/church/city/${slug}`,
      count: value.count,
    }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  return typeof limit === "number" ? links.slice(0, limit) : links;
}

export function getStyleLinks(churches: Pick<ChurchDirectoryEntry, "musicStyle">[], limit?: number): FacetLink[] {
  const links = STYLE_FILTERS
    .map((filter) => ({
      slug: filter.slug,
      label: filter.seoLabel,
      href: `/church/style/${filter.slug}`,
      count: churches.filter((church) => matchesStyle(church.musicStyle, filter.slug)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  return typeof limit === "number" ? links.slice(0, limit) : links;
}

export function getDenominationLinks(churches: Pick<ChurchDirectoryEntry, "denomination">[], limit?: number): FacetLink[] {
  const links = DENOMINATION_FILTERS
    .map((filter) => ({
      slug: filter.slug,
      label: filter.label,
      href: `/church/denomination/${filter.slug}`,
      count: churches.filter((church) => matchesDenomination(church.denomination, filter.slug)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  return typeof limit === "number" ? links.slice(0, limit) : links;
}

export function getCountryLabelFromSlug(churches: Pick<ChurchDirectoryEntry, "country">[], countrySlug: string): string | undefined {
  const match = churches.find((church) => church.country && slugify(church.country) === countrySlug);
  return match?.country;
}

export function getCityLabelFromSlug(churches: Pick<ChurchDirectoryEntry, "location">[], citySlug: string): string | undefined {
  const match = churches.find((church) => {
    const city = extractCity(church.location);
    return Boolean(city && slugify(city) === citySlug);
  });
  return extractCity(match?.location);
}

export function buildSearchSummary(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}
