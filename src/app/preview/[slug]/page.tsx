import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/neon-client";
import { getChurchBySlugAsync } from "@/lib/content";
import { getChurchEnrichment } from "@/lib/church";
import { getApprovedProfileEditsForChurch, buildMergedProfile } from "@/lib/church-profile";
import { calculateProfileScore } from "@/lib/profile-score";
import { PROFILE_FIELDS } from "@/lib/profile-fields";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Preview your church profile",
};

async function validateToken(slug: string, token: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data } = await sb
    .from<{ slug: string }>("churches")
    .select("slug")
    .eq("slug", slug)
    .eq("claim_preview_token", token)
    .maybeSingle();
  return data != null;
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!token || !(await validateToken(slug, token))) {
    notFound();
  }

  const church = await getChurchBySlugAsync(slug);
  if (!church) notFound();

  const [enrichment, edits] = await Promise.all([
    getChurchEnrichment(slug),
    getApprovedProfileEditsForChurch(slug),
  ]);

  const mergedProfile = buildMergedProfile(enrichment, edits, church);
  const profileScore = calculateProfileScore({ isClaimed: false, mergedData: mergedProfile });
  const scorePercent = Math.round((profileScore.score / 115) * 100);

  // Group missing fields into helpful buckets
  const missingHero = !mergedProfile.coverImageUrl;
  const missingPastor = !mergedProfile.pastorName;
  const missingPastorPhoto = !mergedProfile.pastorPhotoUrl;
  const missingWhatToExpect = !mergedProfile.whatToExpect;
  const missingServiceDuration = !mergedProfile.serviceDurationMinutes;
  const missingParking = !mergedProfile.parkingInfo;
  const missingGoodFit = !mergedProfile.goodFitTags || (mergedProfile.goodFitTags as unknown[]).length === 0;
  const missingFaq = !mergedProfile.visitorFaq || (mergedProfile.visitorFaq as unknown[]).length === 0;
  const missingServiceTimes = !mergedProfile.serviceTimes;
  const missingDescription = !mergedProfile.description || (mergedProfile.description as string).length < 80;

  const missingItems = [
    missingHero && { label: "Hero image", reason: "A wide photo of your church that makes people stop scrolling" },
    missingPastor && { label: "Pastor name & title", reason: "Your team's face and welcome" },
    missingPastorPhoto && !missingPastor && { label: "Pastor photo", reason: "A real person makes the church feel human" },
    missingDescription && { label: "Description", reason: "What makes your church special, in a few sentences" },
    missingWhatToExpect && { label: "What a first visit feels like", reason: "Dress code, service length, kids, parking — the practical stuff" },
    missingServiceTimes && { label: "Service times", reason: "When to come" },
    missingServiceDuration && { label: "Service length", reason: "So visitors know how much time to plan" },
    missingParking && { label: "Parking & accessibility", reason: "Parking info, wheelchair access" },
    missingGoodFit && { label: "Good fit tags", reason: "Who your church is a great fit for" },
    missingFaq && { label: "Visitor FAQ", reason: "Common first-visit questions with your answers" },
  ].filter(Boolean) as { label: string; reason: string }[];

  const filledCount = Object.values(profileScore.fieldScores).filter((f) => f.filled).length;
  const totalCount = Object.keys(profileScore.fieldScores).length;
  const churchUrl = `/church/${slug}`;

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-gold">Preview for {church.name}</p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-espresso sm:text-4xl">
            Your church on GospelChannel
          </h1>
          <p className="mt-3 text-base text-warm-brown">
            This is your live church page. It&apos;s {scorePercent}% complete.
            <br />
            Claim it and add the missing pieces in about 2 minutes.
          </p>
        </div>

        {/* Completeness bar */}
        <div className="mt-8 rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-espresso">Profile completeness</h2>
              <p className="text-sm text-muted-warm">{filledCount} of {totalCount} key fields filled</p>
            </div>
            <span className="font-serif text-4xl font-bold text-rose-gold">{scorePercent}%</span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-rose-200/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-gold to-rose-gold-deep transition-all"
              style={{ width: `${scorePercent}%` }}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/church/${slug}/claim`}
              className="inline-flex items-center rounded-full bg-rose-gold px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-gold-deep"
            >
              Claim this church
            </Link>
            <Link
              href={churchUrl}
              target="_blank"
              className="inline-flex items-center rounded-full border border-rose-200/60 bg-white px-6 py-3 text-sm font-semibold text-rose-gold transition-colors hover:bg-blush-light/40"
            >
              Open full page ↗
            </Link>
          </div>
          <p className="mt-2 text-center text-xs text-muted-warm">Free. Takes about 2 minutes.</p>
        </div>

        {/* Live church page preview */}
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-espresso">Your live page right now</h2>
            <span className="text-xs text-muted-warm">gospelchannel.com/church/{slug}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-rose-200/40 bg-white/60 shadow-sm">
            <iframe
              src={churchUrl}
              className="h-[720px] w-full"
              title={`Live preview of ${church.name} on GospelChannel`}
              loading="lazy"
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-warm">
            Scroll inside the preview to see the whole page. This is exactly what visitors see today.
          </p>
        </div>

        {/* What's missing */}
        {missingItems.length > 0 && (
          <div className="mt-10 rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="font-serif text-xl font-semibold text-espresso">What&apos;s missing</h2>
            <p className="mt-1 text-sm text-muted-warm">Add these and your page tells the full story.</p>
            <ul className="mt-5 space-y-3">
              {missingItems.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-rose-gold/30 text-rose-gold">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-espresso">{item.label}</p>
                    <p className="text-xs text-muted-warm">{item.reason}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 text-center">
              <Link
                href={`/church/${slug}/claim`}
                className="inline-flex items-center rounded-full bg-rose-gold px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-gold-deep"
              >
                Claim this church and fill in the rest
              </Link>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-8 text-center text-xs text-muted-warm">
          GospelChannel is a free church directory. No ads, no tracking, no surprises.
        </div>
      </div>
    </>
  );
}
