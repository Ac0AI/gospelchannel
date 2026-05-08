"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import posthog from "posthog-js";
import { ChurchSearchAutocomplete } from "@/components/ChurchSearchAutocomplete";

type ChurchOption = {
  slug: string;
  name: string;
  country: string;
};

type Props = {
  churches?: ChurchOption[];
  surpriseSlugs?: string[];
  variant?: "hero" | "page";
};

export function HeroSearch({ churches = [], surpriseSlugs = [], variant = "hero" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const canSurprise = surpriseSlugs.length > 0 || churches.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    posthog.capture("church_searched", { query: q, variant });
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
        <ChurchSearchAutocomplete
          value={query}
          onValueChange={setQuery}
          onSuggestionSelect={(suggestion, selectedQuery) => {
            posthog.capture("church_search_result_selected", {
              church_slug: suggestion.slug,
              church_name: suggestion.title,
              query: selectedQuery,
              variant,
            });
          }}
          containerClassName="relative min-w-0 flex-1"
          placeholder="Search churches..."
          inputClassName={`w-full bg-transparent py-4 pl-3 pr-2 text-base outline-none ${
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

    </div>
  );
}
