import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { verifyChurchClaim } from "../src/lib/church-community";
import { neon } from "@neondatabase/serverless";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");
loadLocalEnv(ROOT_DIR);

const claimId = process.argv[2];
if (!claimId) {
  console.error("Usage: tsx scripts/debug-claim-verify.ts <claim-id>");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
}

const sql = neon(databaseUrl);

type ClaimRow = {
  id: string;
  status: string;
  church_slug: string;
  email: string;
};

type MembershipRow = {
  id: string;
  church_slug: string;
  email: string;
  user_id: string | null;
  status: string;
  claim_id: string | null;
};

async function queryRows<T extends Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  return await (sql.query(query, params) as unknown as Promise<T[]>);
}

async function main() {
  console.log(`[debug-claim-verify] claim=${claimId}`);

  try {
    const result = await verifyChurchClaim(claimId);
    console.log("[debug-claim-verify] verifyChurchClaim result");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("[debug-claim-verify] verifyChurchClaim threw");
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  }

  const [claimRows, membershipRows] = await Promise.all([
    queryRows<ClaimRow>(`select id, status, church_slug, email from "church_claims" where id = $1`, [claimId]),
    queryRows<MembershipRow>(`select id, church_slug, email, user_id, status, claim_id from "church_memberships" where claim_id = $1`, [claimId]),
  ]);

  console.log("[debug-claim-verify] db rows");
  console.log(JSON.stringify({ claimRows, membershipRows }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
