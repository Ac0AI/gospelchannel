import { desc, gte, inArray, sql } from "drizzle-orm";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { createAdminClient, hasServiceConfig } from "@/lib/neon-client";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import type {
  ChurchPlaylistReview,
  ChurchFeedback,
  ChurchSuggestion,
  ChurchClaim,
  ChurchMembership,
  ChurchOutreach,
} from "@/types/gospel";
import { CONTENT_BASE_DATE } from "@/lib/utils";

type SuggestionRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  website: string | null;
  contact_email: string | null;
  denomination: string | null;
  language: string | null;
  playlist_url: string;
  message: string | null;
  submitted_at: string;
  status: ChurchSuggestion["status"];
};

type FeedbackRow = {
  id: string;
  church_slug: string;
  kind: ChurchFeedback["kind"];
  playlist_url: string | null;
  field: string | null;
  message: string;
  submitted_at: string;
  status: ChurchFeedback["status"];
  source: ChurchFeedback["source"] | null;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
};

type ClaimRow = {
  id: string;
  church_slug: string;
  name: string;
  role: string | null;
  email: string;
  message: string | null;
  submitted_at: string;
  status: ChurchClaim["status"];
};

type MembershipRow = {
  id: string;
  church_slug: string;
  email: string;
  full_name: string | null;
  role: ChurchMembership["role"];
  status: ChurchMembership["status"];
  claim_id: string | null;
  created_at: string;
};

type OutreachRow = {
  id: string;
  church_slug: string;
  email: string;
  sent_at: string;
  status: ChurchOutreach["status"];
  claim_id: string | null;
};

/* ── Church voting ("This Is My Church") — database-backed ── */

const memoryVotes = new Map<string, number>();
const memoryDaily = new Map<string, Record<string, number>>();
let voteStoreUnavailable = false;

function isKvEnabled(): boolean {
  return hasDatabaseConfig() && !isOfflinePublicBuild() && !voteStoreUnavailable;
}

function dateKey(offsetDays = 0): string {
  const [year, month, day] = CONTENT_BASE_DATE.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

function incrementMemoryVote(slug: string): number {
  const current = (memoryVotes.get(slug) ?? 0) + 1;
  memoryVotes.set(slug, current);
  const key = dateKey(0);
  const bucket = memoryDaily.get(key) ?? {};
  bucket[slug] = (bucket[slug] ?? 0) + 1;
  memoryDaily.set(key, bucket);
  return current;
}

function getMemoryVoteCounts(slugs: string[]): Record<string, number> {
  const output: Record<string, number> = {};
  for (const slug of slugs) output[slug] = memoryVotes.get(slug) ?? 0;
  return output;
}

function getMemoryTopChurchSlugs(periodDays: number, limit: number): Array<{ slug: string; votes: number }> {
  const scores: Record<string, number> = {};
  for (let day = 0; day < periodDays; day++) {
    const bucket = memoryDaily.get(dateKey(day)) ?? {};
    for (const [slug, value] of Object.entries(bucket)) {
      scores[slug] = (scores[slug] ?? 0) + value;
    }
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, votes]) => ({ slug, votes }));
}

