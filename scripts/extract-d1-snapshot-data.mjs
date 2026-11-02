import { createReadStream, createWriteStream, existsSync, unlinkSync } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";

const [snapshot, output] = process.argv.slice(2);
if (!snapshot || !output) throw new Error("Usage: node scripts/extract-d1-snapshot-data.mjs snapshot.sql data.sql");
if (existsSync(output)) throw new Error("Refusing to overwrite output");
const lines = createInterface({ input: createReadStream(snapshot), crlfDelay: Infinity });
const out = createWriteStream(output, { flags: "wx", mode: 0o600 });
let started = false;
let finished = false;
try {
  for await (const line of lines) {
    if (line === "PRAGMA defer_foreign_keys = true;") started = true;
    if (started && !out.write(`${line}\n`)) await once(out, "drain");
  }
  if (!started) throw new Error("Snapshot data marker missing");
  out.end();
  await once(out, "finish");
  finished = true;
} finally {
  lines.close();
  out.destroy();
  if (!finished && existsSync(output)) unlinkSync(output);
}
