"use client";

import { useRouter } from "next/navigation";

type FilterOption = { slug: string; label: string };

type PrayerWallFiltersProps = {
  countries: FilterOption[];
  cities: FilterOption[];
  churches: FilterOption[];
  activeCountry?: string;
  activeCity?: string;
  activeChurch?: string;
};

export function PrayerWallFilters({
  countries,
  cities,
  churches,
  activeCountry,
  activeCity,
  activeChurch,
}: PrayerWallFiltersProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={activeCountry || ""}
        onChange={(e) => {
          const val = e.target.value;
          router.push(val ? `/prayerwall/country/${val}` : "/prayerwall");
        }}
        className="rounded-full border border-rose-200/60 bg-white px-4 py-2.5 text-sm text-espresso shadow-sm outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={activeCity || ""}
        onChange={(e) => {
          const val = e.target.value;
          router.push(val ? `/prayerwall/city/${val}` : activeCountry ? `/prayerwall/country/${activeCountry}` : "/prayerwall");
        }}
        className="rounded-full border border-rose-200/60 bg-white px-4 py-2.5 text-sm text-espresso shadow-sm outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>

      {churches.length > 0 ? (
        <select
          value={activeChurch || ""}
          onChange={(e) => {
            const val = e.target.value;
            router.push(val ? `/prayerwall/church/${val}` : activeCity ? `/prayerwall/city/${activeCity}` : activeCountry ? `/prayerwall/country/${activeCountry}` : "/prayerwall");
          }}
          className="rounded-full border border-rose-200/60 bg-white px-4 py-2.5 text-sm text-espresso shadow-sm outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
        >
          <option value="">All churches</option>
          {churches.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
