import { and, asc, eq, ilike } from "drizzle-orm";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import type { ChurchNetwork, ChurchCampus, ChurchCampusWithDetails, ChurchEnrichment } from "@/types/gospel";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";

const NETWORK_CACHE_SECONDS = 60 * 60;
type CacheEntry<T> = { value: T; expiresAt: number };

const networkBySlugCache = new Map<string, CacheEntry<ChurchNetwork | null>>();
const networkByParentSlugCache = new Map<string, CacheEntry<ChurchNetwork | null>>();
const networkCampusCountCache = new Map<string, CacheEntry<number>>();
const loggedNetworkFallbacks = new Set<string>();
let networkReadsUnavailable = false;

function getCachedValue<T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedValue<T>(store: Map<string, CacheEntry<T>>, key: string, value: T): T {
  store.set(key, {
    value,
    expiresAt: Date.now() + NETWORK_CACHE_SECONDS * 1000,
  });
  return value;
}

function logNetworkFallback(scope: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  const key = scope;
  if (loggedNetworkFallbacks.has(key)) {
    return;
  }
  loggedNetworkFallbacks.add(key);
  console.error(`[church-networks] Falling back for ${scope}: ${detail}`);
}

function mapNetwork(row: typeof schema.churchNetworks.$inferSelect): ChurchNetwork {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    website: row.website ?? undefined,
    parentChurchSlug: row.parentChurchSlug ?? undefined,
    founded: row.founded ?? undefined,
    headquartersCountry: row.headquartersCountry ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCampus(row: typeof schema.churchCampuses.$inferSelect): ChurchCampus {
  return {
    id: row.id,
    slug: row.slug,
    networkId: row.networkId,
    name: row.name,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
    status: row.status as ChurchCampus["status"],
    discoveredBy: row.discoveredBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEnrichment(row: typeof schema.churchEnrichments.$inferSelect): ChurchEnrichment {
  return {
    id: row.id,
    churchSlug: row.churchSlug ?? undefined,
    candidateId: row.candidateId ?? undefined,
    officialChurchName: row.officialChurchName ?? undefined,
    streetAddress: row.streetAddress ?? undefined,
    googleMapsUrl: row.googleMapsUrl ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    serviceTimes: (row.serviceTimes as ChurchEnrichment["serviceTimes"]) ?? undefined,
    theologicalOrientation: row.theologicalOrientation ?? undefined,
    denominationNetwork: row.denominationNetwork ?? undefined,
    languages: row.languages ?? undefined,
    phone: row.phone ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    instagramUrl: row.instagramUrl ?? undefined,
    facebookUrl: row.facebookUrl ?? undefined,
    youtubeUrl: row.youtubeUrl ?? undefined,
    childrenMinistry: row.childrenMinistry ?? undefined,
    youthMinistry: row.youthMinistry ?? undefined,
    ministries: row.ministries ?? undefined,
    churchSize: row.churchSize as ChurchEnrichment["churchSize"],
    coverImageUrl: row.coverImageUrl ?? undefined,
    logoImageUrl: row.logoImageUrl ?? undefined,
    seoDescription: row.seoDescription ?? undefined,
    summary: row.summary ?? undefined,
    sources: (row.sources as ChurchEnrichment["sources"]) ?? undefined,
    enrichmentStatus: row.enrichmentStatus as ChurchEnrichment["enrichmentStatus"],
    confidence: row.confidence,
    schemaVersion: row.schemaVersion,
    lastEnrichedAt: row.lastEnrichedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getNetworkBySlug(slug: string): Promise<ChurchNetwork | null> {
  const cached = getCachedValue(networkBySlugCache, slug);
  if (cached !== undefined) return cached;
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return null;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.churchNetworks)
      .where(eq(schema.churchNetworks.slug, slug))
      .limit(1);

    return setCachedValue(networkBySlugCache, slug, rows[0] ? mapNetwork(rows[0]) : null);
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("network-by-slug", error);
    return setCachedValue(networkBySlugCache, slug, null);
  }
}

export async function getNetworkForWorshipChurch(churchSlug: string): Promise<ChurchNetwork | null> {
  const cached = getCachedValue(networkByParentSlugCache, churchSlug);
  if (cached !== undefined) return cached;
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return null;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.churchNetworks)
      .where(eq(schema.churchNetworks.parentChurchSlug, churchSlug))
      .limit(1);

    return setCachedValue(networkByParentSlugCache, churchSlug, rows[0] ? mapNetwork(rows[0]) : null);
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("network-by-parent-slug", error);
    return setCachedValue(networkByParentSlugCache, churchSlug, null);
  }
}

export async function getNetworkCampusCount(networkId: string): Promise<number> {
  const cached = getCachedValue(networkCampusCountCache, networkId);
  if (cached !== undefined) return cached;
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return 0;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.churchCampuses)
      .where(and(eq(schema.churchCampuses.networkId, networkId), eq(schema.churchCampuses.status, "published")));

    return setCachedValue(networkCampusCountCache, networkId, rows.length);
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("network-campus-count", error);
    return setCachedValue(networkCampusCountCache, networkId, 0);
  }
}

