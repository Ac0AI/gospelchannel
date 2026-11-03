import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT = process.cwd();
loadLocalEnv(ROOT);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://gospelchannel.com").replace(/\/+$/, "");
const DEFAULT_WARM_PATHS = [
  "/",
  "/church",
  "/church-near-me",
  "/church?page=2",
  "/church?q=berlin",
  "/church/suggest",
  "/for-churches",
  "/contact",
  "/robots.txt",
  "/sitemap.xml",
];
const SKIP_WARM_FLAGS = new Set(["--skip-warm", "--no-warm"]);
const SITEMAP_WARM_PASSES = 2;
const PRIMARY_WARM_CONCURRENCY = 6;
// Sitemap chunks each render 5k URLs from D1. Running them concurrently piles
// up cold-isolate hydrations and trips Cloudflare's gateway timeout (503).
// Serialize them so the first chunk warms the R2 unstable_cache layer and the
// rest hit it warm.
const SITEMAP_WARM_CONCURRENCY = 2;

const WORKER_NAME = "gospelmigration";
// Sidor som måste svara 200 i den lokala kontrollen före trafik. Lokalt finns
// ingen D1-data, men de här renderar ändå via ögonblicksbilderna. Den 3 nov 2026
// gav en trasig build 500 + loadManifest på just dessa, både lokalt och live.
const LOCAL_CHECK_PATHS = ["/robots.txt", "/", "/about", "/guides", "/church"];
// Sidor som måste svara 200 live direkt efter att den nya versionen fått trafik.
const SMOKE_PATHS = ["/", "/church", "/guides", "/robots.txt", "/sitemap.xml"];
const SMOKE_ATTEMPTS = Number(process.env.DEPLOY_SMOKE_ATTEMPTS || 3);
// Ge den nya versionen tid att nå ut innan livekontrollen, annars kan den svara
// från den gamla och släppa igenom en trasig version.
const SMOKE_DELAY_MS = Number(process.env.DEPLOY_SMOKE_DELAY_MS ?? 15000);
const SMOKE_RETRY_MS = Number(process.env.DEPLOY_SMOKE_RETRY_MS ?? 5000);
const LOCAL_CRASH_PATTERN = /loadManifest|Uncaught|error code: 1101/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

function assertSuccess(result, label) {
  if (result.status === 0) return;
  const status = result.status ?? 1;
  console.error(`[deploy] ${label} failed with exit code ${status}.`);
  process.exit(status);
}

function buildWarmUrl(path) {
  return `${SITE_URL}${path}`;
}

function extractXmlLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
}

async function collectWarmUrls() {
  const urls = new Set(DEFAULT_WARM_PATHS.map(buildWarmUrl));
  const sitemapUrls = [];

  try {
    const response = await fetch(buildWarmUrl("/church"), { redirect: "follow" });
    if (!response.ok) {
      console.warn(`[deploy] Prewarm seed request failed: /church returned ${response.status}.`);
      return { urls: [...urls], sitemapUrls: [] };
    }

    const html = await response.text();
    const slugs = [...html.matchAll(/href="\/church\/([a-z0-9-]+)"/g)]
      .map((match) => match[1])
      .filter((slug) => slug !== "suggest")
      .slice(0, 80);

    for (const slug of slugs) {
      urls.add(buildWarmUrl(`/church/${slug}`));
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[deploy] Could not collect dynamic prewarm URLs: ${detail}`);
  }

  try {
    const response = await fetch(buildWarmUrl("/sitemap.xml"), { redirect: "follow" });
    if (!response.ok) {
      console.warn(`[deploy] Sitemap seed request failed: /sitemap.xml returned ${response.status}.`);
    } else {
      const xml = await response.text();
      const discovered = extractXmlLocs(xml)
        .filter((url) => url.startsWith(`${SITE_URL}/sitemap-chunk/`));

      for (const url of discovered) {
        sitemapUrls.push(url);
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[deploy] Could not collect sitemap warm URLs: ${detail}`);
  }

  sitemapUrls.unshift(buildWarmUrl("/sitemap.xml"));
  return {
    urls: [...urls],
    sitemapUrls: [...new Set(sitemapUrls)],
  };
}

