import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./d1-schema";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { createD1Sql } from "./d1-sql";
import { createD1HttpDatabase, createD1HttpSql } from "./d1-http";

function nodeConfig() {
  // OpenNext includes .env files in its bundle. Node maintenance credentials
  // must never override the binding supplied to a running Worker.
  try {
    getCloudflareContext();
    return null;
  } catch {
    // No Worker request context: local Node tools may use the HTTP adapter.
  }
  if (!process.env.GOSPEL_D1_DATABASE_ID) return null;
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.GOSPEL_D1_DATABASE_ID,
    token: process.env.GOSPEL_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
  };
}

export function getD1Binding(): AnyD1Database {
  const { env } = getCloudflareContext();
  const binding = (env as unknown as { GOSPEL_D1?: AnyD1Database }).GOSPEL_D1;
  if (!binding) throw new Error("Missing GOSPEL_D1 database binding");
  return binding;
}

/**
 * Refreshes SQLite's index statistics (sqlite_stat1) so the planner picks the
 * selective index. Without them it guessed: city pages walked every approved
 * church through (status, directory_rank) instead of (status, city_slug), and
 * `slug IN (json_each) AND status = ...` scanned the status index instead of
 * the primary key (~4 billion rows read a day, D1 overloads after deploys,
 * 2026-11-04). Cloudflare's advice is to run it after creating indexes;
 * SQLite's is to run it periodically. Cheap: it only analyzes tables whose
 * statistics are missing or stale. Called by the daily cron.
 */
export async function optimizeDatabase(): Promise<void> {
  await getD1Binding().prepare("PRAGMA optimize").run();
}

export function hasDatabaseConfig(): boolean {
  const config = nodeConfig();
  if (config) return Boolean(config.accountId && config.token);
  try { return Boolean(getD1Binding()); } catch { return false; }
}

export function getSql() {
  const config = nodeConfig();
  if (config) return createD1HttpSql(config);
  return createD1Sql(getD1Binding());
}

export function getDb(): BaseSQLiteDatabase<"async", unknown, typeof schema> {
  const config = nodeConfig();
  if (config) return createD1HttpDatabase(config);
  return drizzle(getD1Binding(), { schema });
}

export { schema };
