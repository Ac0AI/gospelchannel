import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/neon-client";
import { getChurchBySlugAsync } from "@/lib/content";
import { getChurchEnrichment } from "@/lib/church";
import { getApprovedProfileEditsForChurch, buildMergedProfile } from "@/lib/church-profile";
import { calculateProfileScore } from "@/lib/profile-score";
import { PROFILE_FIELDS } from "@/lib/profile-fields";
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

  const filledFields = Object.values(profileScore.fieldScores).filter(f => f.filled).length;
  const totalFields = Object.keys(profileScore.fieldScores).length;

  const missingFields = PROFILE_FIELDS.filter(field => {
    const scoreEntry = profileScore.fieldScores[field.name];
    return scoreEntry && !scoreEntry.filled;
  });

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-espresso sm:text-4xl">
            Your church on GospelChannel
          </h1>
          <p className="mt-2 text-lg text-warm-brown">
            See what {church.name} looks like to visitors today, and what it could look like.
          </p>
        </div>

        {/* Before / After comparison */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* TODAY (thin) */}
          <div className="rounded-2xl border-2 border-dashed border-rose-200/60 bg-linen-deep/50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-warm">Today</p>
            <div className="mt-4 space-y-3">
              <h2 className="font-serif text-xl font-semibold text-espresso">{church.name}</h2>
              {church.location && <p className="text-sm text-muted-warm">{church.location}</p>}
              {church.denomination && <p className="text-sm text-muted-warm">{getProfileOptionLabel(church.denomination)}</p>}
              {church.description && (
                <p className="text-sm text-warm-brown line-clamp-3">{church.description}</p>
              )}
              {!church.description && !church.location && (
                <p className="text-sm italic text-muted-warm">That&#39;s all visitors can see right now.</p>
              )}
            </div>
          </div>

          {/* WITH YOUR DETAILS (rich) */}
          <div className="rounded-2xl border-2 border-rose-gold/40 bg-white/90 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-gold">With your details</p>
            <div className="mt-4 space-y-4">
              {/* Mock hero */}
              <div className="h-24 rounded-xl bg-gradient-to-br from-rose-gold/20 to-blush/30 flex items-center justify-center">
                <span className="font-serif text-lg font-semibold text-espresso/60">Hero image</span>
              </div>

              <h2 className="font-serif text-xl font-semibold text-espresso">{church.name}</h2>

              {/* Mock pastor welcome */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted-warm/20" />
                <div>
                  <p className="text-sm font-medium text-espresso">Pastor name</p>
                  <p className="text-xs text-muted-warm">Welcome message</p>
                </div>
              </div>

              {/* Mock Sunday cards */}
              <div className="grid grid-cols-2 gap-2">
                {["Worship style", "Service length", "Languages", "Parking"].map(label => (
                  <div key={label} className="rounded-lg bg-linen/60 px-3 py-2">
                    <p className="text-xs text-muted-warm">{label}</p>
                    <p className="text-sm font-medium text-espresso/60">...</p>
                  </div>
                ))}
              </div>

              {/* Mock Spotify */}
              <div className="h-20 rounded-xl bg-espresso/10 flex items-center justify-center">
                <span className="text-sm text-muted-warm">Spotify player</span>
              </div>

              {/* Mock tags */}
              <div className="flex flex-wrap gap-1.5">
                {["Families", "Young adults", "Seekers"].map(tag => (
                  <span key={tag} className="rounded-full bg-blush-light/60 px-2.5 py-1 text-xs text-warm-brown">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Completeness score */}
        <div className="mt-8 rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-espresso">Profile completeness</h3>
              <p className="text-sm text-muted-warm">{filledFields} of {totalFields} fields filled</p>
            </div>
            <span className="text-2xl font-bold text-rose-gold">{scorePercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-200/30">
            <div
              className="h-full rounded-full bg-rose-gold transition-all"
              style={{ width: `${scorePercent}%` }}
            />
          </div>

          {missingFields.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-espresso">Missing:</p>
              <ul className="mt-1 space-y-1">
                {missingFields.slice(0, 8).map(field => (
                  <li key={field.name} className="flex items-center gap-2 text-sm text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    {field.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href={`/church/${slug}/claim`}
              className="inline-flex items-center rounded-full bg-rose-gold px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-gold-deep"
            >
              Claim this church and fill in the rest
            </Link>
            <p className="mt-2 text-xs text-muted-warm">Free. Takes about 2 minutes.</p>
          </div>
        </div>
      </div>
    </>
  );
}