async function warmUrls(urls, concurrency = PRIMARY_WARM_CONCURRENCY) {
  const results = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < urls.length) {
      const url = urls[currentIndex++];
      const startedAt = performance.now();

      try {
        const response = await fetch(url, { redirect: "follow" });
        await response.arrayBuffer();
        results.push({
          url,
          status: response.status,
          ms: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        results.push({
          url,
          status: "ERR",
          ms: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function logWarmResults(results) {
  const failures = results.filter((result) => result.status !== 200);
  const slowest = [...results]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map((result) => `${result.status} ${result.ms}ms ${result.url}`);

  if (failures.length > 0) {
    process.exitCode = 1;
    console.warn("[deploy] Prewarm completed with warnings:");
    for (const failure of failures.slice(0, 10)) {
      console.warn(`- ${failure.status} ${failure.ms}ms ${failure.url}${failure.error ? ` (${failure.error})` : ""}`);
    }
  } else {
    console.log(`[deploy] Prewarmed ${results.length} URLs.`);
  }

  if (slowest.length > 0) {
    console.log("[deploy] Slowest warm requests:");
    for (const line of slowest) {
      console.log(`- ${line}`);
    }
  }
}

async function prewarmSite() {
  const { urls, sitemapUrls } = await collectWarmUrls();
  const primaryResults = await warmUrls(urls, PRIMARY_WARM_CONCURRENCY);
  logWarmResults(primaryResults);

  for (let pass = 1; pass <= SITEMAP_WARM_PASSES; pass += 1) {
    if (sitemapUrls.length === 0) {
      break;
    }

    const passResults = await warmUrls(sitemapUrls, SITEMAP_WARM_CONCURRENCY);
    const failures = passResults.filter((result) => result.status !== 200);
    if (failures.length > 0) {
      process.exitCode = 1;
      console.warn(`[deploy] Sitemap warm pass ${pass} completed with warnings.`);
      for (const failure of failures.slice(0, 10)) {
        console.warn(`- ${failure.status} ${failure.ms}ms ${failure.url}${failure.error ? ` (${failure.error})` : ""}`);
      }
    } else {
      console.log(`[deploy] Sitemap warm pass ${pass} completed for ${passResults.length} routes.`);
    }
  }
}

async function checkPaths(baseUrl, paths) {
  const failures = [];
  for (const path of paths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
      await response.arrayBuffer();
      if (response.status !== 200) failures.push(`${response.status} ${path}`);
    } catch (error) {
      failures.push(`ERR ${path} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return failures;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Kör den byggda Workern lokalt i workerd och kräver 200 på nyckelsidorna INNAN
// något laddas upp. Fångar fel som bara syns när Workern körs (t.ex. en OpenNext
// som inte känner till en ny Next-version), inte i next build.
async function localCheckBeforeTraffic() {
  if (process.env.DEPLOY_SKIP_LOCAL_CHECK === "1") {
    console.warn("[deploy] Lokal kontroll överhoppad (DEPLOY_SKIP_LOCAL_CHECK=1).");
    return;
  }
  let baseUrl = process.env.DEPLOY_LOCAL_CHECK_URL;
  let child = null;
  let log = "";
  if (!baseUrl) {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn("pnpm", ["exec", "wrangler", "dev", "--local", "--ip", "127.0.0.1", "--port", String(port)], {
      cwd: ROOT,
      env: process.env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => { log += chunk; });
    child.stderr.on("data", (chunk) => { log += chunk; });
  }

  let ready = false;
  for (let attempt = 0; attempt < 90 && !ready; attempt += 1) {
    try {
      await fetch(`${baseUrl}/robots.txt`);
      ready = true;
    } catch {
      await sleep(1000);
    }
  }
  const failures = ready ? await checkPaths(baseUrl, LOCAL_CHECK_PATHS) : ["lokala Workern startade inte"];
  const crashed = LOCAL_CRASH_PATTERN.test(log);
  if (child) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // redan avslutad
    }
  }

  if (failures.length > 0 || crashed) {
    console.error("[deploy] Lokal kontroll föll. Inget har laddats upp och sajten är orörd.");
    for (const failure of failures) console.error(`- ${failure}`);
    if (crashed) console.error(`- workerd-loggen innehåller ${log.match(LOCAL_CRASH_PATTERN)?.[0]}`);
    process.exit(1);
  }
  console.log(`[deploy] Lokal kontroll OK (${LOCAL_CHECK_PATHS.length} sidor i workerd).`);
}

// Den version som har trafik nu, så att en trasig deploy kan rullas tillbaka.
function activeVersionId() {
  const result = spawnSync("pnpm", ["exec", "wrangler", "deployments", "list", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  try {
    const deployments = JSON.parse(result.stdout);
    const latest = Array.isArray(deployments) ? deployments.at(-1) : null;
    const versions = [...(latest?.versions ?? [])].sort((a, b) => b.percentage - a.percentage);
    return versions[0]?.version_id ?? null;
  } catch {
    return null;
  }
}

// Kontrollerar livesajten efter deployen och rullar automatiskt tillbaka till
// föregående version om någon nyckelsida inte svarar 200.
async function smokeCheckOrRollback(previousVersionId) {
  if (SMOKE_DELAY_MS > 0) await sleep(SMOKE_DELAY_MS);
  let failures = [];
  for (let attempt = 1; attempt <= SMOKE_ATTEMPTS; attempt += 1) {
    failures = await checkPaths(SITE_URL, SMOKE_PATHS);
    if (failures.length === 0) {
      console.log(`[deploy] Livekontroll OK (${SMOKE_PATHS.length} sidor).`);
      return;
    }
    if (attempt < SMOKE_ATTEMPTS) await sleep(SMOKE_RETRY_MS);
  }

  console.error("[deploy] Livekontrollen föll efter deployen:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`[deploy] Rullar automatiskt tillbaka till ${previousVersionId} ...`);
  const rollback = runCommand("pnpm", [
    "exec", "wrangler", "rollback", previousVersionId, "--name", WORKER_NAME, "-y",
    "--message", "Automatisk tillbakarullning: livekontrollen föll efter deploy",
  ]);
  if (rollback.status !== 0) {
    console.error(`[deploy] TILLBAKARULLNINGEN MISSLYCKADES. Kör för hand: pnpm exec wrangler rollback ${previousVersionId} --name ${WORKER_NAME} -y`);
  } else {
    const after = await checkPaths(SITE_URL, SMOKE_PATHS);
    console.error(after.length === 0
      ? "[deploy] Tillbakarullad. Sajten svarar igen på den tidigare versionen."
      : `[deploy] Tillbakarullad, men sajten svarar fortfarande fel: ${after.join(", ")}`);
  }
  process.exit(1);
}

function shouldSkipWarm() {
  return process.argv.slice(2).some((arg) => SKIP_WARM_FLAGS.has(arg));
}

// The offline build seeds the incremental cache with empty data (facet lists,
// stats) that otherwise lingers until each entry's hourly TTL or the 04:00
// cron. Flush everything right after deploy so the prewarm below re-renders
// with live D1 data instead of baking the empty entries into the edge.
async function revalidateAfterDeploy() {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    throw new Error("[deploy] CRON_SECRET missing; cannot revalidate the offline build cache.");
  }
  try {
    const response = await fetch(`${SITE_URL}/api/cron/sync?full=true`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (response.ok) {
      console.log("[deploy] Post-deploy revalidation OK (full cache flush).");
    } else if (response.status === 401) {
      throw new Error("[deploy] Post-deploy revalidation got 401: local CRON_SECRET does not match the deployed secret.");
    } else {
      throw new Error(`[deploy] Post-deploy revalidation failed with ${response.status}.`);
    }
  } catch (error) {
    throw new Error("[deploy] Post-deploy revalidation failed; release verification is incomplete.", { cause: error });
  }
}

console.log("[deploy] Building Cloudflare bundle...");
assertSuccess(runCommand("pnpm", ["run", "cf:build"]), "cf:build");

console.log("[deploy] Lokal kontroll i workerd före trafik...");
await localCheckBeforeTraffic();

if (process.argv.slice(2).includes("--check-only")) {
  console.log("[deploy] --check-only: byggd och lokalt kontrollerad, inget uppladdat.");
  process.exit(0);
}

const previousVersionId = activeVersionId();
if (!previousVersionId) {
  console.error("[deploy] Hittade inte den aktiva versionen (wrangler deployments list), så en trasig deploy kan inte rullas tillbaka. Avbryter.");
  process.exit(1);
}
console.log(`[deploy] Aktiv version före deploy: ${previousVersionId}`);

console.log("[deploy] Attempting OpenNext deploy...");
const openNextDeploy = runCommand("pnpm", ["exec", "opennextjs-cloudflare", "deploy"]);

if (openNextDeploy.status !== 0) {
  console.warn("[deploy] OpenNext deploy failed. Falling back to Wrangler deploy with the built bundle.");
  assertSuccess(
    runCommand("pnpm", ["exec", "wrangler", "deploy"], {
      env: { OPEN_NEXT_DEPLOY: "true" },
    }),
    "wrangler deploy",
  );
}

await smokeCheckOrRollback(previousVersionId);

await revalidateAfterDeploy();

if (shouldSkipWarm()) {
  console.log("[deploy] Skipping post-deploy prewarm.");
} else {
  console.log(`[deploy] Prewarming ${SITE_URL} ...`);
  await prewarmSite();
}
