"use client";

import { useCallback, useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCandidatePlaylistButton } from "@/components/admin/AdminCandidatePlaylistButton";
import { AdminCandidateDetailsForm } from "@/components/admin/AdminCandidateDetailsForm";
import { AdminCandidateWebsiteEmail } from "@/components/admin/AdminCandidateWebsiteEmail";
import { AdminCandidateWebsiteTitle } from "@/components/admin/AdminCandidateWebsiteTitle";
import { AdminCandidateStatusSelect } from "@/components/admin/AdminCandidateStatusSelect";
import { postAdminAction } from "@/lib/admin-client";

export type AdminCandidateScreening = {
  suggestedName: string;
  verdict: string;
  notes: string;
  websiteInputUrl: string;
  websiteFinalUrl: string;
  websiteTitle: string;
  websiteDescription: string;
  websiteEmails: string[];
  websiteChurchScore: number;
  qualityFlags: string[];
  headerImageUrl: string;
  socialSpotifyUrls: string[];
  socialYoutubeUrls: string[];
  socialInstagramUrls: string[];
  location: string;
  country: string;
  verifiedPlaylistCount: number;
  verifiedPlaylists: Array<{
    id: string;
    name: string;
    owner: string;
    url: string;
    score: number;
  }>;
};

export type AdminCandidateRecord = {
  slug: string;
  name: string;
  spotifyPlaylistIds: string[];
  website?: string;
  email?: string;
  location?: string;
  country?: string;
  confidence: number;
  reason?: string;
  discoveredAt: string;
  discoverySource?: string;
  headerImage?: string;
  status: "pending" | "approved" | "rejected";
  screening?: AdminCandidateScreening;
  playlistReviewStatuses: Record<string, "kept" | "rejected">;
};

type Props = {
  candidates: AdminCandidateRecord[];
};

// --- View filter ---

type ViewFilter = "all" | "pending" | "approved" | "rejected";

const viewFilterLabels: Record<ViewFilter, string> = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Removed",
};

// --- Candidate label ---

function getCandidateLabel(candidate: AdminCandidateRecord): { label: string; className: string } {
  if (candidate.status === "approved") return { label: "Approved", className: "bg-emerald-600 text-white" };
  if (candidate.status === "rejected") return { label: "Removed", className: "bg-red-100 text-red-600" };
  return { label: "Pending", className: "bg-amber-100 text-amber-800" };
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "Strong match";
  if (confidence >= 0.4) return "Medium match";
  return "Weak match";
}

// --- Helpers ---

function getHostLabel(url?: string): string {
  if (!url) return "Website";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Website";
  }
}

function getSpotifyPlaylistUrl(id: string): string {
  return `https://open.spotify.com/playlist/${id}`;
}

function getSpotifySearchUrl(name: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${name} worship`)}/playlists`;
}

function getGoogleSearchUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} church worship`)}`;
}

function formatPercent(value?: number) {
  return `${Math.round((value || 0) * 100)}%`;
}

function formatFlag(flag: string) {
  return flag.replaceAll("_", " ");
}

function isCorruptEmail(email: string): boolean {
  if (!email) return false;
  if (/^[a-f0-9]{8,}[.@-]/i.test(email)) return true;
  if (email.includes("noreply") || email.includes("no-reply")) return true;
  if (!email.includes("@") || !email.includes(".")) return true;
  return false;
}

function sanitizeEmail(email?: string): string {
  if (!email) return "";
  if (isCorruptEmail(email)) return "";
  return email;
}

