import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT = process.cwd();
loadLocalEnv(ROOT);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://gospelchannel.com").replace(/\/+$/, "");
const DEFAULT_WARM_PATHS = [
  "/",
  "/church",
  "/church?page=2",
  "/church?q=berlin",
  "/church/suggest",
  "/for-churches",
  "/contact",
  "/prayerwall",
  "/prayerwall/country/united-states",
  "/sitemap.xml",
  "/sitemap-chunk/0.xml",
  "/robots.txt",
];
const SKIP_WARM_FLAGS = new Set(["--skip-warm", "--no-warm"]);
const SITEMAP_WARM_PASSES = 2;

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
      return urls;
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
        urls.add(url);
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

async function warmUrls(urls) {
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

  await Promise.all(Array.from({ length: 6 }, worker));
  return results;
}

function logWarmResults(results) {
  const failures = results.filter((result) => result.status !== 200);
  const slowest = [...results]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map((result) => `${result.status} ${result.ms}ms ${result.url}`);

  if (failures.length > 0) {
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
  const primaryResults = await warmUrls(urls);
  logWarmResults(primaryResults);

  for (let pass = 2; pass <= SITEMAP_WARM_PASSES; pass += 1) {
    if (sitemapUrls.length === 0) {
      break;
    }

    const passResults = await warmUrls(sitemapUrls);
    const failures = passResults.filter((result) => result.status !== 200);
    if (failures.length > 0) {
      console.warn(`[deploy] Sitemap warm pass ${pass} completed with warnings.`);
      for (const failure of failures.slice(0, 10)) {
        console.warn(`- ${failure.status} ${failure.ms}ms ${failure.url}${failure.error ? ` (${failure.error})` : ""}`);
      }
    } else {
      console.log(`[deploy] Sitemap warm pass ${pass} completed for ${passResults.length} routes.`);
    }
  }
}

function shouldSkipWarm() {
  return process.argv.slice(2).some((arg) => SKIP_WARM_FLAGS.has(arg));
}

console.log("[deploy] Building Cloudflare bundle...");
assertSuccess(runCommand("pnpm", ["run", "cf:build"]), "cf:build");

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

if (shouldSkipWarm()) {
  console.log("[deploy] Skipping post-deploy prewarm.");
} else {
  console.log(`[deploy] Prewarming ${SITE_URL} ...`);
  await prewarmSite();
}
