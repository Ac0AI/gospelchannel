"use client";

import { useRouter } from "next/navigation";
import { signOutCurrentUser } from "@/lib/auth/client";

export function AdminLogout({ className = "" }: { className?: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOutCurrentUser();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-warm-brown transition hover:bg-blush-light ${className}`.trim()}
    >
      Sign Out
    </button>
  );
}
