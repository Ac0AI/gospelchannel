import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { USER_ROLE } from "../src/lib/auth-roles";
import { ensureAuthUser, findAuthUserByEmail } from "../src/lib/auth/server";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

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

async function main() {
  loadLocalEnv(ROOT_DIR);

  const adminEmails = (
    getArgValue("--emails")
    || process.env.SEED_ADMIN_EMAILS
    || ""
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    throw new Error("Missing admin emails. Set SEED_ADMIN_EMAILS or pass --emails=email1,email2");
  }

  const password = getArgValue("--password")
    || process.env.SEED_ADMIN_PASSWORD
    || process.env.ADMIN_SEED_PASSWORD;

  const db = getDb();
  const defaultName = getArgValue("--name") || "Gospel Channel Admin";

  for (const email of adminEmails) {
    const existing = await findAuthUserByEmail(email);
    if (!existing && !password) {
      throw new Error(`Missing seed password for new admin user ${email}. Set SEED_ADMIN_PASSWORD or pass --password=...`);
    }

    const user = await ensureAuthUser({
      email,
      name: defaultName,
      emailVerified: true,
      password,
      role: USER_ROLE.ADMIN,
    });

    await db
      .update(schema.user)
      .set({
        role: USER_ROLE.ADMIN,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, user.id));

    console.log(`[db:seed] ensured admin user ${email}`);
  }
}

main().catch((error) => {
  console.error("[db:seed] failed", error);
  process.exit(1);
});
