import Link from "next/link";
import { getChurchSuggestions } from "@/lib/church-community";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminSuggestionsPanel } from "@/components/admin/AdminReviewPanels";
import { requireAdminPageAccess } from "@/lib/admin-page";

export default async function AdminSuggestionsPage() {
  await requireAdminPageAccess("/admin/suggestions");

  const suggestions = await getChurchSuggestions();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Link href="/admin" className="text-sm font-medium text-rose-gold hover:text-rose-gold-deep">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-espresso">Suggestions</h1>
        <span className="text-sm text-warm-brown">({suggestions.length} total)</span>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-6 text-warm-brown">
        Review community-submitted churches with triage-friendly filters, stronger context, and one-click outbound checks.
      </p>

      <AdminNav activeHref="/admin/suggestions" />

      {suggestions.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
          No suggestions yet.
        </div>
      ) : (
        <AdminSuggestionsPanel suggestions={suggestions} />
      )}
    </div>
  );
}
