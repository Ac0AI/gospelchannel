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
    <div className="relative w-full max-w-lg sm:max-w-xl">
      <form onSubmit={handleSubmit} className={`group/search flex items-center gap-0 rounded-full border transition-colors ${
        isHero
          ? "border-white/20 bg-white/15 backdrop-blur-sm focus-within:border-white/40"
          : "border-espresso/12 bg-white shadow-sm focus-within:border-rose-gold focus-within:shadow-md"
      }`}>
        <svg
          className={`pointer-events-none ml-5 h-4 w-4 shrink-0 ${isHero ? "text-white/50" : "text-warm-brown/40"}`}
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
          className={`min-w-0 flex-1 bg-transparent py-4 pl-3 pr-2 text-base outline-none ${
            isHero
              ? "text-white placeholder:text-white/50"
              : "text-espresso placeholder:text-warm-brown/40"
          }`}
        />
        <button
          type="submit"
          className="mr-1.5 shrink-0 rounded-full bg-rose-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
        >
          Find
        </button>
      </form>
      {canSurprise && (
        <button
          type="button"
          onClick={handleSurprise}
          className={`mt-3 w-full text-center text-sm font-medium tracking-wide ${
            isHero ? "text-white/50 hover:text-white" : "text-warm-brown/50 hover:text-warm-brown"
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
