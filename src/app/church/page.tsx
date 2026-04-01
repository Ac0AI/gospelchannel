import type { Metadata } from "next";
import Link from "next/link";
import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";
import {
  buildSearchSummary,
  filterChurchDirectory,
  paginateChurches,
} from "@/lib/church-directory";
import { getChurchIndexData } from "@/lib/church";
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

function buildPageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", `${page}`);
  const qs = params.toString();
  return qs ? `/church?${qs}` : "/church";
}

export async function generateMetadata({ searchParams }: ChurchIndexPageProps): Promise<Metadata> {
  const params = (await searchParams) ?? {};
  const query = readStringParam(params.q).trim();
  const currentPage = readPositivePage(params.page);
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();

  if (query) {
    const summary = buildSearchSummary(query);
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
  const query = readStringParam(params.q).trim().slice(0, 80);
  const requestedPage = readPositivePage(params.page);

  const [{ countryCount }, churches] = await Promise.all([
    getChurchStatsAsync(),
    getChurchIndexData(),
  ]);
  const filtered = filterChurchDirectory(churches, { query });
  const { currentPage, totalCount, totalPages, pageItems } = paginateChurches(filtered, requestedPage, PAGE_SIZE);

  const searchSummary = query ? buildSearchSummary(query) : null;

  const directorySchema = query
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Church Channels",
        description: `Browse ${churches.length} church channels across ${countryCount} countries and compare fit by worship style, tradition, city, and service details.`,
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
          {searchSummary
            ? `Showing churches that match ${searchSummary}. Compare worship style, tradition, city, and service details to find the right fit.`
            : "Find the right fit by worship style, tradition, or city."}
        </p>

        <form action="/church" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={`Search ${churches.length} churches by name, city, or country`}
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
              href="/church"
              className="inline-flex items-center justify-center rounded-full border border-rose-200/80 px-6 py-3 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light hover:text-espresso"
            >
              Clear
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
              href={buildPageHref(currentPage - 1, query)}
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
              href={buildPageHref(currentPage + 1, query)}
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
