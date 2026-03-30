"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";

type ChurchOption = {
  slug: string;
  name: string;
  country: string;
  location?: string;
  thumbnailUrl?: string;
  logoUrl?: string;
};

type Props = {
  churches?: ChurchOption[];
  surpriseSlugs?: string[];
  variant?: "hero" | "page";
};

function SearchResultImage({ name, thumbnailUrl, logoUrl }: { name: string; thumbnailUrl?: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();

  if (thumbnailUrl && !failed) {
    return (
      <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailUrl} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }

  if (logoUrl && !failed) {
    return (
      <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-blush-light text-xs font-bold text-rose-gold">
      {initials}
    </div>
  );
}

export function HeroSearch({ churches = [], surpriseSlugs = [], variant = "hero" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const canSurprise = surpriseSlugs.length > 0 || churches.length > 0;

  const results = useMemo(() => {
    const q = deferredQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!q || churches.length === 0) return [];
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return churches
      .filter(
        (c) =>
          norm(c.name).includes(q) ||
          norm(c.country).includes(q) ||
          (c.location ? norm(c.location).includes(q) : false),
      )
      .slice(0, 7);
  }, [churches, deferredQuery]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setOpen(false);
    posthog.capture("church_searched", { query: q, variant, results_count: results.length });
    router.push(q ? `/church?q=${encodeURIComponent(q)}` : "/church");
  }

  const isHero = variant === "hero";

  function handleSurprise() {
    const pool = surpriseSlugs.length > 0 ? surpriseSlugs : churches.map((c) => c.slug);
    const slug = pool[Math.floor(Math.random() * pool.length)];
    posthog.capture("church_surprise_me", { church_slug: slug });
    router.push(`/church/${slug}`);
  }

  return (
    <div className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="group/search relative min-w-0 flex-1">
          {/* Holy shimmer — warm glow that moves slowly around the border */}
          <div className={`pointer-events-none absolute -inset-[2px] rounded-full blur-[2px] transition-opacity group-focus-within/search:opacity-100 ${
            isHero ? "opacity-70" : "opacity-50"
          }`}
            style={{
              background: isHero
                ? "conic-gradient(from var(--shimmer-angle, 0deg), transparent 0%, rgba(255,190,130,0.5) 10%, rgba(255,160,100,0.7) 15%, transparent 25%, transparent 50%, rgba(255,200,150,0.4) 60%, rgba(255,170,120,0.6) 65%, transparent 75%, transparent 100%)"
                : "conic-gradient(from var(--shimmer-angle, 0deg), transparent 0%, rgba(194,120,80,0.5) 10%, rgba(180,100,60,0.7) 15%, transparent 25%, transparent 50%, rgba(194,130,90,0.4) 60%, rgba(180,110,70,0.6) 65%, transparent 75%, transparent 100%)",
              animation: "holy-shimmer 6s linear infinite",
            }}
          />
          <svg
            className={`pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${isHero ? "text-white/50" : "text-warm-brown/50"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Search churches..."
            className={`relative w-full rounded-full py-3 pl-11 pr-4 text-base outline-none transition-colors sm:text-sm ${
              isHero
                ? "border border-white/20 bg-white/15 text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/30 focus:ring-2 focus:ring-amber-200/15"
                : "border border-rose-200/80 bg-white text-espresso shadow-sm placeholder:text-warm-brown/50 focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            }`}
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-full bg-rose-gold px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md"
        >
          Find
        </button>
        {canSurprise && (
          <button
            type="button"
            onClick={handleSurprise}
            className={`hidden shrink-0 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 sm:inline-flex ${
              isHero
                ? "border border-white/20 text-white/70 backdrop-blur-sm hover:bg-white/10 hover:text-white"
                : "border border-rose-200/80 text-warm-brown hover:bg-blush-light hover:text-espresso"
            }`}
          >
            Surprise me
          </button>
        )}
      </form>
      {canSurprise && (
        <button
          type="button"
          onClick={handleSurprise}
          className={`mt-2 text-xs font-medium sm:hidden ${
            isHero ? "text-white/60 hover:text-white" : "text-warm-brown hover:text-espresso"
          }`}
        >
          or surprise me →
        </button>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-rose-200/60 bg-white shadow-lg">
          <ul>
            {results.map((church) => (
              <li key={church.slug}>
                <Link
                  href={`/church/${church.slug}`}
                  onClick={() => {
                    setOpen(false);
                    posthog.capture("church_search_result_selected", { church_slug: church.slug, church_name: church.name, query: query.trim(), variant });
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors first:rounded-t-2xl hover:bg-blush-light"
                >
                  <SearchResultImage name={church.name} thumbnailUrl={church.thumbnailUrl} logoUrl={church.logoUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-espresso">{church.name}</p>
                    <p className="text-xs text-warm-brown">{church.country}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={query.trim() ? `/church?q=${encodeURIComponent(query.trim())}` : "/church"}
            onClick={() => setOpen(false)}
            className="block border-t border-rose-200/40 px-4 py-2.5 text-center text-xs font-semibold text-rose-gold transition-colors hover:bg-blush-light"
          >
            See all results
          </Link>
          <Link
            href="/church/suggest"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 rounded-b-2xl border-t border-rose-200/40 px-4 py-2.5 text-xs text-muted-warm transition-colors hover:bg-blush-light hover:text-rose-gold"
          >
            Can&apos;t find your church?{" "}
            <span className="font-semibold text-rose-gold">Suggest it</span>
          </Link>
        </div>
      )}
    </div>
  );
}
