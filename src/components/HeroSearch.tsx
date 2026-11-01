"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import posthog from "posthog-js";
import { ChurchAskPanel, useChurchChat } from "@/components/ChurchAskPanel";
import { ChurchSearchAutocomplete } from "@/components/ChurchSearchAutocomplete";
import { isConversationalQuery } from "@/lib/church-chat/intent";

type Props = {
  variant?: "hero" | "page";
};

// Example questions under the box. They show that the box takes a sentence,
// and each one is a real fit request the directory can answer.
// Picked where the directory has the data to answer well (2026-11-01: Paris 48
// English-language churches, Berlin 15 charismatic).
const EXAMPLE_QUESTIONS = [
  "English-speaking church in Paris",
  "Charismatic church in Berlin",
  "What happens on a first visit?",
];

// One box, two behaviours: a place or a church name goes straight to the
// directory (what nearly every visitor types), a sentence or question gets an
// answer from the church guide with church cards underneath.
export function HeroSearch({ variant = "hero" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const chat = useChurchChat(variant);
  const isHero = variant === "hero";

  function ask(question: string) {
    posthog.capture("church_searched", { query: question.slice(0, 80), variant, mode: "chat" });
    void chat.ask(question);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (isConversationalQuery(q)) {
      // Blur closes the autocomplete list so it does not cover the answer.
      (document.activeElement as HTMLElement | null)?.blur();
      ask(q);
      return;
    }
    posthog.capture("church_searched", { query: q, variant, mode: "search" });
    router.push(q ? `/church?q=${encodeURIComponent(q)}` : "/church");
  }

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={handleSubmit}
        className={`group/search mx-auto flex max-w-xl items-center gap-0 rounded-full border transition-colors ${
          isHero
            ? "border-white/20 bg-white/15 backdrop-blur-sm focus-within:border-white/40"
            : "border-espresso/12 bg-white shadow-sm focus-within:border-rose-gold focus-within:shadow-md"
        }`}
      >
        <svg
          className={`pointer-events-none ml-5 h-4 w-4 shrink-0 ${isHero ? "text-white/50" : "text-warm-brown/40"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <ChurchSearchAutocomplete
          value={query}
          onValueChange={setQuery}
          onSuggestionSelect={(suggestion, selectedQuery) => {
            posthog.capture("church_search_result_selected", {
              church_slug: suggestion.type === "church" ? suggestion.slug : undefined,
              church_name: suggestion.type === "church" ? suggestion.title : undefined,
              suggestion_type: suggestion.type,
              suggestion_title: suggestion.title,
              suggestion_href: suggestion.href,
              query: selectedQuery,
              variant,
            });
          }}
          containerClassName="relative min-w-0 flex-1"
          placeholder="City, church, or a question…"
          inputClassName={`w-full bg-transparent py-4 pl-3 pr-2 text-base outline-none ${
            isHero
              ? "text-white placeholder:text-white/50"
              : "text-espresso placeholder:text-warm-brown/45"
          }`}
        />
        <button
          type="submit"
          disabled={chat.pending}
          className="mr-1.5 min-h-11 shrink-0 rounded-full bg-rose-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep disabled:opacity-60"
        >
          Find
        </button>
      </form>

      {chat.exchanges.length === 0 ? (
        <ul className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2" aria-label="Example questions">
          {EXAMPLE_QUESTIONS.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => {
                  setQuery(example);
                  ask(example);
                }}
                className="min-h-11 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-sm text-white/90 backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-black/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <ChurchAskPanel
        exchanges={chat.exchanges}
        pending={chat.pending}
        onAsk={ask}
        onClose={chat.reset}
        variant={variant}
        className="mx-auto mt-4 max-w-xl"
      />
    </div>
  );
}
