"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { PrayerCard } from "./PrayerCard";

type PrayerItem = {
  id: string;
  content: string;
  authorName?: string;
  churchSlug: string;
  prayedCount: number;
  createdAt: string;
};

export type PrayerFeedHandle = {
  refresh: () => void;
};

export type PrayerFeedProps = {
  churchSlug?: string;
  initialPrayers: PrayerItem[];
  limit?: number;
  showChurch?: boolean;
  churchNames?: Record<string, string>;
  country?: string;
  city?: string;
  expandable?: boolean;
};

export const PrayerFeed = forwardRef<PrayerFeedHandle, PrayerFeedProps>(
  function PrayerFeed({ churchSlug, initialPrayers, limit = 5, showChurch = false, churchNames = {}, country, city, expandable = false }, ref) {
    const [prayers, setPrayers] = useState<PrayerItem[]>(initialPrayers);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const refresh = useCallback(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (churchSlug) params.set("church", churchSlug);
        if (country) params.set("country", country);
        if (city) params.set("city", city);
        params.set("limit", String(limit));
        const res = await fetch(`/api/prayer?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPrayers(data.prayers ?? []);
        }
      } catch {}
      setLoading(false);
    }, [churchSlug, country, city, limit]);

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);

    if (prayers.length === 0 && !loading) {
      return (
        <p className="text-sm text-muted-warm italic">
          No prayers yet. Be the first to pray for this church.
        </p>
      );
    }

    const handleExpand = async () => {
      setExpanded(true);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (churchSlug) params.set("church", churchSlug);
        if (country) params.set("country", country);
        if (city) params.set("city", city);
        params.set("limit", "20");
        const res = await fetch(`/api/prayer?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPrayers(data.prayers ?? []);
        }
      } catch {}
      setLoading(false);
    };

    return (
      <div className="space-y-3">
        {loading && (
          <p className="text-xs text-muted-warm animate-pulse">Refreshing prayers…</p>
        )}
        {prayers.map((prayer) => (
          <PrayerCard
            key={prayer.id}
            id={prayer.id}
            content={prayer.content}
            authorName={prayer.authorName}
            churchSlug={prayer.churchSlug}
            churchName={churchNames[prayer.churchSlug]}
            prayedCount={prayer.prayedCount}
            createdAt={prayer.createdAt}
            showChurch={showChurch}
          />
        ))}
        {expandable && !expanded && prayers.length >= limit && (
          <button
            type="button"
            onClick={handleExpand}
            className="w-full rounded-xl border border-rose-200/60 px-4 py-2.5 text-sm font-semibold text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
          >
            Show more prayers
          </button>
        )}
      </div>
    );
  }
);
