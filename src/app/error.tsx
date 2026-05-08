"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-5 py-20 sm:px-12">
      <div className="mx-auto max-w-[560px] text-center">
        <p className="gc-eyebrow">Something went sideways</p>
        <h1
          className="mt-5 m-0 font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
          style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
        >
          Unexpected <em className="gc-italic">note</em>.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-warm-brown sm:text-lg">
          We hit a snag loading this page. Try again, or head home.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Back to home
          </Link>
        </div>
        <p className="mx-auto mt-10 max-w-[440px] font-serif text-base italic leading-relaxed text-muted-warm sm:text-lg">
          &ldquo;The Lord is close to the brokenhearted.&rdquo; &mdash; Psalm 34:18
        </p>
      </div>
    </section>
  );
}
