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
const DESCRIPTION_MAX = 158;
const TITLE_TEMPLATES: Record<ChurchTier, string> = {
  music: "Worship Songs, Service Times & Visit Info",
  profile: "Service Times, Worship Style & Languages",
  thin: "Church Profile",
};

function readMerged<T>(merged: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!merged) return undefined;
  return merged[key] as T | undefined;
}

function resolveCity(input: ChurchMetadataInput): string | undefined {
  const merged = normalizeDisplayText(readMerged<string>(input.mergedProfile, "city"));
  if (merged) return merged;
  return extractCity(input.church.location);
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

export function buildChurchTitle(input: ChurchMetadataInput): string {
  const tier = classifyChurchTier(input);
  const city = resolveCity(input);
  const country = normalizeDisplayText(input.church.country);
  const valueProp = TITLE_TEMPLATES[tier];

  if (tier === "thin") {
    const fallbackGeo = country && !nameContainsCity(input.displayName, country)
      ? ` in ${country}`
      : "";
    return `${input.displayName}${fallbackGeo} ${TITLE_SEPARATOR} ${valueProp}`;
  }

  const fullName = appendCityIfNew(input.displayName, city);
  return `${fullName} ${TITLE_SEPARATOR} ${valueProp}`;
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
  const city = resolveCity(input);
  const country = normalizeDisplayText(input.church.country);
  const denomination = resolveDenomination(input);
  const denominationLabel = denomination ? getProfileOptionLabel(denomination) : undefined;
  const languages = resolveLanguages(input);
  const serviceLabel = getFirstServiceTimeLabel(resolveServiceTimes(input));
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

  if (serviceLabel) {
    sentences.push(`Services ${serviceLabel}.`);
  }

  if (languages.length === 1) {
    sentences.push(`Worship in ${languages[0]}.`);
  } else if (languages.length > 1) {
    sentences.push(`Worship in ${languages.slice(0, 2).join(" and ")}.`);
  }

  let built = joinSentences(sentences);

  if (built.length < 80 && longDescription) {
    const padded = longDescription.slice(0, DESCRIPTION_MAX - built.length - 1).trim();
    if (padded) built = `${built} ${padded}`;
  }

  return clip(built, DESCRIPTION_MAX);
}
