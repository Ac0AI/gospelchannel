/**
 * R2 mirror helper. The ONE place that knows how to fetch a foreign image
 * URL and mirror it to the project's R2 bucket (`church-assets`), returning
 * a `media.gospelchannel.com` permalink that survives the source URL
 * rotating.
 *
 * Why: Apify enrichment and Google Maps Place Photos store short-lived CDN
 * URLs (lh3.googleusercontent.com, streetviewpixels-pa.googleapis.com,
 * various site-builder hosts). They expire / rotate, producing the Ahrefs
 * broken-image findings. Mirroring at ingest (or via a nightly backfill)
 * makes the stored URL permanent.
 *
 * Callers: scripts/backfill-mirror-foreign-images.ts (nightly Node job).
 * Future: auto-enrichment write paths can call this directly so new
 * enrichments are protected from day 0.
 *
 * Upload path: spawn `npx wrangler r2 object put` (same pattern as
 * scripts/backfill-r2-media.mjs). Avoids introducing a separate S3
 * credential surface — wrangler already has the auth.
 *
 * Key structure: `mirrors/<host>/<sha1-of-url>.<ext>` — deterministic from
 * the source URL so re-running the backfill never re-uploads, and two
 * churches that scraped the same image share the same R2 object.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve as resolvePath } from "node:path";
import { randomUUID } from "node:crypto";

const MEDIA_BASE_URL =
  (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/+$/, "");

/** Returns true if `url` is already a media.gospelchannel.com permalink. */
export function isAlreadyMirrored(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).host.toLowerCase();
    return host === "media.gospelchannel.com" || host === new URL(MEDIA_BASE_URL).host.toLowerCase();
  } catch {
    return false;
  }
}

/** Strip non-ASCII-alphanum chars from a host for safe path use. */
function safeHost(url: string): string {
  try {
    return new URL(url).host.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
  } catch {
    return "unknown";
  }
}

/** Map Content-Type → extension. Conservative — defaults to .jpg on unknown. */
function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  const lc = ct.toLowerCase();
  if (lc.includes("png")) return "png";
  if (lc.includes("webp")) return "webp";
  if (lc.includes("gif")) return "gif";
  if (lc.includes("svg")) return "svg";
  if (lc.includes("avif")) return "avif";
  return "jpg";
}

/**
 * Deterministic R2 key for a source URL. Same URL → same key always.
 * Two churches with the same source image share one R2 object.
 */
export function r2KeyFor(sourceUrl: string, ext: string): string {
  const sha = createHash("sha1").update(sourceUrl).digest("hex");
  return `mirrors/${safeHost(sourceUrl)}/${sha}.${ext}`;
}

/** Run `wrangler r2 object put` for a buffer. Resolves on exit code 0. */
async function wranglerUpload(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const tempPath = resolvePath(tmpdir(), `gospel-mirror-${randomUUID()}`);
  await writeFile(tempPath, buffer);
  try {
    await new Promise<void>((res, rej) => {
      const child = spawn(
        "npx",
        [
          "wrangler",
          "r2",
          "object",
          "put",
          `church-assets/${key}`,
          "--remote",
          "--file",
          tempPath,
          "--content-type",
          contentType,
        ],
        { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], env: process.env },
      );
      let stderr = "";
      child.stderr.on("data", (c) => (stderr += c.toString()));
      child.on("error", rej);
      child.on("close", (code) => (code === 0 ? res() : rej(new Error(stderr || `wrangler exit ${code}`))));
    });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

/**
 * Fetch `sourceUrl`, upload to R2, return the media.gospelchannel.com URL.
 * Returns `null` if the source is unreachable / 4xx / too large.
 *
 * Idempotency: the R2 key is a sha1 of the source URL, so calling this
 * twice for the same URL is a no-op upload (R2 just overwrites with the
 * same bytes) and the same permalink is returned.
 */
export async function mirrorImageToR2(
  sourceUrl: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024; // 8 MB cap — these are church hero/logo, not video.
  const timeoutMs = opts.timeoutMs ?? 12_000;
  if (!sourceUrl.startsWith("http")) return null;
  if (isAlreadyMirrored(sourceUrl)) return sourceUrl;
  let res: Response;
  try {
    res = await fetch(sourceUrl, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = extFromContentType(contentType);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return null;
  const key = r2KeyFor(sourceUrl, ext);
  await wranglerUpload(key, buffer, contentType);
  return `${MEDIA_BASE_URL}/${key}`;
}

/**
 * Make sure the OS tmp dir we use for staging exists. Cheap to call
 * repeatedly; safe to skip if it does.
 */
export async function ensureTmpDir(): Promise<void> {
  await mkdir(tmpdir(), { recursive: true }).catch(() => {});
}
