import { and, eq, gt, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";

type RateLimitEntry = {
  value: number;
  expiresAt: number;
};

const memoryRateLimits = new Map<string, RateLimitEntry>();
let rateLimitStoreUnavailable = false;

function getMemoryRateLimit(key: string): RateLimitEntry | null {
  const existing = memoryRateLimits.get(key);
  if (!existing) return null;
  if (existing.expiresAt <= Date.now()) {
    memoryRateLimits.delete(key);
    return null;
  }
  return existing;
}

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const ip = forwarded.split(",")[0]?.trim();
  return ip || null;
}

export function isBotTrapFilled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export async function hasKvRateLimit(key: string): Promise<boolean> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || rateLimitStoreUnavailable) {
    return Boolean(getMemoryRateLimit(key));
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        key: schema.appRateLimits.key,
        value: schema.appRateLimits.value,
      })
      .from(schema.appRateLimits)
      .where(and(eq(schema.appRateLimits.key, key), gt(schema.appRateLimits.expiresAt, new Date())))
      .limit(1);

    return Boolean(rows[0]);
  } catch {
    rateLimitStoreUnavailable = true;
    return Boolean(getMemoryRateLimit(key));
  }
}

export async function setKvRateLimit(key: string, ttlSeconds: number): Promise<void> {
  if (!isOfflinePublicBuild() && hasDatabaseConfig() && !rateLimitStoreUnavailable) {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const db = getDb();
      await db
        .insert(schema.appRateLimits)
        .values({
          key,
          value: 1,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.appRateLimits.key,
          set: {
            value: 1,
            expiresAt,
            updatedAt: new Date(),
          },
        });
      return;
    } catch {
      rateLimitStoreUnavailable = true;
    }
  }

  memoryRateLimits.set(key, {
    value: 1,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function getRateLimitValue(key: string): Promise<number> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || rateLimitStoreUnavailable) {
    return getMemoryRateLimit(key)?.value ?? 0;
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ value: schema.appRateLimits.value })
      .from(schema.appRateLimits)
      .where(and(eq(schema.appRateLimits.key, key), gt(schema.appRateLimits.expiresAt, new Date())))
      .limit(1);

    return Number(rows[0]?.value ?? 0);
  } catch {
    rateLimitStoreUnavailable = true;
    return getMemoryRateLimit(key)?.value ?? 0;
  }
}

export async function incrementRateLimitValue(key: string, ttlSeconds: number): Promise<number> {
  if (isOfflinePublicBuild() || !hasDatabaseConfig() || rateLimitStoreUnavailable) {
    const existing = getMemoryRateLimit(key);
    const nextValue = (existing?.value ?? 0) + 1;
    memoryRateLimits.set(key, {
      value: nextValue,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return nextValue;
  }

  try {
    const db = getDb();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const rows = await db
      .insert(schema.appRateLimits)
      .values({
        key,
        value: 1,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.appRateLimits.key,
        set: {
          value: sql`${schema.appRateLimits.value} + 1`,
          expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning({ value: schema.appRateLimits.value });

    return Number(rows[0]?.value ?? 1);
  } catch {
    rateLimitStoreUnavailable = true;
    const existing = getMemoryRateLimit(key);
    const nextValue = (existing?.value ?? 0) + 1;
    memoryRateLimits.set(key, {
      value: nextValue,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return nextValue;
  }
}
