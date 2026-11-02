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
