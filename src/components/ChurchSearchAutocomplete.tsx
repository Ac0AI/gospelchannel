"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SearchSuggestion = {
  id: string;
  type: "church";
  title: string;
  subtitle?: string;
  slug: string;
  href: string;
};

type SuggestionPayload = {
  suggestions?: SearchSuggestion[];
};

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  maxResults?: number;
  debounceMs?: number;
  minQueryLength?: number;
  containerClassName?: string;
  inputClassName?: string;
  panelClassName?: string;
  extraSearchParams?: Record<string, string | undefined>;
  onValueChange?: (value: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion, query: string) => void;
};

type CachedSuggestions = {
  expiresAt: number;
  suggestions: SearchSuggestion[];
};

const CLIENT_CACHE_MS = 60_000;
const clientSuggestionCache = new Map<string, CachedSuggestions>();

function normalizeCacheKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildSearchHref(query: string, extraParams?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) params.set(key, value);
  }
  if (query.trim()) params.set("q", query.trim());
  const qs = params.toString();
  return qs ? `/church?${qs}` : "/church";
}

export function ChurchSearchAutocomplete({
  name = "q",
  value,
  defaultValue = "",
  placeholder = "Search churches...",
  maxResults = 8,
  debounceMs = 250,
  minQueryLength = 2,
  containerClassName = "relative min-w-0 flex-1",
  inputClassName = "w-full bg-transparent outline-none",
  panelClassName = "",
  extraSearchParams,
  onValueChange,
  onSuggestionSelect,
}: Props) {
  const router = useRouter();
  const [internalValue, setInternalValue] = useState(() => defaultValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value ?? internalValue;
  const trimmedQuery = query.trim();
  const searchHref = useMemo(() => buildSearchHref(trimmedQuery, extraSearchParams), [trimmedQuery, extraSearchParams]);
  const showPanel = open && trimmedQuery.length >= minQueryLength && (loading || suggestions.length > 0);

  useEffect(() => {
    const cacheKey = normalizeCacheKey(trimmedQuery);

    if (cacheKey.length < minQueryLength) {
      return;
    }

    const cached = clientSuggestionCache.get(`${cacheKey}:${maxResults}`);
    if (cached && cached.expiresAt > Date.now()) {
      const timeout = window.setTimeout(() => {
        setSuggestions(cached.suggestions);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search/suggest?q=${encodeURIComponent(cacheKey)}&limit=${maxResults}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Suggest request failed: ${response.status}`);
          return (await response.json()) as SuggestionPayload;
        })
        .then((payload) => {
          const nextSuggestions = payload.suggestions ?? [];
          clientSuggestionCache.set(`${cacheKey}:${maxResults}`, {
            expiresAt: Date.now() + CLIENT_CACHE_MS,
            suggestions: nextSuggestions,
          });
          setSuggestions(nextSuggestions);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [debounceMs, maxResults, minQueryLength, trimmedQuery]);

  function setNextValue(nextValue: string) {
    setActiveIndex(-1);
    setSuggestions([]);
    setLoading(false);
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function selectSuggestion(suggestion: SearchSuggestion) {
    setOpen(false);
    onSuggestionSelect?.(suggestion, trimmedQuery);
    router.push(suggestion.href);
  }

  return (
    <div className={containerClassName}>
      <input
        type="search"
        name={name}
        value={query}
        onChange={(event) => {
          setNextValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        onKeyDown={(event) => {
          if (!showPanel) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(suggestions.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(-1, index - 1));
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
        placeholder={placeholder}
        className={inputClassName}
      />

      {showPanel ? (
        <div
          className={`absolute left-0 right-0 top-full z-40 mt-3 overflow-hidden rounded-2xl border border-rose-200/60 bg-white shadow-xl ${panelClassName}`}
        >
          {suggestions.length > 0 ? (
            <ul>
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.type}:${suggestion.id}`}>
                  <Link
                    href={suggestion.href}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setOpen(false);
                      onSuggestionSelect?.(suggestion, trimmedQuery);
                    }}
                    className={`block px-4 py-3 transition-colors ${
                      index === activeIndex ? "bg-blush-light" : "hover:bg-blush-light"
                    }`}
                  >
                    <span className="block truncate text-sm font-semibold text-espresso">{suggestion.title}</span>
                    {suggestion.subtitle ? (
                      <span className="mt-0.5 block truncate text-xs text-warm-brown">{suggestion.subtitle}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : loading ? (
            <div className="px-4 py-3 text-sm text-muted-warm">Searching...</div>
          ) : null}

          <Link
            href={searchHref}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen(false)}
            className="block border-t border-rose-200/40 px-4 py-3 text-center text-xs font-semibold text-rose-gold transition-colors hover:bg-blush-light"
          >
            See all results
          </Link>
          <Link
            href="/church/suggest"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen(false)}
            className="block border-t border-rose-200/40 px-4 py-3 text-center text-xs text-muted-warm transition-colors hover:bg-blush-light hover:text-rose-gold"
          >
            Can&apos;t find your church? <span className="font-semibold text-rose-gold">Suggest it</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
