import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/neon-client';
import { getServerUser } from '@/lib/auth/server';
import { getChurchMembershipForUserAndSlug } from '@/lib/church-community';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024;

const IMAGE_TARGETS: Record<string, { folder: string; prefix: string }> = {
  logo_url: { folder: 'church-logos', prefix: 'logo' },
  cover_image_url: { folder: 'church-heroes', prefix: 'hero' },
};

export async function POST(request: NextRequest) {
  const user = await getServerUser(request.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const churchSlug = formData.get('churchSlug') as string | null;
  const fieldName = formData.get('fieldName') as string | null;

  if (!file || !churchSlug || !fieldName) {
    return NextResponse.json({ error: 'Missing file, churchSlug, or fieldName' }, { status: 400 });
  }

  const target = IMAGE_TARGETS[fieldName];
  if (!target) {
    return NextResponse.json({ error: 'Unsupported image field' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Max 2 MB' }, { status: 400 });
  }

  const membership = await getChurchMembershipForUserAndSlug(user.id, churchSlug);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = createAdminClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `${target.folder}/${churchSlug}/${target.prefix}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await client.storage
    .from('church-assets')
    .upload(filePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: urlData } = client.storage.from('church-assets').getPublicUrl(filePath);
  return NextResponse.json({ url: urlData.publicUrl });
}
