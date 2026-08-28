"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import posthog from "posthog-js";
import { ChurchCard } from "@/components/ChurchCard";
import {
  formatNearbyServiceTime,
  NEARBY_DEFAULT_RADIUS_KM,
  roundNearbyCoordinate,
  type NearbyChurchResult,
  type NearbyChurchSearchResponse,
} from "@/lib/nearby-church-search";

const RADIUS_OPTIONS = [
  { value: 8, label: "5 mi / 8 km" },
  { value: 24, label: "15 mi / 24 km" },
  { value: 64, label: "40 mi / 64 km" },
] as const;

const WORSHIP_OPTIONS = [
  ["", "Any worship style"],
  ["contemporary", "Contemporary"],
  ["gospel", "Gospel"],
  ["charismatic", "Charismatic"],
  ["traditional", "Traditional"],
  ["acoustic", "Acoustic or reflective"],
] as const;

const DENOMINATION_OPTIONS = [
  ["", "Any tradition"],
  ["non-denominational", "Non-denominational"],
  ["baptist", "Baptist"],
  ["pentecostal", "Pentecostal"],
  ["anglican", "Anglican"],
  ["catholic", "Catholic"],
  ["lutheran", "Lutheran"],
  ["reformed", "Reformed"],
] as const;

const LANGUAGE_OPTIONS = [
  ["", "Any language"],
  ["english", "English"],
  ["spanish", "Spanish"],
  ["portuguese", "Portuguese"],
  ["french", "French"],
  ["german", "German"],
  ["swedish", "Swedish"],
] as const;

type ApproximateLocation = {
  latitude: number;
  longitude: number;
};

type BrowserPermissionsPolicy = {
  allowsFeature(feature: string): boolean;
};

function subscribeToLocationPolicy(): () => void {
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
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-warm">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-rose-200/80 bg-white px-3.5 py-3 text-base text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/15"
      >
        {children}
      </select>
    </label>
  );
}

