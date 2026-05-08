import type { Metadata } from "next";
import Link from "next/link";
import { SuggestChurchForm } from "@/components/SuggestChurchForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add Your Church",
  description:
    "Give your church a page on GospelChannel. Share your playlist, website, and contact details - and help people discover your community.",
  alternates: { canonical: "https://gospelchannel.com/church/suggest" },
};

export default function SuggestChurchPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-5 pt-14 sm:px-12 sm:pt-16">
        <div className="mx-auto max-w-[1100px]">
          <p className="gc-eyebrow">Add a new church</p>
          <h1
            className="mt-3.5 m-0 font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 6vw, 60px)" }}
          >
            Tell us about your <em className="gc-italic">church</em>.
          </h1>
          <p className="mt-4 max-w-[480px] text-base leading-relaxed text-warm-brown sm:text-lg">
            The basics now, polish later. We&rsquo;ll review and publish within 24 hours. You can claim it as the official admin afterward.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pt-12 pb-20 sm:px-12 sm:pt-14">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          {/* Form */}
          <div>
            <SuggestChurchForm />
            <p className="mt-6 text-xs leading-relaxed text-muted-warm">
              By submitting you agree to our editorial review. We&rsquo;ll email you within 24 hours.
            </p>
          </div>

          {/* Sticky side rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6">
              <div className="rounded-[18px] border border-rose-gold/[0.14] bg-white p-7 shadow-[var(--shadow-sm)]">
                <p className="gc-eyebrow">What happens next?</p>
                <ol className="mt-3.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-warm-brown">
                  <li>We review for spam &mdash; usually within 24h</li>
                  <li>The page goes live with a &ldquo;Listed by community&rdquo; tag</li>
                  <li>You (or someone at the church) can claim it to verify</li>
                </ol>
              </div>

              <div
                className="rounded-[18px] p-7"
                style={{ background: "var(--linen-deep)" }}
              >
                <p className="gc-eyebrow">What helps approval faster</p>
                <ul className="mt-3.5 space-y-2 text-sm leading-relaxed text-warm-brown">
                  <li>Spotify playlist URL</li>
                  <li>Official website domain</li>
                  <li>Contact email from the church</li>
                  <li>City &amp; country</li>
                  <li>Short description of the worship sound</li>
                </ul>
              </div>

              <div className="rounded-[18px] border border-rose-gold/[0.14] bg-white p-7">
                <p className="gc-eyebrow">Already in the catalog?</p>
                <h3 className="mt-2.5 font-serif text-xl font-semibold tracking-[-0.01em] text-espresso">
                  Claim it instead of submitting a duplicate.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-warm-brown">
                  If your church already has a page, open it and use the claim flow there. That&rsquo;s the cleanest path for corrections and ownership signals.
                </p>
                <Link
                  href="/church"
                  prefetch={false}
                  className="mt-4 inline-flex rounded-full border border-rose-gold/30 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:bg-rose-gold/[0.06]"
                >
                  Browse church pages &rarr;
                </Link>
              </div>
            </div>
          </aside>
        </div>

        <p className="mt-16 text-center font-serif text-sm italic text-muted-warm">
          &ldquo;For where two or three gather in my name, there am I with them.&rdquo; &mdash; Matthew 18:20
        </p>
      </section>
    </>
  );
}
