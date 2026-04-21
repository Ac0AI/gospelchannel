"use client";

import { useState, useMemo, useRef, useCallback, useEffect, type CSSProperties } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChurchCard } from "@/components/ChurchCard";
import { uniqueSpotifyPlaylistIds } from "@/lib/spotify-playlist";
import { CONTENT_UPDATED_AT } from "@/lib/utils";

const snapScrollStyle: CSSProperties = { scrollSnapType: "x mandatory" };
const snapItemStyle: CSSProperties = { scrollSnapAlign: "start" };

type ChurchItem = {
  slug: string;
  name: string;
  aliases?: string[];
  description: string;
  country: string;
  location?: string;
  logo?: string;
  songCount: number;
  musicStyle?: string[];
  spotifyPlaylistIds: string[];
  additionalPlaylists?: string[];
  playlistCount?: number;
  qualityScore?: number;
  verifiedAt?: string;
  updatedAt?: string;
  thumbnailUrl?: string;
  denomination?: string;
  promotionTier?: "promotable" | "catalog_only";
  displayReady?: boolean;
  displayScore?: number;
  displayFlags?: string[];
  enrichmentHint?: {
    summary?: string;
    summaryLength: number;
    serviceTimes?: string;
    location?: string;
    languages?: string[];
    hasSocial: boolean;
    dataRichnessScore: number;
  };
};

const REGIONS: Record<string, string[]> = {
  "North America": ["USA", "United States", "Canada", "Mexico", "Honduras", "Guatemala"],
  Europe: ["United Kingdom", "Ireland", "Sweden", "Norway", "Denmark", "Germany", "Netherlands", "Switzerland", "Spain"],
  "Australia & Pacific": ["Australia", "Singapore", "Hong Kong", "Philippines", "Indonesia"],
  Africa: ["Nigeria", "South Africa"],
  "Latin America": ["Brazil", "Argentina", "Colombia"],
  Asia: ["South Korea"],
};

const STYLE_FILTERS: { slug: string; label: string; match: string[] }[] = [
  { slug: "contemporary-worship", label: "Congregational", match: ["contemporary worship", "modern worship", "contemporary Christian", "CCM", "contemporary worship music"] },
  { slug: "gospel", label: "Gospel & Choir", match: ["gospel", "contemporary gospel"] },
  { slug: "charismatic", label: "Spirit-Led", match: ["charismatic worship", "prophetic worship", "spontaneous worship", "prayer-fueled worship", "pentecostal", "praise and worship"] },
  { slug: "african", label: "African & Diaspora", match: ["African worship", "Igbo Christian music", "South African township gospel"] },
  { slug: "latin", label: "Latin & Spanish", match: ["Latin worship", "Latin CCM", "Spanish worship", "Latin Christian"] },
  { slug: "acoustic", label: "Acoustic", match: ["acoustic worship", "folk rock", "Celtic", "Swedish worship"] },
  { slug: "kids", label: "Family & Kids", match: ["kids worship"] },
  { slug: "rock", label: "High Energy", match: ["Christian rock", "Christian EDM", "high-energy praise", "worship anthems"] },
];

const DENOMINATION_FILTERS: { slug: string; label: string; match: string[] }[] = [
  { slug: "non-denominational", label: "Non-denominational", match: ["Non-denominational"] },
  { slug: "pentecostal", label: "Pentecostal", match: ["Pentecostal", "Assemblies of God", "Disciples of Christ"] },
  { slug: "evangelical", label: "Evangelical", match: ["Evangelical"] },
  { slug: "charismatic", label: "Charismatic", match: ["Charismatic"] },
  { slug: "baptist", label: "Baptist", match: ["Baptist"] },
  { slug: "anglican", label: "Anglican", match: ["Anglican", "Church of England"] },
  { slug: "lutheran", label: "Lutheran", match: ["Lutheran"] },
];

function getRegion(country: string): string {
  for (const [region, countries] of Object.entries(REGIONS)) {
    if (countries.includes(country)) return region;
  }
  return "Other";
}

function matchesStyle(musicStyle: string[] | undefined, styleSlug: string): boolean {
  if (!musicStyle) return false;
  const filter = STYLE_FILTERS.find((f) => f.slug === styleSlug);
  if (!filter) return false;
  return musicStyle.some((s) => filter.match.some((m) => s.toLowerCase().includes(m.toLowerCase())));
}

