"use client";

import { useCallback, useEffect, useState } from "react";

type ChurchHeartButtonProps = {
  slug: string;
};

export function ChurchHeartButton({ slug }: ChurchHeartButtonProps) {
  const [hearted, setHearted] = useState(() => {
    if (typeof document !== "undefined") {
      return document.cookie.includes(`church_${slug}=1`);
    }
    return false;
  });
  const [count, setCount] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    fetch(`/api/church/vote?slugs=${slug}`)
      .then((r) => r.json())
      .then((data) => setCount(data[slug] ?? 0))
      .catch(() => {});
  }, [slug]);

  const handleHeart = useCallback(async () => {
    if (hearted) return;
    setHearted(true);
    setAnimating(true);
    setCount((c) => c + 1);
    setTimeout(() => setAnimating(false), 600);
    try {
      const res = await fetch("/api/church/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        const data = await res.json();
        setCount(data.votes);
      }
    } catch {}
  }, [hearted, slug]);

  return (
    <button
      onClick={handleHeart}
      disabled={hearted}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
        hearted
          ? "border border-rose-300 bg-blush-light text-rose-gold-deep"
          : "border border-rose-200 bg-white text-warm-brown hover:bg-blush-light hover:text-espresso"
      }`}
    >
      <span className={animating ? "heart-pulse" : ""}>
        {hearted ? "❤️" : "🤍"}
      </span>
      {hearted ? "Loved!" : "Love this church"}
      {count > 0 && (
        <span className="ml-1 text-xs text-muted-warm">
          · {count}
        </span>
      )}
    </button>
  );
}
