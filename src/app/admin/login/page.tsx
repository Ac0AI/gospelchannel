import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = (await searchParams) ?? {};
  const redirectParam = params.redirect;
  const redirectTo =
    typeof redirectParam === "string" && redirectParam.startsWith("/admin")
      ? redirectParam
      : "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-linen px-4">
      <AdminLoginForm redirectTo={redirectTo} />
    </div>
  );
}
