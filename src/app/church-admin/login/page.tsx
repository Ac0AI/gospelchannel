import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChurchAdminLoginForm } from "@/components/church-admin/ChurchAdminLoginForm";
import { getServerUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Church Admin Login — Gospel Channel",
  robots: { index: false, follow: false },
};

type ChurchAdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSafeChurchAdminRedirect(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/church-admin";
  }

  try {
    const parsed = new URL(value, "https://gospelchannel.local");
    if (parsed.origin !== "https://gospelchannel.local") {
      return "/church-admin";
    }

    const isAllowedPath =
      parsed.pathname === "/church-admin" ||
      /^\/church\/[a-z0-9-]+\/(?:manage|embed)$/.test(parsed.pathname);

    if (!isAllowedPath) {
      return "/church-admin";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/church-admin";
  }
}

export default async function ChurchAdminLoginPage({ searchParams }: ChurchAdminLoginPageProps) {
  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);
  const params = (await searchParams) ?? {};
  const redirectParam = params.redirect;
  const errorParam = params.error;
  const redirectTo = getSafeChurchAdminRedirect(redirectParam);
  const initialError = typeof errorParam === "string" ? errorParam : "";

  if (user) {
    redirect(redirectTo);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linen px-4">
      <ChurchAdminLoginForm redirectTo={redirectTo} initialError={initialError} />
    </div>
  );
}
