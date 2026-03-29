"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/church", label: "Churches" },
  { href: "/tools", label: "Free Tools" },
  { href: "/prayerwall", label: "Share a Prayer" },
  { href: "/about", label: "About" },
];

const COOKIE_NAME = "my_church";

function getMyChurchSlug(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

const subscribe = () => () => {};

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const myChurchSlug = useSyncExternalStore(subscribe, getMyChurchSlug, () => "");

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    window.addEventListener("popstate", closeMenu);
    return () => window.removeEventListener("popstate", closeMenu);
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeMenu]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-rose-200/60 bg-linen/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" prefetch={false} className="flex items-center gap-2">
          <svg className="h-5 w-5 text-rose-gold/40" viewBox="0 0 24 24" fill="currentColor">
            <rect x="10.5" y="2" width="3" height="20" rx="1.5" />
            <rect x="4" y="7.5" width="16" height="3" rx="1.5" />
          </svg>
          <span className="font-serif text-xl font-semibold tracking-tight text-espresso">
            Gospel<span className="text-rose-gold italic">Channel</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-3 md:flex">
          <nav className="items-center gap-1 text-sm font-medium text-warm-brown md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`rounded-full px-3 py-2 transition-all duration-200 hover:bg-blush-light hover:text-espresso ${
                  isActive(item.href) ? "bg-blush-light text-espresso" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {myChurchSlug && (
            <Link
              href={`/church/${myChurchSlug}`}
              prefetch={false}
              className="rounded-full border border-rose-200/60 bg-white px-3 py-2 text-sm font-medium text-rose-gold transition-colors hover:bg-blush-light"
              title="Your saved church"
            >
              My Church
            </Link>
          )}
          <Link
            href="/church/suggest"
            prefetch={false}
            className="rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md"
          >
            Add Your Church
          </Link>
        </div>

        {/* Mobile: My Church shortcut + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          {myChurchSlug && (
            <Link
              href={`/church/${myChurchSlug}`}
              prefetch={false}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-200/60 bg-white text-rose-gold transition-colors hover:bg-blush-light"
              title="Your saved church"
              aria-label="Go to your saved church"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="relative z-50 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-blush-light"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <div className="flex w-5 flex-col items-center gap-[5px]">
              <span
                className={`block h-[2px] w-5 rounded-full bg-espresso transition-all duration-300 ${
                  open ? "translate-y-[7px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-[2px] w-5 rounded-full bg-espresso transition-all duration-300 ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-[2px] w-5 rounded-full bg-espresso transition-all duration-300 ${
                  open ? "-translate-y-[7px] -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-espresso/30 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={closeMenu}
            aria-hidden="true"
          />

          <nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            className="fixed top-0 right-0 z-[45] flex h-dvh w-full flex-col bg-linen shadow-xl transition-transform duration-300 md:hidden sm:w-72"
            style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
          >
            <div className="flex items-center justify-between border-b border-rose-200/60 px-6 py-5">
              <span className="font-serif text-lg font-semibold text-espresso">
                Menu
              </span>
              <button
                type="button"
                onClick={closeMenu}
                className="flex h-8 w-8 items-center justify-center rounded-full text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
                aria-label="Close menu"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={closeMenu}
                  className={`flex items-center rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-200 hover:bg-blush-light/60 hover:text-espresso ${
                    isActive(item.href) ? "bg-blush-light/60 text-espresso" : "text-warm-brown"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {myChurchSlug && (
                <Link
                  href={`/church/${myChurchSlug}`}
                  prefetch={false}
                  onClick={closeMenu}
                  className="flex items-center gap-2 rounded-xl px-4 py-3.5 text-base font-medium text-rose-gold transition-all duration-200 hover:bg-blush-light/60"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  My Church
                </Link>
              )}
              <Link
                href="/church/suggest"
                prefetch={false}
                onClick={closeMenu}
                className="mt-3 flex items-center justify-center rounded-xl bg-rose-gold px-4 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:bg-rose-gold-deep"
              >
                Add Your Church
              </Link>
            </div>

            <div className="border-t border-rose-200/60 px-6 py-4">
              <Link
                href="/for-churches"
                prefetch={false}
                onClick={closeMenu}
                className="text-xs font-medium text-warm-brown transition-colors hover:text-espresso"
              >
                For church teams →
              </Link>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
