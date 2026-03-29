"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { AdminStatusButton } from "@/components/AdminStatusButton";
import { AdminClaimVerifyButton } from "@/components/admin/AdminClaimVerifyButton";
import type { ChurchClaim, ChurchFeedback, ChurchSuggestion } from "@/types/gospel";

type Tone = "neutral" | "good" | "warn" | "danger" | "info";

function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function hostLabel(url?: string) {
  if (!url) return "Missing";

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function emailDomain(email = "") {
  const [, domain = ""] = email.split("@");
  return domain.toLowerCase();
}

function toneClass(tone: Tone) {
  if (tone === "good") return "bg-emerald-100 text-emerald-800";
  if (tone === "warn") return "bg-amber-100 text-amber-800";
  if (tone === "danger") return "bg-red-100 text-red-700";
  if (tone === "info") return "bg-sky-100 text-sky-800";
  return "bg-gray-100 text-gray-700";
}

function suggestionStatusClass(status: ChurchSuggestion["status"]) {
  if (status === "approved") return toneClass("good");
  if (status === "rejected") return toneClass("danger");
  if (status === "reviewed") return toneClass("info");
  return toneClass("warn");
}

function feedbackStatusClass(status: ChurchFeedback["status"]) {
  if (status === "applied") return toneClass("good");
  if (status === "rejected") return toneClass("danger");
  if (status === "reviewed") return toneClass("info");
  return toneClass("warn");
}

function claimStatusClass(status: ChurchClaim["status"]) {
  if (status === "verified") return toneClass("good");
  if (status === "rejected") return toneClass("danger");
  return toneClass("warn");
}

function matchesSearch(values: Array<string | undefined>, query: string) {
  if (!query) return true;
  return values.some((value) => normalizeText(value).includes(query));
}

function getGoogleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getClaimEmailSignal(claim: ChurchClaim): { label: string; tone: Tone } {
  const domain = emailDomain(claim.email);
  if (!domain) return { label: "No email", tone: "danger" };

  if (["gmail.com", "hotmail.com", "outlook.com", "icloud.com", "yahoo.com"].includes(domain)) {
    return { label: "Personal inbox", tone: "warn" };
  }

  const slugTokens = claim.churchSlug
    .split("-")
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 3);

  if (slugTokens.some((token) => domain.includes(token))) {
    return { label: "Church-like domain", tone: "good" };
  }

  return { label: domain, tone: "info" };
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-rose-200/70">
      <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">{label}</div>
      <div className="mt-2 text-3xl font-bold text-espresso">{value}</div>
      <div className="mt-1 text-xs text-warm-brown">{hint}</div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? "bg-espresso text-white" : "bg-blush-light text-warm-brown"
      }`}
    >
      {label}
    </button>
  );
}

function MetaPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(tone)}`}>{label}</span>;
}

function ActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
    >
      {label}
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
      {label}
    </div>
  );
}

