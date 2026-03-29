import Link from "next/link";
import { createAdminClient, hasSupabaseServiceConfig } from "@/lib/supabase";
import { AdminLogout } from "@/components/AdminLogout";
import { AdminNav } from "@/components/admin/AdminNav";
import { getPendingEdits } from "@/lib/church-profile";

async function getPendingCounts() {
  if (!hasSupabaseServiceConfig()) {
    return {
      suggestions: 0,
      feedback: 0,
      claims: 0,
      candidates: 0,
      edits: 0,
    };
  }

  const supabase = createAdminClient();

  const [suggestions, feedback, claims, candidates, editsRows] = await Promise.all([
    supabase.from("church_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("church_feedback").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("church_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("churches").select("slug", { count: "exact", head: true }).eq("status", "pending"),
    getPendingEdits(),
  ]);

  return {
    suggestions: suggestions.count ?? 0,
    feedback: feedback.count ?? 0,
    claims: claims.count ?? 0,
    candidates: candidates.count ?? 0,
    edits: editsRows.length,
  };
}

const sections = [
  { href: "/admin/suggestions", label: "Suggestions", key: "suggestions" as const, desc: "New church submissions from the community" },
  { href: "/admin/feedback", label: "Feedback", key: "feedback" as const, desc: "Data issues and playlist additions" },
  { href: "/admin/claims", label: "Claims", key: "claims" as const, desc: "Church ownership verification requests" },
  { href: "/admin/candidates", label: "Candidates", key: "candidates" as const, desc: "Auto-discovered churches with screening and review signals" },
  { href: "/admin/edits", label: "Profile Edits", key: "edits" as const, desc: "Profile field edits submitted by claimed churches" },
];

export default async function AdminDashboard() {
  const counts = await getPendingCounts();
  const queue = [...sections]
    .map((section) => ({
      ...section,
      count: counts[section.key],
    }))
    .sort((left, right) => right.count - left.count);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-espresso">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-warm-brown">Gospel Channel growth pipeline</p>
        </div>
        <AdminLogout />
      </div>

      <AdminNav activeHref="/admin" counts={counts} />

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
        <div className="text-sm font-semibold text-espresso">Needs attention</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {queue.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              className="flex items-center justify-between rounded-2xl bg-linen px-4 py-3 transition hover:bg-blush-light"
            >
              <div>
                <div className="font-medium text-espresso">{section.label}</div>
                <div className="text-xs text-warm-brown">{section.desc}</div>
              </div>
              <div className="rounded-full bg-espresso px-3 py-1 text-xs font-bold text-white">
                {section.count}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            className="group rounded-2xl border border-rose-200/60 bg-white p-6 shadow-sm transition hover:border-rose-gold/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-espresso group-hover:text-rose-gold-deep">{section.label}</h2>
              {counts[section.key] > 0 && (
                <span className="rounded-full bg-rose-gold px-2.5 py-0.5 text-xs font-bold text-white">
                  {counts[section.key]}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-warm-brown">{section.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
        <div className="mb-3 text-sm font-semibold text-espresso">Internal datasets</div>
        <Link
          href="/admin/website-tech"
          className="flex items-center justify-between rounded-2xl bg-linen px-4 py-3 transition hover:bg-blush-light"
        >
          <div>
            <div className="font-medium text-espresso">Website Tech</div>
            <div className="text-xs text-warm-brown">
              Filter church CMS/platform fingerprints and export outreach-ready CSV slices.
            </div>
          </div>
          <div className="rounded-full bg-espresso px-3 py-1 text-xs font-bold text-white">
            Open
          </div>
        </Link>
      </div>
    </div>
  );
}
