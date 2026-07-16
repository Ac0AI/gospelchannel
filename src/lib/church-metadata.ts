import type { ChurchConfig, ChurchEnrichment, ServiceTime } from "@/types/gospel";
import { extractCity } from "@/lib/church-directory";
import { getFirstServiceTimeLabel, normalizeDisplayText } from "@/lib/content-quality";
import { getProfileOptionLabel } from "@/lib/profile-fields";

export type ChurchMetadataInput = {
  church: ChurchConfig;
  enrichment?: ChurchEnrichment | null;
  mergedProfile?: Record<string, unknown> | null;
  displayName: string;
};

export type ChurchTier = "music" | "profile" | "thin";

const TITLE_SEPARATOR = "·";
const TITLE_MAX = 68;
const DESCRIPTION_MAX = 158;
type ChurchSearchOverride = {
  title?: string;
  description?: string;
  aliases?: string[];
};

// GSC query-to-page data, reviewed 2026-07-14. Keep overrides limited to
// genuine identity/location variants that the structured church record cannot
// derive by itself. Service times and addresses remain data-driven below so
// they cannot go stale in this map.
const SEARCH_QUERY_OVERRIDES: Record<string, ChurchSearchOverride> = {
  "city-harvest-church": {
    title: "City Harvest Church Singapore · Service Times & Address",
    aliases: ["City Harvest Singapore", "City Harvest Church Singapore", "CHC Singapore"],
  },
  "every-nation-dalung-bali": {
    title: "Every Nation Dalung, Bali · Church in Kabupaten Badung",
    description: "Every Nation Dalung in Kabupaten Badung, Bali, Indonesia. Find location, worship and visitor information for this Every Nation church.",
    aliases: ["Every Nation Dalung Kabupaten Badung", "Every Nation Dalung Bali"],
  },
  "fr-eglise-evangelique-de-gisors": {
    title: "Église évangélique de Gisors · Horaires et adresse",
    description: "Église Source de Siloé, église évangélique à Gisors (Eure). Culte le dimanche à 10h, adresse et informations pratiques pour votre visite.",
    aliases: ["Église évangélique de Gisors", "Église évangélique de Gisors Eure"],
  },
  "icf-zurich": {
    title: "ICF Church Zurich · Service Times, Address & Church Info",
    description: "ICF Church Zurich (ICF Zürich) in Dübendorf, Switzerland. Find service times, address, visitor details and official church links.",
    aliases: ["ICF Church Zurich", "ICF Church Zürich", "ICF Zürich", "ICF Zuerich"],
  },
  "international-central-gospel-church-hosanna-temple-teshie": {
    title: "ICGC Hosanna Temple, Teshie · Church Info",
    aliases: ["ICGC Hosanna Temple", "International Central Gospel Church Hosanna Temple"],
  },
};

function readMerged<T>(merged: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!merged) return undefined;
  return merged[key] as T | undefined;
}

function resolveCity(input: ChurchMetadataInput): string | undefined {
  // The curated location is normally the city and is safer than inferring a
  // city from multi-part street addresses. Example: a Gisors address contains
  // "Zone Industrielle" as its second segment, which is a district, not a city.
  const locationCity = extractCity(input.church.location);
  if (locationCity) return locationCity;
  const merged = normalizeDisplayText(readMerged<string>(input.mergedProfile, "city"));
  if (merged) return merged;
  return undefined;
}

function resolveStreetAddress(input: ChurchMetadataInput): string | undefined {
  return normalizeDisplayText(
    readMerged<string>(input.mergedProfile, "streetAddress") ?? input.enrichment?.streetAddress,
  );
}

function resolveDenomination(input: ChurchMetadataInput): string | undefined {
  return normalizeDisplayText(
    readMerged<string>(input.mergedProfile, "denomination")
      ?? input.enrichment?.denominationNetwork
      ?? input.church.denomination,
  );
}

