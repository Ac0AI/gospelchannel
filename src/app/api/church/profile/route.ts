import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/neon-client';
import { getServerUser } from '@/lib/auth/server';
import { getChurchMembershipForUserAndSlug } from '@/lib/church-community';
import { revalidatePublicChurchContent } from '@/lib/content';
import { getChurchBySlugAsync } from '@/lib/content';
import { syncChurchUpdateSourcesFromProfileEdit } from '@/lib/church-updates';
import { validateField, sanitizeText, normalizeInstagramInput } from '@/lib/profile-validation';
import { submitProfileEdit, getProfileEditsForChurch } from '@/lib/church-profile';
import type { ChurchEnrichment } from '@/types/gospel';

async function getChurchEnrichmentBySlug(slug: string): Promise<ChurchEnrichment | null> {
  const client = createAdminClient();
  const { data } = await client
    .from<ChurchEnrichment>('church_enrichments')
    .select()
    .eq('church_slug', slug)
    .limit(1)
    .maybeSingle();
  return (data as ChurchEnrichment | null) ?? null;
}

export async function GET(request: NextRequest) {
  const user = await getServerUser(request.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const churchSlug = searchParams.get('churchSlug');

  if (!churchSlug) {
    return NextResponse.json({ error: 'Missing churchSlug' }, { status: 400 });
  }

  const membership = await getChurchMembershipForUserAndSlug(user.id, churchSlug);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const edits = await getProfileEditsForChurch(churchSlug);
  return NextResponse.json({ edits });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser(request.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as {
    churchSlug?: string;
    fieldName?: string;
    fieldValue?: unknown;
  } | null;

  if (!payload) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { churchSlug, fieldName, fieldValue } = payload;

  if (!churchSlug || !fieldName || fieldValue === undefined) {
    return NextResponse.json({ error: 'Missing churchSlug, fieldName, or fieldValue' }, { status: 400 });
  }

  // Validate slug against known churches
  if (!(await getChurchBySlugAsync(churchSlug))) {
    return NextResponse.json({ error: 'Unknown church' }, { status: 404 });
  }

  const membership = await getChurchMembershipForUserAndSlug(user.id, churchSlug);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate field
  const validationError = validateField(fieldName, fieldValue);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Sanitize and normalize
  let processedValue = fieldValue;
  if (typeof fieldValue === 'string') {
    processedValue = sanitizeText(fieldValue);
    if (fieldName === 'instagram_url') {
      processedValue = normalizeInstagramInput(processedValue as string);
    }
  }

  // Fetch enrichment for auto-verify
  const enrichment = await getChurchEnrichmentBySlug(churchSlug);

  try {
    const edit = await submitProfileEdit({
      churchSlug,
      submittedBy: user.id,
      fieldName,
      fieldValue: processedValue,
      enrichment,
    });
    await syncChurchUpdateSourcesFromProfileEdit(churchSlug, fieldName);
    revalidatePublicChurchContent();
    return NextResponse.json({ success: true, edit });
  } catch (err) {
    const message = (err as Error).message;
    // Rate limit error from DB trigger
    if (message.toLowerCase().includes('rate') || message.toLowerCase().includes('too many')) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
