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

function CardItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-linen/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-warm">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-[11px] text-espresso leading-tight">{value}</p>
    </div>
  );
}

type MergedProfile = Record<string, unknown>;

// Realistic sample data used for mock fields on the "enriched" side
const SAMPLE_HERO = "https://media.gospelchannel.com/heroes/south-hill-evangelical-church.jpg";

const SAMPLE = {
  pastorName: "Pastor Example",
  pastorTitle: "Senior Pastor",
  pastorWelcome: "Whether it's your first visit or your fiftieth, we're so glad you're here. Our church is a place where real people figuring life out come together to worship, learn, and belong. No dress code, no pressure. Just come as you are.",
  whatToExpect: "About 90 minutes of worship and teaching. Dress is casual. Kids welcome, with a staffed kids area during service.",
  serviceDuration: 90,
  parking: "Free street parking nearby. Wheelchair accessible.",
  tags: ["Families", "Young adults", "Seekers", "Contemporary worship"],
  faq: [
    { q: "What should I wear?", a: "Most people dress casually." },
    { q: "Do you have programs for kids?", a: "Yes, staffed kids area during service." },
    { q: "Is there parking?", a: "Free street parking and wheelchair access." },
  ],
};

function MockCurrentProfile({
  church,
  data,
}: {
  church: { name: string; description?: string; country?: string };
  data: MergedProfile;
}) {
  const description = data.description as string | undefined;
  const denomination = data.denomination as string | undefined;
  const city = data.city as string | undefined;
  const streetAddress = data.streetAddress as string | undefined;
  const pastorName = data.pastorName as string | undefined;
  const serviceDurationMinutes = data.serviceDurationMinutes as number | undefined;
  const hasAny = description || pastorName || serviceDurationMinutes;

  return (
    <div className="space-y-2.5 opacity-90">
      {/* Plain hero (no image, just name) */}
      <div className="rounded-xl border border-rose-200/30 bg-linen-deep/60 p-4">
        <p className="font-serif text-base font-bold text-warm-brown">{church.name}</p>
        {(denomination || city || streetAddress) && (
          <p className="mt-0.5 text-[11px] text-muted-warm">
            {denomination && getProfileOptionLabel(denomination)}
            {denomination && (city || church.country) && " · "}
            {city || church.country}
          </p>
        )}
      </div>

      {description && (
        <div className="rounded-xl border border-rose-200/30 bg-white/60 p-3">
          <p className="line-clamp-3 text-[11px] leading-relaxed text-warm-brown">{description}</p>
        </div>
      )}

      {pastorName && (
        <div className="rounded-xl border border-rose-200/30 bg-white/60 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-warm">Pastor</p>
          <p className="text-xs text-warm-brown">{pastorName}</p>
        </div>
      )}

      {!hasAny && (
        <div className="rounded-xl border-2 border-dashed border-rose-gold/20 bg-linen-deep/30 p-4 text-center">
          <p className="text-xs italic text-muted-warm">That&apos;s pretty much all visitors see right now.</p>
        </div>
      )}

      <div className="rounded-xl border border-rose-200/30 bg-white/40 p-3 text-center">
        <p className="text-[10px] italic text-muted-warm/70">No hero image · No music player · No visitor info</p>
      </div>
    </div>
  );
}

