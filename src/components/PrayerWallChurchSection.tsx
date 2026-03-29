"use client";

import { useRef } from "react";
import { PrayerForm } from "./PrayerForm";
import { PrayerFeed, type PrayerFeedHandle } from "./PrayerFeed";

type PrayerWallChurchSectionProps = {
  churchSlug: string;
  churchName: string;
  initialPrayers: Array<{
    id: string;
    content: string;
    authorName?: string;
    churchSlug: string;
    prayedCount: number;
    createdAt: string;
  }>;
  churchNames: Record<string, string>;
};

export function PrayerWallChurchSection({
  churchSlug,
  churchName,
  initialPrayers,
  churchNames,
}: PrayerWallChurchSectionProps) {
  const feedRef = useRef<PrayerFeedHandle>(null);

  return (
    <div className="space-y-4">
      {initialPrayers.length > 0 ? (
        <PrayerFeed
          ref={feedRef}
          churchSlug={churchSlug}
          initialPrayers={initialPrayers}
          churchNames={churchNames}
          limit={20}
          showChurch
        />
      ) : (
        <div className="rounded-2xl border border-rose-200/60 bg-white px-5 py-8 text-center text-sm text-warm-brown">
          No prayers for {churchName} yet. Be the first!
        </div>
      )}
      <PrayerForm
        churchSlug={churchSlug}
        churchName={churchName}
        onSubmitted={() => feedRef.current?.refresh()}
      />
    </div>
  );
}
