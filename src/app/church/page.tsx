import type { Metadata } from "next";
import Link from "next/link";
import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";
import {
  buildSearchSummary,
  getDenominationFilterBySlug,
  getStyleFilterBySlug,
  type ChurchDirectoryFilters,
} from "@/lib/church-directory";
import { getChurchIndexPageData } from "@/lib/church";
import { getChurchStatsAsync } from "@/lib/content";

export const revalidate = 3600;

const PAGE_SIZE = 48;

type ChurchIndexPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readStringParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readPositivePage(value: string | string[] | undefined): number {
  const raw = Number.parseInt(readStringParam(value), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function readBoolParam(value: string | string[] | undefined): boolean {
  const raw = readStringParam(value).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function readDirectoryFilters(params: Record<string, string | string[] | undefined>): ChurchDirectoryFilters {
  const styleSlug = readStringParam(params.style).trim();
  const denominationSlug = readStringParam(params.denomination).trim();
  const language = readStringParam(params.language).trim().slice(0, 40);

  return {
    query: readStringParam(params.q).trim().slice(0, 80),
    styleSlug: getStyleFilterBySlug(styleSlug) ? styleSlug : undefined,
    denominationSlug: getDenominationFilterBySlug(denominationSlug) ? denominationSlug : undefined,
    language: language || undefined,
    hasKids: readBoolParam(params.kids) || undefined,
    hasServiceTimes: readBoolParam(params.serviceTimes) || undefined,
    hasMusic: readBoolParam(params.music) || undefined,
  };
}

function buildPageHref(page: number, filters: ChurchDirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.styleSlug) params.set("style", filters.styleSlug);
  if (filters.denominationSlug) params.set("denomination", filters.denominationSlug);
  if (filters.language) params.set("language", filters.language);
  if (filters.hasKids) params.set("kids", "1");
  if (filters.hasServiceTimes) params.set("serviceTimes", "1");
  if (filters.hasMusic) params.set("music", "1");
  if (page > 1) params.set("page", `${page}`);
  const qs = params.toString();
  return qs ? `/church?${qs}` : "/church";
}

function buildActiveFilterLabels(filters: ChurchDirectoryFilters): string[] {
  const labels: string[] = [];
  if (filters.query) labels.push(`Area/search: ${filters.query}`);
  if (filters.styleSlug) labels.push(getStyleFilterBySlug(filters.styleSlug)?.label ?? filters.styleSlug);
  if (filters.denominationSlug) labels.push(`${getDenominationFilterBySlug(filters.denominationSlug)?.label ?? filters.denominationSlug} tradition`);
  if (filters.language) labels.push(`${filters.language} language`);
  if (filters.hasKids) labels.push("Kids/youth ministry");
  if (filters.hasServiceTimes) labels.push("Service times listed");
  if (filters.hasMusic) labels.push("Music available");
  return labels;
}

export async function generateMetadata({ searchParams }: ChurchIndexPageProps): Promise<Metadata> {
  const params = (await searchParams) ?? {};
  const filters = readDirectoryFilters(params);
  const activeFilterLabels = buildActiveFilterLabels(filters);
  const currentPage = readPositivePage(params.page);
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();

  if (activeFilterLabels.length > 0) {
    const summary = activeFilterLabels.join(", ");
    return {
      title: `Search Churches for ${summary}`,
      description: `Search ${churchCountLabel} churches across ${countryCount} countries and compare fit, tradition, and service details for ${summary}.`,
      alternates: { canonical: "https://gospelchannel.com/church" },
      robots: { index: false, follow: true },
    };
  }

  if (currentPage > 1) {
    return {
      title: "Browse Church Channels",
      description: `Find the right fit across ${churchCountLabel} churches in ${countryCount} countries by worship style, tradition, city, language, and service details.`,
      alternates: { canonical: "https://gospelchannel.com/church" },
      robots: { index: false, follow: true },
    };
  }

  return {
    title: "Browse Church Channels",
    description: `Find the right fit across ${churchCountLabel} churches in ${countryCount} countries by worship style, tradition, city, language, and service details.`,
    alternates: { canonical: "https://gospelchannel.com/church" },
    openGraph: {
      title: "Browse Church Channels",
      description: `Find the right fit across ${churchCountLabel} churches by worship style, tradition, city, language, and service details before your first visit.`,
      url: "https://gospelchannel.com/church",
      type: "website",
      siteName: "GospelChannel",
    },
    twitter: {
      card: "summary_large_image",
      title: "Browse Church Channels",
      description: `Find the right fit across ${churchCountLabel} churches by worship style, tradition, city, language, and service details.`,
    },
  };
}

export default async function ChurchIndexPage({ searchParams }: ChurchIndexPageProps) {
  const params = (await searchParams) ?? {};
  const filters = readDirectoryFilters(params);
  const query = filters.query ?? "";
  const requestedPage = readPositivePage(params.page);

  const [{ churchCount, countryCount }, directoryPage] = await Promise.all([
    getChurchStatsAsync(),
    getChurchIndexPageData({
      query,
      filters: {
        styleSlug: filters.styleSlug,
        denominationSlug: filters.denominationSlug,
        language: filters.language,
        hasKids: filters.hasKids,
        hasServiceTimes: filters.hasServiceTimes,
        hasMusic: filters.hasMusic,
      },
      page: requestedPage,
      pageSize: PAGE_SIZE,
    }),
  ]);
  const { currentPage, totalCount, totalPages, pageItems } = directoryPage;
  const activeFilterLabels = buildActiveFilterLabels(filters);
  const hasActiveFilters = activeFilterLabels.length > 0;
  const directoryCount = hasActiveFilters ? totalCount : churchCount;

  const searchSummary = query ? buildSearchSummary(query) : null;
  const filterSummary = activeFilterLabels.join(", ");

  const directorySchema = query
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Church Channels",
        description: `Browse ${directoryCount} church channels across ${countryCount} countries and compare fit by worship style, tradition, city, and service details.`,
        numberOfItems: pageItems.length,
        itemListElement: pageItems.map((church, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: church.name,
          url: `https://gospelchannel.com/church/${church.slug}`,
        })),
      };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:space-y-10 sm:px-6 sm:py-10 lg:px-8">
      {directorySchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(directorySchema) }} />
      ) : null}

      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/45 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Church Directory</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">
          {searchSummary ? `Search results for ${searchSummary}` : "Browse church channels"}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-warm-brown">
          {hasActiveFilters
            ? `Showing churches that match ${filterSummary}. Compare worship style, tradition, city, and service details to find the right fit.`
            : "Find the right fit by worship style, tradition, or city."}
        </p>
        {activeFilterLabels.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="inline-flex rounded-full border border-rose-200/70 bg-white/85 px-3 py-1.5 text-xs font-semibold text-rose-gold-deep"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}

        <form action="/church" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          {filters.styleSlug ? <input type="hidden" name="style" value={filters.styleSlug} /> : null}
          {filters.denominationSlug ? <input type="hidden" name="denomination" value={filters.denominationSlug} /> : null}
          {filters.language ? <input type="hidden" name="language" value={filters.language} /> : null}
          {filters.hasKids ? <input type="hidden" name="kids" value="1" /> : null}
          {filters.hasServiceTimes ? <input type="hidden" name="serviceTimes" value="1" /> : null}
          {filters.hasMusic ? <input type="hidden" name="music" value="1" /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={`Search ${directoryCount} churches by name, city, or country`}
            className="w-full rounded-full border border-rose-200/80 bg-white px-5 py-3 text-base text-espresso shadow-sm outline-none transition-colors placeholder:text-warm-brown/50 focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
          />
          <button
            type="submit"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
          >
            Search
          </button>
          {query ? (
            <Link
              href={buildPageHref(1, { ...filters, query: "" })}
              className="inline-flex items-center justify-center rounded-full border border-rose-200/80 px-6 py-3 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light hover:text-espresso"
            >
              Clear search
            </Link>
          ) : null}
          {hasActiveFilters ? (
            <Link
              href="/church"
              className="inline-flex items-center justify-center rounded-full border border-rose-200/80 px-6 py-3 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light hover:text-espresso"
            >
              Clear all
            </Link>
          ) : null}
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-espresso">
              {searchSummary ? "Matching Churches" : "Featured Church Channels"}
            </h2>
            <p className="mt-1 text-sm text-muted-warm">
              Showing {pageItems.length.toLocaleString("en-US")} of {totalCount.toLocaleString("en-US")} churches.
            </p>
          </div>
          {!query ? (
            <div className="hidden rounded-full border border-rose-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-espresso shadow-sm sm:block">
              Page {currentPage} of {totalPages}
            </div>
          ) : null}
        </div>

        <ChurchDirectoryGrid churches={pageItems} />
      </section>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-rose-200/60 bg-white/80 px-4 py-4 shadow-sm">
          {currentPage > 1 ? (
            <Link
              href={buildPageHref(currentPage - 1, filters)}
              className="rounded-full border border-rose-200/70 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-full border border-rose-100 px-4 py-2 text-sm font-semibold text-muted-warm/70">
              Previous
            </span>
          )}
          <span className="text-sm text-warm-brown">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildPageHref(currentPage + 1, filters)}
              className="rounded-full border border-rose-200/70 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-full border border-rose-100 px-4 py-2 text-sm font-semibold text-muted-warm/70">
              Next
            </span>
          )}
        </nav>
      )}

      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-blush-light/70 to-white p-6 text-center shadow-sm">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Don&apos;t see your church?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-warm-brown">
          If your church has a worship playlist on Spotify, let us know and we&apos;ll give it a page with playlists, videos, service times, and community.
        </p>
        <Link
          href="/church/suggest"
          className="mt-5 inline-flex rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
        >
          Suggest a church
        </Link>
      </section>
    </div>
  );
}