export async function getNetworkCampuses(
  networkId: string,
): Promise<Array<ChurchCampus & { enrichment?: ChurchEnrichment }>> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return [];
  try {
    const db = getDb();

    const rows = await db
      .select({
        campus: schema.churchCampuses,
        enrichment: schema.churchEnrichments,
      })
      .from(schema.churchCampuses)
      .leftJoin(schema.churchEnrichments, eq(schema.churchEnrichments.campusId, schema.churchCampuses.id))
      .where(and(eq(schema.churchCampuses.networkId, networkId), eq(schema.churchCampuses.status, "published")))
      .orderBy(asc(schema.churchCampuses.country), asc(schema.churchCampuses.name));

    return rows.map((row) => ({
      ...mapCampus(row.campus),
      enrichment: row.enrichment ? mapEnrichment(row.enrichment) : undefined,
    }));
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("network-campuses", error);
    return [];
  }
}

export async function getCampusBySlug(slug: string): Promise<ChurchCampusWithDetails | null> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return null;
  try {
    const db = getDb();

    const rows = await db
      .select({
        campus: schema.churchCampuses,
        network: schema.churchNetworks,
        enrichment: schema.churchEnrichments,
      })
      .from(schema.churchCampuses)
      .innerJoin(schema.churchNetworks, eq(schema.churchNetworks.id, schema.churchCampuses.networkId))
      .leftJoin(schema.churchEnrichments, eq(schema.churchEnrichments.campusId, schema.churchCampuses.id))
      .where(and(eq(schema.churchCampuses.slug, slug), eq(schema.churchCampuses.status, "published")))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      ...mapCampus(row.campus),
      network: mapNetwork(row.network),
      enrichment: row.enrichment ? mapEnrichment(row.enrichment) : undefined,
    };
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("campus-by-slug", error);
    return null;
  }
}

export async function getAllNetworks(): Promise<ChurchNetwork[]> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return [];
  try {
    const db = getDb();
    const rows = await db.select().from(schema.churchNetworks).orderBy(asc(schema.churchNetworks.name));
    return rows.map(mapNetwork);
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("all-networks", error);
    return [];
  }
}

export async function getAllPublishedCampuses(): Promise<ChurchCampus[]> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || networkReadsUnavailable) return [];
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.churchCampuses)
      .where(eq(schema.churchCampuses.status, "published"))
      .orderBy(asc(schema.churchCampuses.name));

    return rows.map(mapCampus);
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("all-published-campuses", error);
    return [];
  }
}

async function getPublishedCampusesFiltered(
  filter: ReturnType<typeof eq> | ReturnType<typeof ilike>,
): Promise<ChurchCampusWithDetails[]> {
  if (isOfflinePublicBuild() || networkReadsUnavailable) return [];
  try {
    const db = getDb();
    const rows = await db
      .select({
        campus: schema.churchCampuses,
        network: schema.churchNetworks,
        enrichment: schema.churchEnrichments,
      })
      .from(schema.churchCampuses)
      .innerJoin(schema.churchNetworks, eq(schema.churchNetworks.id, schema.churchCampuses.networkId))
      .leftJoin(schema.churchEnrichments, eq(schema.churchEnrichments.campusId, schema.churchCampuses.id))
      .where(and(eq(schema.churchCampuses.status, "published"), filter))
      .orderBy(asc(schema.churchCampuses.name));

    return rows.map((row) => ({
      ...mapCampus(row.campus),
      network: mapNetwork(row.network),
      enrichment: row.enrichment ? mapEnrichment(row.enrichment) : undefined,
    }));
  } catch (error) {
    networkReadsUnavailable = true;
    logNetworkFallback("published-campuses-filtered", error);
    return [];
  }
}

export async function getPublishedCampusesByCountry(country: string): Promise<ChurchCampusWithDetails[]> {
  if (!hasDatabaseConfig()) return [];
  return getPublishedCampusesFiltered(ilike(schema.churchCampuses.country, country));
}

export async function getPublishedCampusesByCity(city: string): Promise<ChurchCampusWithDetails[]> {
  if (!hasDatabaseConfig()) return [];
  return getPublishedCampusesFiltered(ilike(schema.churchCampuses.city, city));
}
