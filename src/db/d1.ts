import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as d1Schema from "./d1-schema";

// Explicitly opt-in during migration; the active app still uses Neon.
export function getD1Database() {
  const { env } = getCloudflareContext();
  const binding = (env as unknown as { GOSPEL_D1?: AnyD1Database }).GOSPEL_D1;
  if (!binding) throw new Error("Missing GOSPEL_D1 binding");
  return drizzle(binding, { schema: d1Schema });
}

export { d1Schema };
