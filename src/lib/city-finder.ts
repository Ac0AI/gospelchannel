export type CityFinderChurch = {
  slug: string;
  name: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  denomination?: string;
  denominationSlugs: string[];
  worshipStyles: string[];
  styleSlugs: string[];
  languages: string[];
  serviceTime: string;
  servicePeriods: Array<"morning" | "afternoon" | "evening">;
  hasKids: boolean;
  hasWorshipPreview: boolean;
  hasVisitorDetails: boolean;
  checkedAt?: string;
  qualityScore: number;
};

export type CityFinderOption = {
  value: string;
  label: string;
  count: number;
};

export type CityFinderLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export type CityFinderFilters = {
  style?: string;
  denomination?: string;
  language?: string;
  servicePeriod?: "morning" | "afternoon" | "evening";
  kids?: boolean;
};

export type CityFinderMatch = {
  church: CityFinderChurch;
  distanceMiles?: number;
};

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getDistanceMiles(
  from: Pick<CityFinderLocation, "latitude" | "longitude">,
  church: Pick<CityFinderChurch, "latitude" | "longitude">,
): number {
  const latitudeDelta = toRadians(church.latitude - from.latitude);
  const longitudeDelta = toRadians(church.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const churchLatitude = toRadians(church.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(churchLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distance = 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
  return Math.round(distance * 10) / 10;
}

function matchesFilters(church: CityFinderChurch, filters: CityFinderFilters): boolean {
  if (filters.style && !church.styleSlugs.includes(filters.style)) return false;
  if (filters.denomination && !church.denominationSlugs.includes(filters.denomination)) return false;
  if (filters.language && !church.languages.includes(filters.language)) return false;
  if (filters.servicePeriod && !church.servicePeriods.includes(filters.servicePeriod)) return false;
  if (filters.kids && !church.hasKids) return false;
  return true;
}

export function getCityFinderMatches(input: {
  churches: CityFinderChurch[];
  location?: CityFinderLocation;
  radiusMiles: number;
  filters: CityFinderFilters;
}): CityFinderMatch[] {
  return input.churches
    .filter((church) => matchesFilters(church, input.filters))
    .map((church) => ({
      church,
      ...(input.location ? { distanceMiles: getDistanceMiles(input.location, church) } : {}),
    }))
    .filter((match) => match.distanceMiles == null || match.distanceMiles <= input.radiusMiles)
    .sort((left, right) => {
      if (left.distanceMiles != null && right.distanceMiles != null) {
        const distanceDifference = left.distanceMiles - right.distanceMiles;
        if (distanceDifference !== 0) return distanceDifference;
      }
      return right.church.qualityScore - left.church.qualityScore || left.church.name.localeCompare(right.church.name);
    });
}
