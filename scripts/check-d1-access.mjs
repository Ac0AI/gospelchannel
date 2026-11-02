import { randomUUID } from "node:crypto";
import { createD1Client } from "./lib/cloudflare-d1.mjs";

const client = createD1Client(process.env);
const table = `_migration_access_${randomUUID().replaceAll("-", "")}`;
// The batch is atomic and leaves no probe table or records behind.
await client.batch([
  { sql: `CREATE TABLE "${table}" (value INTEGER NOT NULL)`, params: [] },
  { sql: `INSERT INTO "${table}" VALUES (1)`, params: [] },
  { sql: `DROP TABLE "${table}"`, params: [] },
]);
const [{ count }] = await client.query("SELECT count(*) AS count FROM churches");
if (count < 1) throw new Error("The selected Gospel directory is empty");
console.log(`D1 read/write access verified; ${count} churches.`);
