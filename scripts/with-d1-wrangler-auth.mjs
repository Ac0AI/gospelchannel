// Run a local maintenance command with the existing Wrangler login. Credentials
// stay in memory; Wrangler refreshes OAuth through its supported CLI.
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { loadLocalEnv } from "./lib/local-env.mjs";

loadLocalEnv(process.cwd());
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Usage: node scripts/with-d1-wrangler-auth.mjs COMMAND [ARGS...]");
if (!process.env.GOSPEL_D1_DATABASE_ID || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("Set GOSPEL_D1_DATABASE_ID and CLOUDFLARE_ACCOUNT_ID");
}
const authEnv = { ...process.env };
delete authEnv.CLOUDFLARE_API_TOKEN;
delete authEnv.CLOUDFLARE_API_KEY;
delete authEnv.CLOUDFLARE_EMAIL;
const require = createRequire(import.meta.url);
const wrangler = require.resolve("wrangler/bin/wrangler.js");
const result = JSON.parse(execFileSync(process.execPath, [wrangler, "auth", "token", "--json", "--env-file", "/dev/null"], {
  env: authEnv, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
}));
if (!result.token) throw new Error("Wrangler login did not provide an access token");
const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, GOSPEL_D1_API_TOKEN: result.token } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
