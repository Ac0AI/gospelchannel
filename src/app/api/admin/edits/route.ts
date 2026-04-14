import { NextRequest } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { revalidatePublicChurchContent } from '@/lib/content';
import { getPendingEdits, reviewProfileEdit } from '@/lib/church-profile';

export async function GET(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const edits = await getPendingEdits();
  return admin.json({ edits });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const payload = (await request.json().catch(() => null)) as {
    editId?: string;
    action?: string;
    rejectionReason?: string;
  } | null;

  if (!payload) {
    return admin.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { editId, action, rejectionReason } = payload;

  if (!editId || !['approved', 'rejected'].includes(action ?? '')) {
    return admin.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await reviewProfileEdit(
      editId,
      action as 'approved' | 'rejected',
      admin.user.id,
      rejectionReason,
    );
    revalidatePublicChurchContent();
    return admin.json({ success: true });
  } catch (err) {
    return admin.json({ error: (err as Error).message }, { status: 500 });
  }
}
