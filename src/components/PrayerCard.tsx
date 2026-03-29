"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

const STORAGE_KEY = "gospel_prayed_ids";

function getPrayedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function markAsPrayed(id: string): void {
  try {
    const ids = getPrayedIds();
    ids.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

type PrayerCardProps = {
  id: string;
  content: string;
  authorName?: string;
  churchSlug: string;
  churchName?: string;
  prayedCount: number;
  createdAt: string;
  showChurch?: boolean;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PrayerCard({ id, content, authorName, churchSlug, churchName, prayedCount: initialCount, createdAt, showChurch = false }: PrayerCardProps) {
  const [prayed, setPrayed] = useState(() => getPrayedIds().has(id));
  const [count, setCount] = useState(initialCount);

  const handlePray = useCallback(async () => {
    if (prayed) return;
    setPrayed(true);
    setCount((c) => c + 1);
    try {
      const res = await fetch("/api/prayer/pray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prayerId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCount(data.prayedCount);
        markAsPrayed(id);
      } else {
        // Server rejected (rate limit or error) - revert optimistic state
        setPrayed(false);
        setCount((c) => c - 1);
      }
    } catch {
      setPrayed(false);
      setCount((c) => c - 1);
    }
  }, [id, prayed]);

  return (
    <div className="rounded-xl border border-rose-200/60 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm leading-relaxed text-warm-brown">{content}</p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-warm">
          <span>{authorName || "Anonymous"}</span>
          {showChurch && churchName && (
            <>
              <span>·</span>
              <Link href={`/church/${churchSlug}`} prefetch={false} className="hover:text-rose-gold">{churchName}</Link>
            </>
          )}
          <span>·</span>
          <span>{timeAgo(createdAt)}</span>
        </div>
        <button
          onClick={handlePray}
          disabled={prayed}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${
            prayed ? "bg-blush-light text-rose-gold-deep" : "bg-linen-deep text-warm-brown hover:bg-blush-light hover:text-rose-gold"
          }`}
        >
          🙏 {count > 0 ? count : "Pray"}
        </button>
      </div>
    </div>
  );
}
