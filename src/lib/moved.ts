import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getCatalogVideosByIds } from "@/lib/catalog";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { CONTENT_BASE_DATE } from "@/lib/utils";

type DailyScore = Record<string, number>;

const memoryCounts = new Map<string, number>();
const memoryDaily = new Map<string, DailyScore>();

function isKvEnabled(): boolean {
  return hasDatabaseConfig();
}

function dateKey(offsetDays = 0): string {
  const [year, month, day] = CONTENT_BASE_DATE.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

function parseZrangeWithScores(raw: unknown): Array<{ member: string; score: number }> {
  if (!Array.isArray(raw)) {
    return [];
  }

  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "member" in raw[0]) {
    return (raw as Array<{ member: string; score: number }>).map((row) => ({
      member: String(row.member),
      score: Number(row.score),
    }));
  }

  const output: Array<{ member: string; score: number }> = [];
  for (let i = 0; i < raw.length; i += 2) {
    const member = raw[i];
    const score = raw[i + 1];
    if (typeof member === "string") {
      output.push({ member, score: Number(score ?? 0) });
    }
  }
  return output;
}

export async function incrementMoved(videoId: string): Promise<number> {
  if (!isKvEnabled()) {
    const current = (memoryCounts.get(videoId) ?? 0) + 1;
    memoryCounts.set(videoId, current);

    const key = dateKey(0);
    const bucket = memoryDaily.get(key) ?? {};
    bucket[videoId] = (bucket[videoId] ?? 0) + 1;
    memoryDaily.set(key, bucket);

    return current;
  }

  const db = getDb();
  await db.insert(schema.videoMovedEvents).values({
    videoId,
    createdAt: new Date(),
  });

  const rows = await db
    .insert(schema.videoMovedTotals)
    .values({
      videoId,
      movedCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.videoMovedTotals.videoId,
      set: {
        movedCount: sql`${schema.videoMovedTotals.movedCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ movedCount: schema.videoMovedTotals.movedCount });

  return Number(rows[0]?.movedCount ?? 1);
}

export async function getMovedCounts(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) {
    return {};
  }

  if (!isKvEnabled()) {
    const output: Record<string, number> = {};
    for (const id of ids) {
      output[id] = memoryCounts.get(id) ?? 0;
    }
    return output;
  }

  const db = getDb();
  const rows = await db
    .select({
      videoId: schema.videoMovedTotals.videoId,
      movedCount: schema.videoMovedTotals.movedCount,
    })
    .from(schema.videoMovedTotals)
    .where(inArray(schema.videoMovedTotals.videoId, ids));

  const output: Record<string, number> = {};
  ids.forEach((id) => {
    output[id] = 0;
  });
  rows.forEach((row) => {
    output[row.videoId] = Number(row.movedCount ?? 0);
  });

  return output;
}

export async function getTopMovedIds(periodDays = 7, limit = 8): Promise<string[]> {
  if (!isKvEnabled()) {
    const scores: Record<string, number> = {};
    for (let day = 0; day < periodDays; day += 1) {
      const bucket = memoryDaily.get(dateKey(day)) ?? {};
      for (const [videoId, value] of Object.entries(bucket)) {
        scores[videoId] = (scores[videoId] ?? 0) + value;
      }
    }

    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([videoId]) => videoId);
  }

  const db = getDb();
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      videoId: schema.videoMovedEvents.videoId,
      movedCount: sql<number>`count(*)::int`,
    })
    .from(schema.videoMovedEvents)
    .where(gte(schema.videoMovedEvents.createdAt, since))
    .groupBy(schema.videoMovedEvents.videoId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((row) => row.videoId);
}

export async function getTopMovedVideos(periodDays = 7, limit = 8) {
  const topIds = await getTopMovedIds(periodDays, limit);
  const counts = await getMovedCounts(topIds);
  const videos = await getCatalogVideosByIds(topIds);

  const byId = new Map(videos.map((video) => [video.videoId, video]));
  return topIds
    .map((videoId) => {
      const video = byId.get(videoId);
      if (!video) {
        return null;
      }

      return {
        ...video,
        movedCount: counts[videoId] ?? 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}