function resolveLanguages(input: ChurchMetadataInput): string[] {
  const merged = readMerged<unknown>(input.mergedProfile, "languages");
  if (Array.isArray(merged)) return merged.filter((value): value is string => typeof value === "string" && value.length > 0);
  return input.enrichment?.languages ?? [];
}

function formatLanguageLabel(value: string): string {
  const label = getProfileOptionLabel(value);
  return label ? `${label[0].toLocaleUpperCase()}${label.slice(1)}` : label;
}

function resolveServiceTimes(input: ChurchMetadataInput): ServiceTime[] | undefined {
  const merged = readMerged<unknown>(input.mergedProfile, "serviceTimes");
  if (Array.isArray(merged) && merged.length > 0) return merged as ServiceTime[];
  return input.enrichment?.serviceTimes;
}

function resolveLongDescription(input: ChurchMetadataInput): string | undefined {
  const merged = normalizeDisplayText(readMerged<string>(input.mergedProfile, "description"));
  if (merged) return merged;
  return normalizeDisplayText(input.church.description);
}

function hasMusicData(church: ChurchConfig): boolean {
  return (church.spotifyPlaylistIds?.length ?? 0) > 0
    || (church.additionalPlaylists?.length ?? 0) > 0;
}

export function classifyChurchTier(input: ChurchMetadataInput): ChurchTier {
  if (hasMusicData(input.church)) return "music";

  const description = resolveLongDescription(input);
  const hasProfileSignal =
    (resolveServiceTimes(input)?.length ?? 0) > 0
    || !!resolveStreetAddress(input)
    || !!resolveDenomination(input)
    || resolveLanguages(input).length > 0
    || (description?.length ?? 0) >= 80;

  return hasProfileSignal ? "profile" : "thin";
}

function nameContainsCity(name: string, city: string): boolean {
  const normalizedName = name.toLowerCase();
  const normalizedCity = city.toLowerCase();
  return normalizedName.includes(normalizedCity);
}

function appendCityIfNew(name: string, city: string | undefined): string {
  if (!city) return name;
  if (nameContainsCity(name, city)) return name;
  return `${name} in ${city}`;
}

function buildTitleWithSuffix(identity: string, suffixes: string[]): string {
  for (const suffix of suffixes) {
    const candidate = `${identity} ${TITLE_SEPARATOR} ${suffix}`;
    if (candidate.length <= TITLE_MAX) return candidate;
  }
  return identity;
}

export function buildChurchTitle(input: ChurchMetadataInput): string {
  const override = SEARCH_QUERY_OVERRIDES[input.church.slug];
  if (override?.title) return override.title;

  const tier = classifyChurchTier(input);
  const city = resolveCity(input);
  const country = normalizeDisplayText(input.church.country);
  const serviceTimes = resolveServiceTimes(input);
  const hasServiceTimes = (serviceTimes?.length ?? 0) > 0;
  const hasAddress = !!resolveStreetAddress(input);
  const fallbackGeo = city ?? country;
  const identity = appendCityIfNew(input.displayName, fallbackGeo);

  if (hasServiceTimes && hasAddress) {
    return buildTitleWithSuffix(identity, ["Service Times & Address", "Visit Details", "Church Info"]);
  }
  if (hasServiceTimes) {
    return buildTitleWithSuffix(identity, ["Service Times & Church Info", "Service Times", "Church Info"]);
  }
  if (tier === "music") {
    return buildTitleWithSuffix(identity, ["Worship Music & Church Info", "Worship Music", "Church Info"]);
  }
  if (hasAddress) {
    return buildTitleWithSuffix(identity, ["Address & Church Info", "Visit Details", "Church Info"]);
  }
  return buildTitleWithSuffix(identity, [tier === "thin" ? "Church Profile" : "Church Info"]);
}

function joinSentences(sentences: string[]): string {
  return sentences.filter(Boolean).join(" ");
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const trimmed = text.slice(0, max - 1).replace(/[\s,.;:·-]+$/, "");
  return `${trimmed}…`;
}

