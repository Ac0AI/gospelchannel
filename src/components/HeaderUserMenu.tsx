"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

function getMyChurchSlug(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )my_church=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function UserInitials({ name, email }: { name: string; email: string }) {
  const display = name || email;
  const parts = display.split(/[\s@]+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : display.slice(0, 2).toUpperCase();
  return <>{initials}</>;
}

export function HeaderUserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, close]);

  if (isPending || !session?.user) return null;

  const user = session.user;
  const churchSlug = getMyChurchSlug();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      close();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-gold text-xs font-bold tracking-wide text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-gold/40 focus:ring-offset-2 focus:ring-offset-linen"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        title={user.email}
      >
        <UserInitials name={user.name} email={user.email} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right animate-fade-in rounded-2xl border border-rose-200/60 bg-linen shadow-lg shadow-espresso/8"
          role="menu"
        >
          <div className="border-b border-rose-200/40 px-4 py-3">
            <p className="truncate text-sm font-semibold text-espresso">
              {user.name || "Church Admin"}
            </p>
            <p className="truncate text-xs text-warm-brown/70">{user.email}</p>
          </div>

          <div className="p-1.5">
            {churchSlug && (
              <Link
                href={`/church/${churchSlug}/manage`}
                onClick={close}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
                role="menuitem"
              >
                <svg className="h-4 w-4 shrink-0 text-rose-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                Manage Church
              </Link>
            )}

            {churchSlug && (
              <Link
                href={`/church/${churchSlug}`}
                onClick={close}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
                role="menuitem"
              >
                <svg className="h-4 w-4 shrink-0 text-rose-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Church Page
              </Link>
            )}

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso disabled:opacity-50"
              role="menuitem"
            >
              <svg className="h-4 w-4 shrink-0 text-rose-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              {signingOut ? "Signing out\u2026" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HeaderUserMenuMobile({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  if (isPending || !session?.user) return null;

  const user = session.user;
  const churchSlug = getMyChurchSlug();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      onNavigate?.();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="border-t border-rose-200/40 px-4 py-3">
      <div className="mb-2 flex items-center gap-3 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-gold text-xs font-bold text-white">
          <UserInitials name={user.name} email={user.email} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-espresso">{user.name || "Church Admin"}</p>
          <p className="truncate text-xs text-warm-brown/60">{user.email}</p>
        </div>
      </div>

      {churchSlug && (
        <Link
          href={`/church/${churchSlug}/manage`}
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-blush-light/60 hover:text-espresso"
        >
          Manage Church
        </Link>
      )}

      {churchSlug && (
        <Link
          href={`/church/${churchSlug}`}
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-blush-light/60 hover:text-espresso"
        >
          View Church Page
        </Link>
      )}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-warm-brown transition-colors hover:bg-blush-light/60 hover:text-espresso disabled:opacity-50"
      >
        {signingOut ? "Signing out\u2026" : "Sign out"}
      </button>
    </div>
  );
}
