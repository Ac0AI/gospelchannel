import { NextRequest, NextResponse } from "next/server";
import { hasServiceConfig, createAdminClient } from "@/lib/neon-client";

const SITE_URL = "https://gospelchannel.com";
const BATCH_SIZE = 200;
const CHECKPOINT_KEY = "indexing_push_checkpoint";

function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return true;
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const query = request.nextUrl.searchParams.get("secret");
  return bearer === configuredSecret || query === configuredSecret;
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

async function buildUrlList(db: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const urls: string[] = [
    SITE_URL,
    `${SITE_URL}/church`,
    `${SITE_URL}/about`,
    `${SITE_URL}/prayerwall`,
  ];

  const networks = ["hillsong", "c3", "icf", "vineyard", "sos-church", "calvary-chapel", "every-nation", "pingstkyrkan", "svenska-kyrkan"];
  for (const n of networks) urls.push(`${SITE_URL}/network/${n}`);

  const { data: churches } = await db.from<Church[]>("churches")
    .select("slug")
    .eq("status", "approved")
    .order("slug", { ascending: true });

  if (churches) {
    for (const c of churches) {
      urls.push(`${SITE_URL}/church/${c.slug}`);
    }
  }

  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`);
    if (res.ok) {
      const xml = await res.text();
      const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
      const seen = new Set(urls);
      for (const url of sitemapUrls) {
        if (!seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
      }
    }
  } catch {
    // Sitemap fetch failed, continue with DB URLs
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

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const db = createAdminClient();
    const allUrls = await buildUrlList(db);

    // Load checkpoint
    const { data: kvRows } = await db.from<KvRow[]>("app_kv")
      .select("key,value")
      .eq("key", CHECKPOINT_KEY);
    let pushed = kvRows?.[0]?.value?.pushed ?? 0;

    // Reset if we've pushed all URLs
    if (pushed >= allUrls.length) pushed = 0;

    const batch = allUrls.slice(pushed, pushed + BATCH_SIZE);
    if (batch.length === 0) {
      return NextResponse.json({ ok: true, message: "No URLs to push", pushed, total: allUrls.length });
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
