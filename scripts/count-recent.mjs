import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const [total] = await sql`SELECT count(*)::int AS n FROM churches`;
const [recent] = await sql`SELECT count(*)::int AS n FROM churches WHERE created_at > now() - interval '30 days'`;
const [last7] = await sql`SELECT count(*)::int AS n FROM churches WHERE created_at > now() - interval '7 days'`;

console.log(`Total: ${total.n}`);
console.log(`Last 30 days: ${recent.n}`);
console.log(`Last 7 days: ${last7.n}`);

const bySource = await sql`
  SELECT discovery_source, count(*)::int AS n
  FROM churches
  WHERE created_at > now() - interval '30 days'
  GROUP BY discovery_source
  ORDER BY n DESC
  LIMIT 20
`;
console.log("\nTop discovery sources (last 30d):");
for (const r of bySource) console.log(`  ${r.n.toString().padStart(5)}  ${r.discovery_source || "(null)"}`);
