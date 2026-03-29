import Link from 'next/link';
import { getPendingEdits } from '@/lib/church-profile';
import { getChurchEnrichment } from '@/lib/church';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminEditsPanel } from './admin-edits-panel';

export const dynamic = 'force-dynamic';

export default async function AdminEditsPage() {
  const edits = await getPendingEdits();

  const slugs = [...new Set(edits.map(e => e.churchSlug))];
  const enrichments: Record<string, Awaited<ReturnType<typeof getChurchEnrichment>>> = {};
  for (const slug of slugs) {
    enrichments[slug] = await getChurchEnrichment(slug);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Link href="/admin" className="text-sm text-rose-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-bold">Profile Edits</h1>
        <span className="text-sm text-gray-500">({edits.length} pending)</span>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-6 text-gray-600">
        Edits submitted by churches that have claimed their page. Review and approve or reject.
      </p>

      <AdminNav activeHref="/admin/edits" />

      {edits.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-gray-500">
          No pending edits.
        </div>
      ) : (
        <AdminEditsPanel edits={edits} enrichments={enrichments} />
      )}
    </div>
  );
}
