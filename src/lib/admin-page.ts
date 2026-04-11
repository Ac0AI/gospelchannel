import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin-users";
import { getServerUser } from "@/lib/auth/server";

function buildAdminLoginHref(redirectTo: string): string {
  const params = new URLSearchParams({ redirect: redirectTo });
  return `/admin/login?${params.toString()}`;
}

export async function requireAdminPageAccess(redirectTo: string) {
  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);

  if (!user || !(await isAdminUser(user.id))) {
    redirect(buildAdminLoginHref(redirectTo));
  }

  return user;
}

export async function redirectAdminIfSignedIn() {
  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);

  if (user && await isAdminUser(user.id)) {
    redirect("/admin");
  }

  return user;
}