function matchesSearch(candidate: AdminCandidateRecord, query: string) {
  if (!query) return true;
  const haystack = [
    candidate.name,
    candidate.location,
    candidate.country,
    candidate.discoverySource,
    candidate.reason,
    candidate.screening?.verdict,
    candidate.screening?.notes,
    candidate.screening?.websiteTitle,
    candidate.screening?.websiteDescription,
    candidate.screening?.websiteEmails.join(" "),
    candidate.screening?.qualityFlags.join(" "),
    candidate.screening?.verifiedPlaylists.map((playlist) => `${playlist.name} ${playlist.owner}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function formatPlace(candidate: AdminCandidateRecord) {
  const parts = [candidate.location, candidate.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

function matchesViewFilter(candidate: AdminCandidateRecord, filter: ViewFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return candidate.status === "pending";
  if (filter === "approved") return candidate.status === "approved";
  if (filter === "rejected") return candidate.status === "rejected";
  return true;
}

export function AdminCandidatesPanel({ candidates }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("pending");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkRejectError, setBulkRejectError] = useState("");

  const toggleExpanded = useCallback((slug: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const visibleCandidates = candidates.filter((candidate) => {
    if (!matchesViewFilter(candidate, viewFilter)) return false;
    return matchesSearch(candidate, deferredSearch);
  });

  const pendingWeakCandidates = visibleCandidates.filter(
    (candidate) => candidate.status === "pending" && candidate.confidence < 0.5
  );

  const handleBulkReject = useCallback(async () => {
    if (!confirm(`Remove ${pendingWeakCandidates.length} weak candidates (<50% confidence)?`)) return;
    setBulkRejecting(true);
    setBulkRejectError("");

    try {
      await Promise.all(
        pendingWeakCandidates.map((candidate) =>
          postAdminAction("/api/admin/status", {
            table: "churches",
            id: candidate.slug,
            status: "rejected",
          })
        )
      );
      router.refresh();
    } catch (err) {
      setBulkRejectError(err instanceof Error ? err.message : "Failed to remove candidates");
    } finally {
      setBulkRejecting(false);
    }
  }, [pendingWeakCandidates, router]);

  const pendingCount = candidates.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Stat card */}
      <button
        type="button"
        onClick={() => setViewFilter(viewFilter === "pending" ? "all" : "pending")}
        className={`rounded-2xl bg-white p-4 text-left transition ring-1 ${
          viewFilter === "pending"
            ? "ring-2 ring-espresso"
            : "ring-rose-200/70 hover:ring-rose-gold/50"
        }`}
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Pending</div>
        <div className="mt-2 text-3xl font-bold text-espresso">{pendingCount}</div>
      </button>

      {/* Search + filter row */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-200/70">
        <div className="space-y-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search church, country, playlist..."
            className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(viewFilterLabels) as ViewFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setViewFilter(filter)}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  viewFilter === filter
                    ? "bg-espresso text-white"
                    : "bg-blush-light text-warm-brown hover:bg-rose-100"
                }`}
              >
                {viewFilterLabels[filter]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-warm-brown">
          Showing {visibleCandidates.length} {viewFilter !== "all" || deferredSearch ? "filtered " : ""}candidates ({candidates.length} total).
        </span>
        {pendingWeakCandidates.length > 0 && (
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={handleBulkReject}
              disabled={bulkRejecting}
              className="rounded-full bg-red-100 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
            >
              {bulkRejecting ? "Removing..." : `Remove ${pendingWeakCandidates.length} weak candidates`}
            </button>
            {bulkRejectError ? <span className="text-xs font-semibold text-red-700">{bulkRejectError}</span> : null}
          </div>
        )}
      </div>

      {visibleCandidates.length === 0 && candidates.length > 0 && viewFilter !== "all" ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/80">
          No candidates match the current filter. Try <span className="font-semibold">All</span> to see everything.
        </div>
      ) : null}

      <div className="space-y-4">
        {visibleCandidates.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
            No candidates match the current filters.
          </div>
        ) : (
          visibleCandidates.map((candidate) => {
            const screening = candidate.screening;
            const websiteUrl = candidate.website || screening?.websiteFinalUrl || "";
            const previewImageUrl = screening?.headerImageUrl || "";
            const candidateLabel = getCandidateLabel(candidate);
            const playlistCandidates =
              screening?.verifiedPlaylists.length
                ? screening.verifiedPlaylists
                : candidate.spotifyPlaylistIds.map((playlistId) => ({
                    id: playlistId,
                    name: playlistId,
                    owner: "",
                    url: getSpotifyPlaylistUrl(playlistId),
                    score: 0,
                  }));
            const playlists = playlistCandidates.map((playlist) => ({
              ...playlist,
              reviewStatus: candidate.playlistReviewStatuses[playlist.id] || "kept",
            }));
            const keptPlaylists = playlists.filter((playlist) => playlist.reviewStatus !== "rejected");
            const rejectedPlaylistCount = playlists.length - keptPlaylists.length;

            const isExpanded = expandedIds.has(candidate.slug);

            return (
              <article key={candidate.slug} className="rounded-3xl bg-white shadow-sm ring-1 ring-rose-200/70">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(candidate.slug)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-warm-brown">{isExpanded ? "▼" : "▶"}</span>
                      <h2 className="text-lg font-semibold text-espresso">{candidate.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${candidateLabel.className}`}>
                        {candidateLabel.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-warm-brown">
                      <span>{formatPlace(candidate)}</span>
                      <span>{(candidate.discoverySource || "manual").replaceAll("-", " ")}</span>
                      <span>{new Date(candidate.discoveredAt).toLocaleDateString()}</span>
                      <span>{getConfidenceLabel(candidate.confidence)}</span>
                      {keptPlaylists.length > 0 && <span>{keptPlaylists.length} playlist{keptPlaylists.length > 1 ? "s" : ""}</span>}
                      {sanitizeEmail(candidate.email) && <span>{sanitizeEmail(candidate.email)}</span>}
                    </div>
                    {screening?.qualityFlags.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {screening.qualityFlags.slice(0, 4).map((flag) => (
                          <span
                            key={`${candidate.slug}-${flag}`}
                            className="rounded-full border border-rose-200/70 bg-linen px-2.5 py-1 text-[11px] font-medium text-warm-brown"
                          >
                            {formatFlag(flag)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <AdminCandidateStatusSelect
                      churchSlug={candidate.slug}
                      currentStatus={candidate.status}
                    />
                    {websiteUrl && (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                      >
                        {getHostLabel(websiteUrl)}
                      </a>
                    )}
                    <a
                      href={getSpotifySearchUrl(candidate.name)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                    >
                      Spotify search
                    </a>
                    <a
                      href={getGoogleSearchUrl(candidate.name)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                    >
                      Google search
                    </a>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-rose-200/50 p-5 pt-4">
                    {(screening?.notes || candidate.reason) && (
                      <p className="mb-4 max-w-4xl text-sm leading-6 text-warm-brown">
                        {screening?.notes || candidate.reason}
                      </p>
                    )}

                    {previewImageUrl ? (
                      <div className="mb-4 overflow-hidden rounded-2xl ring-1 ring-rose-200/60">
                        <div
                          className="h-44 w-full bg-cover bg-center"
                          style={{ backgroundImage: `linear-gradient(180deg, rgba(32,18,11,0.08), rgba(32,18,11,0.42)), url(${previewImageUrl})` }}
                        />
                      </div>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                      <div className="rounded-2xl bg-linen p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Screening</div>
                        <dl className="mt-3 grid gap-2 text-sm text-warm-brown sm:grid-cols-2">
                          <div>
                            <dt className="font-semibold text-espresso">Website score</dt>
                            <dd>{formatPercent(screening?.websiteChurchScore)}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Kept playlists</dt>
                            <dd>{keptPlaylists.length}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Removed playlists</dt>
                            <dd>{rejectedPlaylistCount}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Location</dt>
                            <dd>{candidate.location || "—"}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Country</dt>
                            <dd>{candidate.country || "—"}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Email</dt>
                            <AdminCandidateWebsiteEmail
                              key={`${candidate.slug}:${websiteUrl}:${candidate.email || screening?.websiteEmails[0] || ""}`}
                              websiteUrl={websiteUrl}
                              initialEmail={candidate.email || screening?.websiteEmails[0] || ""}
                              initialFinalUrl={screening?.websiteFinalUrl || ""}
                            />
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Website title</dt>
                            <AdminCandidateWebsiteTitle
                              key={`${candidate.slug}:${websiteUrl}:${screening?.websiteTitle || ""}`}
                              websiteUrl={websiteUrl}
                              initialTitle={screening?.websiteTitle || ""}
                              initialFinalUrl={screening?.websiteFinalUrl || ""}
                              className="truncate"
                            />
                          </div>
                          <div>
                            <dt className="font-semibold text-espresso">Header image</dt>
                            <dd>{screening?.headerImageUrl ? "Found" : "Missing"}</dd>
                          </div>
                        </dl>

                        {screening?.qualityFlags.length ? (
                          <div className="mt-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Quality flags</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {screening.qualityFlags.map((flag) => (
                                <span
                                  key={`${candidate.slug}-expanded-${flag}`}
                                  className="rounded-full border border-rose-200/70 bg-white px-2.5 py-1 text-[11px] font-medium text-warm-brown"
                                >
                                  {formatFlag(flag)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {(screening?.socialSpotifyUrls.length || screening?.socialYoutubeUrls.length) ? (
                          <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-rose-200/60">
                            <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Found on website</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {screening?.socialSpotifyUrls[0] ? (
                                <a
                                  href={screening.socialSpotifyUrls[0]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full bg-blush-light px-3 py-1.5 font-semibold text-espresso transition hover:bg-rose-100"
                                >
                                  Spotify on site
                                </a>
                              ) : null}
                              {screening?.socialYoutubeUrls[0] ? (
                                <a
                                  href={screening.socialYoutubeUrls[0]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full bg-blush-light px-3 py-1.5 font-semibold text-espresso transition hover:bg-rose-100"
                                >
                                  YouTube on site
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-rose-200/60">
                          <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">
                            Edit details
                          </div>
                          <p className="mt-1 text-xs leading-5 text-warm-brown">
                            Save a better church name, official website, or contact email when the auto-screening is incomplete.
                          </p>
                          <AdminCandidateDetailsForm
                            churchSlug={candidate.slug}
                            initialName={candidate.name}
                            initialWebsite={candidate.website || ""}
                            initialEmail={candidate.email || screening?.websiteEmails[0] || ""}
                            initialLocation={candidate.location || ""}
                            initialCountry={candidate.country || ""}
                            initialHeaderImage={candidate.headerImage || screening?.headerImageUrl || ""}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl bg-linen p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Playlists</div>
                        {playlists.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {playlists.slice(0, 6).map((playlist) => (
                              <div
                                key={`${candidate.slug}-${playlist.id}`}
                                className={`rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 transition ${playlist.reviewStatus === "rejected" ? "ring-red-200/70 opacity-70" : "ring-rose-200/60 hover:ring-rose-gold/50"}`}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <a
                                    href={playlist.url || getSpotifyPlaylistUrl(playlist.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="min-w-0 flex-1"
                                  >
                                    <div className="font-medium text-espresso">{playlist.name || playlist.id}</div>
                                    <div className="text-xs text-warm-brown">
                                      {playlist.owner || "Spotify playlist"}{playlist.score ? ` • ${Math.round(playlist.score * 100)}%` : ""}
                                    </div>
                                  </a>
                                  <div className="flex flex-wrap gap-2">
                                    {playlist.reviewStatus === "rejected" ? (
                                      <>
                                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                          Removed
                                        </span>
                                        <AdminCandidatePlaylistButton
                                          churchSlug={candidate.slug}
                                          playlistId={playlist.id}
                                          status="kept"
                                          label="Restore"
                                          variant="neutral"
                                        />
                                      </>
                                    ) : (
                                      <AdminCandidatePlaylistButton
                                        churchSlug={candidate.slug}
                                        playlistId={playlist.id}
                                        status="rejected"
                                        label="Remove"
                                        variant="reject"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-warm-brown">No linked or verified playlists yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
