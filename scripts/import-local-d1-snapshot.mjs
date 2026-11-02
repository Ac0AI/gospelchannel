import { spawn } from "node:child_process";
import { once } from "node:events";
import { createReadStream, existsSync } from "node:fs";

const [snapshot, database] = process.argv.slice(2);
if (!snapshot || !database) throw new Error("Usage: node scripts/import-local-d1-snapshot.mjs snapshot.sql snapshot.sqlite");
if (existsSync(database)) throw new Error("Refusing to overwrite an existing SQLite database");
process.umask(0o077);
const child = spawn("sqlite3", ["-bail", database], { stdio: ["pipe", "ignore", "pipe"] });
let error = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { error += chunk; });
child.stdin.on("error", () => {});
const completion = new Promise((resolve) => {
  child.once("error", (cause) => resolve(cause));
  child.once("exit", (code) => resolve(code === 0 ? null : new Error(`SQLite import failed: ${error.slice(-1000)}`)));
});
try {
  child.stdin.write("PRAGMA foreign_keys=ON;\nBEGIN;\n");
  for await (const chunk of createReadStream(snapshot)) {
    if (!child.stdin.write(chunk)) await once(child.stdin, "drain");
  }
  child.stdin.end("\nCOMMIT;\n");
  const failure = await completion;
  if (failure) throw failure;
  console.log("Snapshot imported locally.");
} catch (error) {
  child.stdin.destroy();
  child.kill();
  throw error;
}
