import { createAdminClient, hasServiceConfig } from "@/lib/neon-client";

const PAGE_SIZE = 100;
const FETCH_PAGE_SIZE = 1000;

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;

type ChurchBaseRow = {
  slug: string;
  name: string;
  location: string | null;
  country: string | null;
  website: string | null;
};

type ChurchWebsiteTechRow = {
  church_slug: string;
  website_url: string;
  final_url: string | null;
  http_status: number | null;
  primary_platform: string | null;
  technologies: unknown;
  sales_angle: string | null;
  error: string | null;
  last_checked_at: string | null;
};

export type ChurchWebsiteTechRecord = {
  churchSlug: string;
  name: string;
  location: string;
  country: string;
  website: string;
  finalUrl: string;
  httpStatus: number | null;
  primaryPlatform: string;
  technologies: string[];
  salesAngle: string;
  error: string;
  lastCheckedAt: string;
};

export type ChurchWebsiteTechFilters = {
  query: string;
  country: string;
  city: string;
  platform: string;
  salesAngle: string;
  page: number;
};

export type ChurchWebsiteTechPageData = {
  filters: ChurchWebsiteTechFilters;
  records: ChurchWebsiteTechRecord[];
  totalRecords: number;
  filteredCount: number;
  pageCount: number;
  pageSize: number;
  facets: {
    countries: string[];
    platforms: string[];
    salesAngles: string[];
  };
  summary: Array<{ label: string; value: number }>;
};