export function AdminSuggestionsPanel({ suggestions }: { suggestions: ChurchSuggestion[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChurchSuggestion["status"]>("pending");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "ready" | "missing_website" | "missing_playlist">(
    "ready"
  );
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const visibleSuggestions = suggestions.filter((suggestion) => {
    if (statusFilter !== "all" && suggestion.status !== statusFilter) return false;
    if (coverageFilter === "ready" && (!suggestion.website || !suggestion.playlistUrl)) return false;
    if (coverageFilter === "missing_website" && suggestion.website) return false;
    if (coverageFilter === "missing_playlist" && suggestion.playlistUrl) return false;

    return matchesSearch(
      [
        suggestion.name,
        suggestion.city,
        suggestion.country,
        suggestion.website,
        suggestion.contactEmail,
        suggestion.denomination,
        suggestion.language,
        suggestion.playlistUrl,
        suggestion.message,
      ],
      deferredSearch
    );
  });

  const pendingCount = suggestions.filter((suggestion) => suggestion.status === "pending").length;
  const readyCount = suggestions.filter(
    (suggestion) => suggestion.status === "pending" && !!suggestion.website && !!suggestion.playlistUrl
  ).length;
  const missingWebsiteCount = suggestions.filter(
    (suggestion) => suggestion.status === "pending" && !suggestion.website
  ).length;
  const approvedCount = suggestions.filter((suggestion) => suggestion.status === "approved").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Pending" value={pendingCount} hint="Fresh submissions to review" />
        <SummaryCard label="Ready" value={readyCount} hint="Has website and playlist" />
        <SummaryCard label="Missing Website" value={missingWebsiteCount} hint="Needs outside verification" />
        <SummaryCard label="Approved" value={approvedCount} hint="Already added or accepted" />
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-200/70">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Church, city, email, denomination..."
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            />
          </label>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm-brown">Status</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={statusFilter === "all"} label="All" onClick={() => setStatusFilter("all")} />
              <FilterChip active={statusFilter === "pending"} label="Pending" onClick={() => setStatusFilter("pending")} />
              <FilterChip active={statusFilter === "reviewed"} label="Reviewed" onClick={() => setStatusFilter("reviewed")} />
              <FilterChip active={statusFilter === "approved"} label="Approved" onClick={() => setStatusFilter("approved")} />
              <FilterChip active={statusFilter === "rejected"} label="Rejected" onClick={() => setStatusFilter("rejected")} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm-brown">Review Scope</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={coverageFilter === "all"} label="All" onClick={() => setCoverageFilter("all")} />
              <FilterChip active={coverageFilter === "ready"} label="Ready" onClick={() => setCoverageFilter("ready")} />
              <FilterChip active={coverageFilter === "missing_website"} label="No website" onClick={() => setCoverageFilter("missing_website")} />
              <FilterChip active={coverageFilter === "missing_playlist"} label="No playlist" onClick={() => setCoverageFilter("missing_playlist")} />
            </div>
          </div>
        </div>
      </div>

      <div className="text-sm text-warm-brown">Showing {visibleSuggestions.length} of {suggestions.length} suggestions.</div>

      <div className="space-y-4">
        {visibleSuggestions.length === 0 ? (
          <EmptyState label="No suggestions matched the current filters." />
        ) : (
          visibleSuggestions.map((suggestion) => {
            const location = [suggestion.city, suggestion.country].filter(Boolean).join(", ") || "Unknown location";
            const canReview = suggestion.status === "pending";
            const canDecision = suggestion.status === "pending" || suggestion.status === "reviewed";

            return (
              <article key={suggestion.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-espresso">{suggestion.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${suggestionStatusClass(suggestion.status)}`}>
                        {suggestion.status}
                      </span>
                      {suggestion.website && <MetaPill label="Website" tone="good" />}
                      {suggestion.playlistUrl && <MetaPill label="Playlist" tone="good" />}
                      {suggestion.contactEmail && <MetaPill label="Email" tone="info" />}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-warm-brown">
                      <span>{location}</span>
                      {suggestion.denomination && <span>{suggestion.denomination}</span>}
                      {suggestion.language && <span>{suggestion.language}</span>}
                      <span>{formatDate(suggestion.submittedAt)}</span>
                    </div>

                    {suggestion.message && (
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-warm-brown">{suggestion.message}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canReview && (
                      <AdminStatusButton table="church_suggestions" id={suggestion.id} status="reviewed" label="Mark reviewed" variant="neutral" />
                    )}
                    {canDecision && (
                      <AdminStatusButton table="church_suggestions" id={suggestion.id} status="approved" label="Approve" variant="approve" />
                    )}
                    {canDecision && (
                      <AdminStatusButton table="church_suggestions" id={suggestion.id} status="rejected" label="Reject" variant="reject" />
                    )}
                    {suggestion.website && <ActionLink href={suggestion.website} label={hostLabel(suggestion.website)} />}
                    {suggestion.playlistUrl && <ActionLink href={suggestion.playlistUrl} label="Playlist" />}
                    {suggestion.contactEmail && <ActionLink href={`mailto:${suggestion.contactEmail}`} label="Email" />}
                    <ActionLink href={getGoogleSearchUrl(`${suggestion.name} ${suggestion.country} church`)} label="Google search" />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl bg-linen p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Submitted Data</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Website</div>
                        <div className="mt-1 text-sm text-espresso">{suggestion.website ? hostLabel(suggestion.website) : "Missing"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Contact</div>
                        <div className="mt-1 text-sm text-espresso">{suggestion.contactEmail || "Missing"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Playlist</div>
                        <div className="mt-1 text-sm text-espresso">{suggestion.playlistUrl ? "Provided" : "Missing"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Language</div>
                        <div className="mt-1 text-sm text-espresso">{suggestion.language || "Unknown"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-linen p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Review Notes</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MetaPill label={suggestion.website ? "Website present" : "Need website check"} tone={suggestion.website ? "good" : "warn"} />
                      <MetaPill label={suggestion.playlistUrl ? "Playlist submitted" : "Need playlist follow-up"} tone={suggestion.playlistUrl ? "good" : "warn"} />
                      <MetaPill label={suggestion.contactEmail ? "Email supplied" : "No contact email"} tone={suggestion.contactEmail ? "info" : "neutral"} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AdminFeedbackPanel({ feedback }: { feedback: ChurchFeedback[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChurchFeedback["status"]>("pending");
  const [kindFilter, setKindFilter] = useState<"all" | ChurchFeedback["kind"]>("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const visibleFeedback = feedback.filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (kindFilter !== "all" && entry.kind !== kindFilter) return false;

    return matchesSearch(
      [entry.churchSlug, entry.kind, entry.field, entry.message, entry.playlistUrl, entry.source, entry.submittedByName, entry.submittedByEmail],
      deferredSearch
    );
  });

  const pendingCount = feedback.filter((entry) => entry.status === "pending").length;
  const playlistAdditionCount = feedback.filter((entry) => entry.kind === "playlist_addition").length;
  const dataIssueCount = feedback.filter((entry) => entry.kind === "data_issue").length;
  const appliedCount = feedback.filter((entry) => entry.status === "applied").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Pending" value={pendingCount} hint="Needs manual decision" />
        <SummaryCard label="Playlist Additions" value={playlistAdditionCount} hint="Possible new Spotify links" />
        <SummaryCard label="Data Issues" value={dataIssueCount} hint="Existing catalog fixes" />
        <SummaryCard label="Applied" value={appliedCount} hint="Already reflected in the data" />
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-200/70">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Church slug, field, message, playlist..."
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            />
          </label>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm-brown">Status</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={statusFilter === "all"} label="All" onClick={() => setStatusFilter("all")} />
              <FilterChip active={statusFilter === "pending"} label="Pending" onClick={() => setStatusFilter("pending")} />
              <FilterChip active={statusFilter === "reviewed"} label="Reviewed" onClick={() => setStatusFilter("reviewed")} />
              <FilterChip active={statusFilter === "applied"} label="Applied" onClick={() => setStatusFilter("applied")} />
              <FilterChip active={statusFilter === "rejected"} label="Rejected" onClick={() => setStatusFilter("rejected")} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm-brown">Type</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={kindFilter === "all"} label="All" onClick={() => setKindFilter("all")} />
              <FilterChip active={kindFilter === "playlist_addition"} label="Playlist" onClick={() => setKindFilter("playlist_addition")} />
              <FilterChip active={kindFilter === "data_issue"} label="Data issue" onClick={() => setKindFilter("data_issue")} />
            </div>
          </div>
        </div>
      </div>

      <div className="text-sm text-warm-brown">Showing {visibleFeedback.length} of {feedback.length} feedback items.</div>

      <div className="space-y-4">
        {visibleFeedback.length === 0 ? (
          <EmptyState label="No feedback matched the current filters." />
        ) : (
          visibleFeedback.map((entry) => {
            const canDecision = entry.status === "pending" || entry.status === "reviewed";

            return (
              <article key={entry.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/church/${entry.churchSlug}`} className="text-lg font-semibold text-rose-gold hover:underline">
                        {entry.churchSlug}
                      </Link>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${feedbackStatusClass(entry.status)}`}>
                        {entry.status}
                      </span>
                      <MetaPill label={entry.kind === "playlist_addition" ? "Playlist addition" : "Data issue"} tone={entry.kind === "playlist_addition" ? "good" : "warn"} />
                      {entry.field && <MetaPill label={`Field: ${entry.field}`} tone="info" />}
                      {entry.source === "claimed_owner" && <MetaPill label="Claimed owner" tone="good" />}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-warm-brown">
                      <span>{formatDate(entry.submittedAt)}</span>
                      {entry.playlistUrl && <span>Playlist submitted</span>}
                      {entry.submittedByEmail && <span>{entry.submittedByEmail}</span>}
                    </div>

                    <p className="mt-3 max-w-4xl text-sm leading-6 text-warm-brown">{entry.message}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {entry.status === "pending" && (
                      <AdminStatusButton table="church_feedback" id={entry.id} status="reviewed" label="Mark reviewed" variant="neutral" />
                    )}
                    {canDecision && (
                      <AdminStatusButton table="church_feedback" id={entry.id} status="applied" label="Apply" variant="approve" />
                    )}
                    {canDecision && (
                      <AdminStatusButton table="church_feedback" id={entry.id} status="rejected" label="Reject" variant="reject" />
                    )}
                    <Link
                      href={`/church/${entry.churchSlug}`}
                      className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                    >
                      Open church
                    </Link>
                    {entry.playlistUrl && <ActionLink href={entry.playlistUrl} label="Playlist" />}
                    <ActionLink href={getGoogleSearchUrl(`${entry.churchSlug} church`)} label="Google search" />
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AdminClaimsPanel({ claims }: { claims: ChurchClaim[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChurchClaim["status"]>("pending");
  const [detailFilter, setDetailFilter] = useState<"all" | "has_role" | "has_message" | "personal_email">("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const visibleClaims = claims.filter((claim) => {
    if (statusFilter !== "all" && claim.status !== statusFilter) return false;
    if (detailFilter === "has_role" && !claim.role) return false;
    if (detailFilter === "has_message" && !claim.message) return false;
    if (detailFilter === "personal_email" && getClaimEmailSignal(claim).label !== "Personal inbox") return false;

    return matchesSearch([claim.churchSlug, claim.name, claim.role, claim.email, claim.message], deferredSearch);
  });

  const pendingCount = claims.filter((claim) => claim.status === "pending").length;
  const roleCount = claims.filter((claim) => !!claim.role).length;
  const messageCount = claims.filter((claim) => !!claim.message).length;
  const verifiedCount = claims.filter((claim) => claim.status === "verified").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Pending" value={pendingCount} hint="Awaiting identity review" />
        <SummaryCard label="Has Role" value={roleCount} hint="Claimant included a role" />
        <SummaryCard label="Has Message" value={messageCount} hint="Extra context to validate" />
        <SummaryCard label="Verified" value={verifiedCount} hint="Already approved" />
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-rose-200/70">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-warm-brown">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Church, claimant, role, email..."
              className="w-full rounded-2xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
            />
          </label>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm-brown">Status</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={statusFilter === "all"} label="All" onClick={() => setStatusFilter("all")} />
              <FilterChip active={statusFilter === "pending"} label="Pending" onClick={() => setStatusFilter("pending")} />
              <FilterChip active={statusFilter === "verified"} label="Verified" onClick={() => setStatusFilter("verified")} />
              <FilterChip active={statusFilter === "rejected"} label="Rejected" onClick={() => setStatusFilter("rejected")} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm-brown">Signal</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={detailFilter === "all"} label="All" onClick={() => setDetailFilter("all")} />
              <FilterChip active={detailFilter === "has_role"} label="Has role" onClick={() => setDetailFilter("has_role")} />
              <FilterChip active={detailFilter === "has_message"} label="Has message" onClick={() => setDetailFilter("has_message")} />
              <FilterChip active={detailFilter === "personal_email"} label="Personal inbox" onClick={() => setDetailFilter("personal_email")} />
            </div>
          </div>
        </div>
      </div>

      <div className="text-sm text-warm-brown">Showing {visibleClaims.length} of {claims.length} claims.</div>

      <div className="space-y-4">
        {visibleClaims.length === 0 ? (
          <EmptyState label="No claims matched the current filters." />
        ) : (
          visibleClaims.map((claim) => {
            const emailSignal = getClaimEmailSignal(claim);

            return (
              <article key={claim.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/church/${claim.churchSlug}`} className="text-lg font-semibold text-rose-gold hover:underline">
                        {claim.churchSlug}
                      </Link>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${claimStatusClass(claim.status)}`}>
                        {claim.status}
                      </span>
                      {claim.role && <MetaPill label={claim.role} tone="info" />}
                      <MetaPill label={emailSignal.label} tone={emailSignal.tone} />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-warm-brown">
                      <span>{claim.name}</span>
                      <span>{claim.email}</span>
                      <span>{formatDate(claim.submittedAt)}</span>
                    </div>

                    {claim.message ? (
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-warm-brown">{claim.message}</p>
                    ) : (
                      <p className="mt-3 text-sm text-warm-brown">No extra message from claimant.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {claim.status === "pending" && (
                      <AdminClaimVerifyButton id={claim.id} />
                    )}
                    {claim.status === "pending" && (
                      <AdminStatusButton table="church_claims" id={claim.id} status="rejected" label="Reject" variant="reject" />
                    )}
                    <Link
                      href={`/church/${claim.churchSlug}`}
                      className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                    >
                      Open church
                    </Link>
                    <ActionLink href={`mailto:${claim.email}`} label="Email claimant" />
                    <ActionLink href={getGoogleSearchUrl(`${claim.name} ${claim.churchSlug}`)} label="Google search" />
                  </div>
                </div>

                {claim.status === "verified" && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200/80">
                    Access granted. The claimant can sign in with this email at <span className="font-semibold">/church-admin/login</span> and submit updates for this church.
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
