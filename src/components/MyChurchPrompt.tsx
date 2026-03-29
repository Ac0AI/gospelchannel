"use client";

import { useCallback, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";

type ChurchOption = {
  slug: string;
  name: string;
  country: string;
  thumbnailUrl?: string;
  logoUrl?: string;
};

const COOKIE_NAME = "my_church";
const DISMISSED_COOKIE = "my_church_dismissed";
const SERVER_SNAPSHOT = "__server__";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function subscribeToCookieSnapshot() {
  return () => {};
}

function readCookieSnapshot() {
  const slug = getCookie(COOKIE_NAME) ?? "";
  const wasDismissed = getCookie(DISMISSED_COOKIE) === "1" ? "1" : "0";
  return `${slug}::${wasDismissed}`;
}

export function MyChurchPrompt({ churches }: { churches: ChurchOption[] }) {
  const [cookieVersion, refreshCookieSnapshot] = useReducer((count: number) => count + 1, 0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const cookieSnapshot = useSyncExternalStore(
    subscribeToCookieSnapshot,
    () => {
      void cookieVersion;
      return readCookieSnapshot();
    },
    () => SERVER_SNAPSHOT,
  );
  const [savedSlugValue, dismissedValue] =
    cookieSnapshot === SERVER_SNAPSHOT ? ["", "1"] : cookieSnapshot.split("::");
  const savedSlug = savedSlugValue || null;
  const dismissed = savedSlug !== null || dismissedValue === "1";

  const filtered = useMemo(() => {
    if (!query.trim()) return churches.slice(0, 6);
    const q = query.toLowerCase();
    return churches
      .filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .slice(0, 6);
  }, [churches, query]);

  const savedChurch = useMemo(
    () => (savedSlug ? churches.find((c) => c.slug === savedSlug) : null),
    [savedSlug, churches],
  );

  const selectChurch = useCallback((slug: string) => {
    setCookie(COOKIE_NAME, slug, 365);
    refreshCookieSnapshot();
    setOpen(false);
  }, []);

  const dismiss = useCallback(() => {
    setCookie(DISMISSED_COOKIE, "1", 30);
    refreshCookieSnapshot();
  }, []);

  if (cookieSnapshot === SERVER_SNAPSHOT) return null;

  // Returning user with saved church — compact shortcut
  if (savedChurch) {
    return (
      <section className="rounded-2xl border border-rose-200/60 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          {savedChurch.thumbnailUrl ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-rose-200/60">
              <Image src={savedChurch.thumbnailUrl} alt={savedChurch.name} fill className="object-cover" sizes="40px" />
            </div>
          ) : savedChurch.logoUrl ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-rose-200/60 bg-white">
              <Image src={savedChurch.logoUrl} alt={savedChurch.name} fill className="object-contain p-1.5" sizes="40px" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush-light text-xs font-bold text-rose-gold">
              {savedChurch.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-espresso">{savedChurch.name}</h3>
            <p className="text-xs text-warm-brown">{savedChurch.country}</p>
          </div>
          <Link
            href={`/church/${savedChurch.slug}`}
            className="shrink-0 rounded-full bg-rose-gold px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-gold-deep"
          >
            Play
          </Link>
        </div>
      </section>
    );
  }

  // First visit — prompt (unless dismissed)
  if (dismissed) return null;

  return (
    <section className="rounded-2xl border border-blush bg-gradient-to-r from-blush-light/40 to-mauve-light/20 px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mauve">Personalize</p>
          <h3 className="mt-1 font-serif text-base font-semibold text-espresso">What&apos;s your church?</h3>
          <p className="mt-1 text-sm text-warm-brown">Pick it once and jump straight back to its page on later visits.</p>
        </div>
        <button
          onClick={dismiss}
          className="text-xs text-muted-warm transition-colors hover:text-espresso"
          aria-label="Not now"
        >
          Not now
        </button>
      </div>

      <div className="relative mt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search churches..."
          className="w-full rounded-full border border-rose-200/60 bg-white/80 py-2.5 pl-4 pr-10 text-sm text-espresso placeholder:text-muted-warm/60 shadow-sm transition-colors focus:border-blush focus:outline-none focus:ring-2 focus:ring-blush/30"
        />
        {open && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-rose-200/60 bg-white shadow-lg">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-warm">No churches found</li>
            ) : (
              filtered.map((church) => (
                <li key={church.slug}>
                  <button
                    type="button"
                    onClick={() => selectChurch(church.slug)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blush-light"
                  >
                    {church.thumbnailUrl ? (
                      <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg">
                        <Image src={church.thumbnailUrl} alt={church.name} fill className="object-cover" sizes="48px" />
                      </div>
                    ) : church.logoUrl ? (
                      <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                        <Image src={church.logoUrl} alt={church.name} fill className="object-contain p-1" sizes="48px" />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-espresso">{church.name}</p>
                      <p className="text-xs text-muted-warm">{church.country}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
