type CityGuideLink = {
  href: string;
  label: string;
};

export type CityPageCopy = {
  metadataTitle: string;
  pageTitle: string;
  eyebrow: string;
  description: string;
  quickAnswer?: string;
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

export function getCityPageCopy(input: { slug: string; label: string; totalCount: number }): CityPageCopy {
  const { slug, label, totalCount } = input;
  if (slug === "austin") {
    return {
      metadataTitle: "Find the Best Church for You in Austin",
      pageTitle: "Find the Best Church for You in Austin",
      eyebrow: "Austin church finder",
      description: `Compare ${totalCount.toLocaleString("en-US")} Austin churches by distance, service times, worship style, language, tradition, and first-visit details.`,
      quickAnswer:
        "There is no universal best church in Austin. Start with one close enough to attend, then compare the Sunday details that affect whether you can participate and return: service time, worship style, language, tradition, family needs, and what a first visit is like.",
    };
  }

  return {
    metadataTitle: buildCityTitle(label),
    pageTitle: `${label} Churches`,
    eyebrow: "Browse by City",
    description: `Explore churches in ${label}, then compare location, service times, worship style, denomination, and first-visit details before choosing where to go.`,
  };
}

export function getCityGuideLinks(slug: string): CityGuideLink[] {
  return CITY_GUIDE_LINKS[slug] ?? [];
}