export function buildChurchDescription(input: ChurchMetadataInput): string {
  const override = SEARCH_QUERY_OVERRIDES[input.church.slug];
  if (override?.description) return override.description;

  const tier = classifyChurchTier(input);
  const city = resolveCity(input);
  const country = normalizeDisplayText(input.church.country);
  const denomination = resolveDenomination(input);
  const denominationLabel = denomination ? getProfileOptionLabel(denomination) : undefined;
  const languages = resolveLanguages(input);
  const serviceLabel = getFirstServiceTimeLabel(resolveServiceTimes(input));
  const streetAddress = resolveStreetAddress(input);
  const longDescription = resolveLongDescription(input);
  const playlistCount = (input.church.spotifyPlaylistIds?.length ?? 0)
    + (input.church.additionalPlaylists?.length ?? 0);
  const artists = (input.church.notableArtists ?? []).slice(0, 2);

  const sentences: string[] = [];

  // Identity sentence — dedupe city/country if already in the display name
  // ("Hope Church Copenhagen in Copenhagen, Denmark" reads like AI slop).
  const cityIsRedundant = !!(city && nameContainsCity(input.displayName, city));
  const countryIsRedundant = !!(country && nameContainsCity(input.displayName, country));

  if (cityIsRedundant && country && !countryIsRedundant) {
    // City baked into name — append only country: "Hope Church Copenhagen, Denmark."
    sentences.push(`${input.displayName}, ${country}.`);
  } else if (countryIsRedundant && city && !cityIsRedundant) {
    // Country in name but city differs — clarify city: "USA Worship Center, Dallas."
    sentences.push(`${input.displayName}, ${city}.`);
  } else if (cityIsRedundant || countryIsRedundant) {
    // Geo already conveyed by the name itself.
    sentences.push(`${input.displayName}.`);
  } else if (city && country) {
    sentences.push(`${input.displayName} in ${city}, ${country}.`);
  } else if (country) {
    sentences.push(`${input.displayName} in ${country}.`);
  } else if (city) {
    sentences.push(`${input.displayName} in ${city}.`);
  } else {
    sentences.push(`${input.displayName}.`);
  }

  // Exact address and service-time searches are the strongest page-level GSC
  // opportunities. Put these facts before generic denomination/music copy so
  // they survive snippet truncation.
  if (streetAddress) {
    sentences.push(`Address: ${streetAddress}.`);
  }

  if (serviceLabel) {
    sentences.push(`Services ${serviceLabel}.`);
  }

  if (denominationLabel) {
    // Skip the " church" suffix when the label already contains the word
    // (e.g. denomination = "Hillsong Church" produced "Hillsong Church church.").
    const alreadyMentionsChurch = /\bchurch\b/i.test(denominationLabel);
    sentences.push(alreadyMentionsChurch ? `${denominationLabel}.` : `${denominationLabel} church.`);
  }

  // Music is the moat — for music tier, it goes ahead of services/languages
  // so it survives truncation when other sentences would push past 158 chars.
  if (playlistCount > 0) {
    if (artists.length > 0) {
      sentences.push(`Worship playlist features ${artists.join(" and ")}.`);
    } else {
      sentences.push(`Curated worship playlist on Spotify.`);
    }
  }

  if (languages.length === 1) {
    sentences.push(`Worship in ${formatLanguageLabel(languages[0])}.`);
  } else if (languages.length > 1) {
    sentences.push(`Worship in ${languages.slice(0, 2).map(formatLanguageLabel).join(" and ")}.`);
  }

  if (tier !== "thin" && !streetAddress && !serviceLabel) {
    sentences.push("Church details for a first visit.");
  }

  let built = joinSentences(sentences);

  if (built.length < 80 && longDescription) {
    const padded = longDescription.slice(0, DESCRIPTION_MAX - built.length - 1).trim();
    if (padded) built = `${built} ${padded}`;
  }

  return clip(built, DESCRIPTION_MAX);
}

export function getChurchSearchAliases(slug: string): string[] {
  return SEARCH_QUERY_OVERRIDES[slug]?.aliases ?? [];
}
