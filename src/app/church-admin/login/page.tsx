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

export default async function ChurchAdminLoginPage({ searchParams }: ChurchAdminLoginPageProps) {
  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);
  const params = (await searchParams) ?? {};
  const redirectParam = params.redirect;
  const errorParam = params.error;
  const redirectTo =
    typeof redirectParam === "string" && redirectParam.startsWith("/")
      ? redirectParam
      : "/church-admin";
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
