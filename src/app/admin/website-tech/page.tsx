import Link from "next/link";
import {
  buildChurchWebsiteTechQueryString,
  getChurchWebsiteTechPageData,
  type ChurchWebsiteTechFilters,
  type ChurchWebsiteTechRecord,
} from "@/lib/church-website-tech";
import { AdminNav } from "@/components/admin/AdminNav";

type WebsiteTechPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getPlatformBadgeClass(platform: string): string {
  switch (platform) {
    case "WordPress":
      return "bg-sky-100 text-sky-800";
    case "Squarespace":
      return "bg-stone-200 text-stone-800";
    case "Wix":
      return "bg-amber-100 text-amber-800";
    case "Drupal":
      return "bg-indigo-100 text-indigo-800";
    case "Webflow":
      return "bg-emerald-100 text-emerald-800";
    case "Next.js":
      return "bg-slate-900 text-white";
    case "Unknown":
      return "bg-rose-100 text-rose-gold-deep";
    default:
      return "bg-linen text-warm-brown";
  }
}

function formatDate(value: string): string {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("sv-SE");
}

function formatTechnologies(record: ChurchWebsiteTechRecord): string[] {
  return record.technologies.slice(0, 4);
}

function buildPageHref(filters: ChurchWebsiteTechFilters, page: number): string {
  const query = buildChurchWebsiteTechQueryString({ ...filters, page });
  return query ? `/admin/website-tech?${query}` : "/admin/website-tech";
}

export default async function AdminWebsiteTechPage({ searchParams }: WebsiteTechPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await getChurchWebsiteTechPageData(resolvedSearchParams);
  const exportQuery = buildChurchWebsiteTechQueryString({
    query: data.filters.query,
    country: data.filters.country,
    city: data.filters.city,
    platform: data.filters.platform,
    salesAngle: data.filters.salesAngle,
  });
  const exportHref = exportQuery
    ? `/api/admin/website-tech/export?${exportQuery}`
    : "/api/admin/website-tech/export";

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Link href="/admin" className="text-sm font-medium text-rose-gold hover:text-rose-gold-deep">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-espresso">Website Tech</h1>
        <span className="text-sm text-warm-brown">({data.filteredCount} filtered / {data.totalRecords} total)</span>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-6 text-warm-brown">
        Internal fingerprinting for church websites. Filter by city, platform, or sales angle, then export the current lead slice as CSV.
      </p>

      <AdminNav activeHref="/admin/website-tech" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.summary.map((item) => (
          <div key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
            <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">{item.label}</div>
            <div className="mt-2 text-3xl font-bold text-espresso">{item.value}</div>
          </div>
        ))}
      </div>

      <form method="GET" className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Search</span>
            <input
              name="q"
              defaultValue={data.filters.query}
              placeholder="Church, slug, website..."
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Country</span>
            <select
              name="country"
              defaultValue={data.filters.country}
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            >
              <option value="">All countries</option>
              {data.facets.countries.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">City</span>
            <input
              name="city"
              defaultValue={data.filters.city}
              placeholder="Stockholm"
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Platform</span>
            <select
              name="platform"
              defaultValue={data.filters.platform}
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            >
              <option value="">All platforms</option>
              {data.facets.platforms.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Sales angle</span>
            <select
              name="salesAngle"
              defaultValue={data.filters.salesAngle}
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            >
              <option value="">All angles</option>
              {data.facets.salesAngles.map((salesAngle) => (
                <option key={salesAngle} value={salesAngle}>{salesAngle}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-espresso/90"
          >
            Apply filters
          </button>
          <Link
            href="/admin/website-tech"
            className="rounded-full bg-blush-light px-5 py-2 text-sm font-semibold text-warm-brown transition hover:bg-rose-100"
          >
            Clear
          </Link>
          <Link
            href={exportHref}
            className="rounded-full bg-rose-gold px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-gold-deep"
          >
            Export CSV
          </Link>
          <span className="text-sm text-warm-brown">
            Showing page {data.filters.page} of {data.pageCount}. {data.pageSize} rows per page.
          </span>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rose-200/70">
        {data.records.length === 0 ? (
          <div className="p-8 text-sm text-warm-brown">No church websites matched the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rose-100 text-sm">
              <thead className="bg-linen/80">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-warm-brown">
                  <th className="px-4 py-3">Church</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Sales angle</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">HTTP</th>
                  <th className="px-4 py-3">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/80">
                {data.records.map((record) => (
                  <tr key={record.churchSlug} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-espresso">{record.name}</div>
                      <div className="mt-1 text-xs text-warm-brown">{record.churchSlug}</div>
                      {record.error ? (
                        <div className="mt-2 text-xs font-medium text-rose-gold-deep">{record.error}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-warm-brown">
                      <div>{record.location || "Unknown city"}</div>
                      <div className="text-xs">{record.country || "Unknown country"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPlatformBadgeClass(record.primaryPlatform)}`}>
                        {record.primaryPlatform}
                      </span>
                      {formatTechnologies(record).length > 0 ? (
                        <div className="mt-2 flex max-w-xs flex-wrap gap-1">
                          {formatTechnologies(record).map((technology) => (
                            <span
                              key={`${record.churchSlug}-${technology}`}
                              className="rounded-full border border-rose-200/70 bg-linen px-2 py-0.5 text-[11px] text-warm-brown"
                            >
                              {technology}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-warm-brown">
                      {record.salesAngle || "No angle"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-sm flex-col gap-2">
                        <a
                          href={record.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-rose-gold hover:text-rose-gold-deep"
                        >
                          Source
                        </a>
                        {record.finalUrl && record.finalUrl !== record.website ? (
                          <a
                            href={record.finalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-warm-brown underline decoration-rose-200 underline-offset-2"
                          >
                            Final URL
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-warm-brown">
                      {record.httpStatus == null ? "Unknown" : record.httpStatus}
                    </td>
                    <td className="px-4 py-4 text-warm-brown">
                      {formatDate(record.lastCheckedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.pageCount > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-warm-brown">
            {data.filteredCount} matching churches across {data.pageCount} pages.
          </span>
          <div className="flex items-center gap-2">
            {data.filters.page > 1 ? (
              <Link
                href={buildPageHref(data.filters, data.filters.page - 1)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-warm-brown shadow-sm ring-1 ring-rose-200/70 transition hover:bg-blush-light"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-full bg-linen px-4 py-2 text-sm font-semibold text-warm-brown/60">
                Previous
              </span>
            )}

            {data.filters.page < data.pageCount ? (
              <Link
                href={buildPageHref(data.filters, data.filters.page + 1)}
                className="rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-espresso/90"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-full bg-linen px-4 py-2 text-sm font-semibold text-warm-brown/60">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
