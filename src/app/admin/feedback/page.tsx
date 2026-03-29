import Link from "next/link";
import { getChurchFeedback } from "@/lib/church-community";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminFeedbackPanel } from "@/components/admin/AdminReviewPanels";

export default async function AdminFeedbackPage() {
  const feedback = await getChurchFeedback();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Link href="/admin" className="text-sm font-medium text-rose-gold hover:text-rose-gold-deep">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold text-espresso">Feedback</h1>
        <span className="text-sm text-warm-brown">({feedback.length} total)</span>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-6 text-warm-brown">
        Triage playlist additions and catalog fixes with clearer issue types, direct church links, and faster status changes.
      </p>

      <AdminNav activeHref="/admin/feedback" />

      {feedback.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
          No feedback yet.
        </div>
      ) : (
        <AdminFeedbackPanel feedback={feedback} />
      )}
    </div>
  );
}
