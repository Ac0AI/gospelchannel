import { eq } from "drizzle-orm";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { USER_ROLE } from "@/lib/auth-roles";

export async function isAdminUser(userId?: string | null): Promise<boolean> {
  if (!userId || !hasDatabaseConfig()) {
    return false;
  }

  const rows = await getDb()
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  return rows[0]?.role === USER_ROLE.ADMIN;
}

export async function listAdminEmails(): Promise<string[]> {
  if (!hasDatabaseConfig()) {
    return [];
  }

  const rows = await getDb()
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.role, USER_ROLE.ADMIN));

  return rows
    .map((row) => row.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
}
