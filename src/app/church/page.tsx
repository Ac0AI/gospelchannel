import type { Metadata } from "next";
import Link from "next/link";
import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";
import { TrackedChurchSearchForm } from "@/components/ChurchJourneyAnalytics";
import { ChurchSearchAutocomplete } from "@/components/ChurchSearchAutocomplete";
import {
  buildSearchSummary,
  DENOMINATION_FILTERS,
  STYLE_FILTERS,
  getDenominationFilterBySlug,
  getStyleFilterBySlug,
  type ChurchDirectoryFilters,
} from "@/lib/church-directory";
import {
  getChurchDirectoryFilterOptions,
  getChurchIndexPageData,
  type ChurchDirectoryFilterOption,
} from "@/lib/church";
import { getChurchStatsAsync, getFreshestChurchUpdatedAtAsync } from "@/lib/content";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";
import { formatContentFreshness } from "@/lib/utils";

export const revalidate = 3600;

const PAGE_SIZE = 48;

const COMPARISON_CRITERIA = [
  {
    label: "City and location",
    shown: "Published city, venue, and address details",
    decision: "Can I get there consistently, and what route or parking should I confirm?",
    href: "/church/city",
    linkLabel: "Browse cities",
  },
  {
    label: "Language",
    shown: "Published service and ministry languages",
    decision: "Can adults and children understand and participate in the service?",
    href: "/church/english-speaking-churches",
    linkLabel: "Compare languages",
  },
  {
    label: "Tradition",
    shown: "Denomination or church-family information",
    decision: "Does the church's theology and service shape fit what I am looking for?",
    href: "/church/denomination",
    linkLabel: "Compare traditions",
  },
  {
    label: "Worship style",
    shown: "Published worship-style signals",
    decision: "Is the room likely to feel contemporary, traditional, charismatic, or something else?",
    href: "/church/style",
    linkLabel: "Compare styles",
  },
  {
    label: "Service times",
    shown: "Published Sunday times and service notes",
    decision: "Can I plan a realistic first visit? Confirm the current time on the church's own site.",
    href: "/church/churches-with-service-times",
    linkLabel: "Compare times",
  },
  {
    label: "Kids and youth",
    shown: "Published children and youth ministry signals",
    decision: "Is there enough information to plan the first Sunday as a family?",
    href: "/church/family-friendly-churches",
    linkLabel: "Compare family details",
  },
  {
    label: "Actual worship music",
    shown: "Church playlists and worship videos when available",
    decision: "Can I hear what the church's worship sounds like before I visit?",
    href: "/church/churches-with-worship-music",
    linkLabel: "Hear the worship",
  },
] as const;

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
  const country = readStringParam(params.country).trim().slice(0, 60);
  const language = readStringParam(params.language).trim().slice(0, 40);

  return {
    query: readStringParam(params.q).trim().slice(0, 80),
    styleSlug: getStyleFilterBySlug(styleSlug) ? styleSlug : undefined,
    denominationSlug: getDenominationFilterBySlug(denominationSlug) ? denominationSlug : undefined,
    country: country || undefined,
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
  if (filters.country) params.set("country", filters.country);
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
  if (filters.country) labels.push(`Country: ${filters.country}`);
  if (filters.styleSlug) labels.push(getStyleFilterBySlug(filters.styleSlug)?.label ?? filters.styleSlug);
  if (filters.denominationSlug) labels.push(`${getDenominationFilterBySlug(filters.denominationSlug)?.label ?? filters.denominationSlug} tradition`);
  if (filters.language) labels.push(`${filters.language} language`);
  if (filters.hasKids) labels.push("Kids/youth ministry");
  if (filters.hasServiceTimes) labels.push("Service times listed");
  if (filters.hasMusic) labels.push("Music available");
  return labels;
}

