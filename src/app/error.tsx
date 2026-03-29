"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blush-light">
          <svg className="h-7 w-7 text-rose-gold/40" viewBox="0 0 24 24" fill="currentColor">
            <rect x="10.5" y="2" width="3" height="20" rx="1.5" />
            <rect x="4" y="7.5" width="16" height="3" rx="1.5" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl font-semibold text-espresso">
          Something Went Wrong
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-warm-brown">
          We hit an unexpected note. The page you were looking for couldn&apos;t load right now.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-full border border-rose-200 bg-white/70 px-6 py-3 text-sm font-semibold text-warm-brown backdrop-blur-sm transition-all duration-200 hover:border-blush hover:bg-blush-light"
          >
            Back to Home
          </Link>
        </div>
        <p className="mt-8 text-xs italic text-muted-warm">
          &ldquo;The Lord is close to the brokenhearted.&rdquo; — Psalm 34:18
        </p>
      </div>
    </div>
  );
}