export async function incrementChurchVote(slug: string): Promise<number> {
  if (!isKvEnabled()) {
    return incrementMemoryVote(slug);
  }

  try {
    const db = getDb();
    await db.insert(schema.churchVoteEvents).values({
      slug,
      createdAt: new Date(),
    });

    const rows = await db
      .insert(schema.churchVoteTotals)
      .values({
        slug,
        votes: 1,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.churchVoteTotals.slug,
        set: {
          votes: sql`${schema.churchVoteTotals.votes} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ votes: schema.churchVoteTotals.votes });

    return Number(rows[0]?.votes ?? 1);
  } catch {
    voteStoreUnavailable = true;
    return incrementMemoryVote(slug);
  }
}

export async function getChurchVoteCounts(slugs: string[]): Promise<Record<string, number>> {
  if (slugs.length === 0) return {};

  if (!isKvEnabled()) {
    return getMemoryVoteCounts(slugs);
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        slug: schema.churchVoteTotals.slug,
        votes: schema.churchVoteTotals.votes,
      })
      .from(schema.churchVoteTotals)
      .where(inArray(schema.churchVoteTotals.slug, slugs));
    const output: Record<string, number> = {};
    slugs.forEach((slug) => {
      output[slug] = 0;
    });
    rows.forEach((row) => {
      output[row.slug] = Number(row.votes ?? 0);
    });
    return output;
  } catch {
    voteStoreUnavailable = true;
    return getMemoryVoteCounts(slugs);
  }
}

export async function getTopChurchSlugs(periodDays = 30, limit = 10): Promise<Array<{ slug: string; votes: number }>> {
  if (!isKvEnabled()) {
    return getMemoryTopChurchSlugs(periodDays, limit);
  }

  try {
    const db = getDb();
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        slug: schema.churchVoteEvents.slug,
        votes: sql<number>`count(*)::int`,
      })
      .from(schema.churchVoteEvents)
      .where(gte(schema.churchVoteEvents.createdAt, since))
      .groupBy(schema.churchVoteEvents.slug)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((row) => ({
      slug: row.slug,
      votes: Number(row.votes ?? 0),
    }));
  } catch {
    voteStoreUnavailable = true;
    return getMemoryTopChurchSlugs(periodDays, limit);
  }
}

/* ── Admin client helpers ── */

function isAdminEnabled(): boolean {
  return hasServiceConfig();
}

/* ── Church suggestions ── */

export async function getChurchSuggestions(): Promise<ChurchSuggestion[]> {
  if (!isAdminEnabled()) return [];
  const client = createAdminClient();
  const { data } = await client
    .from<SuggestionRow>("church_suggestions")
    .select()
    .order("submitted_at", { ascending: false });
  return ((data as SuggestionRow[] | null) ?? []).map(mapSuggestion);
}

export async function addChurchSuggestion(
  suggestion: Omit<ChurchSuggestion, "id" | "submittedAt" | "status">
): Promise<ChurchSuggestion> {
  if (!isAdminEnabled()) {
    throw new Error("Database is not configured");
  }
  // Admin client needed: anon INSERT policy exists but .select().single()
  // requires SELECT permission which is restricted to authenticated users.
  const client = createAdminClient();
  const { data, error } = await client
    .from<SuggestionRow>("church_suggestions")
    .insert({
      name: suggestion.name,
      city: suggestion.city || null,
      country: suggestion.country || null,
      website: suggestion.website || null,
      contact_email: suggestion.contactEmail || null,
      denomination: suggestion.denomination || null,
      language: suggestion.language || null,
      playlist_url: suggestion.playlistUrl,
      message: suggestion.message || null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert suggestion");
  }
  return mapSuggestion(data);
}

/* ── Church feedback ── */

export async function getChurchFeedback(): Promise<ChurchFeedback[]> {
  if (!isAdminEnabled()) return [];
  const client = createAdminClient();
  const { data } = await client
    .from<FeedbackRow>("church_feedback")
    .select()
    .order("submitted_at", { ascending: false });
  return ((data as FeedbackRow[] | null) ?? []).map(mapFeedback);
}

export async function addChurchFeedback(
  feedback: Omit<ChurchFeedback, "id" | "submittedAt" | "status">
): Promise<ChurchFeedback> {
  if (!isAdminEnabled()) {
    throw new Error("Database is not configured");
  }
  // Admin client needed: same RLS limitation as suggestions/claims.
  const client = createAdminClient();
  const { data, error } = await client
    .from<FeedbackRow>("church_feedback")
    .insert({
      church_slug: feedback.churchSlug,
      kind: feedback.kind,
      playlist_url: feedback.playlistUrl || null,
      field: feedback.field || null,
      message: feedback.message,
      source: feedback.source || "public",
      submitted_by_name: feedback.submittedByName || null,
      submitted_by_email: feedback.submittedByEmail || null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert feedback");
  }
  return mapFeedback(data);
}

/* ── Church claims ── */

export async function hasPendingClaimForChurch(churchSlug: string): Promise<boolean> {
  if (!isAdminEnabled()) return false;
  const client = createAdminClient();
  const { data } = await client
    .from("church_claims")
    .select("id")
    .eq("church_slug", churchSlug)
    .eq("status", "pending")
    .limit(1);
  return ((data as Array<{ id: string }> | null) ?? []).length > 0;
}

export async function getChurchClaims(): Promise<ChurchClaim[]> {
  if (!isAdminEnabled()) return [];
  const client = createAdminClient();
  const { data } = await client
    .from<ClaimRow>("church_claims")
    .select()
    .order("submitted_at", { ascending: false });
  return ((data as ClaimRow[] | null) ?? []).map(mapClaim);
}

export async function addChurchClaim(
  claim: Omit<ChurchClaim, "id" | "submittedAt" | "status">
): Promise<ChurchClaim> {
  if (!isAdminEnabled()) {
    throw new Error("Database is not configured");
  }
  // Use admin client for insert because anon RLS allows INSERT but not
  // SELECT on church_claims, and .select().single() requires both.
  // This is a server-only function called from API routes, never from the browser.
  const client = createAdminClient();
  const { data, error } = await client
    .from<ClaimRow>("church_claims")
    .insert({
      church_slug: claim.churchSlug,
      name: claim.name,
      role: claim.role || null,
      email: normalizeEmail(claim.email),
      message: claim.message || null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert claim");
  }
  return mapClaim(data);
}

export async function getChurchMembershipsForUser(userId: string): Promise<ChurchMembership[]> {
  if (!isAdminEnabled()) return [];

  const client = createAdminClient();
  const { data, error } = await client
    .from<MembershipRow>("church_memberships")
    .select()
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as MembershipRow[] | null) ?? []).map(mapMembership);
}

export async function getActiveChurchMembershipsByEmail(email: string): Promise<ChurchMembership[]> {
  if (!isAdminEnabled()) return [];

  const client = createAdminClient();
  const { data, error } = await client
    .from<MembershipRow>("church_memberships")
    .select()
    .ilike("email", normalizeEmail(email))
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as MembershipRow[] | null) ?? []).map(mapMembership);
}

export async function ensureChurchAccessForEmail(email: string): Promise<ChurchMembership[]> {
  const normalizedEmail = normalizeEmail(email);
  const existingMemberships = await getActiveChurchMembershipsByEmail(normalizedEmail);
  if (existingMemberships.length > 0) {
    return existingMemberships;
  }

  if (!isAdminEnabled()) return [];

  const verifiedClaimIds = await getVerifiedClaimIdsByEmail(normalizedEmail);
  if (verifiedClaimIds.length === 0) {
    return [];
  }

  for (const claimId of verifiedClaimIds) {
    await verifyChurchClaim(claimId);
  }

  return await getActiveChurchMembershipsByEmail(normalizedEmail);
}

export async function getChurchMembershipForUserAndSlug(
  userId: string,
  churchSlug: string
): Promise<ChurchMembership | null> {
  if (!isAdminEnabled()) return null;

  const client = createAdminClient();
  const { data, error } = await client
    .from<MembershipRow>("church_memberships")
    .select()
    .eq("user_id", userId)
    .eq("church_slug", churchSlug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapMembership(data) : null;
}

export async function verifyChurchClaim(id: string): Promise<{ email: string; churchSlug: string; name: string }> {
  if (!isAdminEnabled()) {
    throw new Error("Admin client is not configured");
  }

  const client = createAdminClient();
  const { data: claim, error: claimError } = await client
    .from<ClaimRow>("church_claims")
    .select()
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message);
  }

  if (!claim) {
    throw new Error("Claim not found");
  }

  const email = String(claim.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Claim email is missing");
  }

  const userId = await ensureAuthUserIdForClaimEmail(client, email, claim.name || "");
  const { error: membershipError } = await upsertChurchMembership(client, {
    churchSlug: claim.church_slug,
    email,
    userId,
    fullName: claim.name || null,
    role: "owner",
    claimId: claim.id,
  });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const { error: statusError } = await client
    .from<ClaimRow>("church_claims")
    .update({ status: "verified" })
    .eq("id", id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  const { error: verifiedError } = await client
    .from("churches")
    .update({ verified_at: new Date().toISOString() })
    .eq("slug", claim.church_slug);

  if (verifiedError) {
    throw new Error(verifiedError.message);
  }

  return { email, churchSlug: claim.church_slug, name: claim.name || "" };
}

async function getVerifiedClaimIdsByEmail(email: string): Promise<string[]> {
  if (!isAdminEnabled()) return [];

  const client = createAdminClient();
  const { data, error } = await client
    .from<Pick<ClaimRow, "id">>("church_claims")
    .select("id")
    .ilike("email", normalizeEmail(email))
    .eq("status", "verified")
    .order("submitted_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<Pick<ClaimRow, "id">> | null) ?? []).map((claim) => claim.id);
}

async function ensureAuthUserIdForClaimEmail(
  client: ReturnType<typeof createAdminClient>,
  email: string,
  fullName: string,
): Promise<string> {
  let userId: string | null = null;
  let page = 1;

  while (!userId) {
    const { data: usersPage, error: usersError } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (usersError) {
      throw new Error((usersError as { message?: string }).message ?? "Failed to list auth users");
    }

    const match = usersPage.users.find((user) => normalizeEmail(user.email) === email);
    if (match) {
      userId = match.id;
      break;
    }

    if (usersPage.users.length < 200) {
      break;
    }

    page += 1;
  }

  if (userId) {
    return userId;
  }

  const { data: newUser, error: createError } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createError) {
    throw new Error((createError as { message?: string }).message ?? "Failed to create auth user");
  }

  return newUser.user.id;
}

async function upsertChurchMembership(
  client: ReturnType<typeof createAdminClient>,
  membership: {
    churchSlug: string;
    email: string;
    userId: string;
    fullName: string | null;
    role: ChurchMembership["role"];
    claimId: string;
  },
): Promise<{ error: { message: string } | null }> {
  const normalizedEmail = normalizeEmail(membership.email);
  const commonValues = {
    email: normalizedEmail,
    user_id: membership.userId,
    full_name: membership.fullName,
    role: membership.role,
    status: "active" as const,
    claim_id: membership.claimId,
    updated_at: new Date().toISOString(),
  };

  const { data: existingByUser, error: existingByUserError } = await client
    .from<MembershipRow>("church_memberships")
    .select()
    .eq("church_slug", membership.churchSlug)
    .eq("user_id", membership.userId)
    .limit(1)
    .maybeSingle();

  if (existingByUserError) {
    return { error: existingByUserError };
  }

  if (existingByUser) {
    const { error } = await client
      .from<MembershipRow>("church_memberships")
      .update(commonValues)
      .eq("id", existingByUser.id);
    return { error };
  }

  const { data: existingByEmail, error: existingByEmailError } = await client
    .from<MembershipRow>("church_memberships")
    .select()
    .eq("church_slug", membership.churchSlug)
    .ilike("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (existingByEmailError) {
    return { error: existingByEmailError };
  }

  if (existingByEmail) {
    const { error } = await client
      .from<MembershipRow>("church_memberships")
      .update(commonValues)
      .eq("id", existingByEmail.id);
    return { error };
  }

  const { error } = await client
    .from<MembershipRow>("church_memberships")
    .insert({
      church_slug: membership.churchSlug,
      ...commonValues,
    });

  return { error };
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

/* ── Generic status update (admin) ── */

type UpdatableTable = "church_suggestions" | "church_feedback" | "church_claims" | "churches";

export async function updateStatus(
  table: UpdatableTable,
  id: string,
  status: string
): Promise<void> {
  if (!isAdminEnabled()) {
    throw new Error("Admin client is not configured");
  }
  const client = createAdminClient();
  // The churches table uses slug as PK instead of uuid id
  const column = table === "churches" ? "slug" : "id";
  const { error } = await client.from(table).update({ status }).eq(column, id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertPlaylistReview(
  churchSlug: string,
  playlistId: string,
  status: ChurchPlaylistReview["status"]
): Promise<void> {
  if (!isAdminEnabled()) {
    throw new Error("Admin client is not configured");
  }

  const client = createAdminClient();
  const { error } = await client
    .from("church_playlist_reviews")
    .upsert(
      {
        church_slug: churchSlug,
        playlist_id: playlistId,
        status,
        reviewed_at: new Date().toISOString(),
      },
      {
        onConflict: "church_slug,playlist_id",
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateChurchDetails(
  slug: string,
  details: {
    name: string;
    website?: string | null;
    email?: string | null;
    location?: string | null;
    country?: string | null;
    headerImage?: string | null;
  }
): Promise<void> {
  if (!isAdminEnabled()) {
    throw new Error("Admin client is not configured");
  }

  const name = details.name.trim();
  const website = details.website?.trim() || null;
  const email = details.email?.trim() || null;
  const location = details.location?.trim() || null;
  const country = details.country?.trim() || null;
  const headerImage = details.headerImage?.trim() || null;

  if (!name) {
    throw new Error("Church name is required");
  }

  const client = createAdminClient();
  const update: Record<string, string | null> = { name, website, email, location, country };
  // Only include header_image if explicitly provided (even if empty string to clear it)
  if (details.headerImage !== undefined) {
    update.header_image = headerImage;
  }

  const { error } = await client
    .from("churches")
    .update(update)
    .eq("slug", slug);

  if (error) {
    throw new Error(error.message);
  }
}

/* ── Row mappers (snake_case → camelCase) ── */

function mapSuggestion(row: SuggestionRow): ChurchSuggestion {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? "",
    country: row.country ?? "",
    website: row.website ?? "",
    contactEmail: row.contact_email ?? "",
    denomination: row.denomination ?? "",
    language: row.language ?? "",
    playlistUrl: row.playlist_url,
    message: row.message ?? "",
    submittedAt: row.submitted_at,
    status: row.status,
  };
}

function mapFeedback(row: FeedbackRow): ChurchFeedback {
  return {
    id: row.id,
    churchSlug: row.church_slug,
    kind: row.kind,
    playlistUrl: row.playlist_url ?? undefined,
    field: row.field ?? undefined,
    message: row.message,
    submittedAt: row.submitted_at,
    status: row.status,
    source: row.source ?? "public",
    submittedByName: row.submitted_by_name ?? undefined,
    submittedByEmail: row.submitted_by_email ?? undefined,
  };
}

function mapClaim(row: ClaimRow): ChurchClaim {
  return {
    id: row.id,
    churchSlug: row.church_slug,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email,
    message: row.message ?? undefined,
    submittedAt: row.submitted_at,
    status: row.status,
  };
}

function mapMembership(row: MembershipRow): ChurchMembership {
  return {
    id: row.id,
    churchSlug: row.church_slug,
    email: row.email,
    fullName: row.full_name ?? undefined,
    role: row.role,
    status: row.status,
    claimId: row.claim_id ?? undefined,
    createdAt: row.created_at,
  };
}

/* ── Church Outreach ── */

export async function addOutreachRecord(churchSlug: string, email: string): Promise<ChurchOutreach> {
  if (!isAdminEnabled()) throw new Error('Database not configured');
  const client = createAdminClient();

  const { data, error } = await client
    .from<OutreachRow>('church_outreach')
    .insert({ church_slug: churchSlug, email })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to add outreach');
  return {
    id: data.id,
    churchSlug: data.church_slug,
    email: data.email,
    sentAt: data.sent_at,
    status: data.status,
    claimId: data.claim_id ?? undefined,
  };
}

export async function updateOutreachStatus(
  id: string,
  status: 'bounced' | 'claimed',
  claimId?: string,
): Promise<void> {
  if (!isAdminEnabled()) throw new Error('Database not configured');
  const client = createAdminClient();

  const update: Record<string, unknown> = { status };
  if (claimId) update.claim_id = claimId;

  const { error } = await client
    .from('church_outreach')
    .update(update)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getOutreachForChurch(churchSlug: string): Promise<ChurchOutreach[]> {
  if (!isAdminEnabled()) return [];
  const client = createAdminClient();

  const { data } = await client
    .from<OutreachRow>('church_outreach')
    .select()
    .eq('church_slug', churchSlug)
    .order('sent_at', { ascending: false });

  return ((data as OutreachRow[] | null) ?? []).map((row) => ({
    id: row.id,
    churchSlug: row.church_slug,
    email: row.email,
    sentAt: row.sent_at,
    status: row.status,
    claimId: row.claim_id ?? undefined,
  }));
}