function withSelectedOption(
  options: ChurchDirectoryFilterOption[],
  selectedValue: string | undefined,
): ChurchDirectoryFilterOption[] {
  if (!selectedValue || options.some((option) => option.value === selectedValue)) return options;
  return [{ value: selectedValue, label: selectedValue, count: 0 }, ...options];
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
      title: "Find a Church",
      description: `Compare ${churchCountLabel} churches in ${countryCount} countries by worship style, tradition, city, language, and service times.`,
      alternates: { canonical: "https://gospelchannel.com/church" },
      robots: { index: false, follow: true },
    };
  }

  return {
    title: "Find a Church",
    description: `Compare ${churchCountLabel} churches in ${countryCount} countries by worship style, tradition, city, language, and service times.`,
    alternates: { canonical: "https://gospelchannel.com/church" },
    openGraph: {
      images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
      title: "Find a Church",
      description: `Compare ${churchCountLabel} churches by worship style, tradition, city, language, and service times before your first visit.`,
      url: "https://gospelchannel.com/church",
      type: "website",
      siteName: "GospelChannel",
    },
    twitter: {
      images: ["https://gospelchannel.com/hero-worship.jpg"],
      card: "summary_large_image",
      title: "Find a Church",
      description: `Compare ${churchCountLabel} churches by worship style, tradition, city, language, and service times.`,
    },
  };
}

