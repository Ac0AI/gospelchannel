export const NEARBY_DEFAULT_RADIUS_KM = 24;
export const NEARBY_MAX_RADIUS_KM = 100;
export const NEARBY_DEFAULT_LIMIT = 12;
export const NEARBY_MAX_LIMIT = 20;

export type NearbyChurchSearchInput = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit: number;
  worshipStyle?: string;
  denomination?: string;
  language?: string;
  hasServiceTimes: boolean;
  kids: boolean;
};

export type NearbyChurchResult = {
  slug: string;
  name: string;
  url: string;
  location: string | null;
  country: string | null;
  denomination: string | null;
  worshipStyles: string[];
  language: string | null;
  languages?: string[];
  website: string | null;
  summary: string | null;
  distanceKm?: number;
  serviceTimes?: unknown;
  serviceTimesNote?: string;
  streetAddress?: string | null;
  hasKids?: boolean;
  hasVisitorDetails?: boolean;
  hasParkingInfo?: boolean;
  checkedAt?: string;
};

export type NearbyChurchSearchResponse = {
  churches: NearbyChurchResult[];
};

type ParseResult =
  | { ok: true; value: NearbyChurchSearchInput }
  | { ok: false; error: string };

type ServiceTime = {
  day?: unknown;
  time?: unknown;
  label?: unknown;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalFilter(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 60) : undefined;
}

export function roundNearbyCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseNearbyChurchSearchInput(value: unknown): ParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "A search request is required." };
  }

  const input = value as Record<string, unknown>;
  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);

  if (latitude == null || latitude < -90 || latitude > 90) {
    return { ok: false, error: "Latitude must be between -90 and 90." };
  }
  if (longitude == null || longitude < -180 || longitude > 180) {
    return { ok: false, error: "Longitude must be between -180 and 180." };
  }

  const rawRadius = finiteNumber(input.radiusKm) ?? NEARBY_DEFAULT_RADIUS_KM;
  const rawLimit = finiteNumber(input.limit) ?? NEARBY_DEFAULT_LIMIT;

  return {
    ok: true,
    value: {
      latitude: roundNearbyCoordinate(latitude),
      longitude: roundNearbyCoordinate(longitude),
      radiusKm: clamp(Math.round(rawRadius), 1, NEARBY_MAX_RADIUS_KM),
      limit: clamp(Math.round(rawLimit), 1, NEARBY_MAX_LIMIT),
      worshipStyle: optionalFilter(input.worshipStyle),
      denomination: optionalFilter(input.denomination),
      language: optionalFilter(input.language),
      hasServiceTimes: input.hasServiceTimes === true,
      kids: input.kids === true,
    },
  };
}

function cleanServicePart(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ").slice(0, 40);
  return clean || null;
}

export function formatNearbyServiceTime(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  const times = value.flatMap((entry): Array<{ day: string; time: string; label?: string }> => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as ServiceTime;
    const day = cleanServicePart(item.day);
    const time = cleanServicePart(item.time);
    const label = cleanServicePart(item.label);
    if (!day || !time || !/\d/.test(time)) return [];
    return [{ day, time, ...(label ? { label } : {}) }];
  });

  const selected =
    times.find((item) => item.day.toLowerCase().replace(/s$/, "") === "sunday" && /service|worship|mass|gathering/i.test(item.label ?? ""))
    ?? times.find((item) => item.day.toLowerCase().replace(/s$/, "") === "sunday")
    ?? times[0];

  return selected ? `${selected.day} ${selected.time}` : null;
}

export function getSafeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