function matchesDenomination(denomination: string | undefined, denomSlug: string): boolean {
  if (!denomination) return false;
  const filter = DENOMINATION_FILTERS.find((f) => f.slug === denomSlug);
  if (!filter) return false;
  return filter.match.some((m) => denomination.toLowerCase().includes(m.toLowerCase()));
}

function getPlaylistCount(church: ChurchItem): number {
  if (typeof church.playlistCount === "number" && church.playlistCount > 0) {
    return church.playlistCount;
  }
  return uniqueSpotifyPlaylistIds([
    ...(church.spotifyPlaylistIds ?? []),
    ...(church.additionalPlaylists ?? []),
  ]).length;
}

function getTextMatchScore(church: ChurchItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = church.name.toLowerCase();
  let score = 0;
  if (name.startsWith(q)) score = Math.max(score, 100);
  else if (name.includes(q)) score = Math.max(score, 70);

  for (const alias of church.aliases ?? []) {
    const aliasLower = alias.toLowerCase();
    if (aliasLower.startsWith(q)) score = Math.max(score, 90);
    else if (aliasLower.includes(q)) score = Math.max(score, 60);
  }

  if (church.country.toLowerCase().includes(q)) score = Math.max(score, 30);
  if (church.location?.toLowerCase().includes(q)) score = Math.max(score, 40);
  if ((church.musicStyle ?? []).some((style) => style.toLowerCase().includes(q))) score = Math.max(score, 30);

  return score;
}

function getAgeDays(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  const reference = new Date(CONTENT_UPDATED_AT).getTime();
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.floor((reference - value) / (1000 * 60 * 60 * 24)));
}

function getFreshnessBoost(church: ChurchItem): number {
  const ageDays = getAgeDays(church.verifiedAt ?? church.updatedAt);
  if (ageDays === null) return 0;
  if (ageDays <= 30) return 5;
  if (ageDays <= 90) return 3;
  return 0;
}

function getQualityBoost(church: ChurchItem): number {
  return Math.max(0, Math.min(10, (church.qualityScore ?? 0) / 10));
}

function getPromotionBoost(church: ChurchItem): number {
  return church.promotionTier === "promotable" ? 18 : 0;
}

function getEngagementBoost(votes: number | undefined): number {
  return Math.max(0, Math.min(5, Math.log10((votes ?? 0) + 1) * 2.5));
}

