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
      <section className="mx-auto max-w-[720px] px-5 pt-20 pb-32 text-center sm:px-12">
        <p className="gc-eyebrow">Claim a church</p>
        <h1
          className="mx-auto mt-3.5 m-0 max-w-[14ch] font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
          style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
        >
          Already <em className="gc-italic">claimed</em>.
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-warm-brown sm:text-lg">
          This church has already been claimed and verified by its team.
        </p>
        <Link
          href={`/church/${church.slug}`}
          className="mt-8 inline-flex rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
        >
          &larr; Back to {church.name}
        </Link>
      </section>
    );
  }

  if (hasPending) {
    return (
      <section className="mx-auto max-w-[720px] px-5 pt-20 pb-32 text-center sm:px-12">
        <p className="gc-eyebrow">Claim a church</p>
        <h1
          className="mx-auto mt-3.5 m-0 max-w-[16ch] font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
          style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
        >
          Claim <em className="gc-italic">under review</em>.
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-warm-brown sm:text-lg">
          A claim for this church is already under review. We&rsquo;ll get back within 48 hours.
        </p>
        <Link
          href={`/church/${church.slug}`}
          className="mt-8 inline-flex rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
        >
          &larr; Back to {church.name}
        </Link>
      </section>
    );
  }

  return (
    <>
      {/* Editorial hero */}
      <section className="px-5 pt-14 text-center sm:px-12 sm:pt-16">
        <div className="mx-auto max-w-[720px]">
          <p className="gc-eyebrow">Claim a church &middot; Verify</p>
          <h1
            className="mx-auto mt-3.5 m-0 max-w-[18ch] font-serif font-semibold leading-[1] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 6vw, 64px)" }}
          >
            How should we <em className="gc-italic">verify</em> you?
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-warm-brown sm:text-lg">
            You&rsquo;re claiming <strong className="text-espresso">{church.name}</strong>. Pick a verification path and we&rsquo;ll review within 48 hours.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[720px] px-5 py-12 sm:px-12 sm:py-14">
        <ClaimChurchForm slug={church.slug} churchName={church.name} />
      </section>
    </>
  );
}
