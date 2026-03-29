import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="relative mx-auto flex min-h-[65vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      {/* Decorative cross formed by thin lines */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"
      >
        <div className="absolute h-full w-px bg-espresso" />
        <div className="absolute h-px w-full bg-espresso" style={{ top: "38%" }} />
      </div>

      <p className="font-sans text-xs font-semibold uppercase tracking-[0.35em] text-muted-warm">
        404
      </p>

      <h1 className="mt-6 font-serif text-4xl font-bold leading-tight text-espresso sm:text-5xl">
        Not all who wander
        <br />
        <span className="italic text-rose-gold">are lost</span>
      </h1>

      <div className="mx-auto mt-8 h-px w-16 bg-blush" />

      <p className="mt-8 max-w-md font-serif text-lg leading-relaxed text-warm-brown italic">
        &ldquo;The Lord is my shepherd; I shall not want.
        <br />
        He makes me lie down in green pastures.
        <br />
        He leads me beside still waters.&rdquo;
      </p>
      <p className="mt-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-muted-warm">
        Psalm 23:1-2
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/"
          className="inline-flex rounded-full bg-rose-gold px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md"
        >
          Find your church
        </Link>
        <Link
          href="/church/suggest"
          className="inline-flex rounded-full border border-blush px-7 py-2.5 text-sm font-semibold text-warm-brown transition-all duration-200 hover:border-rose-gold hover:text-espresso"
        >
          Suggest a church
        </Link>
      </div>
    </div>
  );
}