export function ChurchGrid({ churches }: { churches: ChurchItem[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStyle = searchParams.get("style") || "all";
  const initialQuery = searchParams.get("q") || "";

  const [activeRegion, setActiveRegion] = useState("All");
  const [activeStyle, setActiveStyle] = useState(initialStyle);
  const [activeDenomination, setActiveDenomination] = useState("all");
  const [filterMode, setFilterMode] = useState<"style" | "region" | "tradition">("style");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [showAll, setShowAll] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlStyle = searchParams.get("style") || "all";
  const urlQuery = searchParams.get("q") || "";

  useEffect(() => {
    setActiveStyle(urlStyle);
  }, [urlStyle]);

  useEffect(() => {
    setSearchQuery(urlQuery);
    setDebouncedQuery(urlQuery.trim());
  }, [urlQuery]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (churches.length === 0) return;
    // Only fetch votes for top churches initially, not all 2000+
    const allSlugs = churches.slice(0, 100).map((church) => church.slug);
    const BATCH_SIZE = 50;

    const loadVotes = async () => {
      try {
        const batches: string[][] = [];
        for (let i = 0; i < allSlugs.length; i += BATCH_SIZE) {
          batches.push(allSlugs.slice(i, i + BATCH_SIZE));
        }
        const results = await Promise.all(
          batches.map(async (batch) => {
            const response = await fetch(`/api/church/vote?slugs=${encodeURIComponent(batch.join(","))}`, { cache: "no-store" });
            if (!response.ok) return {};
            return (await response.json()) as Record<string, number>;
          })
        );
        const merged: Record<string, number> = {};
        for (const result of results) {
          Object.assign(merged, result);
        }
        setVoteCounts(merged);
      } catch {
        // Ranking gracefully falls back if votes are unavailable.
      }
    };

    void loadVotes();
  }, [churches]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 200);
  }, []);

  const regions = useMemo(() => {
    const set = new Set(churches.map((c) => getRegion(c.country)));
    return ["All", ...Array.from(set).sort()];
  }, [churches]);

  const styleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const filter of STYLE_FILTERS) {
      counts[filter.slug] = churches.filter((church) => matchesStyle(church.musicStyle, filter.slug)).length;
    }
    return counts;
  }, [churches]);

  const denominationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const filter of DENOMINATION_FILTERS) {
      counts[filter.slug] = churches.filter((church) => matchesDenomination(church.denomination, filter.slug)).length;
    }
    return counts;
  }, [churches]);

  const sorted = useMemo(() => {
    const query = debouncedQuery.trim();
    let filtered = activeRegion === "All"
      ? churches
      : churches.filter((church) => getRegion(church.country) === activeRegion);

    if (activeStyle !== "all") {
      filtered = filtered.filter((church) => matchesStyle(church.musicStyle, activeStyle));
    }

    if (activeDenomination !== "all") {
      filtered = filtered.filter((church) => matchesDenomination(church.denomination, activeDenomination));
    }

    if (query) {
      filtered = filtered.filter((church) => getTextMatchScore(church, query) > 0);
    }

    return [...filtered].sort((a, b) => {
      const aPlaylistCount = getPlaylistCount(a);
      const bPlaylistCount = getPlaylistCount(b);

      if (query) {
        const aRankScore =
          getTextMatchScore(a, query) +
          getPromotionBoost(a) +
          getQualityBoost(a) +
          getFreshnessBoost(a) +
          getEngagementBoost(voteCounts[a.slug]) +
          (a.enrichmentHint?.dataRichnessScore ?? 0) * 0.3;
        const bRankScore =
          getTextMatchScore(b, query) +
          getPromotionBoost(b) +
          getQualityBoost(b) +
          getFreshnessBoost(b) +
          getEngagementBoost(voteCounts[b.slug]) +
          (b.enrichmentHint?.dataRichnessScore ?? 0) * 0.3;

        if (aRankScore !== bRankScore) return bRankScore - aRankScore;
        if (aPlaylistCount !== bPlaylistCount) return bPlaylistCount - aPlaylistCount;
        return a.name.localeCompare(b.name);
      }

      const aRichness = a.enrichmentHint?.dataRichnessScore ?? 0;
      const bRichness = b.enrichmentHint?.dataRichnessScore ?? 0;
      const aTotal = getPromotionBoost(a) * 5 + (a.displayScore ?? 0) + (a.qualityScore ?? 0) + aRichness * 0.5 + aPlaylistCount * 12;
      const bTotal = getPromotionBoost(b) * 5 + (b.displayScore ?? 0) + (b.qualityScore ?? 0) + bRichness * 0.5 + bPlaylistCount * 12;
      if (aTotal !== bTotal) return bTotal - aTotal;
      return a.name.localeCompare(b.name);
    });
  }, [churches, activeRegion, activeStyle, activeDenomination, debouncedQuery, voteCounts]);

  return (
    <>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder={`Search ${churches.length} churches by name, country, or sound...`}
          className="w-full rounded-full border border-rose-200/60 bg-white/70 py-3 pl-11 pr-10 text-base text-espresso placeholder:text-muted-warm/60 shadow-sm backdrop-blur-sm transition-colors focus:border-blush focus:outline-none focus:ring-2 focus:ring-blush/30 sm:text-sm"
        />
        <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-warm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery ? (
          <button
            onClick={() => {
              setSearchQuery("");
              setDebouncedQuery("");
              const params = new URLSearchParams(searchParams.toString());
              params.delete("q");
              const qs = params.toString();
              router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-warm transition-colors hover:bg-blush-light hover:text-espresso"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex shrink-0 overflow-hidden rounded-full border border-rose-200/60 bg-white/70">
          <button
            onClick={() => setFilterMode("style")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === "style" ? "bg-espresso text-white" : "text-warm-brown hover:bg-blush-light"
            }`}
          >
            Sound
          </button>
          <button
            onClick={() => setFilterMode("tradition")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === "tradition" ? "bg-espresso text-white" : "text-warm-brown hover:bg-blush-light"
            }`}
          >
            Tradition
          </button>
          <button
            onClick={() => setFilterMode("region")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === "region" ? "bg-espresso text-white" : "text-warm-brown hover:bg-blush-light"
            }`}
          >
            Region
          </button>
        </div>

        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto" style={snapScrollStyle}>
          {filterMode === "style" ? (
            <>
              <button
                onClick={() => setActiveStyle("all")}
                style={snapItemStyle}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeStyle === "all"
                    ? "bg-espresso text-white shadow-sm"
                    : "border border-rose-200/60 bg-white/70 text-warm-brown hover:border-blush hover:bg-blush-light"
                }`}
              >
                All
              </button>
              {STYLE_FILTERS.filter((filter) => styleCounts[filter.slug] > 0).map((filter) => (
                <button
                  key={filter.slug}
                  onClick={() => setActiveStyle(activeStyle === filter.slug ? "all" : filter.slug)}
                  style={snapItemStyle}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeStyle === filter.slug
                      ? "bg-espresso text-white shadow-sm"
                      : "border border-rose-200/60 bg-white/70 text-warm-brown hover:border-blush hover:bg-blush-light"
                  }`}
                >
                  {filter.label}
                  <span className="ml-1 opacity-70">{styleCounts[filter.slug]}</span>
                </button>
              ))}
            </>
          ) : filterMode === "tradition" ? (
            <>
              <button
                onClick={() => setActiveDenomination("all")}
                style={snapItemStyle}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeDenomination === "all"
                    ? "bg-espresso text-white shadow-sm"
                    : "border border-rose-200/60 bg-white/70 text-warm-brown hover:border-blush hover:bg-blush-light"
                }`}
              >
                All
              </button>
              {DENOMINATION_FILTERS.filter((filter) => denominationCounts[filter.slug] > 0).map((filter) => (
                <button
                  key={filter.slug}
                  onClick={() => setActiveDenomination(activeDenomination === filter.slug ? "all" : filter.slug)}
                  style={snapItemStyle}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeDenomination === filter.slug
                      ? "bg-espresso text-white shadow-sm"
                      : "border border-rose-200/60 bg-white/70 text-warm-brown hover:border-blush hover:bg-blush-light"
                  }`}
                >
                  {filter.label}
                  <span className="ml-1 opacity-70">{denominationCounts[filter.slug]}</span>
                </button>
              ))}
            </>
          ) : (
            regions.map((region) => (
              <button
                key={region}
                onClick={() => setActiveRegion(region)}
                style={snapItemStyle}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeRegion === region
                    ? "bg-rose-gold text-white shadow-sm"
                    : "border border-rose-200/60 bg-white/70 text-warm-brown hover:border-blush hover:bg-blush-light"
                }`}
              >
                {region}
                {region !== "All" ? (
                  <span className="ml-1 opacity-70">
                    {churches.filter((church) => getRegion(church.country) === region).length}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-warm-brown">
        {sorted.length} {sorted.length === 1 ? "church" : "churches"}
        {activeRegion !== "All" ? ` in ${activeRegion}` : ""}
        {activeStyle !== "all" ? ` · ${STYLE_FILTERS.find((f) => f.slug === activeStyle)?.label}` : ""}
        {activeDenomination !== "all" ? ` · ${DENOMINATION_FILTERS.find((f) => f.slug === activeDenomination)?.label}` : ""}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(() => {
          const isFiltering = debouncedQuery || activeStyle !== "all" || activeRegion !== "All" || activeDenomination !== "all";
          const INITIAL_LIMIT = 36;
          const visible = isFiltering || showAll ? sorted : sorted.slice(0, INITIAL_LIMIT);
          const hasMore = !isFiltering && !showAll && sorted.length > INITIAL_LIMIT;

          return (
            <>
              {visible.map((church, index) => (
                <ChurchCard
                  key={church.slug}
                  slug={church.slug}
                  name={church.name}
                  description={church.description}
                  country={church.country}
                  playlistCount={getPlaylistCount(church)}
                  updatedAt={church.verifiedAt ?? church.updatedAt}
                  musicStyle={church.musicStyle}
                  thumbnailUrl={church.thumbnailUrl}
                  logoUrl={church.logo}
                  enrichmentLocation={church.location}
                  serviceTimes={church.enrichmentHint?.serviceTimes}
                  enrichmentSummary={church.enrichmentHint?.summary}
                  prefetch={index < 8}
                />
              ))}
              {hasMore ? (
                <div className="col-span-full flex justify-center pt-4">
                  <button
                    onClick={() => setShowAll(true)}
                    className="rounded-full border border-rose-200/60 bg-white/70 px-8 py-3 text-sm font-semibold text-warm-brown shadow-sm transition-all hover:border-blush hover:bg-blush-light hover:shadow-md"
                  >
                    Show all {sorted.length} churches
                  </button>
                </div>
              ) : null}
            </>
          );
        })()}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-warm">
          {debouncedQuery
            ? `No churches found matching "${debouncedQuery}"${activeRegion !== "All" ? ` in ${activeRegion}` : ""}${activeStyle !== "all" ? " with that sound" : ""}.`
            : activeStyle !== "all"
              ? "No churches found with this sound in this region."
              : "No churches found in this region yet."}
        </p>
      ) : null}
    </>
  );
}
