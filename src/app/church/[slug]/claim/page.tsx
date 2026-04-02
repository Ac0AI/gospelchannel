import Link from "next/link";
import { notFound } from "next/navigation";
import { getChurchBySlugAsync } from "@/lib/content";
import { checkChurchClaimed } from "@/lib/church";
import { hasPendingClaimForChurch } from "@/lib/church-community";
import { ClaimChurchForm } from "@/components/ClaimChurchForm";

type ClaimPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;

export default async function ClaimChurchPage({ params }: ClaimPageProps) {
  const { slug } = await params;
  const church = await getChurchBySlugAsync(slug);

  if (!church) {
    notFound();
  }

  const [isClaimed, hasPending] = await Promise.all([
    checkChurchClaimed(church.slug),
    hasPendingClaimForChurch(church.slug),
  ]);

  if (isClaimed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
            <svg className="h-7 w-7 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        <h1 className="mt-5 font-serif text-2xl font-bold text-espresso">Already Claimed</h1>
        <p className="mt-3 text-sm leading-relaxed text-warm-brown">
          This church has already been claimed and verified.
        </p>
        <Link
          href={`/church/${church.slug}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-gold-deep hover:shadow-md"
        >
          ← Back to {church.name}
        </Link>
      </div>
    );
  }

  if (hasPending) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <svg className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h1 className="mt-5 font-serif text-2xl font-bold text-espresso">Claim Under Review</h1>
        <p className="mt-3 text-sm leading-relaxed text-warm-brown">
          A claim for this church is already under review. We'll get back within 48 hours.
        </p>
        <Link
          href={`/church/${church.slug}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-gold-deep hover:shadow-md"
        >
          ← Back to {church.name}
        </Link>
      </div>
    );
  }

  return <ClaimChurchForm slug={church.slug} churchName={church.name} />;
}
