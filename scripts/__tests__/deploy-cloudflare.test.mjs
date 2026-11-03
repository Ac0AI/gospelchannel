import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const script = fileURLToPath(new URL("../deploy-cloudflare.mjs", import.meta.url));
const DEPLOYMENTS = JSON.stringify([
  { versions: [{ version_id: "old-version", percentage: 100 }] },
  { versions: [{ version_id: "prev-123", percentage: 100 }] },
]);

async function startServer(t, failingPath) {
  const server = createServer((req, res) => {
    res.statusCode = req.url === failingPath ? 500 : 200;
    if (req.url === "/church") res.end('<a href="/church/test-church">Church</a>');
    else if (req.url === "/sitemap.xml") res.end("<sitemapindex></sitemapindex>");
    else res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

// Kör deploy-kommandot utan att bygga eller deploya. pnpm är en attrapp som
// loggar sina argument och svarar på `wrangler deployments list`.
async function runDeploy(t, { siteFailing, localFailing, deployments = DEPLOYMENTS, args = [] } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "deploy-check-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "bin"));
  await writeFile(join(dir, "deployments.json"), deployments);
  const pnpmLog = join(dir, "pnpm.log");
  await writeFile(join(dir, "bin", "pnpm"), [
    "#!/bin/sh",
    `echo "$*" >> "${pnpmLog}"`,
    'case "$*" in',
    `  *"deployments list"*) /bin/cat "${join(dir, "deployments.json")}" ;;`,
    "esac",
    "exit 0",
    "",
  ].join("\n"), { mode: 0o755 });

  const siteUrl = await startServer(t, siteFailing);
  const localUrl = await startServer(t, localFailing);
  const child = spawn(process.execPath, [script, ...args], {
    cwd: dir,
    env: {
      ...process.env,
      PATH: join(dir, "bin"),
      CRON_SECRET: "test-secret",
      NEXT_PUBLIC_SITE_URL: siteUrl,
      DEPLOY_LOCAL_CHECK_URL: localUrl,
      DEPLOY_SMOKE_DELAY_MS: "0",
      DEPLOY_SMOKE_RETRY_MS: "0",
      DEPLOY_SMOKE_ATTEMPTS: "2",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  const commands = await readFile(pnpmLog, "utf8").catch(() => "");
  return { code, output, commands };
}

test("deploy succeeds only when revalidation and warm requests succeed", async (t) => {
  const result = await runDeploy(t);
  assert.equal(result.code, 0, result.output);
  assert.match(result.commands, /opennextjs-cloudflare deploy/);
  assert.doesNotMatch(result.commands, /rollback/);
});

for (const route of ["/api/cron/sync?full=true", "/church/test-church"]) {
  test(`deploy fails when ${route} returns 500`, async (t) => {
    const result = await runDeploy(t, { siteFailing: route });
    assert.equal(result.code, 1, result.output);
    assert.doesNotMatch(result.commands, /rollback/);
  });
}

test("a failing local check stops the deploy before anything is uploaded", async (t) => {
  const result = await runDeploy(t, { localFailing: "/about" });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /Lokal kontroll föll/);
  assert.doesNotMatch(result.commands, /deploy|rollback/);
});

for (const route of ["/guides", "/sitemap.xml"]) {
  test(`a failing live check after deploy (${route}) rolls back to the previous version`, async (t) => {
    const result = await runDeploy(t, { siteFailing: route });
    assert.equal(result.code, 1, result.output);
    assert.match(result.commands, /opennextjs-cloudflare deploy/);
    assert.match(result.commands, /wrangler rollback prev-123 --name gospelmigration -y/);
  });
}

test("deploy refuses to start when the active version cannot be found", async (t) => {
  const result = await runDeploy(t, { deployments: "[]" });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /kan inte rullas tillbaka/);
  assert.doesNotMatch(result.commands, /opennextjs-cloudflare deploy/);
});

test("--check-only builds and checks locally but never deploys", async (t) => {
  const result = await runDeploy(t, { args: ["--check-only"] });
  assert.equal(result.code, 0, result.output);
  assert.match(result.commands, /run cf:build/);
  assert.doesNotMatch(result.commands, /opennextjs-cloudflare deploy|wrangler deploy|rollback/);
});
