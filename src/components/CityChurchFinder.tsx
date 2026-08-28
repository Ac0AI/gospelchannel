"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import posthog from "posthog-js";
import { TrackedChurchProfileLink } from "@/components/ChurchJourneyAnalytics";
import {
  getCityFinderMatches,
  getDistanceMiles,
  type CityFinderChurch,
  type CityFinderFilters,
  type CityFinderLocation,
  type CityFinderOption,
} from "@/lib/city-finder";

type FinderArea = CityFinderLocation & { id: string };

type CityChurchFinderProps = {
  city: string;
  cityCenter: CityFinderLocation;
  maxLocalDistanceMiles: number;
  churches: CityFinderChurch[];
  areas: FinderArea[];
  styleOptions: CityFinderOption[];
  denominationOptions: CityFinderOption[];
  languageOptions: CityFinderOption[];
};

const RADIUS_OPTIONS = [5, 10, 25] as const;

type BrowserPermissionsPolicy = {
  allowsFeature(feature: string): boolean;
};

function subscribeToLocationPolicy(): () => void {
  // The policy is fixed for the lifetime of a document. React still checks the
  // snapshot after hydration, and a reload creates a new subscription.
  return () => undefined;
}

function getLocationPolicySnapshot(): boolean {
  const policyDocument = document as Document & {
    permissionsPolicy?: BrowserPermissionsPolicy;
    featurePolicy?: BrowserPermissionsPolicy;
  };
  const policy = policyDocument.permissionsPolicy ?? policyDocument.featurePolicy;
  return Boolean(navigator.geolocation) && (policy?.allowsFeature("geolocation") ?? true);
}

function getLocationPolicyServerSnapshot(): boolean {
  return false;
}

function formatCheckedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function getOptionLabel(options: CityFinderOption[], value: string | undefined): string | undefined {
  if (!value) return undefined;
  return options.find((option) => option.value === value)?.label;
}

function FinderSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-linen/55">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-linen/15 bg-linen/[0.07] px-3.5 py-3 text-sm text-linen outline-none transition-colors focus:border-rose-gold"
      >
        {children}
      </select>
    </label>
  );
}

