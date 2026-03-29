import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

let sqlClient: ReturnType<typeof neon> | null = null;
let dbClient: ReturnType<typeof drizzle> | null = null;

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!value) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  return value;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
}

export function getSql() {
  if (!sqlClient) {
    sqlClient = neon(getDatabaseUrl());
  }
  return sqlClient;
}

export function getDb() {
  if (!dbClient) {
    dbClient = drizzle(getSql(), { schema });
  }
  return dbClient;
}

export { schema };