function MockEnrichedProfile({
  church,
  data,
}: {
  church: { name: string; description?: string; country?: string };
  data: MergedProfile;
}) {
  const description = (data.description as string | undefined) || "A welcoming community of faith in the heart of the city. Come experience worship, teaching, and genuine community with people who are figuring life out together.";
  const denomination = data.denomination as string | undefined;
  const city = data.city as string | undefined;
  const streetAddress = data.streetAddress as string | undefined;
  const pastorName = (data.pastorName as string | undefined) || SAMPLE.pastorName;
  const pastorTitle = (data.pastorTitle as string | undefined) || SAMPLE.pastorTitle;
  const pastorWelcome = SAMPLE.pastorWelcome; // Always use the warm sample welcome text
  const coverImageUrl = (data.coverImageUrl as string | undefined) || SAMPLE_HERO;
  const whatToExpect = (data.whatToExpect as string | undefined) || SAMPLE.whatToExpect;
  const serviceDuration = (data.serviceDurationMinutes as number | undefined) || SAMPLE.serviceDuration;
  const parking = (data.parkingInfo as string | undefined) || SAMPLE.parking;
  const languages = data.languages as string[] | undefined;
  const tags = ((data.goodFitTags as string[] | undefined) && (data.goodFitTags as string[]).length > 0)
    ? (data.goodFitTags as string[])
    : SAMPLE.tags;
  const faq = ((data.visitorFaq as { question: string; answer: string }[] | undefined) && (data.visitorFaq as { question: string; answer: string }[]).length > 0)
    ? (data.visitorFaq as { question: string; answer: string }[])
    : SAMPLE.faq.map(f => ({ question: f.q, answer: f.a }));

  return (
    <div className="space-y-3">
      {/* Hero with real mock image */}
      <div className="overflow-hidden rounded-xl border border-rose-200/40 shadow-sm">
        <div className="relative flex h-36 items-end p-3 sm:h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0e09] via-[#1a0e09]/60 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgba(26,14,9,0.7)_0%,transparent_70%)]" />
          <div className="relative">
            <p className="font-serif text-lg font-bold text-white drop-shadow-sm">{church.name}</p>
            {(denomination || city || streetAddress) && (
              <p className="mt-0.5 text-[11px] text-white/95">
                {denomination && getProfileOptionLabel(denomination)}
                {denomination && (city || church.country) && " · "}
                {city || church.country}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm">About</p>
        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-espresso">{description}</p>
      </div>

      {/* Word from the team */}
      <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm">Word from the team</p>
        <div className="mt-2 flex items-start gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blush via-rose-gold/60 to-rose-gold-deep text-sm font-bold text-white shadow-sm">
            {pastorName.split(" ").map(p => p[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-espresso">{pastorName}</p>
            <p className="text-[9px] text-muted-warm">{pastorTitle}</p>
            <p className="mt-1.5 text-[11px] italic leading-relaxed text-espresso/80 line-clamp-3">
              &ldquo;{pastorWelcome}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Your visit at a glance */}
      <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm">Your visit at a glance</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <CardItem
            icon={<svg className="h-2.5 w-2.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/></svg>}
            label="What to expect"
            value={whatToExpect.slice(0, 55) + (whatToExpect.length > 55 ? "…" : "")}
          />
          <CardItem
            icon={<svg className="h-2.5 w-2.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            label="Service length"
            value={`${serviceDuration} min`}
          />
          <CardItem
            icon={<svg className="h-2.5 w-2.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="8" rx="1"/></svg>}
            label="Parking"
            value={parking.slice(0, 40) + (parking.length > 40 ? "…" : "")}
          />
          <CardItem
            icon={<svg className="h-2.5 w-2.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/></svg>}
            label="Languages"
            value={languages && languages.length > 0 ? languages.map(l => getProfileOptionLabel(l)).join(", ") : "Swedish, English"}
          />
        </div>
      </div>

      {/* Mock Spotify embed */}
      <div className="overflow-hidden rounded-xl border border-rose-200/40 bg-[#1a0e09] p-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1db954] to-[#169c46] text-white">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.41c-.2.31-.61.41-.92.21-2.52-1.54-5.69-1.89-9.42-1.04-.36.08-.72-.14-.8-.5s.14-.72.5-.8c4.08-.93 7.58-.53 10.41 1.2.31.2.41.61.21.93zm1.22-2.72c-.25.38-.76.51-1.15.26-2.89-1.77-7.29-2.29-10.7-1.25-.43.13-.89-.11-1.02-.54s.11-.89.54-1.02c3.9-1.18 8.74-.6 12.06 1.44.4.24.52.76.27 1.11z"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Worship playlist</p>
            <p className="truncate text-xs font-semibold text-white">{church.name} — Sunday Worship</p>
            <p className="mt-0.5 text-[10px] text-white/50">12 songs · Spotify + Apple Music</p>
          </div>
          <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Play">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>

      {/* Good fit for */}
      <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm">Good fit for</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 5).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-blush-light/70 px-2 py-0.5 text-[10px] font-medium text-warm-brown">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Visitor FAQ */}
      <div className="rounded-xl border border-rose-200/40 bg-white/80 p-3 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm">Common questions</p>
        <div className="mt-2 space-y-1.5">
          {faq.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center justify-between border-b border-rose-200/20 pb-1 last:border-0 last:pb-0">
              <p className="text-[11px] font-medium text-espresso">{item.question}</p>
              <svg className="h-3 w-3 text-muted-warm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            </div>
          ))}
        </div>
      </div>
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
            <div className="rounded-2xl bg-linen-deep/40 p-4">
              <MockCurrentProfile church={church} data={mergedProfile} />
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
              <MockEnrichedProfile church={church} data={mergedProfile} />
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
