import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Link from "next/link";
import { createAdminClient, hasSupabaseServiceConfig } from "@/lib/neon-client";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  AdminCandidatesPanel,
  type AdminCandidateRecord,
  type AdminCandidateScreening,
} from "@/components/admin/AdminCandidatesPanel";
import type { ChurchCandidate, ChurchPlaylistReview } from "@/types/gospel";

type RawScreeningRow = {
  slug: string;
  name?: string;
  verdict?: string;
  notes?: string;
  website_input_url?: string;
  website_final_url?: string;
  website_title?: string;
  website_description?: string;
  website_emails?: string | string[];
  website_church_score?: number;
  verified_playlist_count?: number;
  verified_playlist_ids?: string | string[];
  verified_playlist_names?: string | string[];
  verified_playlist_owners?: string | string[];
  verified_playlist_scores?: string | string[];
  verified_playlist_urls?: string | string[];
  verified_playlists?: Array<{
    id: string;
    name?: string;
    owner?: string;
    score?: number;
    url?: string;
  }>;
  quality_flags?: string | string[];
  header_image_url?: string;
  social_spotify_urls?: string | string[];
  social_youtube_urls?: string | string[];
  social_instagram_urls?: string | string[];
  location?: string;
  country?: string;
};

type RawPlaylistReviewRow = {
  church_slug: string;
  playlist_id: string;
  status: ChurchPlaylistReview["status"];
};

type CandidateRow = {
  slug: string;
  name: string;
  spotify_owner_id?: string | null;
  spotify_playlist_ids?: string[] | null;
  website?: string | null;
  email?: string | null;
  location?: string | null;
  country?: string | null;
  confidence?: number | null;
  reason?: string | null;
  discovered_at?: string | null;
  created_at?: string | null;
  discovery_source?: ChurchCandidate["discoverySource"] | null;
  source_kind?: ChurchCandidate["sourceKind"] | null;
  candidate_id?: string | null;
  header_image?: string | null;
  status: ChurchCandidate["status"];
};

function splitList(value?: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return String(value || "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toScreening(row: RawScreeningRow): AdminCandidateScreening {
  const ids = splitList(row.verified_playlist_ids);
  const names = splitList(row.verified_playlist_names);
  const owners = splitList(row.verified_playlist_owners);
  const scores = splitList(row.verified_playlist_scores).map((value) => Number(value) || 0);
  const urls = splitList(row.verified_playlist_urls);

  const verifiedPlaylists = Array.isArray(row.verified_playlists) && row.verified_playlists.length > 0
    ? row.verified_playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name || playlist.id,
        owner: playlist.owner || "",
        url: playlist.url || "",
        score: Number(playlist.score || 0),
      }))
    : ids.map((id, index) => ({
        id,
        name: names[index] || id,
        owner: owners[index] || "",
        url: urls[index] || "",
        score: scores[index] || 0,
      }));

  return {
    suggestedName: row.name || "",
    verdict: row.verdict || "",
    notes: row.notes || "",
    websiteInputUrl: row.website_input_url || "",
    websiteFinalUrl: row.website_final_url || "",
    websiteTitle: row.website_title || "",
    websiteDescription: row.website_description || "",
    websiteEmails: splitList(row.website_emails),
    websiteChurchScore: Number(row.website_church_score || 0),
    qualityFlags: splitList(row.quality_flags),
    headerImageUrl: row.header_image_url || "",
    socialSpotifyUrls: splitList(row.social_spotify_urls),
    socialYoutubeUrls: splitList(row.social_youtube_urls),
    socialInstagramUrls: splitList(row.social_instagram_urls),
    location: row.location || "",
    country: row.country || "",
    verifiedPlaylistCount: Number(row.verified_playlist_count || verifiedPlaylists.length || 0),
    verifiedPlaylists,
  };
}

function getDisplayName(candidate: ChurchCandidate, screening?: AdminCandidateScreening): string {
  // DB name (candidate.name) always takes priority -- it may have been
  // manually corrected via the details form. Only use screening name
  // as initial fallback for candidates that haven't been touched yet.
  return candidate.name || screening?.suggestedName || "Unknown";
}

function mapCandidate(row: CandidateRow): ChurchCandidate {
  return {
    slug: row.slug,
    name: row.name,
    spotifyOwnerId: row.spotify_owner_id ?? undefined,
    spotifyPlaylistIds: row.spotify_playlist_ids ?? [],
    website: row.website ?? undefined,
    email: row.email ?? undefined,
    location: row.location ?? undefined,
    country: row.country ?? undefined,
    confidence: row.confidence ?? 1.0,
    reason: row.reason ?? undefined,
    discoveredAt: row.discovered_at ?? row.created_at ?? new Date(0).toISOString(),
    discoverySource: row.discovery_source ?? undefined,
    sourceKind: row.source_kind ?? undefined,
    candidateId: row.candidate_id ?? undefined,
    headerImage: row.header_image ?? undefined,
    status: row.status,
  };
}

