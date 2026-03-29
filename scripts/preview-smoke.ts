import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
}

const envSource = readFileSync(join(ROOT_DIR, ".env.local"), "utf8");
const ADMIN_EMAIL = ((envSource.match(/^ADMIN_EMAILS=(.+)$/m)?.[1] || "").split(",")[0] || "").trim();
const ADMIN_PASSWORD = envSource.match(/^SEED_ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim() || "";
const BASE_URL = process.env.PREVIEW_BASE_URL || "https://preview.gospelchannel.com";
const TEST_CHURCH_SLUG = process.env.PREVIEW_SMOKE_CHURCH_SLUG || "wearechurch";
const sql = neon(DATABASE_URL);

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Missing ADMIN_EMAILS or SEED_ADMIN_PASSWORD in .env.local");
}

type ClaimResponse = {
  id: string;
  success: boolean;
  message?: string;
};

type DbClaimRow = {
  id: string;
  status: string;
  church_slug: string;
  email: string;
};

type DbMembershipRow = {
  id: string;
  status: string;
  church_slug: string;
  email: string;
  user_id: string | null;
};

class CookieJar {
  private readonly cookies = new Map<string, string>();

  setFromHeaders(headers: Headers) {
    const raw = headers.getSetCookie
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie") as string]
        : [];

    for (const cookie of raw) {
      const pair = cookie.split(";")[0]?.trim();
      if (!pair) continue;
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  toHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function getArgValue(flag: string): string | undefined {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1).trim();
  }

  const index = process.argv.findIndex((arg) => arg === flag);
  if (index >= 0) {
    return process.argv[index + 1]?.trim();
  }

  return undefined;
}

async function requestJson<T>(input: string, init: RequestInit): Promise<{ response: Response; body: T }> {
  const response = await fetch(input, init);
  const body = (await response.json().catch(() => null)) as T;
  return { response, body };
}

async function queryRows<T extends Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  return await (sql.query(query, params) as unknown as Promise<T[]>);
}

async function main() {
  const keepArtifacts = process.argv.includes("--keep");
  const claimEmail = getArgValue("--email") || `claimtest+${Date.now()}@ac0.ai`;
  const claimName = getArgValue("--name") || "Claim Smoke Test";
  const claimRole = getArgValue("--role") || "Owner";
  const jar = new CookieJar();
  const adminReferer = `${BASE_URL}/admin/login`;
  const churchAdminReferer = `${BASE_URL}/church-admin/login`;

  console.log(`[preview-smoke] base=${BASE_URL}`);
  console.log(`[preview-smoke] church=${TEST_CHURCH_SLUG}`);
  console.log(`[preview-smoke] email=${claimEmail}`);

  const claim = await requestJson<ClaimResponse>(`${BASE_URL}/api/church/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: BASE_URL,
      referer: adminReferer,
    },
    body: JSON.stringify({
      churchSlug: TEST_CHURCH_SLUG,
      name: claimName,
      role: claimRole,
      email: claimEmail,
      message: "Automated preview smoke test",
    }),
  });

  if (!claim.response.ok || !claim.body?.id) {
    throw new Error(`[preview-smoke] claim failed: ${claim.response.status} ${JSON.stringify(claim.body)}`);
  }

  console.log(`[preview-smoke] claim created ${claim.body.id}`);

  const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: BASE_URL,
      referer: adminReferer,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  jar.setFromHeaders(signIn.headers);
  if (!signIn.ok) {
    throw new Error(`[preview-smoke] admin sign-in failed: ${signIn.status} ${await signIn.text()}`);
  }

  console.log("[preview-smoke] admin sign-in ok");

  const verify = await requestJson<{ success?: boolean; error?: string }>(`${BASE_URL}/api/admin/claims/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: BASE_URL,
      referer: adminReferer,
      cookie: jar.toHeader(),
    },
    body: JSON.stringify({ id: claim.body.id }),
  });

  if (!verify.response.ok) {
    throw new Error(`[preview-smoke] verify failed: ${verify.response.status} ${JSON.stringify(verify.body)}`);
  }

  console.log("[preview-smoke] admin verify returned success");

  const [claimRows, membershipRows] = await Promise.all([
    queryRows<DbClaimRow>(
      `select id, status, church_slug, email from "church_claims" where id = $1`,
      [claim.body.id],
    ),
    queryRows<DbMembershipRow>(
      `select id, status, church_slug, email, user_id from "church_memberships" where email = $1 order by created_at desc limit 1`,
      [claimEmail],
    ),
  ]);

  const dbClaim = claimRows[0] || null;
  const dbMembership = membershipRows[0] || null;

  console.log(`[preview-smoke] db claim status=${dbClaim?.status || "missing"}`);
  console.log(`[preview-smoke] db membership=${dbMembership ? "present" : "missing"}`);

  const access = await requestJson<{ success?: boolean; error?: string }>(`${BASE_URL}/api/church-admin/access-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: BASE_URL,
      referer: churchAdminReferer,
    },
    body: JSON.stringify({ email: claimEmail }),
  });

  console.log(`[preview-smoke] church-admin access ${access.response.status}`);

  let otpStatus: number | null = null;
  if (access.response.ok) {
    const otp = await requestJson<{ error?: { message?: string } | string }>(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: BASE_URL,
        referer: churchAdminReferer,
      },
      body: JSON.stringify({
        email: claimEmail,
        type: "sign-in",
      }),
    });
    otpStatus = otp.response.status;
    console.log(`[preview-smoke] otp send ${otp.response.status}`);
  }

  const summary = {
    baseUrl: BASE_URL,
    churchSlug: TEST_CHURCH_SLUG,
    claimId: claim.body.id,
    claimEmail,
    dbClaimStatus: dbClaim?.status ?? null,
    membershipCreated: Boolean(dbMembership),
    churchAdminAccessStatus: access.response.status,
    otpSendStatus: otpStatus,
    keepArtifacts,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!keepArtifacts && dbClaim?.status !== "verified") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
