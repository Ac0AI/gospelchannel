type CityGuideLink = {
  href: string;
  label: string;
};

const CITY_GUIDE_LINKS: Record<string, CityGuideLink[]> = {
  zurich: [
    {
      href: "/church/english-speaking-churches-in-zurich",
      label: "English-speaking churches in Zurich",
    },
  ],
};

export function buildCityTitle(label: string): string {
  return `Churches in ${label}: Service Times & Locations`;
}

export function getCityGuideLinks(slug: string): CityGuideLink[] {
  return CITY_GUIDE_LINKS[slug] ?? [];
}
