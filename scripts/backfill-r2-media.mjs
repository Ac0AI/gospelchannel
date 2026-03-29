import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const SNAPSHOT_PATH = resolve("src/data/churches.json");
const SUPABASE_PREFIX = "/storage/v1/object/public/church-assets/";
const MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
const FAILURE_LOG_PATH = resolve("tmp/media-backfill-failures.json");

function getArgValue(flag, fallback) {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1];
  return fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseLegacyMediaKey(url) {
  if (typeof url !== "string" || !url.includes(SUPABASE_PREFIX)) return null;

  try {
    const parsed = new URL(url);
    const index = parsed.pathname.indexOf(SUPABASE_PREFIX);
    if (index < 0) return null;
    const key = parsed.pathname.slice(index + SUPABASE_PREFIX.length).replace(/^\/+/, "");
    return key || null;
  } catch {
    return null;
  }
}

function toMediaUrl(key) {
  return `${MEDIA_BASE_URL}/${key}`;
}

async function uploadToR2({ key, buffer, contentType }) {
  const tempPath = resolve(tmpdir(), `gospel-media-${randomUUID()}`);
  await writeFile(tempPath, buffer);

  const args = [
    "wrangler",
    "r2",
    "object",
    "put",
    `church-assets/${key}`,
    "--remote",
    "--file",
    tempPath,
  ];

  if (contentType) {
    args.push("--content-type", contentType);
  }

  try {
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn("npx", args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", rejectPromise);

      child.on("close", (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(stderr || stdout || `wrangler exited with code ${code}`));
      });
    });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function main() {
  const limit = Number.parseInt(getArgValue("--limit", "0") || "0", 10) || 0;
  const startAt = Math.max(1, Number.parseInt(getArgValue("--start-at", "1") || "1", 10) || 1);
  const concurrency = Math.max(1, Number.parseInt(getArgValue("--concurrency", "3") || "3", 10) || 3);
  const retries = Math.max(1, Number.parseInt(getArgValue("--retries", "3") || "3", 10) || 3);
  const dryRun = hasFlag("--dry-run");
  const rewriteSnapshot = hasFlag("--rewrite-snapshot");
  const rewriteOnly = hasFlag("--rewrite-only");

  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  const pendingEntries = [];
  const uniqueKeys = new Map();

  for (const church of snapshot) {
    const key = parseLegacyMediaKey(church.headerImage);
    if (!key) continue;
    pendingEntries.push({
      slug: church.slug,
      key,
      sourceUrl: church.headerImage,
    });
    if (!uniqueKeys.has(key)) {
      uniqueKeys.set(key, church.headerImage);
    }
  }

  const queue = Array.from(uniqueKeys.entries()).map(([key, sourceUrl]) => ({ key, sourceUrl }));
  const selectedBase = queue.slice(startAt - 1);
  const selected = limit > 0 ? selectedBase.slice(0, limit) : selectedBase;

  console.log(JSON.stringify({
    snapshotPath: SNAPSHOT_PATH,
    totalSnapshotEntries: snapshot.length,
    totalLegacyMediaRefs: pendingEntries.length,
    uniqueKeys: queue.length,
    selected: selected.length,
    startAt,
    dryRun,
    rewriteSnapshot,
    rewriteOnly,
    concurrency,
    retries,
  }, null, 2));

  if (selected.length === 0) {
    return;
  }

  const results = await mapWithConcurrency(selected, concurrency, async ({ key, sourceUrl }, index) => {
    const mediaUrl = toMediaUrl(key);
    const ordinal = startAt + index;
    const label = `[${ordinal}/${queue.length}] ${key}`;

    if (dryRun) {
      console.log(`${label} dry-run -> ${mediaUrl}`);
      return { key, status: "dry-run", mediaUrl };
    }

    if (rewriteOnly) {
      console.log(`${label} rewrite-only -> ${mediaUrl}`);
      return { key, status: "rewritten", mediaUrl };
    }

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          throw new Error(`${label} download failed: ${response.status} ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || undefined;
        await uploadToR2({ key, buffer, contentType });
        console.log(`${label} uploaded -> ${mediaUrl}`);
        return { key, status: "uploaded", mediaUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= retries) {
          console.error(`${label} failed after ${attempt} attempts: ${message}`);
          return { key, status: "failed", mediaUrl, error: message };
        }
        console.warn(`${label} retry ${attempt}/${retries - 1}: ${message}`);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1000));
      }
    }
  });

  const failures = results.filter((result) => result?.status === "failed");
  const uploaded = results.filter((result) => result?.status === "uploaded");

  console.log(JSON.stringify({
    uploaded: uploaded.length,
    failed: failures.length,
    failureLogPath: failures.length > 0 ? FAILURE_LOG_PATH : null,
  }, null, 2));

  if (failures.length > 0) {
    await mkdir(resolve("tmp"), { recursive: true });
    await writeFile(FAILURE_LOG_PATH, `${JSON.stringify(failures, null, 2)}\n`);
  }

  if (rewriteSnapshot) {
    const uploadedUrls = new Map(
      results
        .filter((result) => result?.status === "uploaded" || result?.status === "dry-run" || result?.status === "rewritten")
        .map((result) => [result.key, result.mediaUrl]),
    );

    let changed = 0;
    for (const church of snapshot) {
      const key = parseLegacyMediaKey(church.headerImage);
      const replacement = key ? uploadedUrls.get(key) : null;
      if (!replacement) continue;
      church.headerImage = replacement;
      changed += 1;
    }

    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`rewrote snapshot headerImage URLs: ${changed}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
