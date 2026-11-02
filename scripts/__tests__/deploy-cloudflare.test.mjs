import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const script = fileURLToPath(new URL("../deploy-cloudflare.mjs", import.meta.url));

// Exercise the deploy command's exit status without building or deploying.
async function runDeploy(t, failingPath) {
  const dir = await mkdtemp(join(tmpdir(), "deploy-check-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "bin"));
  await writeFile(join(dir, "bin", "pnpm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const server = createServer((req, res) => {
    res.statusCode = req.url === failingPath ? 500 : 200;
    if (req.url === "/church") res.end('<a href="/church/test-church">Church</a>');
    else if (req.url === "/sitemap.xml") res.end("<sitemapindex></sitemapindex>");
    else res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const child = spawn(process.execPath, [script], {
    cwd: dir,
    env: { ...process.env, PATH: join(dir, "bin"), CRON_SECRET: "test-secret",
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${server.address().port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  return { code, output };
}

test("deploy succeeds only when revalidation and warm requests succeed", async (t) => {
  assert.equal((await runDeploy(t)).code, 0);
});

for (const route of ["/api/cron/sync?full=true", "/church/test-church", "/sitemap.xml"]) {
  test(`deploy fails when ${route} returns 500`, async (t) => {
    const result = await runDeploy(t, route);
    assert.equal(result.code, 1, result.output);
  });
}
