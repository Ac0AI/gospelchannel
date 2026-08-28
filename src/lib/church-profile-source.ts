import type { ChurchConfig } from "@/types/gospel";

type ChurchProfileSourceInput = {
  isClaimed: boolean;
  sourceKind?: ChurchConfig["sourceKind"];
  verifiedAt?: string;
  lastResearched?: string;
  hasOfficialWebsite: boolean;
};

export type ChurchProfileSource = {
  status: string;
  source: string;
  freshnessLabel: "Details checked" | "Last researched" | "Freshness";
  freshnessValue: string;
  freshnessDate?: string;
};

function validIsoDate(value?: string): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function describeSource(sourceKind: ChurchConfig["sourceKind"], hasOfficialWebsite: boolean): string {
  if (hasOfficialWebsite) return "Official church website and public sources";

  switch (sourceKind) {
    case "claimed":
      return "Church-submitted details";
    case "suggested":
      return "Community suggestion and public sources";
    case "manual":
      return "GospelChannel research";
    case "discovered":
    default:
      return "Publicly available church sources";
  }
}

export function buildChurchProfileSource(input: ChurchProfileSourceInput): ChurchProfileSource {
  const verifiedAt = validIsoDate(input.verifiedAt);
  const lastResearched = validIsoDate(input.lastResearched);
  const freshnessDate = verifiedAt ?? lastResearched;

  return {
    status: input.isClaimed ? "Verified by church leaders" : "Independent church guide profile",
    source: describeSource(input.sourceKind, input.hasOfficialWebsite),
    freshnessLabel: verifiedAt ? "Details checked" : lastResearched ? "Last researched" : "Freshness",
    freshnessValue: freshnessDate ? formatDate(freshnessDate) : "No review date recorded",
    ...(freshnessDate ? { freshnessDate } : {}),
  };
}
