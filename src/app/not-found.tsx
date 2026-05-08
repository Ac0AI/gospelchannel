import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-5 py-24 sm:px-12">
      <div className="relative mx-auto max-w-[920px] text-center">
        {/* Giant ghost 404 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif font-bold leading-[0.85] tracking-[-0.05em] text-rose-gold/[0.18]"
          style={{ fontSize: "clamp(180px, 28vw, 360px)" }}
        >
          404
        </div>
        <div className="relative">
          <p className="gc-eyebrow">Page not found</p>
          <h1
            className="m-0 mt-5 font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(48px, 9vw, 80px)" }}
          >
            You&rsquo;re <em className="gc-italic">lost</em>.
          </h1>
          <p className="mx-auto mt-5 max-w-[480px] text-lg leading-relaxed text-warm-brown sm:text-xl">
            That&rsquo;s a beautiful place to start. We&rsquo;ve all been there. Let&rsquo;s get you somewhere warmer.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-rose-gold px-7 py-3.5 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
            >
              &larr; Home
            </Link>
            <Link
              href="/church"
              className="rounded-full border border-rose-gold/30 px-7 py-3.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Search churches
            </Link>
            <Link
              href="/guides/church-fit-quiz"
              className="rounded-full border border-rose-gold/30 px-7 py-3.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
            >
              Take the fit quiz
            </Link>
          </div>

          <div className="mt-15 border-t border-rose-gold/10 pt-8 sm:mt-16">
            <p className="gc-eyebrow">Or read this verse</p>
            <p className="mx-auto mt-3.5 max-w-[580px] font-serif text-xl italic leading-[1.5] text-warm-brown sm:text-2xl">
              &ldquo;For the Son of Man came to seek and to save the lost.&rdquo;
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.1em] text-muted-warm">
              &mdash; Luke 19:10
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
