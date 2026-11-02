import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
import { createD1ScriptSql } from "./lib/d1-sql.mjs";
const sql = createD1ScriptSql();

const [total] = await sql`SELECT count(*) AS n FROM churches`;
const [recent] = await sql`SELECT count(*) AS n FROM churches WHERE created_at > (unixepoch() * 1000 - 30 * 86400000)`;
const [last7] = await sql`SELECT count(*) AS n FROM churches WHERE created_at > (unixepoch() * 1000 - 7 * 86400000)`;

console.log(`Total: ${total.n}`);
console.log(`Last 30 days: ${recent.n}`);
console.log(`Last 7 days: ${last7.n}`);

const bySource = await sql`
  SELECT discovery_source, count(*) AS n
  FROM churches
  WHERE created_at > (unixepoch() * 1000 - 30 * 86400000)
  GROUP BY discovery_source
  ORDER BY n DESC
  LIMIT 20
`;
console.log("\nTop discovery sources (last 30d):");
for (const r of bySource) console.log(`  ${r.n.toString().padStart(5)}  ${r.discovery_source || "(null)"}`);