function formatDistance(distanceKm: number | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.max(100, Math.round(distanceKm * 10) * 100)} m`;
  const miles = distanceKm * 0.621371;
  return `${distanceKm.toFixed(1)} km · ${miles.toFixed(1)} mi`;
}

function getLanguages(church: NearbyChurchResult): string[] {
  return [...new Set([...(church.languages ?? []), church.language ?? ""].map((value) => value.trim()).filter(Boolean))];
}

function getResultSignals(church: NearbyChurchResult): string[] {
  const languages = getLanguages(church);
  return [
    formatDistance(church.distanceKm),
    church.denomination,
    languages[0],
    church.hasKids ? "Kids or youth details" : null,
    church.hasVisitorDetails ? "First-visit details" : null,
    church.hasParkingInfo ? "Parking or access notes" : null,
  ].filter((value): value is string => Boolean(value)).slice(0, 4);
}

export function NearbyChurchFinder() {
  const canUseCurrentLocation = useSyncExternalStore(
    subscribeToLocationPolicy,
    getLocationPolicySnapshot,
    getLocationPolicyServerSnapshot,
  );
  const [location, setLocation] = useState<ApproximateLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState(NEARBY_DEFAULT_RADIUS_KM);
  const [worshipStyle, setWorshipStyle] = useState("");
  const [denomination, setDenomination] = useState("");
  const [language, setLanguage] = useState("");
  const [hasServiceTimes, setHasServiceTimes] = useState(false);
  const [kids, setKids] = useState(false);
  const [churches, setChurches] = useState<NearbyChurchResult[]>([]);
  const [status, setStatus] = useState("Use your location to start with churches you can realistically reach.");
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const requestNumber = useRef(0);

  async function searchNearby(nextLocation: ApproximateLocation) {
    const currentRequest = requestNumber.current + 1;
    requestNumber.current = currentRequest;
    setIsSearching(true);
    setStatus("Comparing nearby church profiles...");

    try {
      const response = await fetch("/api/church/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextLocation,
          radiusKm,
          limit: 12,
          worshipStyle: worshipStyle || undefined,
          denomination: denomination || undefined,
          language: language || undefined,
          hasServiceTimes,
          kids,
        }),
      });
      const data = (await response.json()) as NearbyChurchSearchResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Church search failed.");
      if (requestNumber.current !== currentRequest) return;

      setChurches(data.churches);
      setHasSearched(true);
      setStatus(
        data.churches.length > 0
          ? `Found ${data.churches.length} nearby church ${data.churches.length === 1 ? "profile" : "profiles"}.`
          : "No matching churches were found inside this radius. Widen it or remove one filter.",
      );
      posthog.capture("nearby_church_results_viewed", {
        radius_km: radiusKm,
        result_count: data.churches.length,
        has_worship_filter: Boolean(worshipStyle),
        has_denomination_filter: Boolean(denomination),
        has_language_filter: Boolean(language),
        has_service_times_filter: hasServiceTimes,
        has_kids_filter: kids,
      });
    } catch (error) {
      if (requestNumber.current !== currentRequest) return;
      setChurches([]);
      setHasSearched(true);
      setStatus(error instanceof Error ? error.message : "Church search is temporarily unavailable.");
    } finally {
      if (requestNumber.current === currentRequest) setIsSearching(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("This browser cannot share a location. Browse churches by city instead.");
      return;
    }

    setIsLocating(true);
    setStatus("Getting your location...");
    posthog.capture("nearby_church_finder_started", { location_source: "browser" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const approximateLocation = {
          latitude: roundNearbyCoordinate(position.coords.latitude),
          longitude: roundNearbyCoordinate(position.coords.longitude),
        };
        setLocation(approximateLocation);
        setIsLocating(false);
        void searchNearby(approximateLocation);
      },
      (error) => {
        setIsLocating(false);
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location access is off. Enable it for this site or browse churches by city."
            : "Your location could not be read. Try again or browse churches by city.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  const busy = isLocating || isSearching;

  return (
    <section id="nearby-church-finder" className="scroll-mt-24">
      <div className="overflow-hidden rounded-[28px] border border-rose-200/70 bg-white/85 text-espresso shadow-[0_20px_65px_rgba(113,78,64,0.12)] backdrop-blur-sm">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative overflow-hidden border-b border-rose-200/70 bg-linen-deep/60 px-6 py-9 sm:px-10 sm:py-11 lg:border-r lg:border-b-0">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-rose-gold/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-10 h-56 w-56 rounded-full border border-rose-gold/15" />
            <div className="relative max-w-[500px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-gold">Church near me</p>
              <h2 className="mt-3 font-serif text-4xl font-semibold leading-[0.98] tracking-[-0.02em] text-espresso sm:text-5xl">
                Start close. Then check the fit.
              </h2>
              <p className="mt-5 text-sm leading-[1.75] text-warm-brown sm:text-base">
                Distance gets you to the door. Service time, worship, tradition, language, and visitor details help you choose where to go this Sunday.
              </p>

              {canUseCurrentLocation ? (
                <button
                  type="button"
                  data-nearby-location-trigger
                  onClick={useCurrentLocation}
                  disabled={busy}
                  className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-rose-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-gold disabled:cursor-wait disabled:opacity-60"
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                  {isLocating ? "Finding you..." : isSearching && !location ? "Searching..." : "Use my location"}
                </button>
              ) : null}

              <p aria-live="polite" className="mt-4 min-h-10 text-xs font-medium leading-relaxed text-rose-gold-deep">
                {status}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-warm">
                Your exact position stays in your browser. Only an approximate point, rounded to about 1 km, is used for the search. Coordinates are not sent to analytics.
              </p>
              <Link
                href="/church/city"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-rose-gold-deep underline decoration-rose-gold/30 underline-offset-4 transition-colors hover:text-espresso"
              >
                Prefer not to share location? Browse by city
              </Link>
            </div>
          </div>

          <div className="px-6 py-9 sm:px-10 sm:py-11">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-warm">Search radius</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Search radius">
                {RADIUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRadiusKm(option.value)}
                    aria-pressed={radiusKm === option.value}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                      radiusKm === option.value
                        ? "border-rose-gold bg-rose-gold text-white"
                        : "border-rose-200/80 bg-linen text-warm-brown hover:border-rose-gold/60 hover:bg-blush-light"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <FinderSelect label="Worship" value={worshipStyle} onChange={setWorshipStyle}>
                {WORSHIP_OPTIONS.map(([value, label]) => <option key={value || "any"} value={value} className="text-espresso">{label}</option>)}
              </FinderSelect>
              <FinderSelect label="Tradition" value={denomination} onChange={setDenomination}>
                {DENOMINATION_OPTIONS.map(([value, label]) => <option key={value || "any"} value={value} className="text-espresso">{label}</option>)}
              </FinderSelect>
              <FinderSelect label="Language" value={language} onChange={setLanguage}>
                {LANGUAGE_OPTIONS.map(([value, label]) => <option key={value || "any"} value={value} className="text-espresso">{label}</option>)}
              </FinderSelect>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-rose-200/70 bg-linen/70 px-4 py-3 text-sm text-warm-brown transition-colors hover:border-rose-gold/40">
                <input
                  type="checkbox"
                  checked={hasServiceTimes}
                  onChange={(event) => setHasServiceTimes(event.target.checked)}
                  className="h-4 w-4 text-base accent-rose-gold"
                />
                Recorded service time
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-rose-200/70 bg-linen/70 px-4 py-3 text-sm text-warm-brown transition-colors hover:border-rose-gold/40">
                <input
                  type="checkbox"
                  checked={kids}
                  onChange={(event) => setKids(event.target.checked)}
                  className="h-4 w-4 text-base accent-rose-gold"
                />
                Kids or youth details
              </label>
            </div>

            <button
              type="button"
              onClick={() => location && void searchNearby(location)}
              disabled={!location || busy}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-rose-gold bg-rose-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-gold-deep disabled:cursor-not-allowed disabled:border-rose-200 disabled:bg-linen-deep disabled:text-muted-warm"
            >
              {isSearching ? "Updating..." : "Update nearby matches"}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-warm">
              Results are ordered by approximate distance, not reviews, popularity, or payment.
            </p>
          </div>
        </div>

        {hasSearched ? (
          <div className="border-t border-rose-200/70 bg-linen/65 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-gold">Nearby matches</p>
                <h3 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
                  {churches.length > 0
                    ? `${churches.length} church ${churches.length === 1 ? "profile" : "profiles"}`
                    : "No matches inside these filters"}
                </h3>
              </div>
              <p className="max-w-[480px] text-xs leading-relaxed text-muted-warm">
                A directory result is not proof that a congregation is active today. Confirm the current service and access details on the church&apos;s official site before you travel.
              </p>
            </div>

            {churches.length > 0 ? (
              <div className="mt-7 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {churches.map((church, index) => {
                  const serviceTime = formatNearbyServiceTime(church.serviceTimes);
                  const signals = getResultSignals(church);
                  const locationLabel = church.streetAddress || church.location || undefined;

                  return (
                    <ChurchCard
                      key={church.slug}
                      slug={church.slug}
                      name={church.name}
                      description={church.summary || "Church profile"}
                      country={church.country || "Nearby"}
                      musicStyle={church.worshipStyles}
                      thumbnailUrl={church.imageUrl ?? undefined}
                      updatedAt={church.checkedAt}
                      showFeedback={false}
                      enrichmentLocation={locationLabel}
                      serviceTimes={serviceTime ?? undefined}
                      enrichmentSummary={church.summary ?? undefined}
                      matchReasons={signals}
                      prefetch={index < 8}
                      surface="nearby_church_finder"
                      buttonSurface="nearby_church_finder"
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-rose-200/70 bg-white/90 px-5 py-8 text-center shadow-sm">
                <p className="text-sm text-warm-brown">Try the wider radius or remove one filter.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
