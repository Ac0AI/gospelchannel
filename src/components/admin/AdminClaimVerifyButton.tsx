"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postAdminAction } from "@/lib/admin-client";

export function AdminClaimVerifyButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");

    try {
      await postAdminAction("/api/admin/claims/verify", { id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify claim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "..." : "Verify + grant access"}
      </button>
      {error ? <span className="text-xs font-semibold text-red-700">{error}</span> : null}
    </div>
  );
}
