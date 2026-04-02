import { createHash } from "node:crypto";
import { extractCity } from "@/lib/church-directory";
import { getPublicHostLabel, isValidPublicUrl, normalizeDisplayText } from "@/lib/content-quality";
import { getApprovedProfileEditsForChurch, buildMergedProfile, type PublicProfileEdit } from "@/lib/church-profile";
import { getChurchBySlugAsync, getChurchDirectorySeedAsync } from "@/lib/content";
import { createAdminClient, hasServiceConfig } from "@/lib/neon-client";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import type {
  ChurchConfig,
  ChurchEnrichment,
  ChurchUpdateItem,
  ChurchUpdateSource,
  ChurchUpdateSourceKind,
} from "@/types/gospel";

const FEED_DISCOVERY_PATHS = ["/feed", "/feed/", "/rss.xml", "/feed.xml", "/atom.xml"];
const MAX_SOURCE_ITEMS = 8;
const DEFAULT_UPDATE_LIMIT = 6;
const SOURCE_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const REFRESH_CONCURRENCY = 4;
let churchUpdateStoreUnavailable = false;

type SourceRow = {
  id: string;
  church_slug: string;
  source_kind: ChurchUpdateSourceKind;
  source_value: string;
  source_url: string | null;
  source_label: string | null;
  is_primary: boolean;
  active: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  church_slug: string;
  source_id: string;
  external_id: string;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  source_kind: ChurchUpdateSourceKind;
  source_label: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

type EnrichmentRow = {
  id: string;
  official_church_name: string | null;
  website_url: string | null;
  youtube_url: string | null;
  enrichment_status: ChurchEnrichment["enrichmentStatus"];
  confidence: number;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

type SourceUpsert = {
  church_slug: string;
  source_kind: ChurchUpdateSourceKind;
  source_value: string;
  source_url?: string | null;
  source_label?: string | null;
  is_primary: boolean;
  active: boolean;
};

type ParsedFeedItem = {
  externalId?: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  imageUrl?: string;
};

function mapSourceRow(row: SourceRow): ChurchUpdateSource {
  return {
    id: row.id,
    churchSlug: row.church_slug,
    sourceKind: row.source_kind,
    sourceValue: row.source_value,
    sourceUrl: row.source_url ?? undefined,
    sourceLabel: row.source_label ?? undefined,
    isPrimary: row.is_primary,
    active: row.active,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: ItemRow): ChurchUpdateItem {
  return {
    id: row.id,
    churchSlug: row.church_slug,
    sourceId: row.source_id,
    externalId: row.external_id,
    title: row.title,
    url: row.url,
    summary: row.summary ?? undefined,
    publishedAt: row.published_at ?? undefined,
    sourceKind: row.source_kind,
    sourceLabel: row.source_label ?? undefined,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string): string {
  return decodeXmlEntities(stripCdata(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getTagValue(block: string, tagNames: string[]): string | undefined {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${escapeRegex(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, "i");
    const match = block.match(pattern);
    if (match?.[1]) {
      const text = stripCdata(match[1]).trim();
      if (text) return text;
    }
  }
  return undefined;
}

function getTagAttribute(block: string, tagName: string, attribute: string): string | undefined {
  const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*\\b${escapeRegex(attribute)}=["']([^"']+)["'][^>]*\\/?>`, "i");
  return block.match(pattern)?.[1];
}

function getAtomLink(block: string): string | undefined {
  const alternate = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i)?.[1];
  if (alternate) return alternate;
  return block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i)?.[1];
}

function normalizeIsoDate(value: string | undefined): string | undefined {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return undefined;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeItemUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname) {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildExternalId(sourceKind: ChurchUpdateSourceKind, item: ParsedFeedItem): string {
  const canonical = normalizeItemUrl(item.url)
    || normalizeDisplayText(item.externalId)
    || normalizeDisplayText(item.title)
    || `${sourceKind}-${Date.now()}`;
  return createHash("sha1").update(`${sourceKind}:${canonical}`).digest("hex");
}

function getFeedImage(block: string, summary: string | undefined): string | undefined {
  const direct = [
    getTagAttribute(block, "media:content", "url"),
    getTagAttribute(block, "media:thumbnail", "url"),
    getTagAttribute(block, "enclosure", "url"),
  ].find((value) => isValidPublicUrl(value));
  if (direct) return direct;

  const image = summary?.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)?.[1];
  return isValidPublicUrl(image) ? image : undefined;
}

function parseRssItem(block: string): ParsedFeedItem | null {
  const title = stripHtml(getTagValue(block, ["title"]) ?? "");
  const url = normalizeItemUrl(getTagValue(block, ["link"]));
  if (!title || !url) return null;

  const summaryHtml = getTagValue(block, ["content:encoded", "description", "summary"]);
  const summary = truncate(stripHtml(summaryHtml ?? ""), 220);

  return {
    externalId: normalizeDisplayText(getTagValue(block, ["guid"])),
    title,
    url,
    summary,
    publishedAt: normalizeIsoDate(getTagValue(block, ["pubDate", "published", "updated"])),
    imageUrl: getFeedImage(block, summaryHtml),
  };
}

function parseAtomEntry(block: string): ParsedFeedItem | null {
  const title = stripHtml(getTagValue(block, ["title"]) ?? "");
  const url = normalizeItemUrl(getAtomLink(block));
  if (!title || !url) return null;

  const summaryHtml = getTagValue(block, ["summary", "content"]);
  const summary = truncate(stripHtml(summaryHtml ?? ""), 220);

  return {
    externalId: normalizeDisplayText(getTagValue(block, ["id"])),
    title,
    url,
    summary,
    publishedAt: normalizeIsoDate(getTagValue(block, ["published", "updated"])),
    imageUrl: getFeedImage(block, summaryHtml),
  };
}

export function parseFeedXml(xml: string): ParsedFeedItem[] {
  if (!xml.trim()) return [];

  const blocks = xml.includes("<entry")
    ? xml.match(/<entry\b[\s\S]*?<\/entry>/gi)
    : xml.match(/<item\b[\s\S]*?<\/item>/gi);

  if (!blocks) return [];

  const parser = xml.includes("<entry") ? parseAtomEntry : parseRssItem;
  return blocks
    .map((block) => parser(block))
    .filter((item): item is ParsedFeedItem => Boolean(item))
    .slice(0, MAX_SOURCE_ITEMS);
}

function looksLikeFeedUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.endsWith(".xml")
    || normalized.includes("/feed")
    || normalized.includes("/rss")
    || normalized.includes("/atom");
}

function buildGoogleNewsFeedUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function buildYouTubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

function extractYouTubeChannelId(value: string | undefined): string | undefined {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return undefined;
  if (normalized.startsWith("UC")) return normalized;
  if (!isValidPublicUrl(normalized)) return undefined;
  try {
    const parsed = new URL(normalized);
    const match = parsed.pathname.match(/^\/channel\/([A-Za-z0-9_-]+)$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function buildGoogleNewsSearchQuery(input: {
  churchName: string;
  location?: string;
  country?: string;
}): string {
  const location = extractCity(input.location) || normalizeDisplayText(input.country);
  const parts = [`"${input.churchName}"`];
  if (location) parts.push(location);
  parts.push("church");
  return parts.join(" ");
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9",
      "User-Agent": "GospelChannelBot/1.0 (+https://gospelchannel.com)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Feed request failed (${response.status})`);
  }

  return response.text();
}

async function discoverWebsiteFeedUrl(websiteUrl: string): Promise<string | undefined> {
  const parsed = new URL(websiteUrl);
  const homepageUrl = parsed.origin;
  const homepageHtml = await fetchText(homepageUrl);

  const linkPattern = /<link\b[^>]*\btype=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml|application\/xml)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  const discovered: string[] = [];
  for (const match of homepageHtml.matchAll(linkPattern)) {
    const href = match[1];
    if (!href) continue;
    try {
      const resolved = new URL(href, homepageUrl).toString();
      if (isValidPublicUrl(resolved)) discovered.push(resolved);
    } catch {
      // ignore malformed alternate links
    }
  }
  if (discovered[0]) return discovered[0];

  for (const path of FEED_DISCOVERY_PATHS) {
    const candidate = `${homepageUrl}${path}`;
    try {
      const xml = await fetchText(candidate);
      if (xml.includes("<rss") || xml.includes("<feed") || xml.includes("<rdf")) {
        return candidate;
      }
    } catch {
      // ignore discovery misses
    }
  }

  return undefined;
}

async function getUpdateEnrichment(slug: string): Promise<ChurchEnrichment | null> {
  if (!hasServiceConfig()) return null;
  const sb = createAdminClient();
  const { data } = await sb
    .from<EnrichmentRow>("church_enrichments")
    .select("id,official_church_name,website_url,youtube_url,enrichment_status,confidence,schema_version,created_at,updated_at")
    .eq("church_slug", slug)
    .eq("enrichment_status", "complete")
    .maybeSingle();

  const row = (data as EnrichmentRow | null) ?? null;
  if (!row) return null;

  return {
    id: row.id,
    officialChurchName: row.official_church_name ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    enrichmentStatus: row.enrichment_status,
    confidence: row.confidence,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveDesiredSources(input: {
  church: ChurchConfig;
  enrichment?: ChurchEnrichment | null;
  mergedProfile: Record<string, unknown>;
}): SourceUpsert[] {
  const manualFeedUrl = normalizeDisplayText(input.mergedProfile.rssFeedUrl as string | undefined);
  const websiteUrl = normalizeDisplayText(input.mergedProfile.websiteUrl as string | undefined)
    || normalizeDisplayText(input.enrichment?.websiteUrl)
    || normalizeDisplayText(input.church.website);
  const youtubeChannelId = extractYouTubeChannelId(input.church.youtubeChannelId)
    || extractYouTubeChannelId(input.mergedProfile.youtubeUrl as string | undefined)
    || extractYouTubeChannelId(input.enrichment?.youtubeUrl);
  const googleNewsQuery = normalizeDisplayText(input.mergedProfile.googleNewsQuery as string | undefined)
    || buildGoogleNewsSearchQuery({
      churchName: input.enrichment?.officialChurchName || input.church.name,
      location: input.church.location,
      country: input.church.country,
    });

  const sources: SourceUpsert[] = [];

  if (manualFeedUrl && isValidPublicUrl(manualFeedUrl)) {
    sources.push({
      church_slug: input.church.slug,
      source_kind: "website_rss",
      source_value: manualFeedUrl,
      source_url: manualFeedUrl,
      source_label: getPublicHostLabel(websiteUrl || manualFeedUrl) || "Website",
      is_primary: true,
      active: true,
    });
  } else if (websiteUrl && isValidPublicUrl(websiteUrl)) {
    sources.push({
      church_slug: input.church.slug,
      source_kind: "website_rss",
      source_value: websiteUrl,
      source_url: looksLikeFeedUrl(websiteUrl) ? websiteUrl : null,
      source_label: getPublicHostLabel(websiteUrl) || "Website",
      is_primary: true,
      active: true,
    });
  }

  if (youtubeChannelId) {
    sources.push({
      church_slug: input.church.slug,
      source_kind: "youtube_channel",
      source_value: youtubeChannelId,
      source_url: buildYouTubeFeedUrl(youtubeChannelId),
      source_label: "YouTube",
      is_primary: sources.length === 0,
      active: true,
    });
  }

  if (googleNewsQuery) {
    sources.push({
      church_slug: input.church.slug,
      source_kind: "google_news_search",
      source_value: googleNewsQuery,
      source_url: buildGoogleNewsFeedUrl(googleNewsQuery),
      source_label: "Google News",
      is_primary: false,
      active: true,
    });
  }

  return sources;
}

async function listSourceRowsForChurch(slug: string): Promise<SourceRow[]> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable) return [];
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("church_update_sources")
      .select("*")
      .eq("church_slug", slug);
    if (error) throw new Error(`Failed to load church update sources: ${error.message}`);
    return (data ?? []) as SourceRow[];
  } catch {
    churchUpdateStoreUnavailable = true;
    return [];
  }
}

async function loadSourceSyncContext(slug: string): Promise<{
  church: ChurchConfig;
  enrichment: ChurchEnrichment | null;
  edits: PublicProfileEdit[];
  mergedProfile: Record<string, unknown>;
} | null> {
  const church = await getChurchBySlugAsync(slug);
  if (!church) return null;

  const [enrichment, edits] = await Promise.all([
    getUpdateEnrichment(slug),
    getApprovedProfileEditsForChurch(slug),
  ]);
  const mergedProfile = buildMergedProfile(enrichment, edits, church);
  return { church, enrichment, edits, mergedProfile };
}

export async function ensureChurchUpdateSourcesForSlug(slug: string): Promise<ChurchUpdateSource[]> {
  const context = await loadSourceSyncContext(slug);
  if (!context) return [];
  return ensureChurchUpdateSources(context);
}

export async function ensureChurchUpdateSources(input: {
  church: ChurchConfig;
  enrichment?: ChurchEnrichment | null;
  edits?: PublicProfileEdit[];
  mergedProfile?: Record<string, unknown>;
}): Promise<ChurchUpdateSource[]> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable) return [];

  try {
    const sb = createAdminClient();
    const mergedProfile = input.mergedProfile ?? buildMergedProfile(input.enrichment ?? null, input.edits ?? [], input.church);
    const desiredSources = deriveDesiredSources({
      church: input.church,
      enrichment: input.enrichment ?? null,
      mergedProfile,
    });
    const existingSources = await listSourceRowsForChurch(input.church.slug);
    const desiredKeys = new Set(desiredSources.map((source) => `${source.source_kind}:${source.source_value}`));
    const deactivateIds = existingSources
      .filter((row) => !desiredKeys.has(`${row.source_kind}:${row.source_value}`))
      .map((row) => row.id);

    if (deactivateIds.length > 0) {
      const { error } = await sb
        .from("church_update_sources")
        .update({ active: false })
        .in("id", deactivateIds);
      if (error) throw new Error(`Failed to deactivate update sources: ${error.message}`);
    }

    if (desiredSources.length === 0) {
      return [];
    }

    const { data, error } = await sb
      .from("church_update_sources")
      .upsert(desiredSources, { onConflict: "church_slug,source_kind,source_value" })
      .select("*");
    if (error) throw new Error(`Failed to upsert update sources: ${error.message}`);

    return ((data ?? []) as SourceRow[]).map(mapSourceRow);
  } catch {
    churchUpdateStoreUnavailable = true;
    return [];
  }
}

export async function getChurchLatestUpdates(
  slug: string,
  limit = DEFAULT_UPDATE_LIMIT,
): Promise<ChurchUpdateItem[]> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable) return [];
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("church_update_items")
      .select("*")
      .eq("church_slug", slug)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load church updates: ${error.message}`);
    return ((data ?? []) as ItemRow[]).map(mapItemRow);
  } catch {
    churchUpdateStoreUnavailable = true;
    return [];
  }
}

async function resolveWebsiteSourceUrl(source: ChurchUpdateSource): Promise<string | undefined> {
  if (source.sourceUrl && isValidPublicUrl(source.sourceUrl)) {
    return source.sourceUrl;
  }

  if (!isValidPublicUrl(source.sourceValue)) {
    return undefined;
  }

  if (looksLikeFeedUrl(source.sourceValue)) {
    return source.sourceValue;
  }

  return discoverWebsiteFeedUrl(source.sourceValue);
}

async function loadFeedItemsForSource(source: ChurchUpdateSource): Promise<{
  sourceUrl: string;
  items: ParsedFeedItem[];
}> {
  if (source.sourceKind === "website_rss") {
    const sourceUrl = await resolveWebsiteSourceUrl(source);
    if (!sourceUrl) throw new Error("No RSS/Atom feed discovered");
    const xml = await fetchText(sourceUrl);
    return { sourceUrl, items: parseFeedXml(xml) };
  }

  if (source.sourceKind === "youtube_channel") {
    const sourceUrl = source.sourceUrl || buildYouTubeFeedUrl(source.sourceValue);
    const xml = await fetchText(sourceUrl);
    return { sourceUrl, items: parseFeedXml(xml) };
  }

  const sourceUrl = source.sourceUrl || buildGoogleNewsFeedUrl(source.sourceValue);
  const xml = await fetchText(sourceUrl);
  return { sourceUrl, items: parseFeedXml(xml) };
}

async function upsertChurchUpdateItems(
  source: ChurchUpdateSource,
  items: ParsedFeedItem[],
): Promise<number> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable || items.length === 0) return 0;

  const sb = createAdminClient();
  const rows = items
    .map((item) => ({
      church_slug: source.churchSlug,
      source_id: source.id,
      external_id: buildExternalId(source.sourceKind, item),
      title: truncate(normalizeDisplayText(item.title) ?? "", 180) ?? "",
      url: item.url,
      summary: truncate(normalizeDisplayText(item.summary), 220) ?? null,
      published_at: item.publishedAt ?? null,
      source_kind: source.sourceKind,
      source_label: source.sourceLabel ?? null,
      image_url: item.imageUrl ?? null,
    }))
    .filter((item) => item.title && isValidPublicUrl(item.url));

  if (rows.length === 0) return 0;

  const { data, error } = await sb
    .from<{ id: string }>("church_update_items")
    .upsert(rows, { onConflict: "church_slug,external_id" })
    .select("id");
  if (error) throw new Error(`Failed to upsert church updates: ${error.message}`);
  return ((data as Array<{ id: string }> | null) ?? []).length || rows.length;
}

async function markSourceRefresh(
  sourceId: string,
  input: {
    sourceUrl?: string;
    succeeded: boolean;
    error?: string;
  },
): Promise<void> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable) return;
  const sb = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("church_update_sources")
    .update({
      source_url: input.sourceUrl ?? null,
      last_checked_at: now,
      last_success_at: input.succeeded ? now : undefined,
      last_error: input.succeeded ? null : truncate(input.error, 500) ?? "Unknown refresh error",
      active: true,
    })
    .eq("id", sourceId);
  if (error) throw new Error(`Failed to update source refresh metadata: ${error.message}`);
}

async function refreshSingleSource(source: ChurchUpdateSource): Promise<{
  source: ChurchUpdateSource;
  itemWrites: number;
}> {
  try {
    const { sourceUrl, items } = await loadFeedItemsForSource(source);
    const itemWrites = await upsertChurchUpdateItems(source, items);
    await markSourceRefresh(source.id, { sourceUrl, succeeded: true });
    return { source, itemWrites };
  } catch (error) {
    await markSourceRefresh(source.id, {
      sourceUrl: source.sourceUrl,
      succeeded: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map((item) => worker(item)));
    results.push(...batchResults);
  }
  return results;
}

async function bootstrapMissingChurchUpdateSources(limit: number): Promise<number> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable || limit <= 0) return 0;

  const sb = createAdminClient();
  const [churches, sourceRows] = await Promise.all([
    getChurchDirectorySeedAsync(),
    sb.from("church_update_sources").select("church_slug"),
  ]);
  if (sourceRows.error) {
    throw new Error(`Failed to list existing update sources: ${sourceRows.error.message}`);
  }

  const existing = new Set(((sourceRows.data ?? []) as Array<{ church_slug: string }>).map((row) => row.church_slug));
  const targets = churches
    .filter((church) => !existing.has(church.slug))
    .slice(0, limit);

  const results = await runWithConcurrency(targets, REFRESH_CONCURRENCY, async (church) => {
    const sources = await ensureChurchUpdateSourcesForSlug(church.slug);
    return sources.length > 0 ? 1 : 0;
  });

  return results.reduce<number>((sum, count) => sum + count, 0);
}

async function listDueSources(limit: number): Promise<ChurchUpdateSource[]> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable || limit <= 0) return [];
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("church_update_sources")
    .select("*")
    .eq("active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(`Failed to list due update sources: ${error.message}`);
  }

  const threshold = Date.now() - SOURCE_REFRESH_INTERVAL_MS;
  return ((data ?? []) as SourceRow[])
    .map(mapSourceRow)
    .filter((source) => {
      if (!source.lastCheckedAt) return true;
      const checkedAt = new Date(source.lastCheckedAt).getTime();
      return Number.isNaN(checkedAt) || checkedAt <= threshold;
    })
    .slice(0, limit);
}

export async function refreshChurchUpdatesBatch(input?: {
  bootstrapLimit?: number;
  refreshLimit?: number;
}): Promise<{
  bootstrapped: number;
  refreshedSources: number;
  itemWrites: number;
  errors: Array<{ sourceId: string; message: string }>;
}> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || churchUpdateStoreUnavailable) {
    return { bootstrapped: 0, refreshedSources: 0, itemWrites: 0, errors: [] };
  }

  const bootstrapLimit = input?.bootstrapLimit ?? 40;
  const refreshLimit = input?.refreshLimit ?? 60;
  const bootstrapped = await bootstrapMissingChurchUpdateSources(bootstrapLimit);
  const dueSources = await listDueSources(refreshLimit);

  const settled = await Promise.allSettled(
    Array.from({ length: Math.ceil(dueSources.length / REFRESH_CONCURRENCY) }, async (_, batchIndex) => {
      const start = batchIndex * REFRESH_CONCURRENCY;
      const batch = dueSources.slice(start, start + REFRESH_CONCURRENCY);
      return Promise.allSettled(batch.map(async (source) => {
        try {
          return await refreshSingleSource(source);
        } catch (error) {
          throw {
            sourceId: source.id,
            message: error instanceof Error ? error.message : String(error),
          };
        }
      }));
    }),
  );

  let refreshedSources = 0;
  let itemWrites = 0;
  const errors: Array<{ sourceId: string; message: string }> = [];

  for (const batch of settled) {
    if (batch.status !== "fulfilled") {
      continue;
    }
    for (const result of batch.value) {
      if (result.status === "fulfilled") {
        refreshedSources += 1;
        itemWrites += result.value.itemWrites;
      } else if (result.reason && typeof result.reason === "object" && "sourceId" in result.reason) {
        errors.push({
          sourceId: (result.reason as { sourceId: string }).sourceId,
          message: (result.reason as { message: string }).message,
        });
      }
    }
  }

  return { bootstrapped, refreshedSources, itemWrites, errors };
}

export async function syncChurchUpdateSourcesFromProfileEdit(
  slug: string,
  fieldName: string,
): Promise<void> {
  if (!["rss_feed_url", "google_news_query", "website_url", "youtube_url"].includes(fieldName)) {
    return;
  }
  await ensureChurchUpdateSourcesForSlug(slug);
}
