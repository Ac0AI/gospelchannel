"use client";

import { useRef } from "react";
import { PrayerForm } from "./PrayerForm";
import { PrayerFeed, type PrayerFeedHandle } from "./PrayerFeed";

type Props = {
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

export function ChurchPagePrayerSection({ churchSlug, churchName, initialPrayers }: Props) {
  const feedRef = useRef<PrayerFeedHandle>(null);

  return (
    <div className="space-y-4">
      <PrayerForm
        churchSlug={churchSlug}
        churchName={churchName}
        onSubmitted={() => feedRef.current?.refresh()}
      />
      <PrayerFeed
        ref={feedRef}
        churchSlug={churchSlug}
        initialPrayers={initialPrayers}
        churchNames={{ [churchSlug]: churchName }}
        limit={5}
      />
    </div>
  );
}
