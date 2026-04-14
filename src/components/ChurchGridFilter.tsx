"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ChurchCard } from "@/components/ChurchCard";

// Fisher-Yates shuffle — used client-side after hydration so every visit
// shows a different slice of the featured pool without triggering ISR
// revalidation on the server.
function shuffleArray<T>(source: T[]): T[] {
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type ChurchItem = {
  slug: string;
  name: string;
  description: string;
  country: string;
  location?: string;
  logo?: string;
  playlistCount?: number;
  updatedAt?: string;
  musicStyle?: string[];
  thumbnailUrl?: string;
  serviceTimes?: string;
  enrichmentSummary?: string;
  verified?: boolean;
};

type Tab = {
  key: string;
  label: string;
};

const TABS: Tab[] = [
  { key: "all", label: "All" },
  { key: "europe", label: "Europe" },
  { key: "africa", label: "Africa" },
  { key: "americas", label: "Americas" },
  { key: "asia-pacific", label: "Asia & Pacific" },
  { key: "newly-added", label: "Newly Added" },
];

const REGION_MAP: Record<string, string[]> = {
  europe: [
    "United Kingdom", "Germany", "Sweden", "France", "Switzerland", "Denmark",
    "Norway", "Finland", "Spain", "Netherlands", "Austria", "Italy", "Belgium",
    "Ireland", "Portugal", "Poland", "Czech Republic", "Romania", "Hungary",
    "Greece", "Croatia", "Estonia", "Latvia", "Lithuania", "Slovakia", "Slovenia",
    "Bulgaria", "Serbia", "Iceland", "Luxembourg", "Malta", "Cyprus",
  ],
  africa: [
    "Nigeria", "South Africa", "Kenya", "Ghana", "Tanzania", "Uganda",
    "Ethiopia", "Cameroon", "Zimbabwe", "Mozambique", "Democratic Republic of the Congo",
    "Rwanda", "Ivory Coast", "Senegal", "Zambia", "Malawi", "Angola", "Botswana",
    "Namibia", "Madagascar",
  ],
  americas: [
    "USA", "Canada", "Brazil", "Mexico", "Colombia", "Argentina", "Chile",
    "Peru", "Costa Rica", "Guatemala", "Ecuador", "Venezuela", "Dominican Republic",
    "Puerto Rico", "Jamaica", "Trinidad and Tobago", "Honduras", "Panama",
  ],
  "asia-pacific": [
    "Australia", "South Korea", "Philippines", "India", "Japan", "Singapore",
    "Malaysia", "Indonesia", "New Zealand", "Hong Kong", "Thailand", "China",
    "Taiwan", "Vietnam", "Sri Lanka", "Pakistan", "Bangladesh", "Myanmar",
    "Cambodia", "Fiji", "Papua New Guinea",
  ],
};

function matchesRegion(country: string, region: string): boolean {
  const countries = REGION_MAP[region];
  return countries ? countries.includes(country) : false;
}

type ChurchGridFilterProps = {
  churches: ChurchItem[];
  totalCount: number;
};

export function ChurchGridFilter({ churches, totalCount }: ChurchGridFilterProps) {
  const [activeTab, setActiveTab] = useState("all");
  // Start with the server-rendered order so SSR and initial hydration match;
  // reshuffle once on mount so returning visitors see a fresh selection.
  const [pool, setPool] = useState<ChurchItem[]>(churches);
  useEffect(() => {
    setPool(shuffleArray(churches));
  }, [churches]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return pool;
    if (activeTab === "newly-added") {
      return [...pool].sort((a, b) => {
        const aDate = a.updatedAt ?? "";
        const bDate = b.updatedAt ?? "";
        return bDate.localeCompare(aDate);
      });
    }
    return pool.filter((c) => matchesRegion(c.country, activeTab));
  }, [pool, activeTab]);

  const displayed = filtered.slice(0, activeTab === "all" ? 8 : 12);

  return (
    <section className="space-y-4">
      {/* Filter tabs - horizontal scroll on mobile */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide sm:justify-center" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                activeTab === tab.key
                  ? "bg-rose-gold text-white shadow-sm"
                  : "border border-blush text-warm-brown hover:border-rose-300 hover:bg-blush-light"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Church grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {displayed.map((church) => (
          <ChurchCard
            key={church.slug}
            slug={church.slug}
            name={church.name}
            description={church.description}
            country={church.country}
            playlistCount={church.playlistCount}
            updatedAt={church.updatedAt}
            musicStyle={church.musicStyle}
            thumbnailUrl={church.thumbnailUrl}
            logoUrl={church.logo}
            showFeedback={false}
            enrichmentLocation={church.location}
            serviceTimes={church.serviceTimes}
            enrichmentSummary={church.enrichmentSummary}
            verified={church.verified}
          />
        ))}
      </div>

      {/* Empty state for filtered results */}
      {displayed.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-warm">
          No churches found in this category yet.
        </p>
      )}

      {/* Explore all link */}
      <div className="text-center">
        <Link
          href="/church"
          prefetch={false}
          className="inline-flex rounded-full border border-blush px-6 py-2.5 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
        >
          Explore all {totalCount} churches →
        </Link>
      </div>
    </section>
  );
}