export function CityChurchFinder({
  city,
  cityCenter,
  maxLocalDistanceMiles,
  churches,
  areas,
  styleOptions,
  denominationOptions,
  languageOptions,
}: CityChurchFinderProps) {
  const cityArticle = /^[aeiou]/i.test(city) ? "an" : "a";
  const canUseCurrentLocation = useSyncExternalStore(
    subscribeToLocationPolicy,
    getLocationPolicySnapshot,
    getLocationPolicyServerSnapshot,
  );
  const [location, setLocation] = useState<CityFinderLocation | undefined>();
  const [radiusMiles, setRadiusMiles] = useState<(typeof RADIUS_OPTIONS)[number]>(10);
  const [filters, setFilters] = useState<CityFinderFilters>({});
  const [areaId, setAreaId] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [status, setStatus] = useState(`Choose ${cityArticle} ${city} area to start.`);
  const [visibleCount, setVisibleCount] = useState(3);
  const trackedResults = useRef(new Set<string>());

  const matches = useMemo(
    () => getCityFinderMatches({ churches, location, radiusMiles, filters }),
    [churches, filters, location, radiusMiles],
  );
  const visibleMatches = matches.slice(0, visibleCount);
  const hasActiveFilters = Boolean(
    filters.style || filters.denomination || filters.language || filters.servicePeriod || filters.kids,
  );
  const resultKey = [
    location?.label ?? "citywide",
    radiusMiles,
    filters.style ?? "",
    filters.denomination ?? "",
    filters.language ?? "",
    filters.servicePeriod ?? "",
    filters.kids ? "kids" : "",
    matches.length,
  ].join("|");

  useEffect(() => {
    if (!location || trackedResults.current.has(resultKey)) return;
    trackedResults.current.add(resultKey);
    posthog.capture("city_finder_results_viewed", {
      city: city.toLowerCase(),
      location_source: areaId ? "area" : "browser",
      radius_miles: radiusMiles,
      result_count: matches.length,
      has_style_filter: Boolean(filters.style),
      has_denomination_filter: Boolean(filters.denomination),
      has_language_filter: Boolean(filters.language),
      has_service_period_filter: Boolean(filters.servicePeriod),
      has_kids_filter: Boolean(filters.kids),
    });
  }, [areaId, city, filters, location, matches.length, radiusMiles, resultKey]);

  function updateFilter<Key extends keyof CityFinderFilters>(key: Key, value: CityFinderFilters[Key]) {
    setVisibleCount(3);
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function chooseArea(nextAreaId: string) {
    setVisibleCount(3);
    setAreaId(nextAreaId);
    const area = areas.find((item) => item.id === nextAreaId);
    if (!area) {
      setLocation(undefined);
      setStatus(`Choose ${cityArticle} ${city} area to start.`);
      return;
    }
    setLocation(area);
    setStatus(`Showing churches near ${area.label}.`);
    posthog.capture("city_finder_started", { city: city.toLowerCase(), location_source: "area", area: area.id });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus(`This browser cannot share a location. Choose ${cityArticle} ${city} area instead.`);
      return;
    }

    setIsLocating(true);
    setStatus("Finding your location...");
    posthog.capture("city_finder_started", { city: city.toLowerCase(), location_source: "browser" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "your location",
        };
        const distanceFromCity = getDistanceMiles(nextLocation, {
          latitude: cityCenter.latitude,
          longitude: cityCenter.longitude,
        });

        setIsLocating(false);
        setVisibleCount(3);
        if (distanceFromCity > maxLocalDistanceMiles) {
          setLocation(undefined);
          setAreaId("");
          setStatus(`Your current location is outside the ${city} area. Choose ${cityArticle} ${city} area instead.`);
          return;
        }

        setAreaId("");
        setLocation(nextLocation);
        setStatus("Showing churches near your current location.");
      },
      (error) => {
        setIsLocating(false);
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? `Location access is off. Choose ${cityArticle} ${city} area instead.`
            : `Your location could not be read. Choose ${cityArticle} ${city} area instead.`,
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  const styleLabel = getOptionLabel(styleOptions, filters.style);
  const denominationLabel = getOptionLabel(denominationOptions, filters.denomination);

  return (
    <section id="austin-church-finder" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-12 sm:px-12 sm:pt-14">
      <div className="overflow-hidden rounded-[28px] bg-espresso text-linen shadow-[0_24px_80px_rgba(59,42,34,0.18)]">
        <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative overflow-hidden border-b border-linen/10 px-6 py-9 sm:px-10 sm:py-11 lg:border-r lg:border-b-0">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border border-rose-gold/15" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 h-48 w-48 rounded-full border border-rose-gold/20" />
            <div aria-hidden="true" className="pointer-events-none absolute right-8 top-4 h-24 w-24 rounded-full border border-rose-gold/25" />

            <div className="relative max-w-[520px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-gold">Sunday finder</p>
              <h2 className="mt-3 font-serif text-4xl font-semibold leading-[0.98] tracking-[-0.02em] sm:text-5xl">
                Start close. Then find your fit.
              </h2>
              <p className="mt-5 max-w-[460px] text-sm leading-[1.75] text-linen/72 sm:text-base">
                Distance gets you to the door. Worship, tradition, language, service time, and family needs help you decide whether to return.
              </p>

              {canUseCurrentLocation ? (
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={isLocating || churches.length === 0}
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-rose-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-gold disabled:cursor-wait disabled:opacity-60"
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                  {isLocating ? "Finding you..." : "Use my location"}
                </button>
              ) : null}

              <label className={`${canUseCurrentLocation ? "mt-5" : "mt-7"} block max-w-[330px]`}>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-linen/50">
                  {canUseCurrentLocation ? "Or choose" : "Choose"} {cityArticle} {city} area
                </span>
                <select
                  value={areaId}
                  onChange={(event) => chooseArea(event.target.value)}
                  className="w-full rounded-xl border border-linen/15 bg-linen/[0.07] px-3.5 py-3 text-sm text-linen outline-none transition-colors focus:border-rose-gold"
                >
                  <option value="" className="text-espresso">Choose an area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id} className="text-espresso">{area.label}</option>
                  ))}
                </select>
              </label>

              <p aria-live="polite" className="mt-4 min-h-5 text-xs leading-relaxed text-blush/70">{status}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-linen/45">
                {canUseCurrentLocation
                  ? "Your precise location stays in this browser. Analytics never receives your coordinates."
                  : `Distance is calculated in this browser from the ${city} area you choose.`}
              </p>
            </div>
          </div>

          <div className="px-6 py-9 sm:px-10 sm:py-11">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-linen/50">Search radius</p>
                <div className="mt-2 flex gap-2" role="group" aria-label="Search radius">
                  {RADIUS_OPTIONS.map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      onClick={() => {
                        setVisibleCount(3);
                        setRadiusMiles(radius);
                      }}
                      aria-pressed={radiusMiles === radius}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                        radiusMiles === radius
                          ? "border-rose-gold bg-rose-gold text-white"
                          : "border-linen/15 bg-linen/[0.05] text-linen/70 hover:border-rose-gold/60 hover:text-linen"
                      }`}
                    >
                      {radius} mi
                    </button>
                  ))}
                </div>
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setVisibleCount(3);
                    setFilters({});
                  }}
                  className="text-xs font-bold text-rose-gold underline decoration-rose-gold/40 underline-offset-4"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <FinderSelect label="Worship" value={filters.style ?? ""} onChange={(value) => updateFilter("style", value)}>
                <option value="" className="text-espresso">Any worship style</option>
                {styleOptions.map((option) => <option key={option.value} value={option.value} className="text-espresso">{option.label} ({option.count})</option>)}
              </FinderSelect>
              <FinderSelect label="Tradition" value={filters.denomination ?? ""} onChange={(value) => updateFilter("denomination", value)}>
                <option value="" className="text-espresso">Any tradition</option>
                {denominationOptions.map((option) => <option key={option.value} value={option.value} className="text-espresso">{option.label} ({option.count})</option>)}
              </FinderSelect>
              <FinderSelect label="Language" value={filters.language ?? ""} onChange={(value) => updateFilter("language", value)}>
                <option value="" className="text-espresso">Any language</option>
                {languageOptions.map((option) => <option key={option.value} value={option.value} className="text-espresso">{option.label} ({option.count})</option>)}
              </FinderSelect>
              <FinderSelect
                label="Service time"
                value={filters.servicePeriod ?? ""}
                onChange={(value) => updateFilter("servicePeriod", value as CityFinderFilters["servicePeriod"])}
              >
                <option value="" className="text-espresso">Any recorded time</option>
                <option value="morning" className="text-espresso">Morning</option>
                <option value="afternoon" className="text-espresso">Afternoon</option>
                <option value="evening" className="text-espresso">Evening</option>
              </FinderSelect>
            </div>

            <label className="mt-5 inline-flex cursor-pointer items-center gap-3 text-sm text-linen/72">
              <input
                type="checkbox"
                checked={Boolean(filters.kids)}
                onChange={(event) => updateFilter("kids", event.target.checked)}
                className="h-4 w-4 rounded border-linen/30 accent-rose-gold"
              />
              Show churches with recorded kids or youth ministry
            </label>
          </div>
        </div>

        <div className="border-t border-linen/10 bg-[#2f211a] px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-gold">
                {location ? `Near ${location.label}` : `${city} starting points`}
              </p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-linen sm:text-3xl">
                {matches.length > 0
                  ? `${matches.length.toLocaleString("en-US")} church ${matches.length === 1 ? "match" : "matches"}`
                  : "No matches inside these filters"}
              </h3>
            </div>
            <p className="max-w-[420px] text-xs leading-relaxed text-linen/52">
              Matches use recorded profile facts, never a theological score or paid placement. Confirm service times with the church before you go.
            </p>
          </div>

          {visibleMatches.length > 0 ? (
            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {visibleMatches.map(({ church, distanceMiles }, index) => {
                const checkedAt = formatCheckedAt(church.checkedAt);
                const reasons = [
                  distanceMiles != null ? `${distanceMiles < 0.1 ? "<0.1" : distanceMiles.toFixed(1)} mi away` : null,
                  styleLabel && church.styleSlugs.includes(filters.style ?? "") ? styleLabel : church.hasWorshipPreview ? "Worship preview" : church.worshipStyles[0],
                  denominationLabel && church.denominationSlugs.includes(filters.denomination ?? "") ? denominationLabel : church.denomination,
                  filters.language && church.languages.includes(filters.language) ? filters.language : church.languages[0],
                  filters.kids && church.hasKids ? "Kids or youth ministry" : church.hasVisitorDetails ? "First-visit details" : null,
                ].filter((value): value is string => Boolean(value)).slice(0, 4);

                return (
                  <article key={church.slug} className="flex h-full flex-col rounded-[18px] border border-linen/10 bg-linen/[0.06] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-gold">Match {String(index + 1).padStart(2, "0")}</p>
                      {distanceMiles != null ? <span className="rounded-full bg-rose-gold/15 px-2.5 py-1 text-xs font-bold text-blush">{distanceMiles.toFixed(1)} mi</span> : null}
                    </div>
                    <h4 className="mt-3 font-serif text-xl font-semibold leading-tight text-linen">{church.name}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-linen/55">{church.address}</p>
                    <div className="mt-4 border-y border-linen/10 py-3">
                      <p className="text-sm font-semibold text-blush">{church.serviceTime}</p>
                      <p className="mt-1 text-[11px] text-linen/45">Last recorded service time</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {reasons.map((reason) => (
                        <span key={reason} className="rounded-full border border-linen/10 bg-linen/[0.05] px-2.5 py-1 text-[11px] font-semibold text-linen/68">
                          {reason}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-4 pt-5">
                      <TrackedChurchProfileLink
                        href={`/church/${church.slug}`}
                        churchSlug={church.slug}
                        churchName={church.name}
                        surface="austin_city_finder"
                        className="inline-flex rounded-full bg-linen px-4 py-2 text-sm font-bold text-espresso transition-colors hover:bg-blush"
                      >
                        Plan a first visit
                      </TrackedChurchProfileLink>
                      {checkedAt ? <span className="text-right text-[10px] leading-tight text-linen/35">Details checked<br />{checkedAt}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 rounded-[18px] border border-linen/10 bg-linen/[0.05] px-5 py-8 text-center">
              <p className="text-sm text-linen/68">Widen the radius or remove one filter to see more {city} churches.</p>
            </div>
          )}

          {matches.length > visibleCount ? (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + 3)}
              className="mt-6 rounded-full border border-linen/15 px-4 py-2 text-sm font-bold text-linen/72 transition-colors hover:border-rose-gold/50 hover:text-linen"
            >
              Show more matches
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
