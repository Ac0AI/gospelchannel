import "server-only";

import { unstable_cache } from "next/cache";
import { getSql } from "@/db";
import { CHURCH_INDEX_TAG } from "@/lib/content";
import {
  DENOMINATION_FILTERS,
  STYLE_FILTERS,
  matchesDenomination,
  matchesStyle,
} from "@/lib/church-directory";
import { formatLanguageLabel, splitLanguageValues } from "@/lib/languages";
import type { CityFinderChurch, CityFinderOption } from "@/lib/city-finder";

type ServiceTime = {
  day?: string | null;
  time?: string | null;
  label?: string | null;
};

type CityFinderRow = {
  slug: string;
  name: string;
  country: string | null;
  location: string | null;
  denomination: string | null;
  music_style: string[] | null;
  language: string | null;
  spotify_playlist_ids: string[] | null;
  additional_playlists: string[] | null;
  youtube_videos: unknown;
  directory_score: number | null;
  street_address: string | null;
  latitude: number;
  longitude: number;
  service_times: ServiceTime[] | null;
  languages: string[] | null;
  children_ministry: boolean | null;
  youth_ministry: boolean | null;
  what_to_expect: string | null;
  last_enriched_at: string | null;
};

export type CityFinderData = {
  churches: CityFinderChurch[];
  styleOptions: CityFinderOption[];
  denominationOptions: CityFinderOption[];
  languageOptions: CityFinderOption[];
};

function normalizeServiceTimes(value: unknown): ServiceTime[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ServiceTime => Boolean(entry && typeof entry === "object"));
}

function parseHour(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::\d{2})?\s*(am|pm)?/);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(hour) || hour > 23) return null;
  if (match[2] === "am" && hour === 12) hour = 0;
  if (match[2] === "pm" && hour < 12) hour += 12;
  return hour;
}

function getServicePeriods(times: ServiceTime[]): CityFinderChurch["servicePeriods"] {
  const periods = new Set<CityFinderChurch["servicePeriods"][number]>();
  for (const entry of times) {
    if (!entry.time) continue;
    const hour = parseHour(entry.time);
    if (hour == null) continue;
    periods.add(hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening");
  }
  return [...periods];
}

function getPrimaryServiceTime(times: ServiceTime[]): string | null {
  const valid = times.filter((entry) => entry.day?.trim() && entry.time?.trim());
  const sunday = valid.filter((entry) => entry.day?.trim().toLowerCase() === "sunday");
  const mainSunday = sunday.find((entry) => /service|worship|gathering|mass/i.test(entry.label ?? ""));
  const selected = mainSunday ?? sunday[0] ?? valid[0];
  return selected ? `${selected.day!.trim()} ${selected.time!.trim()}` : null;
}

function hasVideo(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function getLanguages(row: CityFinderRow): string[] {
  const values = [
    ...splitLanguageValues(row.language ?? ""),
    ...(row.languages ?? []),
  ]
    .map(formatLanguageLabel)
    .filter(Boolean);
  return [...new Set(values)];
}

function buildOptions(
  churches: CityFinderChurch[],
  definitions: Array<{ value: string; label: string; matches: (church: CityFinderChurch) => boolean }>,
  limit: number,
): CityFinderOption[] {
  return definitions
    .map((definition) => ({
      value: definition.value,
      label: definition.label,
      count: churches.filter(definition.matches).length,
    }))
    .filter((option) => option.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

async function loadCityFinderData(citySlug: string): Promise<CityFinderData> {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        c.slug, c.name, c.country, c.location, c.denomination, c.music_style, c.language,
        c.spotify_playlist_ids, c.additional_playlists, c.youtube_videos, c.directory_score,
        e.street_address, e.latitude, e.longitude,
        COALESCE(e.service_times, c.service_times) AS service_times,
        e.languages, e.children_ministry, e.youth_ministry, e.what_to_expect, e.last_enriched_at
      FROM churches c
      JOIN LATERAL (
        SELECT ce.*
        FROM church_enrichments ce
        WHERE ce.church_slug = c.slug
          AND ce.latitude IS NOT NULL
          AND ce.longitude IS NOT NULL
        ORDER BY ce.updated_at DESC NULLS LAST, ce.id DESC
        LIMIT 1
      ) e ON TRUE
      WHERE c.status = 'approved'
        AND c.directory_ready IS NOT FALSE
        AND c.city_slug = $1
        AND COALESCE(e.service_times, c.service_times) IS NOT NULL
        AND jsonb_typeof(COALESCE(e.service_times, c.service_times)) = 'array'
        AND jsonb_array_length(COALESCE(e.service_times, c.service_times)) > 0
      ORDER BY c.directory_score DESC NULLS LAST, c.name ASC
      LIMIT 500
    `,
    [citySlug],
  )) as CityFinderRow[];

  const churches = rows.flatMap((row): CityFinderChurch[] => {
    const serviceTimes = normalizeServiceTimes(row.service_times);
    const serviceTime = getPrimaryServiceTime(serviceTimes);
    if (!serviceTime) return [];

    const worshipStyles = row.music_style?.filter(Boolean) ?? [];
    const denominationSlugs = DENOMINATION_FILTERS
      .filter((filter) => matchesDenomination(row.denomination ?? undefined, filter.slug))
      .map((filter) => filter.slug);
    const styleSlugs = STYLE_FILTERS
      .filter((filter) => matchesStyle(worshipStyles, filter.slug))
      .map((filter) => filter.slug);

    return [{
      slug: row.slug,
      name: row.name,
      country: row.country ?? "United States",
      address: row.street_address?.trim() || row.location?.trim() || "Austin, Texas",
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      denomination: row.denomination?.trim() || undefined,
      denominationSlugs,
      worshipStyles,
      styleSlugs,
      languages: getLanguages(row),
      serviceTime,
      servicePeriods: getServicePeriods(serviceTimes),
      hasKids: row.children_ministry === true || row.youth_ministry === true,
      hasWorshipPreview: Boolean(
        (row.spotify_playlist_ids?.length ?? 0) > 0
        || (row.additional_playlists?.length ?? 0) > 0
        || hasVideo(row.youtube_videos),
      ),
      hasVisitorDetails: Boolean(row.what_to_expect?.trim()),
      checkedAt: row.last_enriched_at ?? undefined,
      qualityScore: Number(row.directory_score ?? 0),
    }];
  });

  const styleOptions = buildOptions(
    churches,
    STYLE_FILTERS.map((filter) => ({
      value: filter.slug,
      label: filter.seoLabel,
      matches: (church: CityFinderChurch) => church.styleSlugs.includes(filter.slug),
    })),
    5,
  );
  const denominationOptions = buildOptions(
    churches,
    DENOMINATION_FILTERS.map((filter) => ({
      value: filter.slug,
      label: filter.label,
      matches: (church: CityFinderChurch) => church.denominationSlugs.includes(filter.slug),
    })),
    6,
  );
  const languageLabels = [...new Set(churches.flatMap((church) => church.languages))];
  const languageOptions = buildOptions(
    churches,
    languageLabels.map((label) => ({
      value: label,
      label,
      matches: (church: CityFinderChurch) => church.languages.includes(label),
    })),
    5,
  );

  return { churches, styleOptions, denominationOptions, languageOptions };
}

export function getCityFinderData(citySlug: string): Promise<CityFinderData> {
  return unstable_cache(
    () => loadCityFinderData(citySlug),
    ["city-finder", citySlug],
    { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
  )();
}
