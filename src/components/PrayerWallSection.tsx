"use client";

import { useRef } from "react";
import { PrayerForm } from "./PrayerForm";
import { PrayerFeed, type PrayerFeedHandle } from "./PrayerFeed";

type PrayerWallSectionProps = {
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
};

export function PrayerWallSection({ churchSlug, churchName, initialPrayers }: PrayerWallSectionProps) {
  const feedRef = useRef<PrayerFeedHandle>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-espresso">Prayer Wall</h2>
      <p className="mt-1 text-sm text-warm-brown">Share a prayer for {churchName} and this community.</p>
      <div className="mt-4 space-y-4">
        <PrayerForm
          churchSlug={churchSlug}
          churchName={churchName}
          onSubmitted={() => feedRef.current?.refresh()}
        />
        <PrayerFeed ref={feedRef} churchSlug={churchSlug} initialPrayers={initialPrayers} limit={2} expandable />
      </div>
    </section>
  );
}