export default async function ChurchIndexPage({ searchParams }: ChurchIndexPageProps) {
  const params = (await searchParams) ?? {};
  const filters = readDirectoryFilters(params);
  const query = filters.query ?? "";
  const requestedPage = readPositivePage(params.page);
  const claimIntent = readStringParam(params.intent).trim().toLowerCase() === "claim";

  const [{ churchCount, countryCount }, directoryPage, filterOptions, freshestChurchUpdatedAt] = await Promise.all([
    getChurchStatsAsync(),
    getChurchIndexPageData({
      query,
      filters: {
        styleSlug: filters.styleSlug,
        denominationSlug: filters.denominationSlug,
        country: filters.country,
        language: filters.language,
        hasKids: filters.hasKids,
        hasServiceTimes: filters.hasServiceTimes,
        hasMusic: filters.hasMusic,
      },
      page: requestedPage,
      pageSize: PAGE_SIZE,
    }),
    query
      ? getChurchDirectoryFilterOptions(filters)
      : Promise.resolve({ countries: [], languages: [] }),
    getFreshestChurchUpdatedAtAsync(),
  ]);
  const { currentPage, totalCount, totalPages, pageItems } = directoryPage;
  const activeFilterLabels = buildActiveFilterLabels(filters);
  const hasActiveFilters = activeFilterLabels.length > 0;
  const directoryCount = hasActiveFilters ? totalCount : churchCount;

  const searchSummary = query ? buildSearchSummary(query) : null;
  const filterSummary = activeFilterLabels.join(", ");
  const showDecisionGuide = !hasActiveFilters && currentPage === 1;
  const countryOptions = withSelectedOption(filterOptions.countries, filters.country);
  const languageOptions = withSelectedOption(filterOptions.languages, filters.language);
  const { updatedIso, updatedLabel } = formatContentFreshness(freshestChurchUpdatedAt);

  // Top 5 denominations + 4 styles for the chip rail (handoff "Refine:" pattern).
  const topDenominations = DENOMINATION_FILTERS.slice(0, 5);
  const topStyles = STYLE_FILTERS.slice(0, 4);

  const directorySchema = query
    ? null
    : [
        ...(showDecisionGuide
          ? [
              {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: "Find a Church on GospelChannel",
                description: `Compare ${directoryCount} churches in ${countryCount} countries by worship style, tradition, city, language, service times, and worship music.`,
                url: "https://gospelchannel.com/church",
                isPartOf: {
                  "@type": "WebSite",
                  name: "GospelChannel",
                  url: "https://gospelchannel.com",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: "https://gospelchannel.com/church?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
                about: [
                  { "@type": "Thing", name: "Church discovery" },
                  { "@type": "Thing", name: "Worship style matching" },
                  { "@type": "Thing", name: "First church visit planning" },
                ],
              },
            buildBreadcrumbSchema([
                { name: "GospelChannel", url: "https://gospelchannel.com" },
                { name: "Church Profiles", url: "https://gospelchannel.com/church" },
              ]),
            ]
          : []),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: hasActiveFilters ? `Churches matching ${filterSummary}` : "All churches on GospelChannel",
          description: `Compare ${directoryCount} churches across ${countryCount} countries by worship style, tradition, city, and service times.`,
          numberOfItems: pageItems.length,
          itemListElement: pageItems.map((church, index) => ({
            "@type": "ListItem",
            position: (currentPage - 1) * PAGE_SIZE + index + 1,
            name: church.name,
            url: `https://gospelchannel.com/church/${church.slug}`,
          })),
        },
      ];

  return (
    <>
      {directorySchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(directorySchema) }} />
      ) : null}

      {/* Search-first hero (Säker) */}
      <section
        className="border-b border-rose-gold/[0.12] px-5 pb-10 pt-14 sm:px-12 sm:pb-12 sm:pt-16"
        style={{ background: "linear-gradient(135deg, var(--linen-deep) 0%, var(--linen) 60%)" }}
      >
        <div className="mx-auto max-w-[1280px]">
          <p className="gc-eyebrow">{claimIntent ? "For church leaders" : "Church directory"}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1] tracking-[-0.02em] text-espresso sm:text-5xl lg:text-[56px]">
            {searchSummary ? (
              <>Search results for <em className="gc-italic">{searchSummary}</em>.</>
            ) : claimIntent ? (
              <>Find your church to <em className="gc-italic">claim</em> it.</>
            ) : (
              <>Find your <em className="gc-italic">church</em>.</>
            )}
          </h1>

          {claimIntent ? (
            <p className="mt-4 max-w-[640px] text-base leading-relaxed text-warm-brown">
              Search for your church below, open its page, and tap{" "}
              <strong className="font-semibold text-espresso">&ldquo;Claim this page&rdquo;</strong>. Not listed yet?{" "}
              <Link href="/church/suggest" className="font-semibold text-rose-gold hover:text-rose-gold-deep">
                Add your church
              </Link>
              .
            </p>
          ) : null}

          {/* Premium search pill */}
          <TrackedChurchSearchForm action="/church" method="get" variant="directory" className="mt-7 max-w-[760px]">
            {claimIntent ? <input type="hidden" name="intent" value="claim" /> : null}
            {filters.styleSlug ? <input type="hidden" name="style" value={filters.styleSlug} /> : null}
            {filters.denominationSlug ? <input type="hidden" name="denomination" value={filters.denominationSlug} /> : null}
            {filters.country ? <input type="hidden" name="country" value={filters.country} /> : null}
            {filters.language ? <input type="hidden" name="language" value={filters.language} /> : null}
            {filters.hasKids ? <input type="hidden" name="kids" value="1" /> : null}
            {filters.hasServiceTimes ? <input type="hidden" name="serviceTimes" value="1" /> : null}
            {filters.hasMusic ? <input type="hidden" name="music" value="1" /> : null}

            <div className="flex items-center gap-2 rounded-full border border-rose-gold/[0.18] bg-white p-2 pl-5 shadow-[0_12px_40px_rgba(59,42,34,0.08)] sm:pl-6">
              <svg className="shrink-0 text-rose-gold" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.5-4.5" />
              </svg>
              <ChurchSearchAutocomplete
                defaultValue={query}
                placeholder={`Search ${directoryCount.toLocaleString("en-US")} churches by name, city, or country`}
                extraSearchParams={{
                  intent: claimIntent ? "claim" : undefined,
                  style: filters.styleSlug,
                  denomination: filters.denominationSlug,
                  country: filters.country,
                  language: filters.language,
                  kids: filters.hasKids ? "1" : undefined,
                  serviceTimes: filters.hasServiceTimes ? "1" : undefined,
                  music: filters.hasMusic ? "1" : undefined,
                }}
                containerClassName="relative min-w-0 flex-1"
                inputClassName="w-full bg-transparent px-3 py-3 text-base text-espresso outline-none placeholder:text-warm-brown/50 sm:py-4"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-rose-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep sm:px-7 sm:py-3.5"
              >
                Search
              </button>
            </div>
          </TrackedChurchSearchForm>

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

          {query && (
            <TrackedChurchSearchForm
              action="/church"
              method="get"
              variant="directory_filters"
              className="mt-5 grid max-w-[760px] gap-3 rounded-2xl border border-rose-gold/15 bg-white/75 p-4 shadow-[0_8px_24px_rgba(59,42,34,0.05)] sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <input type="hidden" name="q" value={query} />
              {claimIntent ? <input type="hidden" name="intent" value="claim" /> : null}
              {filters.styleSlug ? <input type="hidden" name="style" value={filters.styleSlug} /> : null}
              {filters.denominationSlug ? <input type="hidden" name="denomination" value={filters.denominationSlug} /> : null}
              {filters.hasKids ? <input type="hidden" name="kids" value="1" /> : null}
              {filters.hasServiceTimes ? <input type="hidden" name="serviceTimes" value="1" /> : null}
              {filters.hasMusic ? <input type="hidden" name="music" value="1" /> : null}

              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-warm">
                Country
                <select
                  name="country"
                  defaultValue={filters.country ?? ""}
                  className="min-w-0 rounded-xl border border-rose-gold/20 bg-white px-3.5 py-3 text-sm font-medium normal-case tracking-normal text-espresso outline-none transition-colors focus:border-rose-gold"
                >
                  <option value="">All countries</option>
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count.toLocaleString("en-US")})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-warm">
                Language
                <select
                  name="language"
                  defaultValue={filters.language ?? ""}
                  className="min-w-0 rounded-xl border border-rose-gold/20 bg-white px-3.5 py-3 text-sm font-medium normal-case tracking-normal text-espresso outline-none transition-colors focus:border-rose-gold"
                >
                  <option value="">All languages</option>
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count.toLocaleString("en-US")})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="rounded-xl bg-espresso px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-warm-brown"
              >
                Apply filters
              </button>
            </TrackedChurchSearchForm>
          )}

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

      {showDecisionGuide && (
        <section className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-12 sm:pt-14">
          <div className="border-b border-rose-gold/[0.12] pb-10">
            <p className="gc-eyebrow">Compare at a glance</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-[32px]">
              Compare what changes your first Sunday.
            </h2>
            <p className="mt-3 max-w-[760px] text-sm leading-[1.7] text-warm-brown sm:text-base">
              GospelChannel helps you compare the same practical signals across church profiles:
              city, language, tradition, worship, service details, family information, and actual
              music. Use the directory to build a shortlist, then confirm time-sensitive details on
              each church&rsquo;s official website before visiting.
            </p>
            <p className="mt-4 text-xs font-semibold text-muted-warm sm:hidden">Scroll to compare &rarr;</p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-rose-gold/20 bg-white/65">
              <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                <caption className="sr-only">Church details you can compare on GospelChannel</caption>
                <thead>
                  <tr className="border-b border-rose-gold/20 text-[11px] uppercase tracking-[0.08em] text-muted-warm">
                    <th className="px-4 py-3 font-semibold">Compare</th>
                    <th className="px-4 py-3 font-semibold">What you&rsquo;ll see</th>
                    <th className="px-4 py-3 font-semibold">Why it matters</th>
                    <th className="px-4 py-3 font-semibold">Start here</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_CRITERIA.map((criterion) => (
                    <tr key={criterion.label} className="border-b border-rose-gold/10 last:border-0 align-top">
                      <th scope="row" className="px-4 py-3 font-semibold text-espresso">
                        {criterion.label}
                      </th>
                      <td className="px-4 py-3 text-espresso/75">{criterion.shown}</td>
                      <td className="px-4 py-3 text-espresso/75">{criterion.decision}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={criterion.href}
                          className="font-semibold text-rose-gold underline decoration-rose-gold/30 underline-offset-2 hover:text-rose-gold-deep"
                        >
                          {criterion.linkLabel} &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-[860px] text-xs leading-relaxed text-muted-warm">
              Directory fields come from published church profiles and enrichment of public church
              information. A missing field means the detail is not published in the profile, not that
              the church does not offer it. This directory is not a ranking or endorsement. Data
              updated <time dateTime={updatedIso}>{updatedLabel}</time>.
            </p>
          </div>
        </section>
      )}

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