async function getCandidates(): Promise<ChurchCandidate[]> {
  if (!hasSupabaseServiceConfig()) {
    return [];
  }

  const supabase = createAdminClient();
  const PAGE_SIZE = 1000;
  const all: ChurchCandidate[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select()
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data) break;
    const pageRows = data as CandidateRow[];
    all.push(...pageRows.map(mapCandidate));
    if (pageRows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

async function getScreeningMap(): Promise<Map<string, AdminCandidateScreening>> {
  const screeningPath = resolve(process.cwd(), "src", "data", "cache", "church-candidate-screening.json");

  try {
    const source = await readFile(screeningPath, "utf8");
    const rows = JSON.parse(source) as RawScreeningRow[];
    return new Map(rows.map((row) => [row.slug, toScreening(row)]));
  } catch {
    return new Map();
  }
}

async function getPlaylistReviewMap(): Promise<Map<string, Record<string, ChurchPlaylistReview["status"]>>> {
  if (!hasSupabaseServiceConfig()) {
    return new Map();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("church_playlist_reviews")
    .select("church_slug, playlist_id, status");

  if (error) {
    return new Map();
  }

  const map = new Map<string, Record<string, ChurchPlaylistReview["status"]>>();
  for (const row of (data ?? []) as RawPlaylistReviewRow[]) {
    const entry = map.get(row.church_slug) ?? {};
    entry[row.playlist_id] = row.status;
    map.set(row.church_slug, entry);
  }
  return map;
}

function buildCandidateRecords(
  candidates: ChurchCandidate[],
  screeningBySlug: Map<string, AdminCandidateScreening>,
  playlistReviewsBySlug: Map<string, Record<string, ChurchPlaylistReview["status"]>>
): AdminCandidateRecord[] {
  const verdictOrder = new Map([
    ["verified_church_with_playlist", 0],
    ["verified_church_needs_playlist", 1],
    ["playlist_found_needs_church_review", 2],
    ["weak_church_signal", 3],
    ["unclear", 4],
    ["non_church", 5],
  ]);

  return candidates
    .map((candidate) => {
      const screening = screeningBySlug.get(candidate.slug);
      return {
        ...candidate,
        name: getDisplayName(candidate, screening),
        website: candidate.website || screening?.websiteFinalUrl || undefined,
        email: candidate.email || screening?.websiteEmails[0] || undefined,
        location: candidate.location || screening?.location || undefined,
        country: candidate.country || screening?.country || undefined,
        discoverySource: candidate.discoverySource,
        screening,
        playlistReviewStatuses: playlistReviewsBySlug.get(candidate.slug) ?? {},
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        const statusOrder = ["pending", "approved", "rejected"];
        return statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
      }

      const leftVerdict = verdictOrder.get(left.screening?.verdict || "") ?? 99;
      const rightVerdict = verdictOrder.get(right.screening?.verdict || "") ?? 99;
      if (leftVerdict !== rightVerdict) return leftVerdict - rightVerdict;

      if ((right.screening?.verifiedPlaylistCount || 0) !== (left.screening?.verifiedPlaylistCount || 0)) {
        return (right.screening?.verifiedPlaylistCount || 0) - (left.screening?.verifiedPlaylistCount || 0);
      }

      // Sort by confidence so weak candidates sink to the bottom
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      // Candidates with location/country rank above those without
      const leftHasPlace = (left.location || left.country) ? 1 : 0;
      const rightHasPlace = (right.location || right.country) ? 1 : 0;
      if (leftHasPlace !== rightHasPlace) return rightHasPlace - leftHasPlace;

      return new Date(right.discoveredAt).getTime() - new Date(left.discoveredAt).getTime();
    });
}

export default async function AdminCandidatesPage() {
  const [candidates, screeningBySlug, playlistReviewsBySlug] = await Promise.all([
    getCandidates(),
    getScreeningMap(),
    getPlaylistReviewMap(),
  ]);
  const records = buildCandidateRecords(candidates, screeningBySlug, playlistReviewsBySlug);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Link href="/admin" className="text-sm font-medium text-rose-gold hover:text-rose-gold-deep">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-espresso">Candidates</h1>
        <span className="text-sm text-warm-brown">({records.length} total)</span>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-6 text-warm-brown">
        Review church candidates with real website signals. Playlist matches are supporting evidence only, and can be rejected without rejecting the church.
      </p>

      <AdminNav activeHref="/admin/candidates" />

      {records.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
          No candidates yet. Run a discovery or screening script to populate this queue.
        </div>
      ) : (
        <AdminCandidatesPanel candidates={records} />
      )}
    </div>
  );
}
