import { createAdminClient, hasSupabaseServiceConfig } from '@/lib/neon-client';
import { getDb, schema } from '@/db';
import type {
  ChurchProfileEdit,
  ChurchConfig,
  ChurchEnrichment,
  EnrichmentMatch,
} from '@/types/gospel';
import { autoVerifyField } from '@/lib/auto-verify';

export type PublicProfileEdit = Pick<ChurchProfileEdit, 'fieldName' | 'fieldValue' | 'reviewStatus' | 'submittedAt'>;

type ProfileEditRow = {
  id: string;
  church_slug: string;
  submitted_by: string;
  field_name: string;
  field_value: unknown;
  review_status: ChurchProfileEdit['reviewStatus'];
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  enrichment_match: EnrichmentMatch | null;
  submitted_at: string;
  updated_at: string;
};

type DbProfileEditRow = typeof schema.churchProfileEdits.$inferSelect;

// --- Row mappers ---

function mapProfileEdit(row: ProfileEditRow): ChurchProfileEdit {
  return {
    id: row.id as string,
    churchSlug: row.church_slug as string,
    submittedBy: row.submitted_by as string,
    fieldName: row.field_name as string,
    fieldValue: row.field_value,
    reviewStatus: row.review_status as ChurchProfileEdit['reviewStatus'],
    reviewedBy: row.reviewed_by as string | undefined,
    reviewedAt: row.reviewed_at as string | undefined,
    rejectionReason: row.rejection_reason as string | undefined,
    enrichmentMatch: row.enrichment_match as EnrichmentMatch | undefined,
    submittedAt: row.submitted_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapDbProfileEdit(row: DbProfileEditRow): ChurchProfileEdit {
  return {
    id: row.id,
    churchSlug: row.churchSlug,
    submittedBy: row.submittedBy,
    fieldName: row.fieldName,
    fieldValue: row.fieldValue,
    reviewStatus: row.reviewStatus as ChurchProfileEdit['reviewStatus'],
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    rejectionReason: row.rejectionReason ?? undefined,
    enrichmentMatch: (row.enrichmentMatch as EnrichmentMatch | null) ?? undefined,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- CRUD ---

export async function submitProfileEdit(params: {
  churchSlug: string;
  submittedBy: string;
  fieldName: string;
  fieldValue: unknown;
  enrichment: ChurchEnrichment | null;
}): Promise<ChurchProfileEdit> {
  if (!hasSupabaseServiceConfig()) throw new Error('Supabase not configured');
  const db = getDb();

  const enrichmentMatch = autoVerifyField(params.fieldName, params.fieldValue, params.enrichment);
  const reviewStatus = enrichmentMatch === 'mismatch' ? 'pending' : 'auto_approved';
  const reviewedAt = reviewStatus === 'auto_approved' ? new Date() : null;
  const now = new Date();

  const [row] = await db
    .insert(schema.churchProfileEdits)
    .values({
      churchSlug: params.churchSlug,
      submittedBy: params.submittedBy,
      fieldName: params.fieldName,
      fieldValue: params.fieldValue,
      reviewStatus,
      enrichmentMatch,
      reviewedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.churchProfileEdits.churchSlug, schema.churchProfileEdits.fieldName],
      set: {
        submittedBy: params.submittedBy,
        fieldValue: params.fieldValue,
        reviewStatus,
        reviewedBy: null,
        reviewedAt,
        rejectionReason: null,
        enrichmentMatch,
        submittedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (!row) {
    throw new Error('Failed to submit edit');
  }

  return mapDbProfileEdit(row);
}

export async function getProfileEditsForChurch(churchSlug: string): Promise<ChurchProfileEdit[]> {
  if (!hasSupabaseServiceConfig()) return [];
  const supabase = createAdminClient();

  const { data } = await supabase
    .from<ProfileEditRow>('church_profile_edits')
    .select()
    .eq('church_slug', churchSlug)
    .order('submitted_at', { ascending: false });

  return ((data as ProfileEditRow[] | null) ?? []).map(mapProfileEdit);
}

export async function getApprovedProfileEditsForChurch(churchSlug: string): Promise<PublicProfileEdit[]> {
  if (!hasSupabaseServiceConfig()) return [];
  const supabase = createAdminClient();
  type ApprovedProfileEditRow = {
    field_name: string;
    field_value: unknown;
    review_status: ChurchProfileEdit["reviewStatus"];
    submitted_at: string;
  };

  const { data } = await supabase
    .from<ApprovedProfileEditRow>('church_profile_edits')
    .select('field_name, field_value, review_status, submitted_at')
    .eq('church_slug', churchSlug)
    .in('review_status', ['approved', 'auto_approved'])
    .order('submitted_at', { ascending: false });

  return ((data ?? []) as ApprovedProfileEditRow[]).map((row) => ({
    fieldName: row.field_name as string,
    fieldValue: row.field_value,
    reviewStatus: row.review_status as ChurchProfileEdit['reviewStatus'],
    submittedAt: row.submitted_at as string,
  }));
}

export async function getPendingEdits(): Promise<ChurchProfileEdit[]> {
  if (!hasSupabaseServiceConfig()) return [];
  const supabase = createAdminClient();

  const { data } = await supabase
    .from<ProfileEditRow>('church_profile_edits')
    .select()
    .eq('review_status', 'pending')
    .order('submitted_at', { ascending: true });

  return ((data as ProfileEditRow[] | null) ?? []).map(mapProfileEdit);
}

export async function reviewProfileEdit(
  editId: string,
  action: 'approved' | 'rejected',
  reviewedBy: string,
  rejectionReason?: string,
): Promise<void> {
  if (!hasSupabaseServiceConfig()) throw new Error('Supabase not configured');
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('church_profile_edits')
    .update({
      review_status: action,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === 'rejected' ? rejectionReason ?? null : null,
    })
    .eq('id', editId);

  if (error) throw new Error(error.message);
}

// --- Merged Profile ---

export function buildMergedProfile(
  enrichment: ChurchEnrichment | null,
  edits: Array<Pick<ChurchProfileEdit, 'fieldName' | 'fieldValue' | 'reviewStatus' | 'submittedAt'>>,
  baseChurch?: ChurchConfig | null,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  // Base layer: manual church data
  if (baseChurch) {
    if (baseChurch.website) merged.websiteUrl = baseChurch.website;
    if (baseChurch.instagramUrl) merged.instagramUrl = baseChurch.instagramUrl;
    if (baseChurch.facebookUrl) merged.facebookUrl = baseChurch.facebookUrl;
    if (baseChurch.youtubeUrl) merged.youtubeUrl = baseChurch.youtubeUrl;
    if (baseChurch.logo) merged.logoUrl = baseChurch.logo;
    if (baseChurch.description) merged.description = baseChurch.description;
    if (baseChurch.country) merged.country = baseChurch.country;
    if (baseChurch.denomination) merged.denomination = baseChurch.denomination;
  }

  // Base layer: enrichment
  if (enrichment) {
    if (enrichment.serviceTimes) merged.serviceTimes = enrichment.serviceTimes;
    if (enrichment.streetAddress) merged.streetAddress = enrichment.streetAddress;
    // Try to extract city from streetAddress (format: "Street, City" or "Street, City, Country")
    if (enrichment.streetAddress) {
      const parts = enrichment.streetAddress.split(',').map(p => p.trim());
      if (parts.length >= 2) merged.city = parts[1];
    }
    if (enrichment.phone) merged.phone = enrichment.phone;
    if (enrichment.contactEmail) merged.contactEmail = enrichment.contactEmail;
    if (enrichment.websiteUrl) merged.websiteUrl = enrichment.websiteUrl;
    if (enrichment.instagramUrl) merged.instagramUrl = enrichment.instagramUrl;
    if (enrichment.facebookUrl) merged.facebookUrl = enrichment.facebookUrl;
    if (enrichment.youtubeUrl) merged.youtubeUrl = enrichment.youtubeUrl;
    if (enrichment.denominationNetwork) merged.denomination = enrichment.denominationNetwork;
    if (enrichment.languages) merged.languages = enrichment.languages;
    if (enrichment.ministries) merged.ministries = enrichment.ministries;
    if (enrichment.churchSize) merged.churchSize = enrichment.churchSize;
    if (enrichment.seoDescription) merged.description = enrichment.seoDescription;
  }

  // Override layer: approved edits (newest first, so first match wins)
  const approvedEdits = edits
    .filter(e => e.reviewStatus === 'approved' || e.reviewStatus === 'auto_approved')
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const appliedFields = new Set<string>();
  for (const edit of approvedEdits) {
    if (appliedFields.has(edit.fieldName)) continue;
    appliedFields.add(edit.fieldName);

    switch (edit.fieldName) {
      case 'service_times': merged.serviceTimes = edit.fieldValue; break;
      case 'address': {
        const addr = edit.fieldValue as { street: string; city: string; postal_code?: string; country: string };
        merged.streetAddress = addr.street;
        merged.city = addr.city;
        merged.country = addr.country;
        if (addr.postal_code) merged.postalCode = addr.postal_code;
        break;
      }
      case 'phone': merged.phone = edit.fieldValue; break;
      case 'contact_email': merged.contactEmail = edit.fieldValue; break;
      case 'description': merged.description = edit.fieldValue; break;
      case 'website_url': merged.websiteUrl = edit.fieldValue; break;
      case 'instagram_url': merged.instagramUrl = edit.fieldValue; break;
      case 'facebook_url': merged.facebookUrl = edit.fieldValue; break;
      case 'youtube_url': merged.youtubeUrl = edit.fieldValue; break;
      case 'rss_feed_url': merged.rssFeedUrl = edit.fieldValue; break;
      case 'google_news_query': merged.googleNewsQuery = edit.fieldValue; break;
      case 'denomination': merged.denomination = edit.fieldValue; break;
      case 'theological_orientation': merged.theologicalOrientation = edit.fieldValue; break;
      case 'languages': merged.languages = edit.fieldValue; break;
      case 'ministries': merged.ministries = edit.fieldValue; break;
      case 'church_size': merged.churchSize = edit.fieldValue; break;
      case 'logo_url': merged.logoUrl = edit.fieldValue; break;
    }
  }

  return merged;
}
