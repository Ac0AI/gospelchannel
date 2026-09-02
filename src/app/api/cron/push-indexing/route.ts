import { NextRequest, NextResponse } from "next/server";
import { hasServiceConfig, createAdminClient } from "@/lib/neon-client";

const SITE_URL = "https://gospelchannel.com";
const BATCH_SIZE = 200;
const CHECKPOINT_KEY = "indexing_push_checkpoint";
const INDEXNOW_MARKER_KEY = "indexnow_last_push";

// IndexNow (Bing, Yandex, Seznam, Naver). Key file lives at
// /public/<key>.txt and is already served at the domain root. Override via
// INDEXNOW_KEY only if the hosted file is rotated to match.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "da4a97e480614b03ad37185dfd1d7785";
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return false;
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  return bearer === configuredSecret;
}

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  if (!email || !rawKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = base64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const pemBody = rawKey
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const input = new TextEncoder().encode(`${header}.${claimSet}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, input);
  const sig = base64url(signature);
  const jwt = `${header}.${claimSet}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Google auth failed: " + JSON.stringify(data));
  return data.access_token;
}

type Church = { slug: string; priority: number };
type KvRow = { key: string; value: { pushed: number; total?: number } };
type IndexNowMarkerRow = { key: string; value: { lastPush?: string } };

// /sitemap.xml is now a <sitemapindex> pointing at /sitemap-chunk/N.xml.
// Walk the tree so we end up with page URLs, not chunk URLs. Depth cap is a
// safety net against accidental recursion if the format changes again.
async function fetchSitemapUrls(rootUrl: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  try {
    const res = await fetch(rootUrl);
    if (!res.ok) return [];
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (xml.includes("<sitemapindex")) {
      const nested = await Promise.all(locs.map((url) => fetchSitemapUrls(url, depth + 1)));
      return nested.flat();
    }
    return locs;
  } catch {
    return [];
  }
}

function coreAndNetworkUrls(): string[] {
  const core: string[] = [
    SITE_URL,
    `${SITE_URL}/church`,
    `${SITE_URL}/about`,
  ];

  const networks = ["hillsong", "c3", "icf", "vineyard", "sos-church", "calvary-chapel", "every-nation", "pingstkyrkan", "svenska-kyrkan"];
  for (const n of networks) core.push(`${SITE_URL}/network/${n}`);

  return core;
}

// Google's ordered walk: core -> hubs -> all approved churches -> remaining
// sitemap URLs. The 200/day Indexing API quota is precious, so facet hub pages
// (/church/{city,country,style,denomination}/...) — which carry the SEO weight
// but sit last in the sitemap behind ~73k church pages — are pulled ahead so
// the quota serves hubs first. Takes the pre-fetched sitemap URL list.
async function buildUrlList(
  db: ReturnType<typeof createAdminClient>,
  sitemapUrls: string[],
): Promise<string[]> {
  const core = coreAndNetworkUrls();

  const HUB_RE = /\/church\/(?:city|country|style|denomination)\//;
  const hubUrls: string[] = [];
  const otherSitemapUrls: string[] = [];
  for (const url of sitemapUrls) {
    (HUB_RE.test(url) ? hubUrls : otherSitemapUrls).push(url);
  }

  const { data: churches } = await db.from<Church[]>("churches")
    .select("slug")
    .eq("status", "approved")
    .order("slug", { ascending: true });
  const churchUrls = (churches ?? []).map((c) => `${SITE_URL}/church/${c.slug}`);

  // Order: core -> hubs -> churches -> remaining sitemap URLs (prayer etc.).
  // Dedupe while preserving first-seen order.
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of [...core, ...hubUrls, ...churchUrls, ...otherSitemapUrls]) {
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

async function pushUrl(accessToken: string, url: string): Promise<"OK" | "QUOTA" | string> {
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  if (res.status === 429) return "QUOTA";
  if (!res.ok) return `ERROR ${res.status}: ${(await res.text()).slice(0, 100)}`;
  return "OK";
}

// Submit URLs to IndexNow (Bing/Yandex/Seznam/Naver) in 9,000-URL chunks (the
// API max is 10 000). Normally receives only the changed set (~150-200 URLs a
// day); the chunking survives as a guard for bulk days. Returns per-chunk
// HTTP statuses (2xx = accepted) plus the accepted URL count so the cron
// response surfaces exactly how many Bing took.
async function submitToIndexNow(urls: string[]): Promise<{ accepted: number; total: number; chunks: string[] }> {
  const CHUNK = 9000;
  const chunks: string[] = [];
  let accepted = 0;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const slice = urls.slice(i, i + CHUNK);
    try {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "gospelchannel.com",
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: slice,
        }),
      });
      chunks.push(`${res.status}`);
      if (res.ok) accepted += slice.length;
    } catch (err) {
      chunks.push(`ERROR ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return { accepted, total: urls.length, chunks };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const db = createAdminClient();
    const sitemapUrls = await fetchSitemapUrls(`${SITE_URL}/sitemap.xml`);
    const allUrls = await buildUrlList(db, sitemapUrls);

    // IndexNow (Bing/Yandex/…) is a change notification, not a crawl feed:
    // Bing Webmaster Tools flags recurring full-catalog dumps as "batch mode"
    // and deprioritizes them. Submit only what changed since the last
    // successful push — approved churches touched after the marker, plus the
    // core and network pages the daily data refresh rewrites. Done first so
    // Bing gets the changes even if Google auth/quota fails below.
    const indexNowRunStart = new Date().toISOString();
    const { data: markerRows } = await db.from<IndexNowMarkerRow[]>("app_kv")
      .select("key,value")
      .eq("key", INDEXNOW_MARKER_KEY);
    const lastPush = markerRows?.[0]?.value?.lastPush;

    let indexNowUrls: string[];
    if (lastPush) {
      const { data: changed } = await db.from<Church[]>("churches")
        .select("slug")
        .eq("status", "approved")
        .gte("updated_at", lastPush);
      const changedUrls = (changed ?? []).map((c) => `${SITE_URL}/church/${c.slug}`);
      indexNowUrls = [...new Set([...coreAndNetworkUrls(), ...changedUrls])];
    } else {
      // First run in changed-only mode: months of daily full dumps mean the
      // catalog is already announced — start the marker from the core pages
      // instead of re-dumping 70k+ URLs.
      indexNowUrls = coreAndNetworkUrls();
    }
    const indexNowStatus = await submitToIndexNow(indexNowUrls);
    // Advance the marker only when every chunk was accepted; a failed run
    // resubmits the same (small) set next time instead of losing it.
    if (indexNowStatus.accepted === indexNowStatus.total) {
      await db.from("app_kv")
        .upsert({
          key: INDEXNOW_MARKER_KEY,
          value: JSON.stringify({ lastPush: indexNowRunStart }),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
    }

    // Load checkpoint (Google's 200/day walk)
    const { data: kvRows } = await db.from<KvRow[]>("app_kv")
      .select("key,value")
      .eq("key", CHECKPOINT_KEY);
    let pushed = kvRows?.[0]?.value?.pushed ?? 0;

    // Reset if we've pushed all URLs
    if (pushed >= allUrls.length) pushed = 0;

    const batch = allUrls.slice(pushed, pushed + BATCH_SIZE);
    if (batch.length === 0) {
      return NextResponse.json({ ok: true, message: "No URLs to push", pushed, total: allUrls.length, indexNow: indexNowStatus });
    }

    const accessToken = await getAccessToken();
    let success = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const url of batch) {
      const result = await pushUrl(accessToken, url);
      if (result === "QUOTA") break;
      if (result === "OK") {
        success++;
      } else {
        errors++;
        if (errorDetails.length < 5) errorDetails.push(`${url}: ${result}`);
      }
    }

    pushed += success;

    // Save checkpoint
    await db.from("app_kv")
      .upsert({
        key: CHECKPOINT_KEY,
        value: JSON.stringify({ pushed, total: allUrls.length, lastRun: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    return NextResponse.json({
      ok: true,
      pushed: success,
      errors,
      indexNow: {
        submitted: indexNowStatus.accepted,
        total: indexNowStatus.total,
        chunks: indexNowStatus.chunks,
      },
      totalPushed: pushed,
      totalUrls: allUrls.length,
      progress: `${((pushed / allUrls.length) * 100).toFixed(1)}%`,
      ...(errorDetails.length > 0 ? { errorDetails } : {}),
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
