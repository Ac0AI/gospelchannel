import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/neon-client";
import { getChurchBySlugAsync } from "@/lib/content";
import { getChurchEnrichment } from "@/lib/church";
import { getApprovedProfileEditsForChurch, buildMergedProfile } from "@/lib/church-profile";
import { calculateProfileScore } from "@/lib/profile-score";
import { getProfileOptionLabel } from "@/lib/profile-fields";
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

// Compact section: rendered with real data if present, ghost if missing
function Ghost({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rose-gold/30 bg-linen-deep/30 px-3 py-2 text-xs italic text-muted-warm">
      {children}
    </div>
  );
}

function CardItem({ icon, label, value, ghost }: { icon: React.ReactNode; label: string; value?: string | null; ghost?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-warm">
        {icon}
        {label}
      </div>
      {value ? (
        <p className="mt-1 text-xs text-espresso">{value}</p>
      ) : ghost ? (
        <p className="mt-1 text-xs italic text-muted-warm/60">{ghost}</p>
      ) : null}
    </div>
  );
}

type MergedProfile = Record<string, unknown>;

function CompactProfile({
  mode,
  church,
  data,
}: {
  mode: "current" | "enriched";
  church: { name: string; description?: string; country?: string };
  data: MergedProfile;
}) {
  const isEnriched = mode === "enriched";
  const pastorName = data.pastorName as string | undefined;
  const pastorTitle = data.pastorTitle as string | undefined;
  const description = data.description as string | undefined;
  const denomination = data.denomination as string | undefined;
  const city = data.city as string | undefined;
  const streetAddress = data.streetAddress as string | undefined;
  const serviceDurationMinutes = data.serviceDurationMinutes as number | undefined;
  const parkingInfo = data.parkingInfo as string | undefined;
  const whatToExpect = data.whatToExpect as string | undefined;
  const languages = data.languages as string[] | undefined;
  const goodFitTags = data.goodFitTags as string[] | undefined;
  const visitorFaq = data.visitorFaq as { question: string; answer: string }[] | undefined;

  const hasAny = description || pastorName || serviceDurationMinutes || parkingInfo || goodFitTags?.length || visitorFaq?.length;

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="overflow-hidden rounded-xl border border-rose-200/40 bg-white/80 backdrop-blur-sm">
        <div className="flex h-24 items-end bg-gradient-to-br from-blush-light via-linen-deep to-blush p-3 sm:h-28">
          <div>
            <p className="font-serif text-base font-bold text-espresso">{church.name}</p>
            {(denomination || streetAddress || city) && (
              <p className="text-[11px] text-warm-brown">
                {denomination && getProfileOptionLabel(denomination)}
                {denomination && (city || streetAddress) && " · "}
                {city || streetAddress?.split(",")[1]?.trim() || church.country}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* About */}
      {description ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">About</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-espresso">{description}</p>
        </div>
      ) : isEnriched ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">About</p>
          <Ghost>A few sentences about what makes your church special</Ghost>
        </div>
      ) : null}

      {/* Word from the team */}
      {pastorName ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Word from the team</p>
          <div className="mt-2 flex items-center gap-2">
            <svg className="h-8 w-8 shrink-0 text-muted-warm/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-espresso">{pastorName}</p>
              {pastorTitle && <p className="text-[10px] text-muted-warm">{pastorTitle}</p>}
            </div>
          </div>
        </div>
      ) : isEnriched ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Word from the team</p>
          <Ghost>Pastor name, title, and photo</Ghost>
        </div>
      ) : null}

      {/* Your visit at a glance */}
      {(hasAny || isEnriched) && (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Your visit at a glance</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {whatToExpect ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/></svg>} label="What to expect" value={whatToExpect.slice(0, 60) + (whatToExpect.length > 60 ? "..." : "")} />
            ) : isEnriched ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/></svg>} label="What to expect" ghost="Casual dress, 75 min..." />
            ) : null}

            {serviceDurationMinutes ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} label="Service length" value={`${serviceDurationMinutes} min`} />
            ) : isEnriched ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} label="Service length" ghost="~90 min" />
            ) : null}

            {parkingInfo ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0"/></svg>} label="Parking" value={parkingInfo.slice(0, 50)} />
            ) : isEnriched ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25"/></svg>} label="Parking" ghost="Free parking nearby" />
            ) : null}

            {languages && languages.length > 0 ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a15 15 0 010 18"/></svg>} label="Languages" value={languages.map(l => getProfileOptionLabel(l)).join(", ")} />
            ) : isEnriched ? (
              <CardItem icon={<svg className="h-3 w-3 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/></svg>} label="Languages" ghost="Swedish, English" />
            ) : null}
          </div>
        </div>
      )}

      {/* Good fit for */}
      {goodFitTags && goodFitTags.length > 0 ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Good fit for</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {goodFitTags.slice(0, 5).map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full bg-blush-light/60 px-2 py-0.5 text-[10px] font-medium text-warm-brown">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : isEnriched ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Good fit for</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {["Families", "Young adults", "Seekers"].map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full border border-dashed border-rose-gold/30 bg-transparent px-2 py-0.5 text-[10px] font-medium italic text-muted-warm/60">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Visitor FAQ */}
      {visitorFaq && visitorFaq.length > 0 ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Common questions</p>
          <div className="mt-2 space-y-1">
            {visitorFaq.slice(0, 3).map((item, i) => (
              <p key={i} className="text-xs font-medium text-espresso">{item.question}</p>
            ))}
          </div>
        </div>
      ) : isEnriched ? (
        <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Common questions</p>
          <Ghost>3-5 questions visitors often ask</Ghost>
        </div>
      ) : null}

      {/* Empty state for "current" when nothing filled */}
      {mode === "current" && !hasAny && (
        <div className="rounded-xl border-2 border-dashed border-rose-gold/20 bg-linen-deep/30 p-4 text-center">
          <p className="text-xs italic text-muted-warm">
            That&apos;s pretty much all visitors see right now.
          </p>
        </div>
      )}
    </div>
  );
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
  const filledCount = Object.values(profileScore.fieldScores).filter((f) => f.filled).length;
  const totalCount = Object.keys(profileScore.fieldScores).length;

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-gold">Private preview for {church.name}</p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-espresso sm:text-4xl">
            Your church on GospelChannel
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-warm-brown">
            See what <span className="font-semibold text-espresso">{church.name}</span> looks like to visitors today,
            and what it could look like with a complete profile.
          </p>
        </div>

        {/* Before / After comparison */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* TODAY */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted-warm/20 text-[10px] font-bold text-muted-warm">
                ✗
              </span>
              <h2 className="font-serif text-lg font-semibold text-muted-warm">Today</h2>
              <span className="text-xs text-muted-warm">(what visitors see now)</span>
            </div>
            <div className="rounded-2xl bg-linen-deep/40 p-4 opacity-90">
              <CompactProfile mode="current" church={church} data={mergedProfile} />
            </div>
          </div>

          {/* WITH FULL PROFILE */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-gold text-[10px] font-bold text-white">
                ✓
              </span>
              <h2 className="font-serif text-lg font-semibold text-rose-gold">With your details</h2>
              <span className="text-xs text-muted-warm">(what&apos;s possible)</span>
            </div>
            <div className="rounded-2xl border-2 border-rose-gold/30 bg-gradient-to-br from-blush-light/30 to-linen p-4 shadow-sm">
              <CompactProfile mode="enriched" church={church} data={mergedProfile} />
            </div>
          </div>
        </div>

        {/* Completeness + CTA */}
        <div className="mt-10 rounded-2xl border-2 border-rose-gold/30 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-espresso">Your profile is {scorePercent}% complete</h2>
              <p className="text-sm text-muted-warm">{filledCount} of {totalCount} key fields filled</p>
            </div>
            <span className="font-serif text-5xl font-bold text-rose-gold">{scorePercent}%</span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-rose-200/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-gold to-rose-gold-deep transition-all"
              style={{ width: `${scorePercent}%` }}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/church/${slug}/claim`}
              className="inline-flex items-center rounded-full bg-rose-gold px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-gold-deep"
            >
              Claim this church and fill in the rest
            </Link>
            <Link
              href={`/church/${slug}`}
              target="_blank"
              className="inline-flex items-center rounded-full border border-rose-200/60 bg-white px-6 py-3 text-sm font-semibold text-rose-gold transition-colors hover:bg-blush-light/40"
            >
              See the real page ↗
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-muted-warm">Free. Takes about 2 minutes.</p>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center text-xs text-muted-warm">
          GospelChannel is a free church directory. No ads, no tracking, no surprises.
        </div>
      </div>
    </>
  );
}
