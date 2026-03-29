import Link from "next/link";
import { getChurchClaims } from "@/lib/church-community";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminClaimsPanel } from "@/components/admin/AdminReviewPanels";

export default async function AdminClaimsPage() {
  const claims = await getChurchClaims();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Link href="/admin" className="text-sm font-medium text-rose-gold hover:text-rose-gold-deep">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-espresso">Claims</h1>
        <span className="text-sm text-warm-brown">({claims.length} total)</span>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-6 text-warm-brown">
        Review ownership requests with clearer claimant signals, direct contact actions, and faster church verification checks.
      </p>

      <AdminNav activeHref="/admin/claims" />

      {claims.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
          No claims yet.
        </div>
      ) : (
        <AdminClaimsPanel claims={claims} />
      )}
    </div>
  );
}
