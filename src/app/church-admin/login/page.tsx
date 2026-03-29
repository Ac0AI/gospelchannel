import { ChurchAdminLoginForm } from "@/components/church-admin/ChurchAdminLoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Church Admin Login — Gospel Channel",
  robots: { index: false, follow: false },
};

type ChurchAdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChurchAdminLoginPage({ searchParams }: ChurchAdminLoginPageProps) {
  const params = (await searchParams) ?? {};
  const redirectParam = params.redirect;
  const redirectTo = typeof redirectParam === "string" ? redirectParam : "/church-admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-linen px-4">
      <ChurchAdminLoginForm redirectTo={redirectTo} />
    </div>
  );
}
