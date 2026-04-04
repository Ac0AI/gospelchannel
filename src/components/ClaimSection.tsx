import Link from "next/link";
import { checkChurchClaimed } from "@/lib/church";
import { ScrollReveal } from "@/components/ScrollReveal";

export async function ClaimInterstitial({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  const isClaimed = await checkChurchClaimed(slug);
  if (isClaimed) return null;

  return (
    <ScrollReveal>
      <Link
        href={`/church/${slug}/claim`}
        className="group relative block overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-r from-linen-deep via-blush-light/40 to-white p-6 shadow-sm transition-all hover:border-rose-gold/30 hover:shadow-md sm:p-8"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-gold/10">
                <svg className="h-4 w-4 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">For church leaders</p>
            </div>
            <h2 className="mt-3 font-serif text-xl font-semibold text-espresso sm:text-2xl">
              Is this your church?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-warm-brown">
              People find this page when they search for churches nearby. Claim it to keep your worship, sermons, and details up to date.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                Verified
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-gold/10 px-2.5 py-1 font-semibold text-rose-gold">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
                Your music
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-gold/10 px-2.5 py-1 font-semibold text-rose-gold">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                Your details
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all group-hover:bg-rose-gold-deep group-hover:shadow-md">
              Claim this page →
            </span>
          </div>
        </div>
      </Link>
    </ScrollReveal>
  );
}

export async function ClaimFooterLink({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  const isClaimed = await checkChurchClaimed(slug);
  if (isClaimed) return null;

  return (
    <Link
      href={`/church/${slug}/claim`}
      className="group flex items-center gap-4 rounded-2xl border border-rose-200/60 bg-gradient-to-r from-white to-blush-light/30 p-5 shadow-sm transition-all hover:border-rose-gold/40 hover:shadow-md sm:p-6"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-gold/10 text-rose-gold transition-colors group-hover:bg-rose-gold/20">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-espresso">Are you part of {displayName}?</p>
        <p className="mt-0.5 text-xs text-warm-brown">Claim this page so you can manage your church&apos;s details, worship, and how visitors find you.</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
        Claim →
      </span>
    </Link>
  );
}
