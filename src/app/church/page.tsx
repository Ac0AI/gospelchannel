import type { Metadata } from "next";
import Link from "next/link";
import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";
import {
  buildSearchSummary,
  DENOMINATION_FILTERS,
  STYLE_FILTERS,
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

/** Toggle a filter — produce the URL that either applies it or removes it. */
function toggleHref(
  filters: ChurchDirectoryFilters,
  patch: Partial<ChurchDirectoryFilters>,
  isActive: boolean,
): string {
  const next: ChurchDirectoryFilters = { ...filters };
  for (const k of Object.keys(patch) as Array<keyof ChurchDirectoryFilters>) {
    if (isActive) {
      delete next[k];
    } else {
      // assignment via patch value preserves the right field's type
      (next as Record<string, unknown>)[k] = patch[k] as unknown;
    }
  }
  return buildPageHref(1, next);
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

  // Top 5 denominations + 4 styles for the chip rail (handoff "Refine:" pattern).
  const topDenominations = DENOMINATION_FILTERS.slice(0, 5);
  const topStyles = STYLE_FILTERS.slice(0, 4);

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
    <>
      {directorySchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(directorySchema) }} />
      ) : null}

      {/* Search-first hero (Säker) */}
      <section
        className="border-b border-rose-gold/[0.12] px-5 pb-10 pt-14 sm:px-12 sm:pb-12 sm:pt-16"
        style={{ background: "linear-gradient(135deg, var(--linen-deep) 0%, var(--linen) 60%)" }}
      >
        <div className="mx-auto max-w-[1280px]">
          <p className="gc-eyebrow">Church Directory</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1] tracking-[-0.02em] text-espresso sm:text-5xl lg:text-[56px]">
            {searchSummary ? (
              <>Search results for <em className="gc-italic">{searchSummary}</em>.</>
            ) : (
              <>Find your <em className="gc-italic">church</em>.</>
            )}
          </h1>

          {/* Premium search pill */}
          <form action="/church" method="get" className="mt-7 max-w-[760px]">
            {filters.styleSlug ? <input type="hidden" name="style" value={filters.styleSlug} /> : null}
            {filters.denominationSlug ? <input type="hidden" name="denomination" value={filters.denominationSlug} /> : null}
            {filters.language ? <input type="hidden" name="language" value={filters.language} /> : null}
            {filters.hasKids ? <input type="hidden" name="kids" value="1" /> : null}
            {filters.hasServiceTimes ? <input type="hidden" name="serviceTimes" value="1" /> : null}
            {filters.hasMusic ? <input type="hidden" name="music" value="1" /> : null}

            <div className="flex items-center gap-2 rounded-full border border-rose-gold/[0.18] bg-white p-2 pl-5 shadow-[0_12px_40px_rgba(59,42,34,0.08)] sm:pl-6">
              <svg className="shrink-0 text-rose-gold" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.5-4.5" />
              </svg>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={`Search ${directoryCount.toLocaleString("en-US")} churches by name, city, or country`}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-espresso outline-none placeholder:text-warm-brown/50 sm:py-4"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-rose-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep sm:px-7 sm:py-3.5"
              >
                Search
              </button>
            </div>
          </form>

          {/* Refine chips */}
          <div className="mt-5 max-w-[860px] flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-warm">
              Refine:
            </span>
            {topDenominations.map((d) => {
              const isActive = filters.denominationSlug === d.slug;
              return (
                <Link
                  key={d.slug}
                  href={toggleHref(filters, { denominationSlug: d.slug }, isActive)}
                  className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-rose-gold bg-rose-gold text-white"
                      : "border-rose-gold/20 bg-white text-warm-brown hover:border-rose-gold/40 hover:text-espresso"
                  }`}
                >
                  {d.label}
                </Link>
              );
            })}
            <span className="text-rose-gold/30">·</span>
            {topStyles.map((s) => {
              const isActive = filters.styleSlug === s.slug;
              return (
                <Link
                  key={s.slug}
                  href={toggleHref(filters, { styleSlug: s.slug }, isActive)}
                  className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-rose-gold bg-rose-gold text-white"
                      : "border-rose-gold/20 bg-white text-warm-brown hover:border-rose-gold/40 hover:text-espresso"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
            <span className="text-rose-gold/30">·</span>
            <Link
              href={toggleHref(filters, { hasMusic: true }, filters.hasMusic === true)}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                filters.hasMusic
                  ? "border-rose-gold bg-rose-gold text-white"
                  : "border-rose-gold/20 bg-white text-warm-brown hover:border-rose-gold/40 hover:text-espresso"
              }`}
            >
              ♪ Music
            </Link>
            <Link
              href={toggleHref(filters, { hasKids: true }, filters.hasKids === true)}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                filters.hasKids
                  ? "border-rose-gold bg-rose-gold text-white"
                  : "border-rose-gold/20 bg-white text-warm-brown hover:border-rose-gold/40 hover:text-espresso"
              }`}
            >
              Kids program
            </Link>
            <Link
              href={toggleHref(filters, { hasServiceTimes: true }, filters.hasServiceTimes === true)}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                filters.hasServiceTimes
                  ? "border-rose-gold bg-rose-gold text-white"
                  : "border-rose-gold/20 bg-white text-warm-brown hover:border-rose-gold/40 hover:text-espresso"
              }`}
            >
              Service times
            </Link>
          </div>

          {hasActiveFilters && (
            <div className="mt-3.5 flex items-center gap-3 text-sm">
              <span className="text-warm-brown">{activeFilterLabels.length} active filter{activeFilterLabels.length === 1 ? "" : "s"}</span>
              <Link
                href="/church"
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-rose-gold underline transition-colors hover:text-rose-gold-deep"
              >
                Clear all
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Results header + grid */}
      <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-[32px]">
              {totalCount.toLocaleString("en-US")} churches found
            </h2>
            <p className="mt-1 text-sm text-muted-warm">
              {searchSummary
                ? <>Matching <em className="not-italic font-semibold">{searchSummary}</em> · sorted by relevance</>
                : filterSummary
                  ? <>Matching {filterSummary}</>
                  : `Page ${currentPage} of ${totalPages}`}
            </p>
          </div>
          {!query && totalPages > 1 && (
            <div className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted-warm sm:block">
              Page {currentPage} of {totalPages}
            </div>
          )}
        </div>

        <ChurchDirectoryGrid churches={pageItems} />
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mx-auto mt-12 flex max-w-[1280px] flex-wrap items-center justify-center gap-3 border-t border-rose-gold/[0.12] px-5 py-7 sm:px-12 sm:py-8">
          {currentPage > 1 ? (
            <Link
              href={buildPageHref(currentPage - 1, filters)}
              className="rounded-full border border-rose-gold/20 bg-white px-5 py-2.5 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
            >
              &larr; Previous
            </Link>
          ) : (
            <span className="rounded-full border border-rose-gold/10 bg-white px-5 py-2.5 text-sm font-semibold text-muted-warm/60">
              &larr; Previous
            </span>
          )}
          <span className="px-3 text-sm text-warm-brown">
            Page <strong className="text-espresso">{currentPage}</strong> of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildPageHref(currentPage + 1, filters)}
              className="rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep"
            >
              Next &rarr;
            </Link>
          ) : (
            <span className="rounded-full border border-rose-gold/10 bg-white px-5 py-2.5 text-sm font-semibold text-muted-warm/60">
              Next &rarr;
            </span>
          )}
        </nav>
      )}

      {/* Suggest CTA */}
      <section className="mx-auto mt-20 max-w-[1280px] px-5 sm:px-12">
        <div
          className="rounded-[28px] border border-rose-gold/[0.18] px-8 py-10 text-center sm:px-12"
          style={{ background: "linear-gradient(135deg, rgba(252,233,229,0.7) 0%, white 60%)" }}
        >
          <p className="gc-eyebrow">Don&rsquo;t see your church?</p>
          <h2 className="mt-2.5 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
            Suggest a <em className="gc-italic">church</em>.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-warm-brown">
            If your church has a worship playlist on Spotify, let us know and we&rsquo;ll give it a page with playlists, videos, service times, and community.
          </p>
          <Link
            href="/church/suggest"
            className="mt-6 inline-flex rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Suggest a church
          </Link>
        </div>
      </section>

      <div className="h-20" />
    </>
  );
}
