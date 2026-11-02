import { readFileSync } from "node:fs";
import { createD1Client } from "./lib/cloudflare-d1.mjs";
import { ident } from "./d1-snapshot-codec.mjs";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: node scripts/verify-d1-remote-counts.mjs snapshot.sql.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entries = Object.entries(manifest.tables);
if (!entries.length || entries.some(([name]) => !/^[a-z_]+$/.test(name))) throw new Error("Invalid snapshot manifest");
const results = await createD1Client(process.env).batch(entries.map(([name]) => ({ sql: `SELECT count(*) AS count FROM ${ident(name)}`, params: [] })));
if (results.length !== entries.length) throw new Error("D1 returned an incomplete count batch");
let failed = false;
for (let index = 0; index < entries.length; index++) {
  const [name, expected] = entries[index];
  const count = results[index].results?.[0]?.count;
  const matches = count === expected.count;
  if (!matches) failed = true;
  console.log(`${name}: ${count} rows, ${matches ? "match" : "MISMATCH"}`);
}
if (failed) throw new Error("Remote D1 counts do not match the snapshot");
