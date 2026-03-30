import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/neon-client';
import { getServerUser } from '@/lib/auth/server';
import { getChurchMembershipForUserAndSlug } from '@/lib/church-community';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getServerUser(request.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const churchSlug = formData.get('churchSlug') as string | null;

  if (!file || !churchSlug) {
    return NextResponse.json({ error: 'Missing file or churchSlug' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Ogiltigt filformat' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Max 2 MB' }, { status: 400 });
  }

  const membership = await getChurchMembershipForUserAndSlug(user.id, churchSlug);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createAdminClient();
  const ext = file.name.split('.').pop() ?? 'png';
  const filePath = `church-logos/${churchSlug}/logo-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('church-assets')
    .upload(filePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: 'Uppladdning misslyckades' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('church-assets').getPublicUrl(filePath);
  return NextResponse.json({ url: urlData.publicUrl });
}