function getFirstValue(
  source: URLSearchParams | SearchParamRecord,
  key: string
): string {
  if (source instanceof URLSearchParams) {
    return source.get(key)?.trim() ?? "";
  }

  const value = source[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function toTechnologyList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort(compareText);
}

async function loadApprovedChurches(): Promise<ChurchBaseRow[]> {
  const client = createAdminClient();
  const rows: ChurchBaseRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("churches")
      .select("slug, name, location, country, website")
      .eq("status", "approved")
      .not("website", "is", null)
      .neq("website", "")
      .order("slug", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load approved churches: ${error.message}`);
    }

    const pageRows = (data as ChurchBaseRow[] | null) ?? [];
    rows.push(...pageRows);
    if (pageRows.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return rows;
}

async function loadChurchWebsiteTechRows(): Promise<ChurchWebsiteTechRow[]> {
  const client = createAdminClient();
  const rows: ChurchWebsiteTechRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("church_website_tech")
      .select("church_slug, website_url, final_url, http_status, primary_platform, technologies, sales_angle, error, last_checked_at")
      .order("church_slug", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load website tech rows: ${error.message}`);
    }

    const pageRows = (data as ChurchWebsiteTechRow[] | null) ?? [];
    rows.push(...pageRows);
    if (pageRows.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return rows;
}

export async function loadChurchWebsiteTechRecords(): Promise<ChurchWebsiteTechRecord[]> {
  if (!hasServiceConfig()) return [];

  const [churches, techRows] = await Promise.all([
    loadApprovedChurches(),
    loadChurchWebsiteTechRows(),
  ]);

  const churchesBySlug = new Map(churches.map((church) => [church.slug, church]));

  return techRows
    .map((row) => {
      const church = churchesBySlug.get(row.church_slug);
      if (!church) return null;

      return {
        churchSlug: row.church_slug,
        name: church.name,
        location: church.location || "",
        country: church.country || "",
        website: row.website_url || church.website || "",
        finalUrl: row.final_url || "",
        httpStatus: typeof row.http_status === "number" ? row.http_status : null,
        primaryPlatform: row.primary_platform || "Unknown",
        technologies: toTechnologyList(row.technologies),
        salesAngle: row.sales_angle || "",
        error: row.error || "",
        lastCheckedAt: row.last_checked_at || "",
      } satisfies ChurchWebsiteTechRecord;
    })
    .filter((row): row is ChurchWebsiteTechRecord => Boolean(row))
    .sort((left, right) => {
      const countryCompare = compareText(left.country, right.country);
      if (countryCompare !== 0) return countryCompare;

      const cityCompare = compareText(left.location, right.location);
      if (cityCompare !== 0) return cityCompare;

      return compareText(left.name, right.name);
    });
}

export function parseChurchWebsiteTechFilters(
  source: URLSearchParams | SearchParamRecord
): ChurchWebsiteTechFilters {
  const pageRaw = Number.parseInt(getFirstValue(source, "page"), 10);

  return {
    query: getFirstValue(source, "q"),
    country: getFirstValue(source, "country"),
    city: getFirstValue(source, "city"),
    platform: getFirstValue(source, "platform"),
    salesAngle: getFirstValue(source, "salesAngle"),
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function filterChurchWebsiteTechRecords(
  records: ChurchWebsiteTechRecord[],
  filters: ChurchWebsiteTechFilters
): ChurchWebsiteTechRecord[] {
  const normalizedQuery = normalizeValue(filters.query);
  const normalizedCountry = normalizeValue(filters.country);
  const normalizedCity = normalizeValue(filters.city);
  const normalizedPlatform = normalizeValue(filters.platform);
  const normalizedSalesAngle = normalizeValue(filters.salesAngle);

  return records.filter((record) => {
    if (normalizedCountry && normalizeValue(record.country) !== normalizedCountry) return false;
    if (normalizedPlatform && normalizeValue(record.primaryPlatform) !== normalizedPlatform) return false;
    if (normalizedSalesAngle && normalizeValue(record.salesAngle) !== normalizedSalesAngle) return false;
    if (normalizedCity && !normalizeValue(record.location).includes(normalizedCity)) return false;

    if (!normalizedQuery) return true;

    const haystack = [
      record.name,
      record.churchSlug,
      record.location,
      record.country,
      record.website,
      record.finalUrl,
      record.primaryPlatform,
      record.salesAngle,
      record.error,
      record.technologies.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function buildChurchWebsiteTechQueryString(filters: Partial<ChurchWebsiteTechFilters>): string {
  const params = new URLSearchParams();

  const entries: Array<[string, string | number | undefined]> = [
    ["q", filters.query],
    ["country", filters.country],
    ["city", filters.city],
    ["platform", filters.platform],
    ["salesAngle", filters.salesAngle],
    ["page", filters.page],
  ];

  for (const [key, value] of entries) {
    const stringValue = String(value ?? "").trim();
    if (stringValue) params.set(key, stringValue);
  }

  return params.toString();
}

function buildSummary(records: ChurchWebsiteTechRecord[]) {
  const platformCounts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.primaryPlatform] = (acc[record.primaryPlatform] || 0) + 1;
    return acc;
  }, {});

  return [
    { label: "Sites tracked", value: records.length },
    { label: "Unknown", value: platformCounts.Unknown || 0 },
    { label: "WordPress", value: platformCounts.WordPress || 0 },
    { label: "Squarespace", value: platformCounts.Squarespace || 0 },
    { label: "Wix", value: platformCounts.Wix || 0 },
  ];
}

export async function getChurchWebsiteTechPageData(
  source: URLSearchParams | SearchParamRecord
): Promise<ChurchWebsiteTechPageData> {
  const filters = parseChurchWebsiteTechFilters(source);
  const allRecords = await loadChurchWebsiteTechRecords();
  const filteredRecords = filterChurchWebsiteTechRecords(allRecords, filters);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const offset = (page - 1) * PAGE_SIZE;

  return {
    filters: { ...filters, page },
    records: filteredRecords.slice(offset, offset + PAGE_SIZE),
    totalRecords: allRecords.length,
    filteredCount: filteredRecords.length,
    pageCount,
    pageSize: PAGE_SIZE,
    facets: {
      countries: sortUnique(allRecords.map((record) => record.country)),
      platforms: sortUnique(allRecords.map((record) => record.primaryPlatform)),
      salesAngles: sortUnique(allRecords.map((record) => record.salesAngle)),
    },
    summary: buildSummary(allRecords),
  };
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function buildChurchWebsiteTechCsv(records: ChurchWebsiteTechRecord[]): string {
  const header = [
    "church_slug",
    "name",
    "location",
    "country",
    "primary_platform",
    "sales_angle",
    "website_url",
    "final_url",
    "http_status",
    "technologies",
    "error",
    "last_checked_at",
  ];

  const lines = records.map((record) =>
    [
      record.churchSlug,
      record.name,
      record.location,
      record.country,
      record.primaryPlatform,
      record.salesAngle,
      record.website,
      record.finalUrl,
      record.httpStatus == null ? "" : String(record.httpStatus),
      record.technologies.join(" | "),
      record.error,
      record.lastCheckedAt,
    ]
      .map((value) => escapeCsvValue(String(value ?? "")))
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}
